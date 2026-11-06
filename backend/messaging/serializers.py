from rest_framework import serializers

from accounts.models import BookstoreProfile, IndividualSellerProfile
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_name', 'body',
            'read_at', 'is_hidden', 'is_reported', 'report_reason', 'created_at',
        ]
        read_only_fields = ['sender', 'read_at', 'is_reported', 'report_reason', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username


class ConversationSerializer(serializers.ModelSerializer):
    buyer_name = serializers.SerializerMethodField()
    bookstore_name = serializers.CharField(source='bookstore.store_name', read_only=True)
    individual_seller_name = serializers.CharField(
        source='individual_seller.display_name', read_only=True
    )
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'buyer', 'buyer_name', 'bookstore', 'bookstore_name',
            'individual_seller', 'individual_seller_name',
            'suborder', 'subject', 'last_message_at',
            'last_message', 'unread_count', 'created_at',
        ]
        read_only_fields = ['buyer', 'last_message_at', 'created_at']

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.username

    def get_last_message(self, obj):
        message = obj.messages.order_by('-created_at').first()
        return MessageSerializer(message).data if message else None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return 0
        return obj.messages.filter(read_at__isnull=True).exclude(sender=user).count()


class ConversationCreateSerializer(serializers.Serializer):
    bookstore_id = serializers.PrimaryKeyRelatedField(
        queryset=BookstoreProfile.objects.all(), required=False, allow_null=True, source='bookstore'
    )
    individual_seller_id = serializers.PrimaryKeyRelatedField(
        queryset=IndividualSellerProfile.objects.all(), required=False, allow_null=True,
        source='individual_seller',
    )
    suborder_id = serializers.IntegerField(required=False, allow_null=True)
    subject = serializers.CharField(required=False, allow_blank=True, max_length=200)
    body = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        has_seller = attrs.get('bookstore') or attrs.get('individual_seller') or attrs.get('suborder_id')
        if not has_seller:
            raise serializers.ValidationError(
                'Indiquez bookstore_id, individual_seller_id ou suborder_id.'
            )
        return attrs
