"""Génération du PDF de facture — partagée entre la vue admin (InvoiceViewSet.pdf)
et le portail self-service client (public_views.py)."""
import io
from xml.sax.saxutils import escape as xml_escape
from django.http import HttpResponse
from django.utils import timezone
from apps.content.models import SiteContent


def generate_invoice_pdf_response(invoice) -> HttpResponse:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT

    b = invoice.booking
    client = b.client
    room = b.room

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2.5*cm, rightMargin=2.5*cm)

    styles = getSampleStyleSheet()
    gold = colors.HexColor('#A8762A')
    dark = colors.HexColor('#1A1916')
    muted = colors.HexColor('#6B6660')

    title_style   = ParagraphStyle('title',   parent=styles['Title'],   fontSize=22, textColor=gold, spaceAfter=2, fontName='Helvetica-Bold')
    sub_style     = ParagraphStyle('sub',     parent=styles['Normal'],  fontSize=9,  textColor=muted, spaceAfter=0)
    label_style   = ParagraphStyle('label',   parent=styles['Normal'],  fontSize=8,  textColor=muted, spaceAfter=2, fontName='Helvetica-Bold')
    value_style   = ParagraphStyle('value',   parent=styles['Normal'],  fontSize=10, textColor=dark,  spaceAfter=4)
    center_style  = ParagraphStyle('center',  parent=styles['Normal'],  fontSize=9,  textColor=muted, alignment=TA_CENTER)

    def fmt_fcfa(n):
        return f"{int(n):,} FCFA".replace(',', ' ')

    def fmt_date(d):
        if not d: return '—'
        import datetime
        if isinstance(d, str):
            d = datetime.datetime.fromisoformat(d.replace('Z', '+00:00'))
        return d.strftime('%d/%m/%Y') if hasattr(d, 'strftime') else str(d)

    story = []

    # Infos hôtel depuis SiteContent
    try:
        _hotel_data = SiteContent.get_content().data.get('hotel', {})
    except Exception:
        _hotel_data = {}
    hotel_name    = _hotel_data.get('name', 'Mon Hôtel')
    hotel_address = _hotel_data.get('address', '')
    hotel_city    = _hotel_data.get('city', '')
    hotel_phone   = _hotel_data.get('phone', '')
    hotel_email   = _hotel_data.get('email', '')
    _addr_parts   = [p for p in [hotel_address, hotel_city] if p]
    _contact_parts= [p for p in [hotel_phone, hotel_email] if p]

    # En-tête hôtel
    story.append(Paragraph(hotel_name.upper(), title_style))
    if _addr_parts:
        story.append(Paragraph(' · '.join(_addr_parts), sub_style))
    if _contact_parts:
        story.append(Paragraph(' · '.join(_contact_parts), sub_style))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="100%", thickness=2, color=gold))
    story.append(Spacer(1, 0.5*cm))

    # Numéro et statut
    status_label = {'draft': 'BROUILLON', 'issued': 'ÉMISE', 'paid': 'PAYÉE', 'cancelled': 'ANNULÉE'}.get(invoice.status, invoice.status.upper())
    story.append(Paragraph(f"FACTURE N° {invoice.number}  ·  {status_label}", ParagraphStyle('inv', parent=styles['Normal'], fontSize=13, textColor=dark, fontName='Helvetica-Bold', spaceAfter=4)))

    # Tableau infos (client | facture)
    info_data = [
        [Paragraph('<b>CLIENT</b>', label_style), Paragraph('<b>FACTURE</b>', label_style)],
        [
            Paragraph(f"{xml_escape(client.first_name)} {xml_escape(client.last_name)}<br/>"
                      f"{xml_escape(client.phone or '')}<br/>"
                      f"{xml_escape(client.email or '')}",
                      ParagraphStyle('cli', parent=styles['Normal'], fontSize=9, textColor=dark, leading=13)),
            Paragraph(
                f"Réservation : {b.reference}<br/>"
                f"Chambre : #{room.number} — {room.room_type.name}<br/>"
                f"Arrivée : {fmt_date(b.check_in)}<br/>"
                f"Départ : {fmt_date(b.check_out)}<br/>"
                f"Durée : {b.duration_label}",
                ParagraphStyle('info', parent=styles['Normal'], fontSize=9, textColor=dark, leading=13)),
        ],
    ]
    info_table = Table(info_data, colWidths=['50%', '50%'])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,0), 0.5, muted),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5F4F0')),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.6*cm))

    # Tableau des montants
    if b.billing_type == b.BillingType.HOURLY:
        hebergement_label = f"Hébergement · {b.duration_label} × {fmt_fcfa(b.price_per_hour or 0)}/heure"
    else:
        hebergement_label = f"Hébergement · {b.duration_label} × {fmt_fcfa(b.price_per_night)}/nuit"

    lines = [
        [Paragraph('<b>DÉSIGNATION</b>', label_style), Paragraph('<b>MONTANT</b>', ParagraphStyle('r', parent=label_style, alignment=TA_RIGHT))],
        [Paragraph(hebergement_label, value_style),
         Paragraph(fmt_fcfa(b.total_price), ParagraphStyle('ra', parent=value_style, alignment=TA_RIGHT))],
    ]
    for svc in (invoice.extra_services or []):
        lines.append([
            Paragraph(svc.get('label', 'Service'), value_style),
            Paragraph(fmt_fcfa(svc.get('amount', 0)), ParagraphStyle('ra', parent=value_style, alignment=TA_RIGHT)),
        ])
    if float(invoice.taxes) > 0:
        lines.append([
            Paragraph("Taxes & frais", ParagraphStyle('tax', parent=value_style, textColor=muted)),
            Paragraph(fmt_fcfa(invoice.taxes), ParagraphStyle('ra', parent=value_style, alignment=TA_RIGHT, textColor=muted)),
        ])
    lines.append([
        Paragraph('<b>TOTAL</b>', ParagraphStyle('tot', parent=label_style, fontSize=11)),
        Paragraph(f'<b>{fmt_fcfa(invoice.total)}</b>', ParagraphStyle('totr', parent=label_style, fontSize=11, alignment=TA_RIGHT)),
    ])

    amounts_table = Table(lines, colWidths=['65%', '35%'])
    n = len(lines)
    amounts_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,0), 0.5, muted),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5F4F0')),
        ('LINEABOVE', (0,n-1), (-1,n-1), 1, dark),
        ('LINEBELOW', (0,n-1), (-1,n-1), 1.5, gold),
        ('BACKGROUND', (0,n-1), (-1,n-1), colors.HexColor('#FBF5E6')),
    ]))
    story.append(amounts_table)
    story.append(Spacer(1, 0.5*cm))

    # Paiement
    if invoice.payment_method:
        pay_labels = {'cash': 'Espèces', 'card': 'Carte bancaire', 'mobile': 'Mobile Money', 'transfer': 'Virement', 'other': 'Autre'}
        story.append(Paragraph(f"Mode de paiement : <b>{pay_labels.get(invoice.payment_method, invoice.payment_method)}</b>", sub_style))
        if invoice.paid_at:
            story.append(Paragraph(f"Payée le : {fmt_date(invoice.paid_at)}", sub_style))
    story.append(Spacer(1, 1*cm))

    # Pied de page
    story.append(HRFlowable(width="100%", thickness=0.5, color=gold))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(f"Merci de votre confiance — {hotel_name}", center_style))
    story.append(Paragraph(f"Document généré le {fmt_date(timezone.now())}", center_style))

    doc.build(story)
    buffer.seek(0)
    filename = f"facture_{invoice.number}.pdf"
    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
