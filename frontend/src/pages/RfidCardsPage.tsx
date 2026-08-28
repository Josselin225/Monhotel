import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { rfidApi, RfidCard, CARD_TYPES, AccessCheckResult } from '../api/rfid'
import { bookingsApi } from '../api/bookings'
import { getContent } from '../api/content'
import { Booking } from '../types'
import { getApiError } from '../utils'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import { SkeletonTablePage } from '../components/Skeleton'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600',
  lost: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const EMPTY_PREPARE = { card_type: 'guest' as const, booking: '', room: '', notes: '' }

function todayLocalInput() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function RfidCardsPage() {
  const [searchParams] = useSearchParams()
  const [cards, setCards] = useState<RfidCard[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [hotelName, setHotelName] = useState('Mon Hôtel')

  const [showIssueModal, setShowIssueModal] = useState(false)
  const [issueStep, setIssueStep] = useState<'prepare' | 'confirm'>('prepare')
  const [prepareForm, setPrepareForm] = useState(EMPTY_PREPARE)
  const [manualValidFrom, setManualValidFrom] = useState(todayLocalInput())
  const [manualValidUntil, setManualValidUntil] = useState('')
  const [confirmUid, setConfirmUid] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [checkedInBookings, setCheckedInBookings] = useState<Booking[]>([])

  const [testUid, setTestUid] = useState('')
  const [testResult, setTestResult] = useState<AccessCheckResult | null>(null)
  const [testing, setTesting] = useState(false)

  const selectedBooking = checkedInBookings.find(b => String(b.id) === prepareForm.booking) || null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      const data = await rfidApi.list(params)
      setCards(data)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    bookingsApi.list({ status: 'checked_in', page_size: '200' })
      .then(data => setCheckedInBookings(data.results))
      .catch(err => toast.error(getApiError(err)))
    getContent().then(c => setHotelName(c.hotel.name || 'Mon Hôtel')).catch(() => {})
  }, [])

  // Ouverture directe depuis Réservations avec ?booking=<id>. Dépend de
  // searchParams (pas []) : si on navigue vers /app/rfid?booking=X pendant
  // que la page est déjà montée (ex: retour sur Réservations puis nouveau
  // lien avec un autre id), il faut rouvrir la modale avec le bon formulaire
  // au lieu de garder l'état de la précédente ouverture.
  useEffect(() => {
    const bookingId = searchParams.get('booking')
    if (bookingId) {
      setPrepareForm({ ...EMPTY_PREPARE, booking: bookingId, card_type: 'guest' })
      setManualValidFrom(todayLocalInput())
      setManualValidUntil('')
      setConfirmUid('')
      setIssueStep('prepare')
      setShowIssueModal(true)
    }
  }, [searchParams])

  const openIssueModal = () => {
    setPrepareForm(EMPTY_PREPARE)
    setManualValidFrom(todayLocalInput())
    setManualValidUntil('')
    setConfirmUid('')
    setIssueStep('prepare')
    setShowIssueModal(true)
  }

  const handlePrepare = (e: React.FormEvent) => {
    e.preventDefault()
    if (prepareForm.card_type === 'guest' && !prepareForm.booking) {
      toast.error('Sélectionnez la réservation du client.')
      return
    }
    setIssueStep('confirm')
  }

  const handlePrintSheet = () => window.print()

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmUid.trim()) { toast.error("Scannez ou saisissez l'identifiant de la carte une fois encodée."); return }
    setIssuing(true)
    try {
      await rfidApi.issue({
        uid: confirmUid.trim(),
        card_type: prepareForm.card_type,
        booking: prepareForm.booking ? Number(prepareForm.booking) : undefined,
        room: prepareForm.room ? Number(prepareForm.room) : undefined,
        valid_from: prepareForm.card_type !== 'guest' && manualValidFrom ? new Date(manualValidFrom).toISOString() : undefined,
        valid_until: prepareForm.card_type !== 'guest' && manualValidUntil ? new Date(manualValidUntil).toISOString() : undefined,
        notes: prepareForm.notes,
      })
      toast.success('Carte activée ✓')
      setShowIssueModal(false)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setIssuing(false) }
  }

  const handleDeactivate = async (card: RfidCard) => {
    try {
      await rfidApi.deactivate(card.id)
      toast.success('Carte désactivée')
      load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleMarkLost = async (card: RfidCard) => {
    if (!confirm(`Déclarer la carte ${card.uid} comme perdue ?`)) return
    try {
      await rfidApi.markLost(card.id)
      toast.success('Carte déclarée perdue')
      load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleTestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testUid.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await rfidApi.checkAccess(testUid.trim())
      setTestResult(result)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setTesting(false) }
  }

  return (
    <div className="p-4">
      <div className="print:hidden">
      <PageHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{cards.length} carte{cards.length > 1 ? 's' : ''}</p>
          <button className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5" onClick={openIssueModal}>
            <i className="bi bi-credit-card-2-front" /> Attribuer une carte
          </button>
        </div>
      </PageHeader>

      {/* Testeur d'accès — simule un lecteur de porte */}
      <div className="card mb-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <i className="bi bi-door-open text-hotel-gold" /> Tester l'accès (simulation lecteur)
        </p>
        <form onSubmit={handleTestAccess} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Scanner ou saisir une carte</label>
            <input className="input" value={testUid} onChange={e => setTestUid(e.target.value)} placeholder="Identifiant de la carte" autoFocus />
          </div>
          <button type="submit" className="btn-secondary px-4 py-2.5 text-sm" disabled={testing}>
            {testing ? 'Vérification…' : 'Vérifier'}
          </button>
        </form>
        {testResult && (
          <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 text-sm ${testResult.authorized ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
            <i className={`bi ${testResult.authorized ? 'bi-unlock-fill' : 'bi-lock-fill'} mt-0.5`} />
            <div>
              <p className="font-semibold">{testResult.authorized ? 'Accès autorisé' : 'Accès refusé'}</p>
              <p>{testResult.reason}</p>
              {testResult.card && (
                <p className="text-xs mt-1 opacity-80">
                  {testResult.card.guest_name || testResult.card.card_type_display} — Chambre {testResult.card.room_number ?? '—'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center py-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <i className="bi bi-search text-gray-300 dark:text-gray-600" />
          <input className="input-box w-full" placeholder="Rechercher (UID, réservation, client)…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-box w-full sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="lost">Perdue</option>
        </select>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={6} cols={6} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Carte</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Chambre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Client / Réservation</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Validité</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cards.map(c => (
                <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{c.uid}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.card_type_display}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.room_number ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {c.guest_name ?? '—'}
                    {c.booking_reference && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 font-mono">#{c.booking_reference}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {fmtDate(c.valid_from)} → {fmtDate(c.valid_until)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[c.status]}`}>
                      {c.is_valid_now && c.status === 'active' ? 'Active' : c.status_display}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {c.status === 'active' && (
                        <>
                          <button onClick={() => handleDeactivate(c)} title="Désactiver" className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            <i className="bi bi-x-circle" />
                          </button>
                          <button onClick={() => handleMarkLost(c)} title="Déclarer perdue" className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                            <i className="bi bi-exclamation-triangle" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400 dark:text-gray-500">
                  <i className="bi bi-credit-card-2-front text-3xl block mb-2 opacity-40" />
                  Aucune carte RFID
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:bg-white print:p-0 print:block">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 print:shadow-none print:rounded-none print:max-w-full">

            {issueStep === 'prepare' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 print:hidden">Attribuer une carte RFID</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-5 print:hidden">
                  Étape 1 — choisissez à qui la carte est destinée. Vous obtiendrez ensuite une fiche à saisir dans le logiciel d'encodage de vos serrures.
                </p>
                <form onSubmit={handlePrepare} className="space-y-4 print:hidden">
                  <FormField label="Type de carte" icon="bi-tags">
                    <select value={prepareForm.card_type} onChange={e => setPrepareForm(f => ({ ...f, card_type: e.target.value as typeof f.card_type }))}>
                      {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </FormField>
                  {prepareForm.card_type === 'guest' ? (
                    <FormField label="Réservation (en cours de séjour)" icon="bi-bookmark-check" required>
                      <select value={prepareForm.booking} onChange={e => setPrepareForm(f => ({ ...f, booking: e.target.value }))} required>
                        <option value="">Sélectionner…</option>
                        {checkedInBookings.map(b => (
                          <option key={b.id} value={b.id}>
                            #{b.reference} — {b.client_detail?.full_name} — Ch. {b.room_detail?.number}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Valide à partir de" icon="bi-calendar3">
                        <input type="datetime-local" value={manualValidFrom} onChange={e => setManualValidFrom(e.target.value)} />
                      </FormField>
                      <FormField label="Valide jusqu'à" icon="bi-calendar-x">
                        <input type="datetime-local" value={manualValidUntil} onChange={e => setManualValidUntil(e.target.value)} placeholder="illimité si vide" />
                      </FormField>
                    </div>
                  )}
                  <FormField label="Notes" icon="bi-card-text">
                    <input value={prepareForm.notes} onChange={e => setPrepareForm(f => ({ ...f, notes: e.target.value }))} placeholder="optionnel" />
                  </FormField>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" className="btn-ghost" onClick={() => setShowIssueModal(false)}>Annuler</button>
                    <button type="submit" className="btn-primary">Générer la fiche d'encodage →</button>
                  </div>
                </form>
              </>
            )}

            {issueStep === 'confirm' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 print:hidden">Fiche d'encodage</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4 print:hidden">
                  Étape 2 — saisissez ces informations dans le logiciel d'encodage de vos serrures, puis confirmez ci-dessous l'identifiant obtenu sur la carte.
                </p>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-5 print:border-2 print:border-black print:rounded-none">
                  <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2 print:text-black">{hotelName} — Fiche d'encodage carte RFID</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Type</span><span className="font-semibold text-gray-900 dark:text-gray-100">{CARD_TYPES.find(t => t.value === prepareForm.card_type)?.label}</span></div>
                    {prepareForm.card_type === 'guest' ? (
                      <>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Réservation</span><span className="font-semibold text-gray-900 dark:text-gray-100 font-mono">#{selectedBooking?.reference}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Client</span><span className="font-semibold text-gray-900 dark:text-gray-100">{selectedBooking?.client_detail?.full_name}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Chambre</span><span className="font-semibold text-gray-900 dark:text-gray-100">{selectedBooking?.room_detail?.number}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Valide du</span><span className="font-semibold text-gray-900 dark:text-gray-100">{selectedBooking?.check_in}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Valide jusqu'au</span><span className="font-semibold text-gray-900 dark:text-gray-100">{selectedBooking?.check_out}</span></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Valide du</span><span className="font-semibold text-gray-900 dark:text-gray-100">{manualValidFrom.replace('T', ' ')}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Valide jusqu'au</span><span className="font-semibold text-gray-900 dark:text-gray-100">{manualValidUntil ? manualValidUntil.replace('T', ' ') : 'Illimité'}</span></div>
                      </>
                    )}
                    {prepareForm.notes && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Notes</span><span className="font-semibold text-gray-900 dark:text-gray-100">{prepareForm.notes}</span></div>}
                  </div>
                </div>

                <form onSubmit={handleConfirm} className="space-y-4 print:hidden">
                  <FormField label="Identifiant de la carte encodée" icon="bi-credit-card-2-front" required>
                    <input value={confirmUid} onChange={e => setConfirmUid(e.target.value)} placeholder="Scanner ou saisir l'UID…" autoFocus required />
                  </FormField>
                  <div className="tip bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 dark:border-amber-600 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <i className="bi bi-info-circle me-1" />
                    Toute autre carte active portant le même identifiant sera automatiquement désactivée.
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-2">
                    <div className="flex gap-2">
                      <button type="button" className="btn-ghost" onClick={() => setIssueStep('prepare')}>← Retour</button>
                      <button type="button" className="btn-secondary flex items-center gap-1.5" onClick={handlePrintSheet}>
                        <i className="bi bi-printer" /> Imprimer
                      </button>
                    </div>
                    <button type="submit" className="btn-primary" disabled={issuing}>
                      {issuing ? 'Activation…' : 'Confirmer et activer'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
