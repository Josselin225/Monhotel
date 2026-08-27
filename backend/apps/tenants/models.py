from django.db import models
from django.utils.text import slugify


class Hotel(models.Model):
    class Plan(models.TextChoices):
        BASIC      = 'basic',      'Basic (1 hôtel)'
        PRO        = 'pro',        'Pro (analytics avancés)'
        ENTERPRISE = 'enterprise', 'Enterprise (multi-propriétés)'

    name          = models.CharField(max_length=200)
    slug          = models.SlugField(max_length=80, unique=True, blank=True)
    email         = models.EmailField(unique=True, help_text="Email du responsable / compte de facturation")
    phone         = models.CharField(max_length=30, blank=True)
    city          = models.CharField(max_length=100, blank=True)
    country       = models.CharField(max_length=100, default="Côte d'Ivoire")
    plan          = models.CharField(max_length=20, choices=Plan.choices, default=Plan.BASIC, db_index=True)
    is_active     = models.BooleanField(default=True, db_index=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name         = 'Hôtel'
        verbose_name_plural  = 'Hôtels'
        ordering             = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)
            slug = base
            n = 1
            while Hotel.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)
