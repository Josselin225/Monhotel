import { useState, useEffect } from 'react'
import { getContent } from '../api/content'
import {
  lookupMyBooking, updateMyBooking, cancelMyBooking, myBookingInvoiceUrl, MyBooking,
} from '../api/public'

function fmt(n: string | number) {
  return Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-100 text-red-700',
}

function getErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { detail?: string } } }
  return anyErr?.response?.data?.detail || 'Une erreur est survenue. Réessayez.'
}

export default function MyBookingPage() {
  const [hotelName, setHotelName] = useState('Mon Hôtel')
  const [logoUrl, setLogoUrl] = useState('')
  const [bank, setBank] = useState({ bank_name: '', bank_account_holder: '', bank_iban: '', bank_bic: '' })

  const [reference, setReference] = useState('')
  const [contact, setContact] = useState('')
  const [booking, setBooking] = useState<MyBooking | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [requests, setRequests] = useState('')
  const [savingRequests, setSavingRequests] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)

  useEffect(() => {
    getContent().then(c => {
      setHotelName(c.hotel.name || 'Mon Hôtel')
      setLogoUrl(c.hotel.logo_url || '')
      setBank({
        bank_name: c.hotel.bank_name || '',
        bank_account_holder: c.hotel.bank_account_holder || '',
        bank_iban: c.hotel.bank_iban || '',
        bank_bic: c.hotel.bank_bic || '',
      })
      document.title = `${c.hotel.name || 'Mon Hôtel'} — Ma réservation`
    }).catch(() => {})
  }, [])

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const b = await lookupMyBooking(reference.trim(), contact.trim())
      setBooking(b)
      setRequests(b.special_requests)
    } catch (err) {
      setError(getErrorMessage(err))
      setBooking(null)
    } finally { setLoading(false) }
  }

  const handleSaveRequests = async () => {
    if (!booking) return
    setSavingRequests(true)
    try {
      const b = await updateMyBooking(booking.reference, contact.trim(), requests)
      setBooking(b)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally { setSavingRequests(false) }
  }

  const handleCancel = async () => {
    if (!booking) return
    setCancelling(true)
    try {
      const b = await cancelMyBooking(booking.reference, contact.trim())
      setBooking(b)
      setShowConfirmCancel(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally { setCancelling(false) }
  }

  const reset = () => { setBooking(null); setReference(''); setContact(''); setError('') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-stone-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          {logoUrl && <img src={logoUrl} alt={hotelName} className="w-14 h-14 rounded-full object-cover mx-auto mb-3" />}
          <h1 className="text-2xl font-serif font-bold text-gray-900">{hotelName}</h1>
          <p className="text-gray-500 mt-1">Gérer ma réservation</p>
        </div>

        {!booking ? (
          <form onSubmit={handleLookup} className="bg-white rounded-2xl p-8 shadow-lg space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Entrez votre référence de réservation ainsi que le téléphone ou l'email utilisé lors de la réservation.
            </p>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="label">Référence de réservation</label>
              <input className="input font-mono uppercase" value={reference}
                onChange={e => setReference(e.target.value)} placeholder="RES1234567" required autoFocus />
            </div>
            <div>
              <label className="label">Téléphone ou email</label>
              <input className="input" value={contact} onChange={e => setContact(e.target.value)}
                placeholder="07XXXXXXXX ou vous@email.com" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? 'Recherche…' : 'Voir ma réservation'}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Référence</p>
                <p className="font-mono font-bold text-lg text-gray-900">{booking.reference}</p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {booking.status_display}
              </span>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Chambre</span><span className="font-medium text-gray-800">{booking.room_type} · n° {booking.room_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Arrivée</span><span className="font-medium text-gray-800">{fmtDate(booking.check_in)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Départ</span><span className="font-medium text-gray-800">{fmtDate(booking.check_out)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Durée</span><span className="font-medium text-gray-800">{booking.nights} nuit{booking.nights > 1 ? 's' : ''}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Voyageurs</span><span className="font-medium text-gray-800">{booking.adults} adulte{booking.adults > 1 ? 's' : ''}{booking.children > 0 ? ` · ${booking.children} enfant(s)` : ''}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-50"><span className="text-gray-400">Total</span><span className="font-bold text-hotel-gold">{fmt(booking.total_price)}</span></div>
              {Number(booking.deposit) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">{booking.payment_method === 'transfer' ? 'Virement' : 'Acompte'}</span>
                  <span className="font-medium text-gray-800">{fmt(booking.deposit)} {booking.deposit_paid ? '(reçu)' : '(en attente)'}</span>
                </div>
              )}
            </div>

            {booking.payment_method === 'transfer' && !booking.deposit_paid && bank.bank_iban && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                  <i className="bi bi-bank2" /> Virement bancaire en attente
                </p>
                <div className="space-y-1 text-xs text-amber-900">
                  {bank.bank_name && <div className="flex justify-between"><span>Banque</span><span className="font-medium">{bank.bank_name}</span></div>}
                  {bank.bank_account_holder && <div className="flex justify-between"><span>Titulaire</span><span className="font-medium">{bank.bank_account_holder}</span></div>}
                  <div className="flex justify-between"><span>IBAN</span><span className="font-medium font-mono">{bank.bank_iban}</span></div>
                  {bank.bank_bic && <div className="flex justify-between"><span>BIC / SWIFT</span><span className="font-medium font-mono">{bank.bank_bic}</span></div>}
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  Référence à indiquer : <span className="font-mono font-semibold">{booking.reference}</span>
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {/* Demandes spéciales */}
            <div className="border-t border-gray-100 pt-4">
              <label className="label">Demandes spéciales</label>
              {booking.can_edit ? (
                <>
                  <textarea className="input" rows={2} value={requests} onChange={e => setRequests(e.target.value)}
                    placeholder="ex: étage élevé, lit bébé…" />
                  {requests !== booking.special_requests && (
                    <button onClick={handleSaveRequests} disabled={savingRequests} className="btn-secondary text-sm mt-2 px-3 py-1.5">
                      {savingRequests ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">{booking.special_requests || 'Aucune'}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
              {booking.has_invoice && (
                <a href={myBookingInvoiceUrl(booking.reference, contact.trim())} className="btn-secondary text-sm px-3 py-2 flex items-center gap-1.5">
                  <i className="bi bi-file-earmark-pdf" /> Télécharger la facture
                </a>
              )}
              {booking.can_cancel && !showConfirmCancel && (
                <button onClick={() => setShowConfirmCancel(true)} className="text-sm text-red-500 hover:text-red-600 font-medium px-3 py-2">
                  Annuler ma réservation
                </button>
              )}
              <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 font-medium px-3 py-2 ml-auto">
                ← Retour
              </button>
            </div>

            {showConfirmCancel && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-3">Confirmer l'annulation de cette réservation ? Cette action est irréversible.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowConfirmCancel(false)} className="btn-ghost text-sm px-3 py-2">Non</button>
                  <button onClick={handleCancel} disabled={cancelling} className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded-lg font-medium">
                    {cancelling ? 'Annulation…' : 'Oui, annuler'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
