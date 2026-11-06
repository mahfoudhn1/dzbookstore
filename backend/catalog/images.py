"""Mirror remote book covers into local media storage.

Provider APIs (Open Library, Google Books, …) return hotlinked cover URLs. If
the provider or the original host goes down, those covers disappear from the
storefront. When a book is imported we download the image once, de-duplicate it
by content hash, and store it under ``MEDIA_ROOT/covers`` so the catalogue keeps
working offline.
"""
from __future__ import annotations

import hashlib
import ipaddress
import logging
import os
import socket
import uuid
from io import BytesIO
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

MAX_COVER_BYTES = 10 * 1024 * 1024  # 10 MB, same limit as manual uploads
REQUEST_TIMEOUT = 8
MAX_REDIRECTS = 3
REQUEST_HEADERS = {
    'User-Agent': 'BookstoreDZ/1.0 (+https://bookstoredz.dz; cover mirror)',
    'Accept': 'image/*',
}
FORMAT_EXTENSIONS = {
    'JPEG': '.jpg',
    'PNG': '.png',
    'WEBP': '.webp',
    'GIF': '.gif',
}


def is_local_cover(value):
    """True when the value already points at our own media storage."""
    if not value:
        return False
    media_path = f"{settings.MEDIA_URL.rstrip('/')}/"
    if value.startswith(media_path):
        return True
    base = (getattr(settings, 'MEDIA_PUBLIC_BASE_URL', '') or '').rstrip('/')
    return bool(base) and value.startswith(f'{base}{media_path}')


def _is_public_http_url(url):
    """Reject non-HTTP schemes and hosts that resolve to private addresses.

    Cover URLs can come from user payloads, so downloading them server-side
    must not become an SSRF bridge to localhost or the internal network.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        return False
    if not parsed.hostname:
        return False
    if parsed.hostname in ('localhost', 'localhost.localdomain'):
        return False
    try:
        port = parsed.port or (443 if parsed.scheme == 'https' else 80)
        addresses = {
            info[4][0] for info in socket.getaddrinfo(parsed.hostname, port)
        }
    except (socket.gaierror, ValueError, OSError):
        return False
    if not addresses:
        return False
    for address in addresses:
        try:
            if not ipaddress.ip_address(address).is_global:
                return False
        except ValueError:
            return False
    return True


def _download(url):
    """Download ``url`` without following redirects to unsafe hosts."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        if not _is_public_http_url(current):
            raise ValueError('URL d’image non autorisée.')
        response = requests.get(
            current,
            stream=True,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False,
            headers=REQUEST_HEADERS,
        )
        if response.status_code in (301, 302, 303, 307, 308):
            location = response.headers.get('Location')
            response.close()
            if not location:
                raise ValueError('Redirection sans destination.')
            current = urljoin(current, location)
            continue
        response.raise_for_status()
        return response
    raise ValueError('Trop de redirections.')


def _public_media_url(filename):
    base = (getattr(settings, 'MEDIA_PUBLIC_BASE_URL', '') or '').rstrip('/')
    path = f"{settings.MEDIA_URL.rstrip('/')}/covers/{filename}"
    return f'{base}{path}' if base else path


def mirror_cover_image(url):
    """Return a local URL for ``url``, or the original value on any failure.

    The function is intentionally best-effort: a cover that cannot be mirrored
    must never block catalog writes. Local URLs are returned untouched.
    """
    url = (url or '').strip()
    if not url or is_local_cover(url):
        return url
    if not getattr(settings, 'MIRROR_REMOTE_COVERS', True):
        return url
    if not url.lower().startswith(('http://', 'https://')):
        return url

    try:
        response = _download(url)
        try:
            data = bytearray()
            for chunk in response.iter_content(chunk_size=64 * 1024):
                if not chunk:
                    continue
                data.extend(chunk)
                if len(data) > MAX_COVER_BYTES:
                    raise ValueError('Image trop volumineuse.')
        finally:
            response.close()

        try:
            with Image.open(BytesIO(bytes(data))) as image:
                image_format = (image.format or '').upper()
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError):
            raise ValueError('Le fichier téléchargé n’est pas une image valide.')

        extension = FORMAT_EXTENSIONS.get(image_format)
        if extension is None:
            raise ValueError(f'Format d’image non supporté ({image_format}).')

        digest = hashlib.sha256(bytes(data)).hexdigest()
        filename = f'{digest}{extension}'
        covers_dir = os.path.join(settings.MEDIA_ROOT, 'covers')
        os.makedirs(covers_dir, exist_ok=True)
        destination = os.path.join(covers_dir, filename)

        if not os.path.exists(destination):
            temporary = f'{destination}.{uuid.uuid4().hex}.part'
            with open(temporary, 'wb') as handle:
                handle.write(data)
            os.replace(temporary, destination)

        return _public_media_url(filename)
    except Exception as exc:  # noqa: BLE001 - never block a catalog write
        logger.warning('Could not mirror cover image %s: %s', url, exc)
        return url
