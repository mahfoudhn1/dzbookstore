from decimal import Decimal, InvalidOperation

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import BookstoreProfile
from accounts.serializers import BookstoreProfileSerializer
from .distance import haversine_expression
from .models import Wilaya, Commune
from .serializers import WilayaSerializer, CommuneSerializer


class WilayaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Wilaya.objects.all().prefetch_related('communes', 'bookstores')
    serializer_class = WilayaSerializer
    pagination_class = None


class CommuneViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Commune.objects.all().select_related('wilaya')
    serializer_class = CommuneSerializer
    pagination_class = None
    filterset_fields = ['wilaya_id']


def _coordinate(value):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return float(number)


@api_view(['GET'])
@permission_classes([AllowAny])
def nearby_bookstores_view(request):
    """Bookstores within a radius, with distance calculations.

    Uses store coordinates only.  Individual sellers' home addresses are never
    part of this endpoint (their exact location is opt-in for offer distance
    sorting and is not exposed as an address).
    """
    latitude = _coordinate(request.query_params.get('lat') or request.query_params.get('latitude'))
    longitude = _coordinate(request.query_params.get('lng') or request.query_params.get('longitude'))
    if latitude is None or longitude is None:
        return Response({'error': 'Les paramètres lat et lng sont requis.'}, status=400)

    try:
        radius = float(request.query_params.get('radius_km', 50))
    except (TypeError, ValueError):
        radius = 50.0
    radius = max(0.5, min(radius, 2000))

    try:
        limit = max(1, min(int(request.query_params.get('limit', 30)), 100))
    except (TypeError, ValueError):
        limit = 30

    qs = BookstoreProfile.objects.select_related('wilaya', 'commune').filter(
        latitude__isnull=False, longitude__isnull=False
    ).annotate(
        distance_km=haversine_expression('latitude', 'longitude', latitude, longitude)
    ).filter(distance_km__lte=radius)

    wilaya_id = request.query_params.get('wilaya_id')
    if wilaya_id:
        qs = qs.filter(Q(wilaya_id=wilaya_id))

    stores = qs.order_by('distance_km')[:limit]
    data = []
    for store in stores:
        payload = BookstoreProfileSerializer(store).data
        payload['distance_km'] = round(store.distance_km, 2)
        data.append(payload)

    return Response({
        'center': {'lat': latitude, 'lng': longitude},
        'radius_km': radius,
        'count': len(data),
        'results': data,
    })
