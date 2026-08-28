import calendar as cal_module
from datetime import date, timedelta

from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from mon_hotel_backend.throttles import PublicBookingThrottle, PublicSearchThrottle, MyBookingThrottle
from apps.rooms.models import Room, RoomType
from apps.clients.models import Client
from .models import Booking


class PublicAvailableRoomsView(APIView):
    """Retourne les types de chambres avec le nombre de disponibilités pour des dates données."""
    permission_classes = [AllowAny]
    throttle_classes = [PublicSearchThrottle]

    def get(self, request):
        check_in_str = request.query_params.get('check_in')
        check_out_str = request.query_params.get('check_out')

        if not check_in_str or not check_out_str:
            return Response({'detail': 'check_in et check_out sont requis.'}, status=400)

        try:
            check_in = date.fromisoformat(check_in_str)
            check_out = date.fromisoformat(check_out_str)
        except ValueError:
            return Response({'detail': 'Format de date invalide (YYYY-MM-DD).'}, status=400)

        if check_in >= check_out:
            return Response({'detail': "La date de départ doit être après la date d'arrivée."}, status=400)

        if check_in < date.today():
            return Response({'detail': "La date d'arrivée ne peut pas être dans le passé."}, status=400)

        # Chambres avec des réservations conflictuelles
        conflicting_ids = Room.objects.filter(
            bookings__status__in=['pending', 'confirmed', 'checked_in'],
            bookings__check_in__lt=check_out,
            bookings__check_out__gt=check_in,
        ).values_list('id', flat=True)

        result = []
        for rt in RoomType.objects.all():
            active = rt.rooms.filter(status__in=['available', 'cleaning'])
            available = active.exclude(id__in=conflicting_ids)
            result.append({
                'id': rt.id,
                'name': rt.name,
                'description': rt.description,
                'base_price': str(rt.base_price),
                'capacity': rt.capacity,
                'amenities': rt.amenities,
                'available_count': available.count(),
                'total_count': active.count(),
            })

        return Response(result)


class PublicAvailabilityCalendarView(APIView):
    """
    Retourne, pour chaque jour d'un mois donné, le nombre de chambres disponibles.
    GET /api/public/calendar/?year=YYYY&month=MM
    """
    permission_classes = [AllowAny]
    throttle_classes = [PublicSearchThrottle]

    def get(self, request):
        today = date.today()
        try:
            year  = int(request.query_params.get('year',  today.year))
            month = int(request.query_params.get('month', today.month))
            _, days_in_month = cal_module.monthrange(year, month)
            month_start = date(year, month, 1)
            month_end   = date(year, month, days_in_month)
        except (ValueError, cal_module.IllegalMonthError):
            return Response({'detail': 'Paramètres invalides.'}, status=400)

        total_rooms = Room.objects.filter(status__in=['available', 'cleaning', 'occupied']).count()

        # Une seule requête pour tout le mois (au lieu d'une par jour) : on
        # récupère les intervalles (room_id, check_in, check_out) des réservations
        # actives qui chevauchent le mois, puis on compte les jours occupés en
        # Python.
        overlapping = Room.objects.filter(
            bookings__status__in=['pending', 'confirmed', 'checked_in'],
            bookings__check_in__lte=month_end,
            bookings__check_out__gt=month_start,
        ).values_list('id', 'bookings__check_in', 'bookings__check_out')

        days = []
        for day in range(1, days_in_month + 1):
            d      = date(year, month, day)
            d_next = d + timedelta(days=1)
            occupied_ids = {
                room_id for room_id, ci, co in overlapping
                if ci < d_next and co > d
            }
            available = max(0, total_rooms - len(occupied_ids))
            days.append({
                'date':      d.isoformat(),
                'day':       day,
                'weekday':   d.weekday(),  # 0=lundi … 6=dimanche
                'available': available,
                'total':     total_rooms,
                'past':      d < today,
            })

        return Response({'year': year, 'month': month, 'days': days, 'total_rooms': total_rooms})


class PublicBookingCreateView(APIView):
    """Crée une réservation en ligne sans authentification (statut: en attente)."""
    permission_classes = [AllowAny]
    throttle_classes = [PublicBookingThrottle]

    def post(self, request):
        data = request.data

        # Honeypot anti-bot : champ caché dans le formulaire, doit rester vide
        if data.get('website'):
            return Response({'reference': 'PENDING', 'message': 'Réservation reçue.'}, status=201)

        for field in ['check_in', 'check_out', 'room_type_id', 'first_name', 'last_name', 'phone']:
            if not data.get(field):
                return Response({'detail': f'Champ requis : {field}'}, status=400)

        try:
            check_in = date.fromisoformat(data['check_in'])
            check_out = date.fromisoformat(data['check_out'])
        except ValueError:
            return Response({'detail': 'Dates invalides.'}, status=400)

        if check_in >= check_out:
            return Response({'detail': "La date de départ doit être après la date d'arrivée."}, status=400)

        if check_in < date.today():
            return Response({'detail': "La date d'arrivée ne peut pas être dans le passé."}, status=400)

        # Validation adults/children
        try:
            adults   = max(1, int(data.get('adults', 1)))
            children = max(0, int(data.get('children', 0)))
        except (TypeError, ValueError):
            return Response({'detail': 'Valeurs adults/children invalides.'}, status=400)

        # Réservation de table optionnelle, validée avant toute écriture en base.
        # Le client choisit un ou plusieurs repas (petit-déjeuner/déjeuner/dîner, chacun
        # avec sa propre heure) et une fréquence commune : une seule fois (à une date
        # précise) ou chaque jour du séjour.
        MEAL_LABELS = {'breakfast': 'Petit-déjeuner', 'lunch': 'Déjeuner', 'dinner': 'Dîner'}
        restaurant_meals_raw  = data.get('restaurant_meals') or []
        restaurant_frequency  = data.get('restaurant_frequency')
        wants_restaurant = bool(restaurant_meals_raw) and bool(restaurant_frequency)
        restaurant_dates = []
        restaurant_meal_times = []
        if wants_restaurant:
            from datetime import time as time_cls
            if not isinstance(restaurant_meals_raw, list):
                return Response({'detail': 'Repas invalides.'}, status=400)
            for item in restaurant_meals_raw:
                meal_key = item.get('meal') if isinstance(item, dict) else None
                time_str = item.get('time') if isinstance(item, dict) else None
                if meal_key not in MEAL_LABELS:
                    return Response({'detail': 'Repas invalide.'}, status=400)
                try:
                    restaurant_meal_times.append((meal_key, time_cls.fromisoformat(time_str)))
                except (TypeError, ValueError):
                    return Response({'detail': 'Heure de réservation au restaurant invalide.'}, status=400)
            if restaurant_frequency == 'daily':
                restaurant_dates = [check_in + timedelta(days=i) for i in range((check_out - check_in).days)]
            elif restaurant_frequency == 'once':
                restaurant_date_str = data.get('restaurant_date')
                if not restaurant_date_str:
                    return Response({'detail': 'Date de réservation au restaurant requise.'}, status=400)
                try:
                    single_date = date.fromisoformat(restaurant_date_str)
                except ValueError:
                    return Response({'detail': 'Date de réservation au restaurant invalide.'}, status=400)
                if single_date < date.today():
                    return Response({'detail': 'La date de réservation au restaurant ne peut pas être dans le passé.'}, status=400)
                restaurant_dates = [single_date]
            else:
                return Response({'detail': 'Fréquence de réservation au restaurant invalide.'}, status=400)

        # Validation email
        email = str(data.get('email', '')).strip()
        if email:
            try:
                validate_email(email)
            except DjangoValidationError:
                return Response({'detail': 'Adresse email invalide.'}, status=400)

        try:
            room_type = RoomType.objects.get(pk=data['room_type_id'])
        except RoomType.DoesNotExist:
            return Response({'detail': 'Type de chambre introuvable.'}, status=400)

        if adults + children > room_type.capacity:
            return Response({
                'detail': f"Cette chambre accueille au maximum {room_type.capacity} personne"
                          f"{'s' if room_type.capacity > 1 else ''}. Réduisez le nombre de voyageurs "
                          f"ou choisissez une chambre plus grande.",
            }, status=400)

        first_name = str(data['first_name']).strip()[:100]
        last_name  = str(data['last_name']).strip()[:100]
        pay_by_transfer = str(data.get('payment_method', '')).strip() == Booking.PaymentMethod.TRANSFER

        # Sélection de la chambre + vérification de conflit sous verrou, à
        # l'intérieur de la transaction : deux requêtes quasi simultanées pour
        # les mêmes dates ne doivent pas pouvoir décrocher la même chambre
        # (sinon double-booking). Sans select_for_update, les deux pourraient
        # lire "disponible" avant que l'une des deux ait committé sa création.
        from django.db import transaction
        with transaction.atomic():
            conflicting_ids = Room.objects.filter(
                bookings__status__in=['pending', 'confirmed', 'checked_in'],
                bookings__check_in__lt=check_out,
                bookings__check_out__gt=check_in,
            ).values_list('id', flat=True)

            room = room_type.rooms.select_for_update().filter(
                status__in=['available', 'cleaning']
            ).exclude(id__in=conflicting_ids).first()

            if not room:
                return Response({'detail': 'Aucune chambre disponible pour ces dates.'}, status=400)

            # Trouver ou créer le client par numéro de téléphone. On ne rattache la
            # réservation à une fiche existante que si le nom fourni correspond —
            # sans preuve de possession du téléphone (pas d'OTP), quelqu'un qui ne
            # connaît qu'un numéro ne doit pas pouvoir polluer/associer la fiche
            # d'une autre personne rien qu'en le devinant.
            existing = Client.objects.filter(phone=data['phone'], hotel=room.hotel).first()
            if existing and existing.first_name.strip().lower() == first_name.lower() \
                    and existing.last_name.strip().lower() == last_name.lower():
                client = existing
            else:
                client = Client.objects.create(
                    hotel=room.hotel,
                    first_name=first_name,
                    last_name=last_name,
                    phone=str(data['phone']).strip()[:30],
                    email=email,
                    notes='Client créé via réservation en ligne.',
                )

            booking = Booking.objects.create(
                client=client,
                room=room,
                check_in=check_in,
                check_out=check_out,
                adults=adults,
                children=children,
                status=Booking.Status.PENDING,
                source=Booking.Source.ONLINE,
                payment_method=Booking.PaymentMethod.TRANSFER if pay_by_transfer else Booking.PaymentMethod.ON_SITE,
                special_requests=str(data.get('special_requests', '')).strip()[:2000],
                price_per_night=room.price,
            )
            if pay_by_transfer:
                booking.deposit = booking.total_price
                booking.save(update_fields=['deposit'])

            if wants_restaurant:
                from apps.amenities.models import AmenityReservation, AmenityType
                try:
                    restaurant_party_size = max(1, int(data.get('restaurant_party_size') or adults))
                except (TypeError, ValueError):
                    restaurant_party_size = adults
                for meal_key, meal_time in restaurant_meal_times:
                    meal_label = MEAL_LABELS[meal_key]
                    for d in restaurant_dates:
                        AmenityReservation.objects.create(
                            hotel=room.hotel,
                            amenity=AmenityType.RESTAURANT,
                            client=client,
                            client_name=f'{first_name} {last_name}',
                            client_phone=str(data['phone']).strip()[:30],
                            date=d,
                            start_time=meal_time,
                            party_size=restaurant_party_size,
                            status=AmenityReservation.Status.PENDING,
                            source=AmenityReservation.Source.ONLINE,
                            notes=f'{meal_label} — réservé en ligne avec la chambre {room.number} ({booking.reference}).',
                        )

        return Response({
            'reference': booking.reference,
            'room_number': room.number,
            'room_type': room_type.name,
            'check_in': str(check_in),
            'check_out': str(check_out),
            'nights': booking.nights,
            'restaurant_reserved': wants_restaurant,
            'restaurant_occasions': len(restaurant_dates) * len(restaurant_meal_times),
            'total_price': str(booking.total_price),
            'price_per_night': str(room.price),
            'payment_method': booking.payment_method,
            # Pas de client_name ici : ne pas confirmer/révéler l'identité
            # d'une fiche existante à partir d'un simple numéro de téléphone.
        }, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# Portail self-service client : consulter/gérer sa réservation avec seulement
# la référence + le téléphone ou l'email renseigné à la réservation (pas de
# compte/mot de passe). Toute action revérifie les deux à chaque appel.
# ─────────────────────────────────────────────────────────────────────────────

def _lookup_booking(reference, contact):
    reference = str(reference or '').strip().upper()
    contact = str(contact or '').strip().lower()
    if not reference or not contact:
        return None
    booking = Booking.objects.select_related('client', 'room', 'room__room_type').filter(
        reference=reference,
    ).first()
    if not booking:
        return None
    client_phone = (booking.client.phone or '').strip().lower()
    client_email = (booking.client.email or '').strip().lower()
    if contact not in (client_phone, client_email):
        return None
    return booking


def _serialize_my_booking(booking):
    has_invoice = False
    try:
        has_invoice = booking.invoice.status in ('issued', 'paid')
    except Booking.invoice.RelatedObjectDoesNotExist:
        pass
    return {
        'reference': booking.reference,
        'status': booking.status,
        'status_display': booking.get_status_display(),
        'room_number': booking.room.number,
        'room_type': booking.room.room_type.name if booking.room.room_type else '',
        'check_in': str(booking.check_in),
        'check_out': str(booking.check_out),
        'nights': booking.nights,
        'adults': booking.adults,
        'children': booking.children,
        'total_price': str(booking.total_price),
        'payment_method': booking.payment_method,
        'deposit': str(booking.deposit),
        'deposit_paid': booking.deposit_paid_at is not None,
        'special_requests': booking.special_requests,
        'can_cancel': booking.status in (Booking.Status.PENDING, Booking.Status.CONFIRMED) and booking.check_in >= date.today(),
        'can_edit': booking.status in (Booking.Status.PENDING, Booking.Status.CONFIRMED),
        'has_invoice': has_invoice,
    }


_NOT_FOUND = Response(
    {'detail': 'Réservation introuvable. Vérifiez la référence et le contact renseignés.'},
    status=404,
)


class MyBookingLookupView(APIView):
    """POST /api/public/my-booking/ — {reference, contact} → détails de la réservation."""
    permission_classes = [AllowAny]
    throttle_classes = [MyBookingThrottle]

    def post(self, request):
        booking = _lookup_booking(request.data.get('reference'), request.data.get('contact'))
        if not booking:
            return _NOT_FOUND
        return Response(_serialize_my_booking(booking))


class MyBookingUpdateView(APIView):
    """PATCH /api/public/my-booking/<reference>/ — {contact, special_requests}."""
    permission_classes = [AllowAny]
    throttle_classes = [MyBookingThrottle]

    def patch(self, request, reference):
        booking = _lookup_booking(reference, request.data.get('contact'))
        if not booking:
            return _NOT_FOUND
        if booking.status not in (Booking.Status.PENDING, Booking.Status.CONFIRMED):
            return Response({'detail': 'Cette réservation ne peut plus être modifiée.'}, status=400)
        booking.special_requests = str(request.data.get('special_requests', '')).strip()[:2000]
        booking.save(update_fields=['special_requests', 'updated_at'])
        return Response(_serialize_my_booking(booking))


class MyBookingCancelView(APIView):
    """POST /api/public/my-booking/<reference>/cancel/ — {contact}."""
    permission_classes = [AllowAny]
    throttle_classes = [MyBookingThrottle]

    def post(self, request, reference):
        booking = _lookup_booking(reference, request.data.get('contact'))
        if not booking:
            return _NOT_FOUND
        if booking.status not in (Booking.Status.PENDING, Booking.Status.CONFIRMED):
            return Response({'detail': 'Cette réservation ne peut plus être annulée.'}, status=400)
        if booking.check_in < date.today():
            return Response({'detail': "La date d'arrivée est déjà passée."}, status=400)
        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=['status', 'updated_at'])
        return Response(_serialize_my_booking(booking))


class MyBookingInvoiceView(APIView):
    """GET /api/public/my-booking/<reference>/invoice/?contact=... — PDF de la facture."""
    permission_classes = [AllowAny]
    throttle_classes = [MyBookingThrottle]

    def get(self, request, reference):
        booking = _lookup_booking(reference, request.query_params.get('contact'))
        if not booking:
            return _NOT_FOUND
        try:
            invoice = booking.invoice
        except Booking.invoice.RelatedObjectDoesNotExist:
            return Response({'detail': 'Aucune facture disponible pour cette réservation.'}, status=404)
        if invoice.status not in ('issued', 'paid'):
            return Response({'detail': 'Aucune facture disponible pour cette réservation.'}, status=404)

        from apps.billing.pdf import generate_invoice_pdf_response
        return generate_invoice_pdf_response(invoice)
