from django.db import models

class Wilaya(models.Model):
    id = models.IntegerField(primary_key=True)  # 1 to 58
    code = models.CharField(max_length=4, unique=True)
    name_ar = models.CharField(max_length=100)
    name_fr = models.CharField(max_length=100)

    class Meta:
        ordering = ['id']
        verbose_name = 'Wilaya'
        verbose_name_plural = 'Wilayas'

    def __str__(self):
        return f"{self.code} - {self.name_fr} ({self.name_ar})"

class Commune(models.Model):
    wilaya = models.ForeignKey(Wilaya, on_delete=models.CASCADE, related_name='communes')
    name_ar = models.CharField(max_length=120)
    name_fr = models.CharField(max_length=120)
    postal_code = models.CharField(max_length=10, blank=True, null=True)

    class Meta:
        ordering = ['name_fr']
        verbose_name = 'Commune'
        verbose_name_plural = 'Communes'

    def __str__(self):
        return f"{self.name_fr} ({self.wilaya.name_fr})"
