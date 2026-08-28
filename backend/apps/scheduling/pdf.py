"""Génération du PDF du planning du personnel (vrai PDF vectoriel via ReportLab,
au lieu de l'impression navigateur) — même approche que apps/billing/pdf.py."""
import io
from django.http import HttpResponse
from apps.content.models import SiteContent
from .models import Shift

POSITION_COLORS = {
    'reception':    ('#DBEAFE', '#1D4ED8'),
    'housekeeping': ('#F3E8FF', '#7E22CE'),
    'maintenance':  ('#FFEDD5', '#C2410C'),
    'restaurant':   ('#DCFCE7', '#15803D'),
    'management':   ('#FEF3C7', '#B45309'),
    'security':     ('#FEE2E2', '#B91C1C'),
    'other':        ('#F3F4F6', '#4B5563'),
}

FR_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']


def generate_schedule_pdf_response(week_start, week_end, employees, shifts) -> HttpResponse:
    from datetime import timedelta
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4),
                            topMargin=1.2*cm, bottomMargin=1.2*cm,
                            leftMargin=1.2*cm, rightMargin=1.2*cm)

    gold  = colors.HexColor('#A8762A')
    dark  = colors.HexColor('#1A1916')
    muted = colors.HexColor('#6B6660')

    title_style = ParagraphStyle('title', fontSize=18, leading=22, textColor=gold, fontName='Helvetica-Bold', spaceAfter=4)
    sub_style   = ParagraphStyle('sub', fontSize=8, textColor=muted)
    h2_style    = ParagraphStyle('h2', fontSize=12, textColor=dark, fontName='Helvetica-Bold', spaceAfter=8)
    label_style = ParagraphStyle('label', fontSize=8, textColor=muted, fontName='Helvetica-Bold')
    dayhdr_style = ParagraphStyle('dayhdr', fontSize=9, textColor=dark, alignment=TA_CENTER, leading=11, fontName='Helvetica-Bold')
    emp_style   = ParagraphStyle('emp', fontSize=9, textColor=dark, leading=12, fontName='Helvetica-Bold')
    shift_style = ParagraphStyle('shift', fontSize=7.5, leading=9)
    legend_style = ParagraphStyle('legend', fontSize=8, textColor=dark)
    center_style = ParagraphStyle('center', fontSize=8, textColor=muted, alignment=TA_CENTER)

    try:
        hotel_data = SiteContent.get_content().data.get('hotel', {})
    except Exception:
        hotel_data = {}
    hotel_name = hotel_data.get('name') or 'Mon Hôtel'
    addr_parts = [p for p in [hotel_data.get('address'), hotel_data.get('city')] if p]
    contact_parts = [p for p in [hotel_data.get('phone'), hotel_data.get('email')] if p]

    story = []
    story.append(Paragraph(hotel_name.upper(), title_style))
    if addr_parts:
        story.append(Paragraph(' · '.join(addr_parts), sub_style))
    if contact_parts:
        story.append(Paragraph(' · '.join(contact_parts), sub_style))
    story.append(Spacer(1, 0.25*cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=gold))
    story.append(Spacer(1, 0.35*cm))

    story.append(Paragraph(
        f"Planning du personnel — Semaine du {week_start.strftime('%d/%m/%Y')} au {week_end.strftime('%d/%m/%Y')}",
        h2_style,
    ))

    days = [week_start + timedelta(days=i) for i in range(7)]

    header_row = [Paragraph('Employé', label_style)]
    for i, d in enumerate(days):
        header_row.append(Paragraph(
            f"{FR_DAYS[i]}<br/><font size=7 color='#6B6660'>{d.strftime('%d/%m')}</font>",
            dayhdr_style,
        ))

    shifts_by_employee_day = {}
    for s in shifts:
        shifts_by_employee_day.setdefault((s.employee_id, s.date), []).append(s)

    position_labels = dict(Shift.Position.choices)

    rows = [header_row]
    for emp in employees:
        row = [Paragraph(f"{emp.name}<br/><font size=7 color='#6B6660'>{emp.get_position_display()}</font>", emp_style)]
        for d in days:
            cell_shifts = shifts_by_employee_day.get((emp.id, d), [])
            if not cell_shifts:
                row.append('')
                continue
            mini_rows = []
            mini_bg = []
            for s in cell_shifts:
                bg, fg = POSITION_COLORS.get(s.position, POSITION_COLORS['other'])
                label = position_labels.get(s.position, s.position)
                txt = (f"<font color='{fg}'><b>{s.start_time.strftime('%H:%M')}"
                       f"–{s.end_time.strftime('%H:%M')}</b><br/>{label}</font>")
                mini_rows.append([Paragraph(txt, shift_style)])
                mini_bg.append(colors.HexColor(bg))
            mini_table = Table(mini_rows, colWidths=[2.75*cm])
            mini_style = [
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ]
            for idx, bg in enumerate(mini_bg):
                mini_style.append(('BACKGROUND', (0, idx), (0, idx), bg))
            mini_table.setStyle(TableStyle(mini_style))
            row.append(mini_table)
        rows.append(row)

    col_widths = [3.6 * cm] + [2.95 * cm] * 7
    main_table = Table(rows, colWidths=col_widths, repeatRows=1)
    main_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F5F4F0')),
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, muted),
        ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#EEEEEE')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(main_table)
    story.append(Spacer(1, 0.45 * cm))

    # Légende des postes
    used_positions = {s.position for s in shifts} or set(POSITION_COLORS.keys())
    legend_cells = []
    for key in Shift.Position.values:
        if key not in used_positions:
            continue
        bg, fg = POSITION_COLORS.get(key, POSITION_COLORS['other'])
        label = position_labels.get(key, key)
        swatch = Table([['']], colWidths=[0.35 * cm], rowHeights=[0.35 * cm])
        swatch.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor(bg)),
            ('BOX', (0, 0), (0, 0), 0.5, colors.HexColor(fg)),
        ]))
        legend_cells.append(swatch)
        legend_cells.append(Paragraph(label, legend_style))
    if legend_cells:
        legend_table = Table([legend_cells], colWidths=None)
        legend_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(legend_table)
        story.append(Spacer(1, 0.4 * cm))

    # Total d'heures par personne
    totals = {}
    for s in shifts:
        totals.setdefault(s.employee_id, {'name': s.employee.name, 'hours': 0})
        totals[s.employee_id]['hours'] += s.hours
    if totals:
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E5E0D5')))
        story.append(Spacer(1, 0.25 * cm))
        summary_line = '   ·   '.join(
            f"<b>{t['name']}</b> : {t['hours']:g}h"
            for t in sorted(totals.values(), key=lambda x: -x['hours'])
        )
        story.append(Paragraph(f"Total d'heures planifiées — {summary_line}",
                                ParagraphStyle('sum', fontSize=8.5, textColor=dark)))
        story.append(Spacer(1, 0.3 * cm))

    from django.utils import timezone
    story.append(Paragraph(f"Document généré le {timezone.now().strftime('%d/%m/%Y à %H:%M')}", center_style))

    doc.build(story)
    buffer.seek(0)
    filename = f"planning_{week_start.strftime('%Y%m%d')}.pdf"
    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
