import os
import uuid
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_image_view(request):
    upload_file = request.FILES.get('image') or request.FILES.get('file')
    if not upload_file:
        return Response({'error': 'Aucun fichier image fourni.'}, status=status.HTTP_400_BAD_REQUEST)

    if upload_file.size > MAX_UPLOAD_SIZE:
        return Response(
            {'error': 'La taille du fichier dépasse la limite maximale autorisée (10 Mo).'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    _name, ext = os.path.splitext(upload_file.name)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return Response(
            {'error': f'Format de fichier non supporté ({ext}). Formats acceptés : JPG, PNG, WEBP, GIF.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    covers_dir = os.path.join(settings.MEDIA_ROOT, 'covers')
    os.makedirs(covers_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(covers_dir, filename)

    try:
        with open(dest_path, 'wb+') as destination:
            for chunk in upload_file.chunks():
                destination.write(chunk)
    except Exception as exc:
        return Response(
            {'error': f"Erreur lors de l'enregistrement de l'image : {exc}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    relative_url = f"/media/covers/{filename}"
    base = (getattr(settings, 'MEDIA_PUBLIC_BASE_URL', '') or '').rstrip('/')
    absolute_url = f"{base}{relative_url}" if base else request.build_absolute_uri(relative_url)

    return Response({
        'success': True,
        'url': absolute_url,
        'relative_url': relative_url,
        'filename': filename,
    }, status=status.HTTP_201_CREATED)
