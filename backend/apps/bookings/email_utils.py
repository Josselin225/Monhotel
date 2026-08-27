from django.core.mail import send_mail
from django.conf import settings
from django.utils.html import strip_tags


def _hotel_info():
    try:
        from apps.content.models import SiteContent
        data = SiteContent.get_content().data.get('hotel', {})
        return {
            'name':  data.get('name',  'Mon Hôtel'),
            'email': data.get('email', settings.DEFAULT_FROM_EMAIL),
            'phone': data.get('phone', ''),
        }
    except Exception:
        return {'name': 'Mon Hôtel', 'email': settings.DEFAULT_FROM_EMAIL, 'phone': ''}


def _row(label, value):
    return (
        f'<tr><td style="padding:8px;background:#f5f4f0;font-weight:bold;width:40%">{label}</td>'
        f'<td style="padding:8px">{value}</td></tr>'
    )


def _wrap(hotel_name, title, body):
    return f"""<html><body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0">
<div style="max-width:600px;margin:30px auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#B8860B;padding:20px 24px">
    <h1 style="margin:0;color:#fff;font-size:20px">{hotel_name}</h1>
  </div>
  <div style="padding:24px">
    <h2 style="margin-top:0;color:#1a1a1a">{title}</h2>
    {body}
  </div>
  <div style="padding:12px 24px;background:#f9fafb;text-align:center;font-size:12px;color:#6b7280">
    {hotel_name} — Ce message est automatique, merci de ne pas y répondre.
  </div>
</div>
</body></html>"""


def send_booking_pending(booking):
    """Email de réception de demande en ligne (statut pending)."""
    hotel = _hotel_info()
    if not booking.client.email:
        return

    rows = (
        _row('Référence', booking.reference) +
        _row('Chambre', f'#{booking.room.number} — {booking.room.room_type.name}') +
        _row('Arrivée', booking.check_in.strftime('%d/%m/%Y')) +
        _row('Départ', booking.check_out.strftime('%d/%m/%Y')) +
        _row('Durée', f"{booking.nights} nuit{'s' if booking.nights > 1 else ''}") +
        _row('Total estimé', f"{int(booking.total_price):,} FCFA".replace(',', ' '))
    )
    body = (
        f"<p>Bonjour {booking.client.full_name},</p>"
        f"<p>Nous avons bien reçu votre demande de réservation. Notre équipe vous contactera sous 24h pour confirmer votre séjour.</p>"
        f"<table style='border-collapse:collapse;width:100%;margin:16px 0'>{rows}</table>"
        f"<p>Merci de votre confiance.</p>"
    )
    html = _wrap(hotel['name'], 'Demande de réservation reçue', body)
    send_mail(
        subject=f"[{hotel['name']}] Demande de réservation — {booking.reference}",
        message=strip_tags(html),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.client.email],
        html_message=html,
        fail_silently=True,
    )


def send_booking_confirmation(booking):
    """Confirmation de réservation (statut → confirmed)."""
    hotel = _hotel_info()
    if not booking.client.email:
        return

    rows = (
        _row('Référence', booking.reference) +
        _row('Chambre', f'#{booking.room.number} — {booking.room.room_type.name}') +
        _row('Arrivée', booking.check_in.strftime('%d/%m/%Y')) +
        _row('Départ', booking.check_out.strftime('%d/%m/%Y')) +
        _row('Durée', f"{booking.nights} nuit{'s' if booking.nights > 1 else ''}") +
        _row('Total', f"{int(booking.total_price):,} FCFA".replace(',', ' '))
    )
    body = (
        f"<p>Bonjour {booking.client.full_name},</p>"
        f"<p>Votre réservation a été <strong>confirmée</strong>. Nous nous réjouissons de vous accueillir.</p>"
        f"<table style='border-collapse:collapse;width:100%;margin:16px 0'>{rows}</table>"
        f"<p>Pour toute question, n'hésitez pas à nous contacter.</p>"
        + (f"<p>📞 {hotel['phone']}</p>" if hotel['phone'] else '')
    )
    html = _wrap(hotel['name'], 'Confirmation de réservation', body)
    send_mail(
        subject=f"[{hotel['name']}] Confirmation — {booking.reference}",
        message=strip_tags(html),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.client.email],
        html_message=html,
        fail_silently=True,
    )


def send_arrival_reminder(booking):
    """Rappel J-1 avant l'arrivée."""
    hotel = _hotel_info()
    if not booking.client.email:
        return

    rows = (
        _row('Réservation', booking.reference) +
        _row('Chambre', f'#{booking.room.number} — {booking.room.room_type.name}') +
        _row('Arrivée', booking.check_in.strftime('%d/%m/%Y'))
    )
    body = (
        f"<p>Bonjour {booking.client.full_name},</p>"
        f"<p>Nous vous rappelons que votre séjour commence <strong>demain</strong> !</p>"
        f"<table style='border-collapse:collapse;width:100%;margin:16px 0'>{rows}</table>"
        f"<p>Notre équipe sera ravie de vous accueillir.</p>"
        + (f"<p>📞 {hotel['phone']}</p>" if hotel['phone'] else '')
    )
    html = _wrap(hotel['name'], 'Rappel : votre arrivée demain', body)
    send_mail(
        subject=f"[{hotel['name']}] Rappel — Votre arrivée demain",
        message=strip_tags(html),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[booking.client.email],
        html_message=html,
        fail_silently=True,
    )
