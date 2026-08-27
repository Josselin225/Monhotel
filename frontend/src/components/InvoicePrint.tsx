import { createPortal } from 'react-dom'
import { Invoice } from '../types'
import api from '../api/client'

interface HotelMeta { name?: string; address?: string; city?: string; phone?: string; email?: string }

interface Props {
  invoice: Invoice
  onClose: () => void
  hotel?: HotelMeta
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PAY_ICONS: Record<string, string> = {
  cash: '💵', card: '💳', mobile: '📱', transfer: '🏦', other: '—',
}

export default function InvoicePrint({ invoice, onClose, hotel }: Props) {
  const b = invoice.booking_detail
  const hotelName = hotel?.name ?? 'Mon Hôtel'
  const addressLine = [hotel?.address, hotel?.city].filter(Boolean).join(' · ')
  const contactLine = [hotel?.phone, hotel?.email].filter(Boolean).join(' · ')

  const handleDownloadPdf = async () => {
    try {
      const resp = await api.get(`/invoices/${invoice.id}/pdf/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = `facture_${invoice.number}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { /* toast handled elsewhere */ }
  }

  const ReceiptContent = () => (
    <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', color: '#111', width: '100%', maxWidth: '300px', margin: '0 auto' }}>

      {/* En-tête */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '2px' }}>{hotelName.toUpperCase()}</div>
        {addressLine && <div style={{ fontSize: '10px', color: '#666', marginBottom: '1px' }}>{addressLine}</div>}
        {contactLine && <div style={{ fontSize: '10px', color: '#666' }}>{contactLine}</div>}
      </div>

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      {/* Référence */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#555' }}>Reçu N°</span>
        <span style={{ fontWeight: 'bold' }}>{invoice.number}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#555' }}>Réservation</span>
        <span>{b?.reference}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#555' }}>Date d'émission</span>
        <span>{fmtDate(invoice.issued_at)}</span>
      </div>
      {invoice.paid_at && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#555' }}>Date paiement</span>
          <span style={{ fontWeight: 'bold' }}>{fmtDate(invoice.paid_at)}</span>
        </div>
      )}

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      {/* Client */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', marginBottom: '3px' }}>Client</div>
        <div style={{ fontWeight: 'bold' }}>{b?.client_detail?.full_name}</div>
        {b?.client_detail?.phone && <div style={{ fontSize: '10px', color: '#555' }}>{b.client_detail.phone}</div>}
      </div>

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      {/* Séjour */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', marginBottom: '3px' }}>Séjour</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ color: '#555' }}>Chambre</span>
          <span>#{b?.room_detail?.number} — {b?.room_detail?.room_type_name}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ color: '#555' }}>Arrivée</span>
          <span>{b?.check_in ? fmtDate(b.check_in) : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ color: '#555' }}>Départ</span>
          <span>{b?.check_out ? fmtDate(b.check_out) : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#555' }}>Durée</span>
          <span>{b?.nights} nuit{(b?.nights ?? 0) > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      {/* Détail */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Détail</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>Hébergement ({b?.nights}n)</span>
          <span>{fmt(Number(b?.total_price))}</span>
        </div>
        {(invoice.extra_services || []).map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>{s.label}</span>
            <span>{fmt(s.amount)}</span>
          </div>
        ))}
        {Number(invoice.taxes) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '11px' }}>
            <span>Taxes & frais</span>
            <span>{fmt(Number(invoice.taxes))}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #111', margin: '8px 0' }} />

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>TOTAL</span>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{fmt(Number(invoice.total))}</span>
      </div>

      {invoice.payment_method && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
          <span style={{ color: '#555' }}>Mode de paiement</span>
          <span>{PAY_ICONS[invoice.payment_method] || ''} {invoice.payment_method_display}</span>
        </div>
      )}

      <div style={{ borderTop: '1px solid #111', margin: '8px 0' }} />

      {/* Statut */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        {invoice.status === 'paid' ? (
          <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #86efac' }}>
            ✓ PAYÉE
          </span>
        ) : (
          <span style={{ background: '#fef9c3', color: '#713f12', padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #fde047' }}>
            EN ATTENTE
          </span>
        )}
      </div>

      {invoice.notes && (
        <>
          <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
          <div style={{ fontSize: '10px', color: '#555', fontStyle: 'italic' }}>Note : {invoice.notes}</div>
        </>
      )}

      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

      {/* Pied */}
      <div style={{ textAlign: 'center', fontSize: '10px', color: '#777' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>★ Merci de votre confiance ★</div>
        <div>Nous espérons vous revoir bientôt</div>
        <div style={{ marginTop: '4px', color: '#aaa' }}>
          Imprimé le {fmtDateTime(new Date().toISOString())}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Modal d'aperçu — masquée à l'impression */}
      <div
        className="no-print fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
        >
          {/* Barre d'actions */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Reçu #{invoice.number}</p>
              <p className="text-xs text-gray-400">{b?.client_detail?.full_name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDownloadPdf} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
                <i className="bi bi-file-earmark-pdf" /> PDF
              </button>
              <button onClick={() => window.print()} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5">
                <i className="bi bi-printer" /> Imprimer
              </button>
              <button onClick={onClose} className="btn-secondary text-xs px-3 py-2">
                <i className="bi bi-x" />
              </button>
            </div>
          </div>

          {/* Aperçu du reçu */}
          <div className="p-5 max-h-[70vh] overflow-y-auto bg-white">
            <ReceiptContent />
          </div>
        </div>
      </div>

      {/* Contenu imprimé — rendu hors du modal via portail */}
      {createPortal(
        <div id="receipt-print-root">
          <ReceiptContent />
        </div>,
        document.body
      )}

      {/* CSS impression */}
      <style>{`
        @media screen {
          #receipt-print-root { display: none; }
        }
        @media print {
          .no-print { display: none !important; }
          body > *:not(#receipt-print-root) { display: none !important; }
          #receipt-print-root { display: block !important; padding: 0; }
          @page { size: 80mm auto; margin: 6mm; }
        }
      `}</style>
    </>
  )
}
