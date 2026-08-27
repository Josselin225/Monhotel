import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  accountingApi, Transaction, MonthlyStat, AccountingSummary, Budget,
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, ALL_CATEGORIES, PAYMENT_METHODS,
} from '../api/accounting'
import { formatFcfa, getApiError } from '../utils'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import { useAppSettings } from '../hooks/useAppSettings'
import { SkeletonTablePage } from '../components/Skeleton'

// ── Period options ──────────────────────────────────────────────────
const PERIODS = [
  { value: 'month',   label: 'Ce mois' },
  { value: '3months', label: '3 derniers mois' },
  { value: 'year',    label: 'Cette année' },
  { value: 'custom',  label: 'Personnalisé' },
]

// ── Category label helper ───────────────────────────────────────────
function catLabel(value: string) {
  return ALL_CATEGORIES.find(c => c.value === value)?.label ?? value
}

// ── Mini bar chart (SVG) ────────────────────────────────────────────
function MonthlyChart({ data }: { data: MonthlyStat[] }) {
  if (!data.length) return null
  const maxVal = Math.max(...data.flatMap(d => [parseFloat(d.income), parseFloat(d.expense)]), 1)
  const BAR_W = 18
  const GAP   = 4
  const H     = 120
  const COL   = BAR_W * 2 + GAP + 8

  return (
    <div className="overflow-x-auto">
      <svg
        width={data.length * COL + 8}
        height={H + 36}
        className="min-w-full"
      >
        {data.map((m, i) => {
          const x      = i * COL + 4
          const ih     = Math.round((parseFloat(m.income)  / maxVal) * H)
          const eh     = Math.round((parseFloat(m.expense) / maxVal) * H)
          const netPos = parseFloat(m.net) >= 0
          return (
            <g key={m.month}>
              {/* Income bar */}
              <rect x={x} y={H - ih} width={BAR_W} height={ih || 1}
                fill="#10b981" rx="3" opacity="0.85">
                <title>{m.month} — Recettes : {formatFcfa(parseFloat(m.income))}</title>
              </rect>
              {/* Expense bar */}
              <rect x={x + BAR_W + GAP} y={H - eh} width={BAR_W} height={eh || 1}
                fill="#f87171" rx="3" opacity="0.85">
                <title>{m.month} — Dépenses : {formatFcfa(parseFloat(m.expense))}</title>
              </rect>
              {/* Month label */}
              <text x={x + BAR_W} y={H + 16} textAnchor="middle"
                fontSize="9" fill="#9ca3af" fontFamily="system-ui">
                {m.month_short}
              </text>
              {/* Net dot */}
              <circle cx={x + BAR_W} cy={H + 28} r="3"
                fill={netPos ? '#10b981' : '#f87171'} opacity="0.7" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Transaction form modal ──────────────────────────────────────────
const EMPTY_FORM = {
  type: 'income' as 'income' | 'expense',
  category: 'room_revenue',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
  payment_method: 'cash',
  notes: '',
}

function TransactionModal({
  initial, onSave, onClose,
}: {
  initial: typeof EMPTY_FORM & { id?: number }
  onSave: (data: typeof EMPTY_FORM & { id?: number }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm]   = useState(initial)
  const [saving, setSaving] = useState(false)

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  useEffect(() => {
    // reset category when type changes
    const first = form.type === 'income' ? 'room_revenue' : 'staff'
    if (!categories.find(c => c.value === form.category)) {
      setForm(f => ({ ...f, category: first }))
    }
  }, [form.type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Le montant doit être positif')
      return
    }
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-lg">
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <i className={`bi bi-${form.type === 'income' ? 'arrow-down-circle text-emerald-600' : 'arrow-up-circle text-red-600'} text-lg`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{form.id ? 'Modifier la transaction' : 'Nouvelle transaction'}</h3>
              <p className="text-xs text-gray-400">Saisie manuelle</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <i className="bi bi-x-lg text-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type toggle */}
          <div>
            <p className="form-section mb-2">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {(['income', 'expense'] as const).map(t => (
                <button
                  key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.type === t
                      ? t === 'income'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <i className={`bi bi-${t === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}`} />
                  {t === 'income' ? 'Recette' : 'Dépense'}
                </button>
              ))}
            </div>
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Catégorie</label>
              <select className="input-box mt-1" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input-box mt-1" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <input className="input-box mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Facture EDF Juin, Salaires Juin…" required />
          </div>

          {/* Amount + Payment method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Montant (FCFA)</label>
              <input type="number" min="1" className="input-box mt-1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" required />
            </div>
            <div>
              <label className="label">Mode de paiement</label>
              <select className="input-box mt-1" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (optionnel)</label>
            <textarea className="input-box mt-1 resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Informations complémentaires…" />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className={`btn-primary min-w-[130px] justify-center ${form.type === 'expense' ? '!bg-red-500 hover:!bg-red-600' : ''}`}>
              {saving ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</> : <><i className="bi bi-check-lg" /> {form.id ? 'Enregistrer' : 'Créer'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────
export default function AccountingPage() {
  useAppSettings()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)
  const [summary, setSummary]           = useState<AccountingSummary | null>(null)
  const [monthly, setMonthly]           = useState<MonthlyStat[]>([])

  const [period, setPeriod]   = useState('month')
  const [filter, setFilter]   = useState({ type: '', category: '', date_from: '', date_to: '' })
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<(typeof EMPTY_FORM & { id?: number }) | null>(null)
  const [expandedCats, setExpandedCats] = useState(false)

  // Budgets
  const [budgets, setBudgets]         = useState<Budget[]>([])
  const [showBudgets, setShowBudgets] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [editingBudget, setEditingBudget]     = useState<Budget | null>(null)
  const budgetYear  = new Date().getFullYear()
  const budgetMonth = new Date().getMonth() + 1
  const EMPTY_BUDGET = { category: 'staff', amount: '', alert_pct: '80', notes: '' }

  const today = new Date().toISOString().slice(0, 10)
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  // Compute date range for summary based on period
  const summaryParams = useCallback((): Record<string, string> => {
    if (period === 'custom') {
      const p: Record<string, string> = {}
      if (filter.date_from) p.date_from = filter.date_from
      if (filter.date_to)   p.date_to   = filter.date_to
      return p
    }
    return { period }
  }, [period, filter.date_from, filter.date_to])

  const loadSummary = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        accountingApi.summary(summaryParams()),
        accountingApi.monthly(),
      ])
      setSummary(s)
      setMonthly(m)
    } catch { /* silent */ }
  }, [summaryParams])

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (filter.type)      params.type      = filter.type
      if (filter.category)  params.category  = filter.category
      if (period === 'custom') {
        if (filter.date_from) params.date_from = filter.date_from
        if (filter.date_to)   params.date_to   = filter.date_to
      } else if (period !== 'custom') {
        params.period = period
        // Translate period to actual dates for list endpoint
        const now = new Date()
        if (period === 'month') {
          params.date_from = thisMonthStart
          params.date_to   = today
          delete params.period
        } else if (period === '3months') {
          const d = new Date(); d.setMonth(d.getMonth() - 3)
          params.date_from = d.toISOString().slice(0, 10)
          params.date_to   = today
          delete params.period
        } else if (period === 'year') {
          params.date_from = `${now.getFullYear()}-01-01`
          params.date_to   = today
          delete params.period
        }
      }
      const data = await accountingApi.list(params)
      setTransactions(data.results)
      setTotal(data.count)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [page, filter, period, today, thisMonthStart])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { loadTransactions() }, [loadTransactions])
  useEffect(() => { setPage(1) }, [filter, period])

  const loadBudgets = useCallback(async () => {
    try {
      const data = await accountingApi.getBudgetsWithActuals(budgetYear, budgetMonth)
      setBudgets(data)
    } catch { /* silent */ }
  }, [budgetYear, budgetMonth])

  // Charge toujours au montage pour détecter les alertes budget
  useEffect(() => { loadBudgets() }, [loadBudgets])
  useEffect(() => { if (showBudgets) loadBudgets() }, [showBudgets, loadBudgets])

  const [alertDismissed, setAlertDismissed] = useState(false)
  const overBudget = budgets.filter(b => b.alert)

  const handleSaveBudget = async (form: typeof EMPTY_BUDGET & { id?: number }) => {
    try {
      const payload = {
        category: form.category,
        amount: String(form.amount),
        period: 'monthly',
        year: budgetYear,
        month: budgetMonth,
        alert_pct: Number(form.alert_pct),
        notes: form.notes,
      }
      if (form.id) {
        await accountingApi.updateBudget(form.id, payload)
        toast.success('Budget mis à jour')
      } else {
        await accountingApi.createBudget(payload)
        toast.success('Budget créé')
      }
      setShowBudgetModal(false)
      setEditingBudget(null)
      loadBudgets()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleDeleteBudget = async (id: number) => {
    if (!confirm('Supprimer ce budget ?')) return
    try { await accountingApi.deleteBudget(id); toast.success('Budget supprimé'); loadBudgets() }
    catch (err) { toast.error(getApiError(err)) }
  }

  const handleSave = async (form: typeof EMPTY_FORM & { id?: number }) => {
    try {
      if (form.id) {
        await accountingApi.update(form.id, form)
        toast.success('Transaction mise à jour')
      } else {
        await accountingApi.create(form)
        toast.success('Transaction créée')
      }
      setShowModal(false)
      setEditing(null)
      await Promise.all([loadSummary(), loadTransactions()])
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette transaction ?')) return
    try {
      await accountingApi.delete(id)
      toast.success('Transaction supprimée')
      await Promise.all([loadSummary(), loadTransactions()])
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleExport = async () => {
    try {
      const blob = await accountingApi.exportCsv()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export téléchargé')
    } catch { toast.error('Erreur export') }
  }

  const handleExportXlsx = async () => {
    try {
      const blob = await accountingApi.exportXlsx()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url; a.download = 'transactions.xlsx'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export Excel téléchargé')
    } catch { toast.error('Erreur export Excel') }
  }

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await accountingApi.importCsv(file)
      toast.success(`Import terminé : ${result.created} transaction(s) importée(s), ${result.skipped} ignorée(s)`)
      if (result.errors?.length) toast.warning(result.errors.slice(0, 3).join('\n'))
      loadSummary(); loadTransactions()
    } catch (err) { toast.error(getApiError(err)) }
    e.target.value = ''
  }

  const openCreate = (type?: 'income' | 'expense') => {
    setEditing({ ...EMPTY_FORM, type: type ?? 'income', category: type === 'expense' ? 'staff' : 'room_revenue' })
    setShowModal(true)
  }
  const openEdit = (t: Transaction) => {
    setEditing({ id: t.id, type: t.type, category: t.category, amount: t.amount, date: t.date, description: t.description, payment_method: t.payment_method, notes: t.notes })
    setShowModal(true)
  }

  const income  = parseFloat(summary?.income  ?? '0')
  const expense = parseFloat(summary?.expense ?? '0')
  const net     = parseFloat(summary?.net     ?? '0')

  // Top categories (by amount desc)
  const topCats = Object.entries(summary?.by_category ?? {})
    .map(([k, v]) => ({ key: k, label: catLabel(k), ...v, total_n: parseFloat(v.total) }))
    .sort((a, b) => b.total_n - a.total_n)
  const displayedCats = expandedCats ? topCats : topCats.slice(0, 5)
  const maxCat = topCats[0]?.total_n ?? 1

  return (
    <div className="p-4">
      {/* Bannière alertes budget */}
      {!alertDismissed && overBudget.length > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <i className="bi bi-exclamation-triangle-fill text-amber-500 text-base mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-amber-800">
              {overBudget.length} catégorie{overBudget.length > 1 ? 's' : ''} dépassent leur seuil d'alerte :
            </span>{' '}
            <span className="text-amber-700">
              {overBudget.map(b => `${b.category_display} (${Math.round(b.pct ?? 0)} %)`).join(' · ')}
            </span>
          </div>
          <button onClick={() => setAlertDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0 ml-2">
            <i className="bi bi-x-lg text-xs" />
          </button>
        </div>
      )}

      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">{total} transaction{total > 1 ? 's' : ''}</p>
          <div className="flex gap-2 flex-wrap self-start sm:self-auto">
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
              <i className="bi bi-download" /> Export CSV
            </button>
            <button onClick={handleExportXlsx} className="btn-secondary flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800">
              <i className="bi bi-file-earmark-excel" /> Export Excel
            </button>
            <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
              <i className="bi bi-upload" /> Import CSV
              <input type="file" accept=".csv" className="sr-only" onChange={handleImportCsv} />
            </label>
            <button onClick={() => openCreate('expense')} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-sm">
              <i className="bi bi-arrow-up-circle" /> Dépense
            </button>
            <button onClick={() => openCreate('income')} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors shadow-sm">
              <i className="bi bi-arrow-down-circle" /> Recette
            </button>
          </div>
        </div>
      </PageHeader>

      {/* ── Period selector ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-0.5 shadow-sm">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.value ? 'bg-hotel-gold text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className="input-box text-xs py-1.5 px-2" value={filter.date_from} onChange={e => setFilter(f => ({ ...f, date_from: e.target.value }))} />
            <span className="text-gray-400 text-xs">→</span>
            <input type="date" className="input-box text-xs py-1.5 px-2" value={filter.date_to} onChange={e => setFilter(f => ({ ...f, date_to: e.target.value }))} />
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Chiffre d\'affaires', value: income, icon: 'bi-cash-stack',        color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
          { label: 'Total recettes',       value: income, icon: 'bi-arrow-down-circle', color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200' },
          { label: 'Total dépenses',       value: expense, icon: 'bi-arrow-up-circle', color: 'text-red-600',      bg: 'bg-red-50',      border: 'border-red-200' },
          { label: 'Bénéfice net',         value: net,    icon: 'bi-graph-up-arrow',   color: net >= 0 ? 'text-emerald-700' : 'text-red-600', bg: net >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: net >= 0 ? 'border-emerald-200' : 'border-red-200' },
        ].map(card => (
          <div key={card.label} className={`card border ${card.border} py-4`}>
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
              <i className={`bi ${card.icon} text-lg ${card.color}`} />
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{formatFcfa(card.value)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* ── Monthly chart ── */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Évolution mensuelle (12 mois)</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />Recettes</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Dépenses</span>
            </div>
          </div>
          <MonthlyChart data={monthly} />
          {!monthly.length && (
            <div className="text-center py-8 text-gray-400 text-sm">Aucune donnée</div>
          )}
        </div>

        {/* ── Category breakdown ── */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Par catégorie</h3>
          {topCats.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Aucune donnée</div>
          ) : (
            <>
              <div className="space-y-2.5">
                {displayedCats.map(cat => (
                  <div key={cat.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium truncate max-w-[120px]">{cat.label}</span>
                      <span className={`font-semibold ${cat.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatFcfa(cat.total_n)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${cat.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${(cat.total_n / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {topCats.length > 5 && (
                <button onClick={() => setExpandedCats(e => !e)} className="mt-3 text-xs text-gray-400 hover:text-gray-600 w-full text-center">
                  {expandedCats ? 'Voir moins' : `+ ${topCats.length - 5} autres`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Filters + Table ── */}
      <div className="card p-0 overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 flex-1 min-w-[160px]">
            <i className="bi bi-search text-gray-400 text-sm" />
            <span className="text-xs text-gray-400">Filtres :</span>
          </div>
          <select className="input-box text-xs py-1.5 w-36" value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value, category: '' }))}>
            <option value="">Tous types</option>
            <option value="income">Recettes</option>
            <option value="expense">Dépenses</option>
          </select>
          <select className="input-box text-xs py-1.5 w-48" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
            <option value="">Toutes catégories</option>
            {(filter.type === 'expense' ? EXPENSE_CATEGORIES : filter.type === 'income' ? INCOME_CATEGORIES : ALL_CATEGORIES).map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTablePage cardCount={0} rows={10} cols={5} withToolbar={false} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Réf.</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Catégorie</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      <i className="bi bi-inbox text-3xl block mb-2 opacity-40" />
                      Aucune transaction sur cette période
                    </td>
                  </tr>
                ) : transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.reference}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{t.description}</p>
                      {t.booking_reference && (
                        <p className="text-xs text-gray-500">Rés. {t.booking_reference}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${t.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        <i className={`bi bi-${t.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'} text-[10px]`} />
                        {t.category_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.payment_method_display}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '−'}{formatFcfa(parseFloat(t.amount))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(t)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
                          <i className="bi bi-pencil text-xs" />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                          <i className="bi bi-trash text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 pb-2">
          <Pagination page={page} total={total} onChange={setPage} />
        </div>
      </div>

      {/* ── Budgets section ───────────────────────────────────── */}
      <div className="card mt-6 p-0 overflow-hidden">
        <button
          onClick={() => setShowBudgets(b => !b)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <i className="bi bi-bullseye text-violet-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Budgets du mois</p>
              <p className="text-xs text-gray-400">
                {budgets.filter(b => b.alert && !b.over).length > 0 && (
                  <span className="text-amber-600 font-medium">{budgets.filter(b => b.alert && !b.over).length} alerte(s)</span>
                )}
                {budgets.filter(b => b.over).length > 0 && (
                  <span className="text-red-600 font-medium ml-2">{budgets.filter(b => b.over).length} dépassement(s)</span>
                )}
                {budgets.filter(b => !b.alert && !b.over).length === budgets.length && budgets.length > 0 && (
                  <span className="text-green-600 font-medium">Tout est dans les limites</span>
                )}
                {budgets.length === 0 && 'Cliquez pour configurer'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showBudgets && (
              <button onClick={e => { e.stopPropagation(); setEditingBudget(null); setShowBudgetModal(true) }}
                className="btn-primary text-xs px-3 py-1.5">
                <i className="bi bi-plus-lg me-1" />Ajouter
              </button>
            )}
            <i className={`bi bi-chevron-${showBudgets ? 'up' : 'down'} text-gray-400`} />
          </div>
        </button>

        {showBudgets && (
          <div className="border-t border-gray-100">
            {budgets.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <i className="bi bi-bullseye text-2xl block mb-2 opacity-30" />
                <p className="text-sm">Aucun budget configuré pour ce mois</p>
                <button onClick={() => setShowBudgetModal(true)} className="btn-primary text-sm mt-3">
                  <i className="bi bi-plus-lg me-1" />Créer un budget
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {budgets.map(b => {
                  const pct   = b.pct ?? 0
                  const alert = b.alert ?? false
                  const over  = b.over  ?? false
                  const barColor = over ? 'bg-red-500' : alert ? 'bg-amber-400' : 'bg-green-400'
                  return (
                    <div key={b.id} className="px-6 py-4 flex items-center gap-4 group hover:bg-gray-50/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-sm font-medium text-gray-900">{b.category_display}</p>
                          {over  && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Dépassé</span>}
                          {alert && !over && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">Alerte {b.alert_pct}%</span>}
                        </div>
                        {/* Progress bar */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 shrink-0 tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatFcfa(b.spent ?? 0)} dépensé / {formatFcfa(Number(b.amount))} budgété
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => { setEditingBudget(b); setShowBudgetModal(true) }}
                          className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                        <button onClick={() => handleDeleteBudget(b.id)}
                          className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && editing && (
        <TransactionModal initial={editing} onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null) }} />
      )}

      {/* ── Budget form modal ────────────────────────────────── */}
      {showBudgetModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBudgetModal(false)}>
          <div className="modal-box max-w-sm">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <i className="bi bi-bullseye text-violet-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{editingBudget ? 'Modifier le budget' : 'Nouveau budget'}</h3>
              </div>
              <button onClick={() => setShowBudgetModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <BudgetForm
              initial={editingBudget}
              onSave={handleSaveBudget}
              onClose={() => setShowBudgetModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function BudgetForm({ initial, onSave, onClose }: {
  initial: Budget | null
  onSave: (form: any) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    category:  initial?.category  ?? 'staff',
    amount:    initial?.amount    ?? '',
    alert_pct: String(initial?.alert_pct ?? 80),
    notes:     initial?.notes     ?? '',
    id:        initial?.id,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const EXPENSE_CATS = [
    { value: 'staff',        label: 'Personnel' },
    { value: 'maintenance',  label: 'Maintenance' },
    { value: 'supplies',     label: 'Fournitures' },
    { value: 'utilities',    label: 'Charges & Fluides' },
    { value: 'marketing',    label: 'Marketing' },
    { value: 'taxes',        label: 'Impôts & Taxes' },
    { value: 'other_expense',label: 'Autres dépenses' },
  ]

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <label className="label">Catégorie de dépense</label>
        <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
          className="input-box w-full mt-1">
          {EXPENSE_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Montant budgété (FCFA)</label>
        <input type="number" required min="1" placeholder="Ex: 500000"
          value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
          className="input-box w-full mt-1" />
      </div>
      <div>
        <label className="label">Seuil d'alerte (%)</label>
        <input type="number" min="10" max="100"
          value={form.alert_pct} onChange={e => setForm({...form, alert_pct: e.target.value})}
          className="input-box w-full mt-1" />
        <p className="text-xs text-gray-400 mt-1">Alerte déclenchée quand les dépenses atteignent {form.alert_pct}% du budget</p>
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
        <button type="submit" disabled={saving} className="btn-primary min-w-[100px] justify-center">
          {saving ? <i className="bi bi-arrow-repeat animate-spin" /> : initial ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </form>
  )
}
