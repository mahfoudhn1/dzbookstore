from rest_framework import serializers, viewsets
from .models import Wilaya, Commune

class CommuneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commune
        fields = ['id', 'name_ar', 'name_fr', 'postal_code', 'wilaya_id']

class WilayaSerializer(serializers.ModelSerializer):
    communes = CommuneSerializer(many=True, read_only=True)
    bookstores_count = serializers.IntegerField(source='bookstores.count', read_only=True)
    name_en = serializers.SerializerMethodField()

    class Meta:
        model = Wilaya
        fields = ['id', 'code', 'name_ar', 'name_fr', 'name_en', 'communes', 'bookstores_count']

    def get_name_en(self, obj):
        if obj.code == '16':
            return 'Algiers'
        return obj.name_fr

class WilayaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Wilaya.objects.all().prefetch_related('communes', 'bookstores')
    serializer_class = WilayaSerializer
    pagination_class = None

class CommuneViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Commune.objects.all().select_related('wilaya')
    serializer_class = CommuneSerializer
    pagination_class = None
    filterset_fields = ['wilaya_id']
