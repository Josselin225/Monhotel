import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { MonthlyReport, FullReport } from '../api/reports'

// ── Palette ────────────────────────────────────────────────────────────────
const GOLD    : [number,number,number] = [201, 151,  58]
const DARK    : [number,number,number] = [ 26,  18,   8]
const GRAY900 : [number,number,number] = [ 17,  24,  39]
const GRAY700 : [number,number,number] = [ 55,  65,  81]
const GRAY500 : [number,number,number] = [107, 114, 128]
const GRAY100 : [number,number,number] = [243, 244, 246]
const EMERALD : [number,number,number] = [ 21, 128,  61]
const EMFILL  : [number,number,number] = [240, 253, 244]
const RED     : [number,number,number] = [185,  28,  28]
const REDFILL : [number,number,number] = [254, 242, 242]
const BLUE    : [number,number,number] = [ 29,  78, 216]
const BLUEFILL: [number,number,number] = [239, 246, 255]
const AMBER   : [number,number,number] = [146,  64,  14]
const AMBFILL : [number,number,number] = [255, 237, 213]
const VIOLET  : [number,number,number] = [ 91,  33, 182]
const VIOFILL : [number,number,number] = [245, 243, 255]
const PRIMARY : [number,number,number] = [196,  97,  21]
const PRIFILL : [number,number,number] = [255, 247, 237]

const W      = 210
const MARGIN = 14
const CW     = W - 2 * MARGIN  // 182

// ── Colonnes ──────────────────────────────────────────────────────────────
const COL_GAP     = 5
const COL_W       = (CW - COL_GAP) / 2       // ~88.5
const C1X         = MARGIN                    // 14
const C2X         = MARGIN + COL_W + COL_GAP  // ~107.5
const C1_RMARGIN  = W - C1X - COL_W           // right-margin for autoTable left col

// ── Number formatter ──────────────────────────────────────────────────────
function fmt(n: number, dec = 0): string {
  const abs   = Math.abs(n)
  const fixed = abs.toFixed(dec)
  const parts = fixed.split('.')
  parts[0]    = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const body  = dec > 0 ? parts[0] + ',' + (parts[1] ?? '0') : parts[0]
  return n < 0 ? '-' + body : body
}
function fmtM(n: number) { return fmt(n) + ' FCFA' }

// ── Mini header (page 2) ──────────────────────────────────────────────────
function miniHeader(doc: jsPDF, hotelName: string, periodLabel: string) {
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 14, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 14, W, 1, 'F')
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...GOLD)
  doc.text(hotelName, MARGIN, 9.5)
  doc.setFont('helvetica', 'normal').setTextColor(200, 200, 200)
  doc.text('Rapport ' + periodLabel, W - MARGIN, 9.5, { align: 'right' })
}

// ── Titre de colonne ──────────────────────────────────────────────────────
function colTitle(doc: jsPDF, x: number, xEnd: number, y: number, title: string): number {
  doc.setFillColor(...GOLD)
  doc.rect(x, y, 3, 7, 'F')
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...GRAY900)
  doc.text(title, x + 6, y + 5.5)
  doc.setDrawColor(...GRAY100).setLineWidth(0.3)
  doc.line(x, y + 9, xEnd, y + 9)
  return y + 14
}

// ── Titre de section pleine largeur ──────────────────────────────────────
function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(...GOLD)
  doc.rect(MARGIN, y, 3, 7, 'F')
  doc.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...GRAY900)
  doc.text(title, MARGIN + 6, y + 5.5)
  doc.setDrawColor(...GRAY100).setLineWidth(0.3)
  doc.line(MARGIN, y + 9, W - MARGIN, y + 9)
  return y + 14
}

// ── Footer ────────────────────────────────────────────────────────────────
function footer(doc: jsPDF, page: number, total: number, hotelName: string) {
  const PH = 297
  doc.setDrawColor(...GRAY100).setLineWidth(0.3)
  doc.line(MARGIN, PH - 11, W - MARGIN, PH - 11)
  doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY500)
  doc.text(hotelName, MARGIN, PH - 6)
  doc.text('Page ' + page + ' / ' + total, W / 2, PH - 6, { align: 'center' })
  doc.text('Genere le ' + new Date().toLocaleDateString('fr-FR'), W - MARGIN, PH - 6, { align: 'right' })
}

// ── KPI box ───────────────────────────────────────────────────────────────
function kpiBox(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  accent: [number,number,number], bg: [number,number,number],
) {
  doc.setFillColor(...bg)
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F')
  doc.setFillColor(...accent)
  doc.roundedRect(x, y, w, 2, 1, 1, 'F')
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...accent)
  doc.text(label.toUpperCase(), x + 4, y + 8)
  doc.setFontSize(11.5).setFont('helvetica', 'bold').setTextColor(...GRAY900)
  doc.text(value, x + 4, y + 15.5)
  if (sub) {
    doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(...GRAY500)
    doc.text(sub, x + 4, y + 20.5)
  }
}

// ── Finance box (pleine largeur colonne, empilée) ─────────────────────────
function finBox(
  doc: jsPDF, x: number, y: number, w: number,
  label: string, value: string,
  accent: [number,number,number], bg: [number,number,number],
): number {
  const h = 16
  doc.setFillColor(...bg)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  doc.setFillColor(...accent)
  doc.roundedRect(x, y, w, 2, 1, 1, 'F')
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...accent)
  doc.text(label.toUpperCase(), x + 4, y + 7)
  doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(...GRAY900)
  doc.text(value, x + w - 4, y + 13, { align: 'right' })
  return y + h + 2.5
}

// ── Score bar ─────────────────────────────────────────────────────────────
function scoreBar(doc: jsPDF, x: number, y: number, bw: number, label: string, val: number | null) {
  if (val === null) return
  const color: [number,number,number] = val >= 4 ? EMERALD : val >= 3 ? AMBER : RED
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...GRAY700)
  doc.text(label, x, y + 3)
  doc.setFillColor(...GRAY100)
  doc.roundedRect(x, y + 5, bw, 3, 1, 1, 'F')
  doc.setFillColor(...color)
  doc.roundedRect(x, y + 5, bw * (val / 5), 3, 1, 1, 'F')
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...color)
  doc.text(val.toFixed(1), x + bw + 4, y + 7.5)
  doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY500)
  doc.text('/5', x + bw + 10, y + 7.5)
}

// ── Progress bar ──────────────────────────────────────────────────────────
function progressBar(doc: jsPDF, x: number, y: number, bw: number, pct: number, color: [number,number,number]) {
  doc.setFillColor(...GRAY100)
  doc.roundedRect(x, y, bw, 4, 1.5, 1.5, 'F')
  if (pct > 0) {
    doc.setFillColor(...color)
    doc.roundedRect(x, y, bw * Math.min(pct / 100, 1), 4, 1.5, 1.5, 'F')
  }
}

// ── Export principal ──────────────────────────────────────────────────────
export function generateMonthlyReportPdf(report: MonthlyReport, hotelName = 'Mon Hotel') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { period, bookings, finances, satisfaction, maintenance, housekeeping } = report
  const TOTAL_PAGES = 2

  // ==========================================================================
  // PAGE 1 — En-tête · KPIs · Réservations (gauche) · Finances (droite)
  // ==========================================================================
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 48, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 48, W, 1.5, 'F')

  doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(...GOLD)
  doc.text(hotelName, MARGIN, 18)
  doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(200, 200, 200)
  doc.text('RAPPORT DE GESTION MENSUEL', MARGIN, 27)
  doc.setFontSize(8).setTextColor(160, 140, 100)
  doc.text('Synthese des indicateurs cles', MARGIN, 34)

  // Badge période
  const bx = W - MARGIN - 44, by = 8
  doc.setFillColor(...GOLD)
  doc.roundedRect(bx, by, 44, 30, 4, 4, 'F')
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...DARK)
  doc.text('PERIODE', bx + 22, by + 8, { align: 'center' })
  const pParts = period.label.split(' ')
  doc.setFontSize(13); doc.text(pParts[0] ?? '', bx + 22, by + 17, { align: 'center' })
  doc.setFontSize(10); doc.text(pParts[1] ?? '', bx + 22, by + 24, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  let y = 58
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY500)
  doc.text('INDICATEURS CLES', MARGIN, y)
  y += 4

  const GAP = 3
  const KH  = 24
  const RW3 = (CW - 2 * GAP) / 3
  const RW2 = (CW - GAP) / 2

  kpiBox(doc, MARGIN,                 y, RW3, KH, 'Revenus hebergement', fmtM(bookings.revenue),          '',                                EMERALD, EMFILL)
  kpiBox(doc, MARGIN + RW3 + GAP,     y, RW3, KH, "Taux d'occupation",   fmt(bookings.occupancy,1)+' %', bookings.nights_sold+' nuits',      BLUE,    BLUEFILL)
  kpiBox(doc, MARGIN + 2*(RW3+GAP),   y, RW3, KH, 'RevPAR',              fmt(bookings.revpar)+' FCFA',   'Revenu / chambre dispo',           VIOLET,  VIOFILL)
  y += KH + GAP

  kpiBox(doc, MARGIN,             y, RW2, KH, 'ADR - Prix moyen / nuit', fmt(bookings.adr)+' FCFA',  bookings.total_rooms+' chambres',                              AMBER,   AMBFILL)
  kpiBox(doc, MARGIN + RW2 + GAP, y, RW2, KH, 'Reservations du mois',   String(bookings.total),     bookings.cancelled+' annulees - '+bookings.no_show+' no-shows', PRIMARY, PRIFILL)
  y += KH + 7

  // ── Deux colonnes : Réservations | Finances ───────────────────────────────
  const SEC_Y  = y
  const BODY_Y = SEC_Y + 14

  colTitle(doc, C1X, C1X + COL_W, SEC_Y, 'RESERVATIONS')
  colTitle(doc, C2X, W - MARGIN,  SEC_Y, 'FINANCES')

  // -- Colonne gauche : table réservations --
  autoTable(doc, {
    startY: BODY_Y,
    head: [['Statut', 'Nb']],
    body: [
      ['Total',         String(bookings.total)],
      ['Confirmees',    String(bookings.confirmed)],
      ['En cours',      String(bookings.checked_in)],
      ['Terminees',     String(bookings.checked_out)],
      ['Annulees',      String(bookings.cancelled)],
      ['No-shows',      String(bookings.no_show)],
      ['Nuits vendues', String(bookings.nights_sold)],
    ],
    theme: 'grid',
    headStyles:   { fillColor: GOLD, textColor: DARK, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles:   { fontSize: 8, textColor: GRAY700 },
    columnStyles: { 0: { cellWidth: COL_W * 0.7 }, 1: { cellWidth: COL_W * 0.3, halign: 'right', fontStyle: 'bold' } },
    margin:       { left: C1X, right: C1_RMARGIN },
    tableWidth:   COL_W,
  })

  // Sources de réservation (sous la table, colonne gauche)
  let leftY    = (doc as any).lastAutoTable.finalY + 5
  const srcBarW = COL_W - 18
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...GRAY700)
  doc.text('Sources de reservation', C1X, leftY)
  leftY += 4
  for (const s of bookings.sources) {
    const pct = bookings.total > 0 ? s.count / bookings.total : 0
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY700)
    doc.text(s.label, C1X, leftY + 3)
    progressBar(doc, C1X, leftY + 5, srcBarW, pct * 100, GOLD)
    doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...GRAY900)
    doc.text(String(s.count), C1X + srcBarW + 4, leftY + 7.5)
    leftY += 11
  }

  // -- Colonne droite : boîtes finance + table catégories --
  let ry = BODY_Y
  ry = finBox(doc, C2X, ry, COL_W, 'Revenus',      fmtM(finances.income),  EMERALD, EMFILL)
  ry = finBox(doc, C2X, ry, COL_W, 'Depenses',     fmtM(finances.expense), RED,     REDFILL)
  const netPos = finances.net >= 0
  ry = finBox(doc, C2X, ry, COL_W, 'Resultat net', (netPos ? '+' : '') + fmtM(finances.net), netPos ? BLUE : AMBER, netPos ? BLUEFILL : AMBFILL)
  ry += 3

  const catEntries = Object.entries(finances.by_category)
  if (catEntries.length > 0) {
    doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...GRAY700)
    doc.text('Detail par categorie', C2X, ry)
    ry += 3
    autoTable(doc, {
      startY: ry,
      head: [['Categorie', 'Revenus', 'Depenses']],
      body: catEntries.map(([, r]) => [
        r.label,
        r.income  ? fmtM(r.income)  : '-',
        r.expense ? fmtM(r.expense) : '-',
      ]),
      theme: 'striped',
      headStyles:   { fillColor: GOLD, textColor: DARK, fontSize: 7, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 7.5, textColor: GRAY700 },
      columnStyles: {
        0: { cellWidth: COL_W * 0.38 },
        1: { cellWidth: COL_W * 0.31, halign: 'right' },
        2: { cellWidth: COL_W * 0.31, halign: 'right' },
      },
      margin:     { left: C2X, right: MARGIN },
      tableWidth: COL_W,
    })
  } else {
    doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucune transaction ce mois-ci.', C2X, ry + 4)
  }

  footer(doc, 1, TOTAL_PAGES, hotelName)

  // ==========================================================================
  // PAGE 2 — Satisfaction · Maintenance · Housekeeping
  // ==========================================================================
  doc.addPage()
  miniHeader(doc, hotelName, period.label)
  y = 22

  // ── Satisfaction ──────────────────────────────────────────────────────────
  y = sectionTitle(doc, y, 'SATISFACTION CLIENTS')

  if (satisfaction.count === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucun questionnaire soumis ce mois-ci.', MARGIN, y + 4)
    y += 14
  } else {
    const cx = MARGIN + 13, cy = y + 15
    doc.setFillColor(...GRAY100)
    doc.circle(cx, cy, 12, 'F')
    const ov    = satisfaction.avg_overall ?? 0
    const ovCol : [number,number,number] = ov >= 4 ? EMERALD : ov >= 3 ? AMBER : RED
    doc.setFontSize(13).setFont('helvetica', 'bold').setTextColor(...ovCol)
    doc.text(ov.toFixed(1), cx, cy + 2, { align: 'center' })
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY500)
    doc.text('/5', cx, cy + 7, { align: 'center' })
    doc.setFontSize(7.5).setTextColor(...GRAY700)
    doc.text(satisfaction.count + ' avis', cx, cy + 12, { align: 'center' })

    const BX = MARGIN + 32, BW = 90
    const scores: [string, number | null][] = [
      ['Proprete',              satisfaction.avg_cleanliness],
      ['Service',               satisfaction.avg_service],
      ['Confort',               satisfaction.avg_comfort],
      ['Rapport qualite/prix',  satisfaction.avg_value],
    ]
    let sby = y
    for (const [lbl, val] of scores) {
      scoreBar(doc, BX, sby, BW, lbl, val)
      sby += 10
    }
    const wrColor: [number,number,number] = satisfaction.would_return_pct >= 70 ? EMERALD : AMBER
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...GRAY700)
    doc.text(satisfaction.would_return_pct + ' % des clients souhaitent revenir', BX, sby + 4)
    progressBar(doc, BX, sby + 6, BW, satisfaction.would_return_pct, wrColor)
    y = sby + 16
  }

  // ── Maintenance ───────────────────────────────────────────────────────────
  y = sectionTitle(doc, y, 'MAINTENANCE')

  if (maintenance.total === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucun ticket ce mois-ci.', MARGIN, y + 4)
    y += 14
  } else {
    const MC1 = MARGIN, MC2 = MARGIN + CW / 2 + 3, MCW = CW / 2 - 3

    autoTable(doc, {
      startY: y,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Total tickets',      String(maintenance.total)],
        ['En cours / Ouverts', String(maintenance.open)],
        ['Resolus / Clotures', String(maintenance.resolved)],
        ['Cout total',         fmtM(maintenance.cost)],
      ],
      theme: 'grid',
      headStyles:   { fillColor: GOLD, textColor: DARK, fontSize: 8, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8.5, textColor: GRAY700 },
      columnStyles: { 0: { cellWidth: MCW * 0.62 }, 1: { cellWidth: MCW * 0.38, halign: 'right', fontStyle: 'bold' } },
      margin:       { left: MC1, right: MC2 + 1 },
      tableWidth:   MCW,
    })

    const priorities = maintenance.by_priority.filter(p => p.count > 0)
    if (priorities.length > 0) {
      const priorityColors: Record<string, [number,number,number]> = {
        low: EMERALD, medium: AMBER, high: [196, 97, 21], urgent: RED,
      }
      let py = y + 2
      doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY700)
      doc.text('Par priorite', MC2, py + 3)
      py += 8
      for (const p of priorities) {
        const col = priorityColors[p.key] ?? GRAY500
        doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...GRAY700)
        doc.text(p.label, MC2, py + 3)
        progressBar(doc, MC2, py + 5, MCW - 18, (p.count / maintenance.total) * 100, col)
        doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY900)
        doc.text(String(p.count), MC2 + MCW - 13, py + 8)
        py += 12
      }
    }

    y = (doc as any).lastAutoTable.finalY + 8
  }

  // ── Housekeeping ──────────────────────────────────────────────────────────
  y = sectionTitle(doc, y, 'MENAGE DES CHAMBRES')

  if (housekeeping.total === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucune tache planifiee ce mois-ci.', MARGIN, y + 4)
    y += 14
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Total taches planifiees', String(housekeeping.total)],
        ['Terminees',               String(housekeeping.done)],
        ['En attente / En cours',   String(housekeeping.pending)],
      ],
      theme: 'striped',
      headStyles:   { fillColor: GOLD, textColor: DARK, fontSize: 8, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8.5, textColor: GRAY700 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 92, halign: 'right', fontStyle: 'bold' } },
      margin:       { left: MARGIN, right: MARGIN },
    })
    const hy      = (doc as any).lastAutoTable.finalY + 5
    const compW   = CW - 50
    const compPct = housekeeping.completion_rate
    const compCol : [number,number,number] = compPct >= 90 ? EMERALD : compPct >= 70 ? AMBER : RED
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY700)
    doc.text('Taux de completion :', MARGIN, hy + 3.5)
    progressBar(doc, MARGIN + 44, hy, compW, compPct, compCol)
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...compCol)
    doc.text(compPct + ' %', MARGIN + 44 + compW + 4, hy + 3.5)
  }

  footer(doc, 2, TOTAL_PAGES, hotelName)

  doc.save('Rapport-' + period.label.replace(' ', '-') + '.pdf')
}

// ── Helper footer sans total ──────────────────────────────────────────────────
function footerFull(doc: jsPDF, page: number, hotelName: string, periodLabel: string) {
  const PH = 297
  doc.setDrawColor(...GRAY100).setLineWidth(0.3)
  doc.line(MARGIN, PH - 11, W - MARGIN, PH - 11)
  doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY500)
  doc.text(hotelName + '  -  Bilan mensuel  -  ' + periodLabel, MARGIN, PH - 6)
  doc.text('Page ' + page, W - MARGIN, PH - 6, { align: 'right' })
  doc.text('Genere le ' + new Date().toLocaleDateString('fr-FR'), W / 2, PH - 6, { align: 'center' })
}

// ── Date "DD/MM" depuis ISO "YYYY-MM-DD" ─────────────────────────────────────
function fd(d: string): string {
  return d.slice(8, 10) + '/' + d.slice(5, 7)
}
function fdy(d: string): string {
  return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4)
}

// ── Export bilan mensuel complet ──────────────────────────────────────────────
export function generateFullReportPdf(report: FullReport, hotelName = 'Mon Hotel') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { period, rooms, concluded, vip, finances, satisfaction, maintenance, housekeeping } = report
  const KH = 22, KG = 3
  const BOTTOM = 277
  let y = 0, page = 1

  // Pagination helpers — add a page only when content would overflow
  const newPage = () => {
    footerFull(doc, page++, hotelName, period.label)
    doc.addPage()
    miniHeader(doc, hotelName, period.label)
    y = 22
  }
  const ensure = (needed: number) => { if (y + needed > BOTTOM) newPage() }

  // ── Grand en-tête (page 1 uniquement) ────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 52, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 52, W, 1.5, 'F')
  doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(...GOLD)
  doc.text(hotelName, MARGIN, 18)
  doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(200, 200, 200)
  doc.text('BILAN MENSUEL COMPLET', MARGIN, 29)
  doc.setFontSize(7.5).setTextColor(160, 140, 100)
  doc.text('Chambres  -  Reservations  -  Clients VIP  -  Finances  -  Operations', MARGIN, 37)

  const bx = W - MARGIN - 44, bby = 8
  doc.setFillColor(...GOLD)
  doc.roundedRect(bx, bby, 44, 32, 4, 4, 'F')
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...DARK)
  doc.text('PERIODE', bx + 22, bby + 8, { align: 'center' })
  const pParts = period.label.split(' ')
  doc.setFontSize(14); doc.text(pParts[0] ?? '', bx + 22, bby + 19, { align: 'center' })
  doc.setFontSize(10); doc.text(pParts[1] ?? '', bx + 22, bby + 27, { align: 'center' })

  // KPIs chambres
  y = 60
  const RW4 = (CW - 3 * KG) / 4
  kpiBox(doc, MARGIN,               y, RW4, KH, 'Disponibles', String(rooms.available),   '', EMERALD, EMFILL)
  kpiBox(doc, MARGIN + RW4 + KG,    y, RW4, KH, 'Occupees',    String(rooms.occupied),    '', BLUE,    BLUEFILL)
  kpiBox(doc, MARGIN + 2*(RW4+KG),  y, RW4, KH, 'Maintenance', String(rooms.maintenance), '', RED,     REDFILL)
  kpiBox(doc, MARGIN + 3*(RW4+KG),  y, RW4, KH, 'Nettoyage',   String(rooms.cleaning),   '', AMBER,   AMBFILL)
  y += KH + KG

  const RW2 = (CW - KG) / 2
  kpiBox(doc, MARGIN,        y, RW2, KH, "Taux d'occupation", fmt(rooms.occupancy_pct, 1) + ' %', String(rooms.total) + ' chambres au total', VIOLET, VIOFILL)
  kpiBox(doc, MARGIN+RW2+KG, y, RW2, KH, 'Revenus du mois',   fmtM(finances.income), (finances.net >= 0 ? '+' : '') + fmtM(finances.net) + ' net', EMERALD, EMFILL)
  y += KH + 8

  // ── CHAMBRES ──────────────────────────────────────────────────────────────
  ensure(40)
  y = sectionTitle(doc, y, 'ETAT DES CHAMBRES PAR ETAGE')
  autoTable(doc, {
    startY: y,
    head: [['Etage', 'Total', 'Disponibles', 'Occupees', 'Maintenance', 'Nettoyage']],
    body: rooms.by_floor.map(f => [
      f.label, String(f.total), String(f.available), String(f.occupied),
      String(f.maintenance), String(f.cleaning),
    ]),
    theme: 'grid',
    headStyles: { fillColor: GOLD, textColor: DARK, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: GRAY700 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'right', textColor: EMERALD },
      3: { cellWidth: 28, halign: 'right', textColor: BLUE },
      4: { cellWidth: 28, halign: 'right', textColor: RED },
      5: { halign: 'right', textColor: AMBER },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index > 1 && d.cell.raw === '0')
        d.cell.styles.textColor = GRAY100
    },
  })
  y = (doc as any).lastAutoTable.finalY + 5

  // Chambres actuellement occupées
  const occupiedRooms = rooms.list.filter(r => r.status === 'occupied')
  if (occupiedRooms.length > 0) {
    ensure(16)
    doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...GRAY700)
    doc.text('Chambres actuellement occupees :', MARGIN, y)
    y += 5
    const COLS = 4, CWC = CW / COLS
    occupiedRooms.slice(0, 16).forEach((rm, i) => {
      const cx = MARGIN + (i % COLS) * CWC
      const ry = y + Math.floor(i / COLS) * 8
      doc.setFillColor(...BLUEFILL)
      doc.roundedRect(cx, ry, CWC - 2, 6.5, 1, 1, 'F')
      doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...BLUE)
      doc.text('Ch. ' + rm.number, cx + 2, ry + 4.5)
      if (rm.current_guest) {
        const n = rm.current_guest.length > 14 ? rm.current_guest.slice(0, 14) + '.' : rm.current_guest
        doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(...GRAY500)
        doc.text(n, cx + 18, ry + 4.5)
      }
    })
    const rowsShown = Math.ceil(Math.min(occupiedRooms.length, 16) / COLS)
    y += rowsShown * 8 + 3
    if (occupiedRooms.length > 16) {
      doc.setFontSize(7).setFont('helvetica', 'italic').setTextColor(...GRAY500)
      doc.text('... et ' + (occupiedRooms.length - 16) + ' autre(s)', MARGIN, y)
      y += 5
    }
  }

  // ── RÉSERVATIONS CONCLUES ─────────────────────────────────────────────────
  y += 4
  ensure(concluded.list.length > 0 ? 60 : 55)
  y = sectionTitle(doc, y, 'RESERVATIONS CONCLUES')

  const R3W = (CW - 2 * KG) / 3
  kpiBox(doc, MARGIN,             y, R3W, KH, 'Sejours termines', String(concluded.total),       '', GRAY900, GRAY100)
  kpiBox(doc, MARGIN + R3W + KG,  y, R3W, KH, 'Revenus generes',  fmtM(concluded.revenue),       '', EMERALD, EMFILL)
  kpiBox(doc, MARGIN+2*(R3W+KG),  y, R3W, KH, 'Duree moyenne',    concluded.avg_stay + ' nuits', '', BLUE,    BLUEFILL)
  y += KH + 5

  if (concluded.list.length === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucune reservation conclue ce mois-ci.', MARGIN, y + 4)
    y += 14
  } else {
    const MAX_BK = 20
    autoTable(doc, {
      startY: y,
      head: [['Reference', 'Client', 'Ch.', 'Arrivee', 'Depart', 'Nts', 'Montant', 'Source']],
      body: concluded.list.slice(0, MAX_BK).map(b => [
        b.reference,
        b.client_name + (b.vip_status !== 'regular' ? ' *' : ''),
        b.room_number, fd(b.check_in), fd(b.check_out),
        String(b.nights), fmtM(b.total_price), b.source,
      ]),
      theme: 'striped',
      headStyles:   { fillColor: GOLD, textColor: DARK, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 7.5, textColor: GRAY700 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 44 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 10, halign: 'right' },
        6: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
        7: { halign: 'center' },
      },
      margin: { left: MARGIN, right: MARGIN },
    })
    y = (doc as any).lastAutoTable.finalY + 3
    if (concluded.total > MAX_BK) {
      doc.setFontSize(7).setFont('helvetica', 'italic').setTextColor(...GRAY500)
      doc.text('* Rapport limite aux ' + MAX_BK + ' dernieres reservations (' + concluded.total + ' au total).', MARGIN, y)
      y += 5
    }
  }

  // ── CLIENTS VIP ───────────────────────────────────────────────────────────
  y += 4
  ensure(vip.list.length > 0 ? 65 : 30)
  y = sectionTitle(doc, y, 'CLIENTS VIP')

  if (vip.list.length === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucun client VIP enregistre.', MARGIN, y + 4)
    y += 14
  } else {
    const VRW = (CW - KG) / 2
    kpiBox(doc, MARGIN,        y, VRW, 18, 'Clients VIP',  String(vip.vip_count),  '', VIOLET, VIOFILL)
    kpiBox(doc, MARGIN+VRW+KG, y, VRW, 18, 'Clients VVIP', String(vip.vvip_count), '', AMBER,  AMBFILL)
    y += 21
    const MAX_VIP = 15
    autoTable(doc, {
      startY: y,
      head: [['Statut', 'Nom', 'Nationalite', 'Sejours', 'Total depense', 'Dernier sejour', 'Ce mois']],
      body: vip.list.slice(0, MAX_VIP).map(c => [
        c.vip_status.toUpperCase(), c.name, c.nationality || '-',
        String(c.total_stays), fmtM(c.total_spent),
        c.last_stay ? fdy(c.last_stay) : '-',
        c.stayed_this_period ? 'Oui' : '-',
      ]),
      theme: 'striped',
      headStyles:   { fillColor: DARK, textColor: [255,255,255] as [number,number,number], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8, textColor: GRAY700 },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 0) {
          d.cell.styles.fontStyle = 'bold'
          d.cell.styles.textColor = (d.cell.raw as string) === 'VVIP' ? AMBER : VIOLET
        }
        if (d.section === 'body' && d.column.index === 6 && d.cell.raw === 'Oui') {
          d.cell.styles.textColor = EMERALD
          d.cell.styles.fontStyle = 'bold'
        }
      },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { cellWidth: 44 },
        2: { cellWidth: 24 },
        3: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 36, halign: 'right' },
        5: { cellWidth: 22, halign: 'center' },
        6: { halign: 'center' },
      },
      margin: { left: MARGIN, right: MARGIN },
    })
    y = (doc as any).lastAutoTable.finalY + 5
  }

  // ── POINT FINANCIER ────────────────────────────────────────────────────────
  y += 4
  ensure(95)
  y = sectionTitle(doc, y, 'POINT FINANCIER')

  const F3W = (CW - 2 * KG) / 3
  const netPos = finances.net >= 0
  kpiBox(doc, MARGIN,             y, F3W, KH, 'Revenus',      fmtM(finances.income),  '', EMERALD, EMFILL)
  kpiBox(doc, MARGIN + F3W + KG,  y, F3W, KH, 'Depenses',     fmtM(finances.expense), '', RED,     REDFILL)
  kpiBox(doc, MARGIN+2*(F3W+KG),  y, F3W, KH, 'Resultat net', (netPos ? '+' : '') + fmtM(finances.net), '', netPos ? BLUE : AMBER, netPos ? BLUEFILL : AMBFILL)
  y += KH + 8

  colTitle(doc, C1X, C1X + COL_W, y, 'REVENUS PAR CATEGORIE')
  colTitle(doc, C2X, W - MARGIN,  y, 'DEPENSES VS BUDGET')
  const tblY = y + 14

  autoTable(doc, {
    startY: tblY,
    head: [['Categorie', 'Montant', '%']],
    body: finances.income_by_category.length > 0
      ? finances.income_by_category.map(c => [c.label, fmtM(c.amount), fmt(c.pct, 1) + '%'])
      : [['Aucun revenu ce mois.', '', '']],
    theme: 'striped',
    headStyles:   { fillColor: EMERALD, textColor: [255,255,255] as [number,number,number], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles:   { fontSize: 8, textColor: GRAY700 },
    columnStyles: {
      0: { cellWidth: COL_W * 0.52 },
      1: { cellWidth: COL_W * 0.33, halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right', textColor: GRAY500 },
    },
    margin: { left: C1X, right: W - C1X - COL_W },
  })
  const leftFinY = (doc as any).lastAutoTable.finalY

  autoTable(doc, {
    startY: tblY,
    head: [['Categorie', 'Depense', 'Budget']],
    body: finances.expense_by_category.length > 0
      ? finances.expense_by_category.map(c => [
          c.label,
          fmtM(c.amount) + (c.over_budget ? ' !' : ''),
          c.budget != null ? fmtM(c.budget) : '-',
        ])
      : [['Aucune depense ce mois.', '', '']],
    theme: 'striped',
    headStyles:   { fillColor: RED, textColor: [255,255,255] as [number,number,number], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles:   { fontSize: 8, textColor: GRAY700 },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1 && (d.cell.raw as string).includes(' !'))
        d.cell.styles.textColor = RED
    },
    columnStyles: {
      0: { cellWidth: COL_W * 0.45 },
      1: { cellWidth: COL_W * 0.37, halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right', textColor: GRAY500 },
    },
    margin: { left: C2X, right: MARGIN },
  })
  y = Math.max(leftFinY, (doc as any).lastAutoTable.finalY) + 8

  // Modes de paiement
  if (finances.payment_methods.length > 0) {
    ensure(14 + finances.payment_methods.length * 9)
    y = sectionTitle(doc, y, 'MODES DE PAIEMENT')
    const pmBW = CW - 55
    for (const pm of finances.payment_methods) {
      doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...GRAY700)
      doc.text(pm.label, MARGIN, y + 3)
      progressBar(doc, MARGIN + 44, y, pmBW, pm.pct, GOLD)
      doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY900)
      doc.text(fmtM(pm.amount), MARGIN + 44 + pmBW + 3, y + 3)
      doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY500)
      doc.text(fmt(pm.pct, 1) + '%', W - MARGIN, y + 3, { align: 'right' })
      y += 9
    }
    y += 4
  }

  // Top transactions
  if (finances.top_transactions.length > 0) {
    ensure(50)
    y = sectionTitle(doc, y, 'TOP TRANSACTIONS DU MOIS')
    autoTable(doc, {
      startY: y,
      head: [['#', 'Description', 'Categorie', 'Mode', 'Date', 'Montant']],
      body: finances.top_transactions.map((tx, i) => [
        String(i + 1),
        (tx.description || tx.label).slice(0, 45),
        tx.label, tx.payment_method, fd(tx.date),
        (tx.type === 'income' ? '+' : '-') + fmtM(tx.amount),
      ]),
      theme: 'striped',
      headStyles: { fillColor: GOLD, textColor: DARK, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY700 },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 5) {
          d.cell.styles.fontStyle = 'bold'
          d.cell.styles.textColor = (d.cell.raw as string).startsWith('+') ? EMERALD : RED
        }
      },
      columnStyles: {
        0: { cellWidth: 9,  halign: 'center', textColor: GRAY500 },
        1: { cellWidth: 56 },
        2: { cellWidth: 32 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18, halign: 'center' },
        5: { halign: 'right' },
      },
      margin: { left: MARGIN, right: MARGIN },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  }

  // ── SATISFACTION ──────────────────────────────────────────────────────────
  y += 2
  ensure(satisfaction.count > 0 ? 60 : 30)
  y = sectionTitle(doc, y, 'SATISFACTION CLIENTS')

  if (satisfaction.count === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucun questionnaire soumis ce mois-ci.', MARGIN, y + 4)
    y += 14
  } else {
    const cx = MARGIN + 13, cy2 = y + 15
    doc.setFillColor(...GRAY100); doc.circle(cx, cy2, 12, 'F')
    const ov = satisfaction.avg_overall ?? 0
    const ovCol: [number,number,number] = ov >= 4 ? EMERALD : ov >= 3 ? AMBER : RED
    doc.setFontSize(13).setFont('helvetica', 'bold').setTextColor(...ovCol)
    doc.text(ov.toFixed(1), cx, cy2 + 2, { align: 'center' })
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY500)
    doc.text('/5', cx, cy2 + 7, { align: 'center' })
    doc.setFontSize(7.5).setTextColor(...GRAY700)
    doc.text(satisfaction.count + ' avis', cx, cy2 + 12, { align: 'center' })
    const BX = MARGIN + 32, BW = 90
    const scores: [string, number | null][] = [
      ['Proprete',     satisfaction.avg_cleanliness],
      ['Service',      satisfaction.avg_service],
      ['Confort',      satisfaction.avg_comfort],
      ['Qualite/prix', satisfaction.avg_value],
    ]
    let sy = y
    for (const [lbl, val] of scores) { scoreBar(doc, BX, sy, BW, lbl, val); sy += 10 }
    const wrC: [number,number,number] = satisfaction.would_return_pct >= 70 ? EMERALD : AMBER
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...GRAY700)
    doc.text(fmt(satisfaction.would_return_pct, 1) + ' % souhaitent revenir', BX, sy + 4)
    progressBar(doc, BX, sy + 6, BW, satisfaction.would_return_pct, wrC)
    y = sy + 16
  }

  // ── MAINTENANCE ───────────────────────────────────────────────────────────
  y += 2
  ensure(maintenance.total > 0 ? 65 : 30)
  y = sectionTitle(doc, y, 'MAINTENANCE')

  if (maintenance.total === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucun ticket ce mois-ci.', MARGIN, y + 4)
    y += 14
  } else {
    const MC1 = MARGIN, MC2 = MARGIN + CW / 2 + 3, MCW = CW / 2 - 3
    autoTable(doc, {
      startY: y,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Total tickets',      String(maintenance.total)],
        ['En cours / Ouverts', String(maintenance.open)],
        ['Resolus / Clotures', String(maintenance.resolved)],
        ['Cout total',         fmtM(maintenance.cost)],
      ],
      theme: 'grid',
      headStyles:   { fillColor: GOLD, textColor: DARK, fontSize: 8, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8.5, textColor: GRAY700 },
      columnStyles: { 0: { cellWidth: MCW * 0.62 }, 1: { cellWidth: MCW * 0.38, halign: 'right', fontStyle: 'bold' } },
      margin: { left: MC1, right: W - MC1 - MCW }, tableWidth: MCW,
    })
    const priorities = maintenance.by_priority.filter(p => p.count > 0)
    if (priorities.length > 0) {
      const pColors: Record<string, [number,number,number]> = { low: EMERALD, medium: AMBER, high: [196,97,21], urgent: RED }
      let py = y + 2
      doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY700)
      doc.text('Par priorite', MC2, py + 3); py += 8
      for (const p of priorities) {
        const col = pColors[p.key] ?? GRAY500
        doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...GRAY700)
        doc.text(p.label, MC2, py + 3)
        progressBar(doc, MC2, py + 5, MCW - 18, (p.count / maintenance.total) * 100, col)
        doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY900)
        doc.text(String(p.count), MC2 + MCW - 13, py + 8)
        py += 12
      }
    }
    if (maintenance.urgent_open.length > 0) {
      y = (doc as any).lastAutoTable.finalY + 5
      doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...RED)
      doc.text('Tickets urgents ouverts :', MARGIN, y); y += 4
      for (const t of maintenance.urgent_open) {
        doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...GRAY700)
        doc.text('• ' + t.title, MARGIN + 3, y); y += 5
      }
    } else {
      y = (doc as any).lastAutoTable.finalY + 8
    }
  }

  // ── MÉNAGE ─────────────────────────────────────────────────────────────────
  y += 2
  ensure(housekeeping.total > 0 ? 55 : 30)
  y = sectionTitle(doc, y, 'MENAGE DES CHAMBRES')

  if (housekeeping.total === 0) {
    doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...GRAY500)
    doc.text('Aucune tache planifiee ce mois-ci.', MARGIN, y + 4)
    y += 14
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Total taches planifiees', String(housekeeping.total)],
        ['Terminees',               String(housekeeping.done)],
        ['En attente / En cours',   String(housekeeping.pending)],
      ],
      theme: 'striped',
      headStyles:   { fillColor: GOLD, textColor: DARK, fontSize: 8, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8.5, textColor: GRAY700 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 92, halign: 'right', fontStyle: 'bold' } },
      margin: { left: MARGIN, right: MARGIN },
    })
    const hy = (doc as any).lastAutoTable.finalY + 5
    const compPct = housekeeping.completion_rate
    const compCol: [number,number,number] = compPct >= 90 ? EMERALD : compPct >= 70 ? AMBER : RED
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...GRAY700)
    doc.text('Taux de completion :', MARGIN, hy + 3.5)
    progressBar(doc, MARGIN + 44, hy, CW - 50, compPct, compCol)
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...compCol)
    doc.text(compPct + ' %', W - MARGIN, hy + 3.5, { align: 'right' })
  }

  footerFull(doc, page, hotelName, period.label)
  doc.save('Bilan-' + period.label.replace(' ', '-') + '.pdf')
}
