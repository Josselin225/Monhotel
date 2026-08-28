import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { billingApi } from '../api/billing'
import { bookingsApi } from '../api/bookings'
import { Invoice, Booking, InvoiceStats } from '../types'
import { INVOICE_STATUS_COLORS, formatDate, formatFcfa, getApiError } from '../utils'
import { generateInvoicePdf } from '../utils/pdfInvoice'
import { getContent, HotelInfo } from '../api/content'
import Pagination from '../components/Pagination'
import InvoicePrint from '../components/InvoicePrint'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { SkeletonTablePage } from '../components/Skeleton'
import { useAppSettings } from '../hooks/useAppSettings'
import { useAuth } from '../context/AuthContext'

export default function BillingPage() {
  useAppSettings()
  const { user } = useAuth()
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | undefined>(undefined)
  useEffect(() => { getContent().then(c => setHotelInfo(c.hotel)).catch(() => {}) }, [])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stats, setStats]       = useState<InvoiceStats | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState({ status: '', search: '' })
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null)
  const [showModal, setShowModal]       = useState(false)
  const [showPayModal, setShowPayModal] = useState<Invoice | null>(null)
  const [payMethod, setPayMethod]       = useState('cash')
  const [form, setForm] = useState({ booking: '', subtotal: '', taxes: '0', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (filter.status) params.status = filter.status
      if (filter.search)  params.search = filter.search
      const [inv, bk, st] = await Promise.all([
        billingApi.list(params),
        bookingsApi.list({ page_size: '100', status: 'checked_out' }),
        billingApi.stats(),
      ])
      setInvoices(inv.results)
      setTotal(inv.count)
      setBookings(bk.results)
      setStats(st)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [filter, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filter])

  const openCreate = () => {
    setForm({ booking: '', subtotal: '', taxes: '0', notes: '' }); setShowModal(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.booking) { toast.error('Sélectionnez une réservation'); return }
    if (!form.subtotal) { toast.error('Saisissez un montant'); return }
    setSaving(true)
    try {
      const subtotal = Number(form.subtotal)
      const taxes    = Number(form.taxes)
      await billingApi.create({ booking: Number(form.booking), subtotal, taxes, total: subtotal + taxes, notes: form.notes })
      toast.success('Facture créée')
      setShowModal(false); load()
    } catch (err) { toast.error(getApiError(err))
    } finally { setSaving(false) }
  }

  const handleIssue = async (id: number) => {
    try {
      await billingApi.issue(id); toast.success('Facture émise'); load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleMarkPaid = async () => {
    if (!showPayModal) return
    try {
      await billingApi.markPaid(showPayModal.id, payMethod)
      toast.success('Paiement enregistré ✓')
      setShowPayModal(null); load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const onBookingSelect = (bid: string) => {
    const booking = bookings.find(b => String(b.id) === bid)
    setForm({ ...form, booking: bid, subtotal: booking ? String(booking.total_price) : '' })
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">{total} facture{total > 1 ? 's' : ''}</p>
          <div className="flex gap-2 self-start sm:self-auto print:hidden">
            <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-sm">
              <i className="bi bi-printer" /> Imprimer
            </button>
            {isManager && (
              <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
                <i className="bi bi-plus-lg" /> Nouvelle facture
              </button>
            )}
          </div>
        </div>
      </PageHeader>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Revenus du mois',   value: formatFcfa(Number(stats.month_revenue)),   color: 'text-green-600',  icon: 'bi-calendar-check' },
            { label: 'Total encaissé',     value: formatFcfa(Number(stats.total_revenue)),   color: 'text-gray-900',   icon: 'bi-bank' },
            { label: 'En attente',         value: formatFcfa(Number(stats.pending_amount)),  color: 'text-blue-600',   icon: 'bi-hourglass-split' },
            { label: 'Factures ouvertes',  value: String(stats.draft_count + stats.issued_count), color: 'text-gray-600', icon: 'bi-file-earmark-text' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <i className={`bi ${s.icon} text-2xl ${s.color} mb-1`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-4 flex flex-col gap-3 sm:flex-row sm:items-center py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <i className="bi bi-search text-gray-400" />
          <input type="text" placeholder="Numéro, réservation, client…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
            value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})} />
          {filter.search && <button onClick={() => setFilter({...filter, search: ''})} className="text-gray-400 hover:text-gray-600"><i className="bi bi-x" /></button>}
        </div>
        <select className="input-box w-full sm:w-52" value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="issued">Émise</option>
          <option value="paid">Payée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={3} rows={8} cols={7} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[850px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['N° Facture','Réservation','Client','Émission','Paiement','Mode','Total','Statut','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">{inv.number}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.booking_detail?.reference}</td>
                  <td className="px-4 py-3 text-gray-900">{inv.booking_detail?.client_detail?.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.issued_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.paid_at)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{inv.payment_method_display || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatFcfa(Number(inv.total))}</td>
                  <td className="px-4 py-3">
                    <span className={`badge border ${INVOICE_STATUS_COLORS[inv.status]}`}>{inv.status_display}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {isManager && inv.status === 'draft' && (
                        <button onClick={() => handleIssue(inv.id)} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">
                          Émettre
                        </button>
                      )}
                      {isManager && (inv.status === 'issued' || inv.status === 'draft') && (
                        <button onClick={() => { setShowPayModal(inv); setPayMethod('cash') }} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium">
                          Payer
                        </button>
                      )}
                      <button onClick={() => setPrintInvoice(inv)} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200" title="Imprimer">
                        <i className="bi bi-printer" />
                      </button>
                      <button onClick={() => generateInvoicePdf(inv, hotelInfo)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Télécharger PDF">
                        <i className="bi bi-file-earmark-pdf" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                  <i className="bi bi-receipt text-3xl block mb-2 opacity-40" />
                  Aucune facture trouvée
                </td></tr>
              )}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} total={total} onChange={setPage} />
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <i className="bi bi-receipt text-green-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Nouvelle facture</h3>
                  <p className="text-xs text-gray-400">Sélectionnez une réservation terminée</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <p className="form-section mb-3">Réservation</p>
                <FormField label="Réservation terminée" icon="bi-calendar-check" required>
                  <select value={form.booking} onChange={e => onBookingSelect(e.target.value)} className="appearance-none">
                    <option value="">Sélectionner une réservation…</option>
                    {bookings.map(b => (
                      <option key={b.id} value={b.id}>{b.reference} — {b.client_detail?.full_name} ({b.total_price} FCFA)</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div>
                <p className="form-section mb-3">Montants</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Sous-total (FCFA)" icon="bi-cash" required>
                    <input type="number" value={form.subtotal} onChange={e => setForm({...form, subtotal: e.target.value})} placeholder="0" />
                  </FormField>
                  <FormField label="Taxes (FCFA)" icon="bi-percent" hint="TVA, taxe de séjour…">
                    <input type="number" value={form.taxes} onChange={e => setForm({...form, taxes: e.target.value})} placeholder="0" />
                  </FormField>
                </div>
                {form.subtotal && (
                  <div className="mt-3 flex items-center justify-between px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-sm text-amber-700 font-medium">Total à facturer</span>
                    <span className="text-base font-bold text-amber-700">{formatFcfa(Number(form.subtotal) + Number(form.taxes))}</span>
                  </div>
                )}
              </div>

              <div>
                <FormField label="Notes / observations" icon="bi-chat-left-text">
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                    placeholder="Informations complémentaires…" rows={2}
                    className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
                </FormField>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary min-w-[120px] justify-center">
                  {saving ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</> : <><i className="bi bi-receipt" /> Créer la facture</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPayModal(null)}>
          <div className="modal-box max-w-sm">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <i className="bi bi-credit-card text-green-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Enregistrer le paiement</h3>
                  <p className="text-xs text-gray-400">Facture {showPayModal.number}</p>
                </div>
              </div>
              <button onClick={() => setShowPayModal(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-sm text-green-700">Montant à encaisser</span>
                <span className="text-xl font-bold text-green-700">{formatFcfa(Number(showPayModal.total))}</span>
              </div>
              <FormField label="Mode de paiement" icon="bi-wallet2">
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="appearance-none">
                  <option value="cash">💵 Espèces</option>
                  <option value="card">💳 Carte bancaire</option>
                  <option value="mobile">📱 Mobile Money</option>
                  <option value="transfer">🏦 Virement</option>
                  <option value="other">Autre</option>
                </select>
              </FormField>
              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button onClick={() => setShowPayModal(null)} className="btn-secondary">Annuler</button>
                <button onClick={handleMarkPaid} className="btn-primary flex items-center gap-2">
                  <i className="bi bi-check-circle-fill" /> Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printInvoice && <InvoicePrint invoice={printInvoice} onClose={() => setPrintInvoice(null)} hotel={hotelInfo} />}
    </div>
  )
}
