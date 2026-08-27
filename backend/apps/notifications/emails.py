"""
Email transactionnels de Mon Hôtel.

Configuration dans settings.py :
  EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'  (prod)
  EMAIL_HOST / EMAIL_PORT / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD
  DEFAULT_FROM_EMAIL = 'Mon Hôtel <no-reply@monhotel.ci>'
  HOTEL_NAME = 'Mon Hôtel'

En développement, EMAIL_BACKEND = console affiche les e-mails dans le terminal.
"""
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone


HOTEL_NAME = getattr(settings, 'HOTEL_NAME', 'Mon Hôtel')
FROM_EMAIL  = settings.DEFAULT_FROM_EMAIL


def _fmt_date(d):
    if not d:
        return '—'
    if hasattr(d, 'strftime'):
        return d.strftime('%d/%m/%Y')
    return str(d)


def _fmt_fcfa(n):
    try:
        return f"{int(n):,} FCFA".replace(',', ' ')
    except Exception:
        return f"{n} FCFA"


# ─── Confirmation de réservation ─────────────────────────────────────────────

def send_booking_confirmation(booking):
    """Envoyé au client dès que la réservation est confirmée."""
    client = booking.client
    if not client.email:
        return
    subject = f"[{HOTEL_NAME}] Confirmation de votre réservation {booking.reference}"
    body = f"""Bonjour {client.first_name},

Votre réservation a bien été confirmée. Voici le récapitulatif :

  Référence     : {booking.reference}
  Chambre       : #{booking.room.number} — {booking.room.room_type.name}
  Arrivée       : {_fmt_date(booking.check_in)}
  Départ        : {_fmt_date(booking.check_out)}
  Durée         : {booking.nights} nuit(s)
  Montant total : {_fmt_fcfa(booking.total_price)}

Nous vous attendons avec plaisir.

L'équipe {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, [client.email], fail_silently=True)
    except Exception:
        pass


# ─── Rappel d'arrivée (J-1) ──────────────────────────────────────────────────

def send_arrival_reminder(booking):
    """Rappel envoyé la veille de l'arrivée."""
    client = booking.client
    if not client.email:
        return
    subject = f"[{HOTEL_NAME}] Rappel — votre arrivée demain ({_fmt_date(booking.check_in)})"
    body = f"""Bonjour {client.first_name},

Nous vous rappelons que votre séjour commence demain.

  Référence : {booking.reference}
  Arrivée   : {_fmt_date(booking.check_in)}
  Chambre   : #{booking.room.number} — {booking.room.room_type.name}

Notre équipe sera ravie de vous accueillir. En cas de besoin,
contactez-nous directement.

À demain !
L'équipe {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, [client.email], fail_silently=True)
    except Exception:
        pass


# ─── Envoi de facture ─────────────────────────────────────────────────────────

def send_invoice(invoice):
    """Envoyé au client lors de l'émission de la facture."""
    client = invoice.booking.client
    if not client.email:
        return
    subject = f"[{HOTEL_NAME}] Votre facture {invoice.number}"
    body = f"""Bonjour {client.first_name},

Veuillez trouver ci-dessous le récapitulatif de votre facture.

  Numéro de facture : {invoice.number}
  Réservation       : {invoice.booking.reference}
  Chambre           : #{invoice.booking.room.number} — {invoice.booking.room.room_type.name}
  Arrivée           : {_fmt_date(invoice.booking.check_in)}
  Départ            : {_fmt_date(invoice.booking.check_out)}
  Montant total     : {_fmt_fcfa(invoice.total)}
  Statut            : {'Payée' if invoice.status == 'paid' else 'En attente de règlement'}

Merci de votre confiance et au plaisir de vous accueillir à nouveau.

L'équipe {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, [client.email], fail_silently=True)
    except Exception:
        pass


# ─── Message d'anniversaire ───────────────────────────────────────────────────

def send_birthday_greeting(client):
    """Envoyé le jour de l'anniversaire d'un client."""
    if not client.email:
        return
    subject = f"[{HOTEL_NAME}] Joyeux anniversaire, {client.first_name} ! 🎂"
    body = f"""Bonjour {client.first_name},

Toute l'équipe de {HOTEL_NAME} vous souhaite un très joyeux anniversaire !

En cette occasion spéciale, sachez que nous serions ravis de vous accueillir
pour un séjour mémorable. Contactez-nous pour connaître nos offres exclusives.

Encore une fois, joyeux anniversaire !

L'équipe {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, [client.email], fail_silently=True)
    except Exception:
        pass


# ─── Questionnaire de satisfaction ────────────────────────────────────────────

def send_satisfaction_survey(survey):
    """Envoie le lien du questionnaire de satisfaction après le check-out."""
    client = survey.booking.client
    if not client.email:
        return
    from django.conf import settings as _settings
    frontend_url = getattr(_settings, 'FRONTEND_URL', 'http://localhost:5173')
    link = f"{frontend_url}/survey/{survey.token}"
    subject = f"[{HOTEL_NAME}] Votre avis sur votre séjour ({survey.booking.reference})"
    body = f"""Bonjour {client.first_name},

Votre séjour au {HOTEL_NAME} est terminé. Nous espérons que vous avez passé un excellent moment !

Nous vous serions reconnaissants de bien vouloir nous faire part de votre avis en quelques minutes :

  {link}

Votre retour nous aide à nous améliorer continuellement.

Merci et à bientôt !

L'équipe {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, [client.email], fail_silently=True)
    except Exception:
        pass


# ─── Commande de rappels (à appeler depuis manage.py ou cron) ────────────────

def _staff_emails():
    """Retourne la liste des adresses destinataires staff (depuis settings)."""
    return getattr(settings, 'STAFF_ALERT_EMAILS', []) or []


# ─── Alerte nouvelle réservation (staff) ─────────────────────────────────────

def send_new_booking_alert(booking):
    """Notifie le staff qu'une nouvelle réservation a été créée."""
    recipients = _staff_emails()
    if not recipients:
        return
    source_label = dict(getattr(booking, 'SOURCE_CHOICES', []) or []).get(booking.source, booking.source)
    subject = f"[{HOTEL_NAME}] Nouvelle réservation — {booking.reference}"
    body = f"""Nouvelle réservation enregistrée dans le système.

  Référence     : {booking.reference}
  Client        : {booking.client.full_name}
  Chambre       : #{booking.room.number} — {booking.room.room_type.name}
  Arrivée       : {_fmt_date(booking.check_in)}
  Départ        : {_fmt_date(booking.check_out)}
  Durée         : {booking.nights} nuit(s)
  Montant total : {_fmt_fcfa(booking.total_price)}
  Source        : {source_label}
  Statut        : {booking.get_status_display()}

— Système {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, recipients, fail_silently=True)
    except Exception:
        pass


# ─── Alerte ticket maintenance urgent (staff) ────────────────────────────────

def send_maintenance_alert(ticket):
    """Notifie le staff d'un nouveau ticket maintenance urgent ou haute priorité."""
    recipients = _staff_emails()
    if not recipients:
        return
    room_info = f"Chambre #{ticket.room.number}" if ticket.room_id else (ticket.location or 'Non précisé')
    subject = f"[{HOTEL_NAME}] ⚠ Ticket {ticket.get_priority_display()} — {ticket.title}"
    body = f"""Un ticket de maintenance à priorité élevée vient d'être créé.

  Titre       : {ticket.title}
  Priorité    : {ticket.get_priority_display()}
  Catégorie   : {ticket.get_category_display()}
  Lieu        : {room_info}
  Description : {ticket.description or '—'}
  Créé le     : {_fmt_date(ticket.created_at)}

Connectez-vous au système pour prendre en charge ce ticket.

— Système {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, recipients, fail_silently=True)
    except Exception:
        pass


def send_survey_reminder(survey):
    """Envoie un email de rappel pour un questionnaire non complété."""
    client = survey.booking.client
    if not client.email:
        return
    from django.conf import settings as _settings
    from django.utils import timezone as tz
    frontend_url = getattr(_settings, 'FRONTEND_URL', 'http://localhost:5173')
    link = f"{frontend_url}/survey/{survey.token}"
    subject = f"[{HOTEL_NAME}] Rappel — votre avis nous intéresse ({survey.booking.reference})"
    body = f"""Bonjour {client.first_name},

Il y a quelques jours, vous avez séjourné au {HOTEL_NAME}. Nous n'avons pas encore reçu votre avis.

Cela ne prend que 2 minutes et nous aide beaucoup à améliorer nos services :

  {link}

Merci d'avance pour votre temps !

L'équipe {HOTEL_NAME}
"""
    try:
        send_mail(subject, body, FROM_EMAIL, [client.email], fail_silently=True)
        survey.reminder_sent_at = timezone.now()
        survey.save(update_fields=['reminder_sent_at'])
    except Exception:
        pass


def send_survey_reminders(reminder_days=None):
    """
    À appeler chaque matin via : python manage.py send_survey_reminders
    Envoie un rappel aux clients qui n'ont pas répondu après N jours.
    """
    from apps.satisfaction.models import SatisfactionSurvey
    from django.conf import settings as _settings
    from datetime import timedelta

    days = reminder_days or getattr(_settings, 'SURVEY_REMINDER_DAYS', 3)
    cutoff_start = timezone.now() - timedelta(days=days + 1)
    cutoff_end   = timezone.now() - timedelta(days=days)

    surveys = SatisfactionSurvey.objects.filter(
        submitted_at__isnull=True,
        reminder_sent_at__isnull=True,
        created_at__gte=cutoff_start,
        created_at__lt=cutoff_end,
    ).select_related('booking__client')

    count = 0
    for s in surveys:
        if s.booking.client.email:
            send_survey_reminder(s)
            count += 1
    return count


def send_daily_reminders():
    """
    À appeler chaque matin via : python manage.py send_reminders
    Envoie les rappels J-1 pour les arrivées du lendemain.
    """
    from apps.bookings.models import Booking
    from datetime import date, timedelta
    tomorrow = date.today() + timedelta(days=1)
    bookings = Booking.objects.filter(
        check_in=tomorrow,
        status=Booking.Status.CONFIRMED,
    ).select_related('client', 'room', 'room__room_type')
    count = 0
    for b in bookings:
        if b.client.email:
            send_arrival_reminder(b)
            count += 1
    return count


def send_daily_birthdays():
    """
    À appeler chaque matin via : python manage.py send_birthday_greetings
    Envoie les messages aux clients dont c'est l'anniversaire aujourd'hui.
    """
    from apps.clients.models import Client
    from django.db.models.functions import ExtractMonth, ExtractDay
    today = timezone.now().date()
    clients = (
        Client.objects
        .exclude(birthday__isnull=True)
        .annotate(bm=ExtractMonth('birthday'), bd=ExtractDay('birthday'))
        .filter(bm=today.month, bd=today.day)
    )
    count = 0
    for c in clients:
        send_birthday_greeting(c)
        count += 1
    return count
