import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Invoice } from '../types'


// U+00A0 (espace insécable) produit par Intl.NumberFormat est mal géré par Helvetica dans jsPDF
// Formateur PDF-safe : Helvetica ne supporte pas les caracteres Unicode hors Latin-1
function pdfFmt(n: number | string): string {
  const num = Math.round(Number(n))
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
}

export function generateInvoicePdf(
  invoice: Invoice,
  hotel?: { name?: string; address?: string; city?: string; phone?: string; email?: string },
) {
  const hotelName = hotel?.name ?? 'Mon Hôtel'
  const addressLine = [hotel?.address, hotel?.city].filter(Boolean).join(' - ')
  const contactLine = [hotel?.phone, hotel?.email].filter(Boolean).join(' - ')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const b = invoice.booking_detail
  const W = 210
  const margin = 16

  const headerH = addressLine || contactLine ? 34 : 28
  doc.setFillColor(184, 134, 11)
  doc.rect(0, 0, W, headerH, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(hotelName, margin, 12)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  if (addressLine) doc.text(addressLine, margin, 19)
  if (contactLine) doc.text(contactLine, margin, addressLine ? 24 : 19)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`FACTURE ${invoice.number}`, W - margin, 12, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const statusMap: Record<string, string> = { paid: 'PAYÉE', issued: 'ÉMISE', draft: 'BROUILLON', cancelled: 'ANNULÉE' }
  doc.text(statusMap[invoice.status] ?? invoice.status, W - margin, 18, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  let y = headerH + 8
  doc.setFontSize(9)

  const roomNumber = b.room_detail?.number ?? '?'
  const roomTypeName = b.room_detail?.room_type_name ?? ''
  const clientName = b.client_detail?.full_name ?? '-'

  doc.setFont('helvetica', 'bold')
  doc.text('CLIENT', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(clientName, margin, y + 5)

  const cx = 90
  doc.setFont('helvetica', 'bold')
  doc.text('SÉJOUR', cx, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`Chambre #${roomNumber}  -  ${roomTypeName}`, cx, y + 5)
  doc.text(
    `${fmtDate(b.check_in)} -> ${fmtDate(b.check_out)}  -  ${b.nights} nuit${b.nights > 1 ? 's' : ''}`,
    cx, y + 10,
  )

  const dx = 155
  doc.setFont('helvetica', 'bold')
  doc.text('DATES', dx, y)
  doc.setFont('helvetica', 'normal')
  if (invoice.issued_at) doc.text(`Émise : ${fmtDate(invoice.issued_at)}`, dx, y + 5)
  if (invoice.paid_at)   doc.text(`Payée : ${fmtDate(invoice.paid_at)}`,   dx, y + 10)

  y += 22

  const rows: (string | number)[][] = []
  rows.push([
    `Hébergement - Chambre #${roomNumber}`,
    `${b.nights} nuit${b.nights > 1 ? 's' : ''} x ${pdfFmt(b.price_per_night)}`,
    pdfFmt(b.price_per_night * b.nights),
  ])
  for (const ex of (invoice.extra_services ?? [])) {
    rows.push([ex.label, '', pdfFmt(ex.amount)])
  }

  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Détail', 'Montant']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [184, 134, 11], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 55 }, 2: { cellWidth: 25, halign: 'right' } },
    margin: { left: margin, right: margin },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 4
  const tx = W - margin

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Sous-total HT', tx - 50, finalY, { align: 'right' })
  doc.text(pdfFmt(Number(invoice.subtotal)), tx, finalY, { align: 'right' })

  if (Number(invoice.taxes) > 0) {
    doc.text('Taxes', tx - 50, finalY + 5, { align: 'right' })
    doc.text(pdfFmt(Number(invoice.taxes)), tx, finalY + 5, { align: 'right' })
  }

  doc.setFillColor(184, 134, 11)
  doc.rect(tx - 65, finalY + 8, 65, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL', tx - 50, finalY + 13.5, { align: 'right' })
  doc.text(pdfFmt(Number(invoice.total)), tx, finalY + 13.5, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  if (invoice.payment_method_display) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Mode de paiement : ${invoice.payment_method_display}`, margin, finalY + 20)
  }

  if (invoice.notes) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(`Note : ${invoice.notes}`, margin, finalY + 28)
  }

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150)
  const footerContact = contactLine ? ` - ${contactLine}` : ''
  doc.text(`${hotelName}${footerContact} - Document généré le ${new Date().toLocaleDateString('fr-FR')}`, W / 2, 290, { align: 'center' })

  doc.save(`Facture-${invoice.number}.pdf`)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('fr-FR')
}
