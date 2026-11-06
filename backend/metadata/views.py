from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsCatalogEditorOrDemo
from catalog.serializers import EditionSerializer, WorkDetailSerializer
from .services import import_record, lookup_isbn, provider_catalog, search_metadata

FIELD_CHOICES = {'any', 'title', 'author', 'isbn', 'publisher'}


@api_view(['GET'])
@permission_classes([AllowAny])
def metadata_search_view(request):
    """Normalised search across the local catalog and external providers."""
    query = (request.query_params.get('q') or request.query_params.get('query') or '').strip()
    if not query:
        return Response({'error': 'Le paramètre q est requis.'}, status=status.HTTP_400_BAD_REQUEST)

    field = request.query_params.get('field', 'any')
    if field not in FIELD_CHOICES:
        field = 'any'

    include_external = request.query_params.get('include_external', 'true').lower() not in (
        '0', 'false', 'no'
    )
    try:
        limit = max(1, min(int(request.query_params.get('limit', 20)), 40))
    except (TypeError, ValueError):
        limit = 20

    return Response(search_metadata(
        query, field=field, include_external=include_external, limit=limit
    ))


@api_view(['GET'])
@permission_classes([AllowAny])
def metadata_isbn_view(request):
    isbn = request.query_params.get('isbn') or request.query_params.get('q')
    if not isbn:
        return Response({'error': 'Le paramètre isbn est requis.'}, status=400)
    return Response(lookup_isbn(isbn))


@api_view(['POST'])
@permission_classes([IsCatalogEditorOrDemo])
def metadata_import_view(request):
    """Import a provider result (or manual payload) into the central catalog."""
    provider = request.data.get('provider')
    identifier = request.data.get('identifier') or request.data.get('provider_id')
    payload = request.data.get('record') or request.data.get('metadata')

    if not payload and not (provider and identifier):
        return Response(
            {'error': 'Fournissez soit un enregistrement, soit provider + identifier.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = import_record(provider=provider, identifier=identifier, payload=payload)
    except LookupError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    work = result['work']
    edition = result['edition']
    return Response({
        'created_work': result['created_work'],
        'created_edition': result['created_edition'],
        'already_imported': result['existing'],
        'work': WorkDetailSerializer(work, context={'request': request}).data,
        'edition': EditionSerializer(edition, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED if not result['existing'] else status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def metadata_sources_view(request):
    """Expose provider attribution/usage info to the storefront."""
    return Response({'providers': provider_catalog()})
