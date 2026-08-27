from secrets import token_hex
from django.db import models


class InventoryCategory(models.Model):
    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='inventory_categories', db_index=True,
    )
    name       = models.CharField(max_length=100, verbose_name='Nom')
    icon       = models.CharField(max_length=40, default='bi-box-seam', verbose_name='Icône (classe Bootstrap Icons)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Catégorie de stock'
        verbose_name_plural = 'Catégories de stock'
        ordering = ['name']
        unique_together = [['hotel', 'name']]

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    class Unit(models.TextChoices):
        PIECE = 'piece', 'Pièce'
        KG    = 'kg',    'Kilogramme'
        L     = 'l',     'Litre'
        PACK  = 'pack',  'Paquet'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='inventory_items', db_index=True,
    )
    name              = models.CharField(max_length=150, verbose_name='Nom')
    category          = models.ForeignKey(InventoryCategory, on_delete=models.PROTECT,
                                          null=True, related_name='items', verbose_name='Catégorie')
    unit              = models.CharField(max_length=10, choices=Unit.choices, default=Unit.PIECE)
    quantity_on_hand  = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Quantité en stock')
    reorder_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Seuil d'alerte")
    unit_cost         = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Coût unitaire (FCFA)')
    notes             = models.TextField(blank=True)
    is_active         = models.BooleanField(default=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Article en stock'
        verbose_name_plural = 'Articles en stock'
        ordering = ['category__name', 'name']

    @property
    def is_low_stock(self):
        return self.quantity_on_hand <= self.reorder_threshold

    def __str__(self):
        return f'{self.name} ({self.quantity_on_hand} {self.get_unit_display()})'


class InventoryMovement(models.Model):
    class MovementType(models.TextChoices):
        IN         = 'in',         'Entrée (achat/réassort)'
        OUT        = 'out',        'Sortie (consommation)'
        ADJUSTMENT = 'adjustment', 'Ajustement (inventaire)'
        LOSS       = 'loss',       'Perte / casse'

    hotel      = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='inventory_movements', db_index=True,
    )
    reference     = models.CharField(max_length=20, unique=True, editable=False)
    item          = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=12, choices=MovementType.choices)
    quantity      = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Quantité')
    room          = models.ForeignKey('rooms.Room', on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='inventory_movements', verbose_name='Chambre (minibar)')
    reason        = models.CharField(max_length=255, blank=True)
    created_by    = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='inventory_movements')
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mouvement de stock'
        verbose_name_plural = 'Mouvements de stock'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.item_id:
            self.hotel_id = self.item.hotel_id
        if not self.reference:
            self.reference = 'MVT' + token_hex(4).upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.reference} — {self.item.name} ({self.get_movement_type_display()}: {self.quantity})'
