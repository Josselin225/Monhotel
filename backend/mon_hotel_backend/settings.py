from pathlib import Path
from decouple import config, Csv
from datetime import timedelta
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')  # Obligatoire — pas de valeur par défaut en production

DEBUG = config('DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=lambda v: [s.strip() for s in v.split(',')])

# Autoriser tous les sous-domaines ngrok en développement
if DEBUG:
    ALLOWED_HOSTS += ['.ngrok-free.dev', '.ngrok.io']

DATABASE_URL = config('DATABASE_URL', default=None)
if DATABASE_URL:
    DATABASES = {'default': dj_database_url.parse(DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'channels',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    # Local apps
    'apps.tenants',
    'apps.accounts',
    'apps.rooms',
    'apps.clients',
    'apps.bookings',
    'apps.billing',
    'apps.content',
    'apps.notifications',
    'apps.housekeeping',
    'apps.satisfaction',
    'apps.accounting',
    'apps.maintenance',
    'apps.audit_log',
    'apps.tracking',
    'apps.inventory',
    'apps.scheduling',
    'apps.rfid',
    'apps.amenities',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'mon_hotel_backend.middleware.CookieOriginCheckMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.audit_log.middleware.AuditContextMiddleware',
]

ROOT_URLCONF = 'mon_hotel_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mon_hotel_backend.wsgi.application'
ASGI_APPLICATION  = 'mon_hotel_backend.asgi.application'

# ─── WebSocket / Django Channels ─────────────────────────────────────────────
_channel_backend = config('CHANNEL_LAYERS_BACKEND', default='memory')
if _channel_backend == 'redis':
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [config('REDIS_URL', default='redis://localhost:6379')]},
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
    }


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Abidjan'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'mon_hotel_backend.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'mon_hotel_backend.pagination.DefaultPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Limite par défaut pour tout endpoint anonyme SANS throttle_classes dédié
        # (contenu du site, témoignages, suivi de visite, menu public, etc.) —
        # simple navigation sur le site public, pas un point sensible. Les actions
        # à risque (connexion, inscription hôtel, réservation, recherche) ont déjà
        # leur propre limite plus stricte ci-dessous, qui remplace celle-ci.
        'anon': '1000/hour',
        'user': '1000/hour',
        'login': '10/hour',
        'hotel_register': '5/hour',
        'public_booking': '5/hour',
        'public_search': '30/hour',
        'my_booking': '20/hour',
    },
    'EXCEPTION_HANDLER': 'mon_hotel_backend.exceptions.custom_exception_handler',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=3),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=lambda v: [s.strip() for s in v.split(',')],
)
CORS_ALLOW_CREDENTIALS = True

# Autoriser ngrok en développement
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r'^https://.*\.ngrok-free\.dev$',
        r'^https://.*\.ngrok\.io$',
    ]

# ─── Security headers ─────────────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
REFERRER_POLICY = 'strict-origin-when-cross-origin'

# En production (HTTPS), activer ces directives via la variable d'env
if not DEBUG:
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = True
    # L'app tourne toujours derrière un reverse proxy qui termine le TLS
    # (nginx / Railway) : sans ceci, request.is_secure() reste False, ce qui
    # casse SECURE_SSL_REDIRECT (boucle de redirection) et les cookies secure.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Domaines depuis lesquels les requêtes POST/PUT avec cookie de session
# (ex: Django admin) sont acceptées derrière le proxy HTTPS.
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='',
    cast=lambda v: [s.strip() for s in v.split(',') if s.strip()],
)

SPECTACULAR_SETTINGS = {
    'TITLE': 'Mon Hôtel API',
    'DESCRIPTION': "API de gestion de l'hôtel",
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SERVE_PERMISSIONS': ['apps.accounts.permissions.IsAdmin'],
}

# ─── Cache (local memory pour dev, Redis en production via CACHE_URL) ───
CACHE_URL = config('CACHE_URL', default=None)
if CACHE_URL:
    import django_redis  # noqa — assurez-vous d'installer django-redis en prod
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': CACHE_URL,
            'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'mon-hotel-cache',
        }
    }

# ─── Email ───────────────────────────────────────────────────────────────
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Mon Hôtel <no-reply@monhotel.ci>')
HOTEL_NAME = config('HOTEL_NAME', default='Mon Hôtel')
# Adresses de notification interne (séparées par des virgules)
STAFF_ALERT_EMAILS = [e.strip() for e in config('STAFF_ALERT_EMAILS', default='').split(',') if e.strip()]
SURVEY_REMINDER_DAYS = config('SURVEY_REMINDER_DAYS', default=3, cast=int)
