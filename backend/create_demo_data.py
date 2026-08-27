"""
Script de création des données de démonstration.
Exécuter avec: python create_demo_data.py
"""
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_hotel_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.rooms.models import RoomType, Room
from apps.clients.models import Client
from apps.bookings.models import Booking
from apps.billing.models import Invoice
from datetime import date, timedelta
from decimal import Decimal

User = get_user_model()

print("Création du superutilisateur admin...")
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser(
        username='admin',
        email='admin@monhotel.ci',
        password='admin1234',
        first_name='Admin',
        last_name='Hôtel',
        role='admin',
    )
    print("  ✓ admin / admin1234")
else:
    print("  → déjà existant")

print("Création de la réceptionniste...")
if not User.objects.filter(username='reception').exists():
    User.objects.create_user(
        username='reception',
        email='reception@monhotel.ci',
        password='recep1234',
        first_name='Marie',
        last_name='Nguema',
        role='receptionist',
    )
    print("  ✓ reception / recep1234")
else:
    print("  → déjà existant")

print("Création des types de chambres...")
standard, _ = RoomType.objects.get_or_create(
    name='Standard',
    defaults={
        'description': 'Chambre confortable avec vue sur le jardin.',
        'base_price': Decimal('25000'),
        'capacity': 2,
        'amenities': ['WiFi', 'Climatisation', 'TV', 'Minibar'],
    }
)
superior, _ = RoomType.objects.get_or_create(
    name='Supérieure',
    defaults={
        'description': 'Chambre spacieuse avec balcon et vue panoramique.',
        'base_price': Decimal('40000'),
        'capacity': 2,
        'amenities': ['WiFi', 'Climatisation', 'TV', 'Minibar', 'Balcon', 'Coffre-fort'],
    }
)
suite, _ = RoomType.objects.get_or_create(
    name='Suite',
    defaults={
        'description': 'Suite luxueuse avec salon séparé et jacuzzi.',
        'base_price': Decimal('80000'),
        'capacity': 4,
        'amenities': ['WiFi', 'Climatisation', 'TV', 'Minibar', 'Jacuzzi', 'Salon', 'Coffre-fort', 'Room Service'],
    }
)
print("  ✓ Standard, Supérieure, Suite")

print("Création des chambres...")
rooms_data = [
    ('101', standard, 1), ('102', standard, 1), ('103', standard, 1),
    ('104', superior, 1), ('105', superior, 1),
    ('201', standard, 2), ('202', standard, 2), ('203', standard, 2),
    ('204', superior, 2), ('205', superior, 2),
    ('301', suite, 3), ('302', suite, 3),
]
for number, rtype, floor in rooms_data:
    Room.objects.get_or_create(number=number, defaults={'room_type': rtype, 'floor': floor})
print(f"  ✓ {len(rooms_data)} chambres créées")

print("Création de clients de démonstration...")
clients_data = [
    ('Kouassi', 'Konan', 'kouassi.konan@email.ci', '+225 07 12 34 56 78', 'Ivoirienne'),
    ('Adjoua', 'Brou', 'adjoua.brou@email.ci', '+225 05 23 45 67 89', 'Ivoirienne'),
    ('Pierre', 'Dupont', 'pierre.dupont@email.fr', '+33 6 12 34 56 78', 'Française'),
    ('Amina', 'Diallo', 'amina.diallo@email.sn', '+221 77 123 45 67', 'Sénégalaise'),
]
created_clients = []
for fn, ln, em, ph, nat in clients_data:
    c, _ = Client.objects.get_or_create(
        email=em,
        defaults={'first_name': fn, 'last_name': ln, 'phone': ph, 'nationality': nat}
    )
    created_clients.append(c)
print(f"  ✓ {len(created_clients)} clients créés")

print("Création de réservations de démonstration...")
today = date.today()
room_101 = Room.objects.get(number='101')
room_204 = Room.objects.get(number='204')
room_301 = Room.objects.get(number='301')

bookings_data = [
    {
        'client': created_clients[0],
        'room': room_101,
        'check_in': today - timedelta(days=2),
        'check_out': today + timedelta(days=1),
        'status': 'checked_in',
        'price_per_night': Decimal('25000'),
        'adults': 2,
    },
    {
        'client': created_clients[1],
        'room': room_204,
        'check_in': today + timedelta(days=1),
        'check_out': today + timedelta(days=4),
        'status': 'confirmed',
        'price_per_night': Decimal('40000'),
        'adults': 2,
    },
    {
        'client': created_clients[2],
        'room': room_301,
        'check_in': today - timedelta(days=10),
        'check_out': today - timedelta(days=7),
        'status': 'checked_out',
        'price_per_night': Decimal('80000'),
        'adults': 2,
    },
]

for bd in bookings_data:
    if not Booking.objects.filter(client=bd['client'], room=bd['room']).exists():
        Booking.objects.create(**bd)
print(f"  ✓ {len(bookings_data)} réservations créées")

print("\n✅ Données de démonstration créées avec succès!")
print("\nConnexion:")
print("  Admin Django : http://localhost:8000/admin  →  admin / admin1234")
print("  API JWT      : POST http://localhost:8000/api/auth/login/  →  admin / admin1234")
print("  Docs API     : http://localhost:8000/api/docs/")
