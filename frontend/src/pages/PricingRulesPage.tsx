import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { roomsApi, PricingRule } from '../api/rooms'
import { getApiError, formatFcfa } from '../utils'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import { SkeletonTablePage } from '../components/Skeleton'

const RULE_TYPES = [
  { value: 'season_high',  label: 'Saison haute',            icon: 'bi-sun',         color: 'bg-orange-100 text-orange-700' },
  { value: 'season_low',   label: 'Saison basse',            icon: 'bi-cloud-snow',  color: 'bg-blue-100 text-blue-700' },
  { value: 'weekend',      label: 'Weekend',                  icon: 'bi-calendar2-week', color: 'bg-purple-100 text-purple-700' },
  { value: 'early_bird',   label: 'Réservation anticipée',   icon: 'bi-clock-history', color: 'bg-green-100 text-green-700' },
  { value: 'last_minute',  label: 'Last minute',             icon: 'bi-lightning-charge', color: 'bg-red-100 text-red-700' },
  { value: 'occupancy',    label: "Taux d'occupation",       icon: 'bi-speedometer2', color: 'bg-amber-100 text-amber-700' },
]

const EMPTY: Partial<PricingRule> = {
  name: '', rule_type: 'season_high', is_active: true,
  percent_change: '0', date_start: null, date_end: null,
  days_threshold: null, occupancy_threshold: null, priority: 0, room_type: null,
}

function ruleColor(type: string) {
  return RULE_TYPES.find(r => r.value === type)?.color ?? 'bg-gray-100 text-gray-600'
}
function ruleIcon(type: string) {
  return RULE_TYPES.find(r => r.value === type)?.icon ?? 'bi-tag'
}
function ruleLabel(type: string) {
  return RULE_TYPES.find(r => r.value === type)?.label ?? type
}

interface FormProps {
  initial: Partial<PricingRule>
  onSave: (rule: Partial<PricingRule>) => Promise<void>
  onCancel: () => void
}

function RuleForm({ initial, onSave, onCancel }: FormProps) {
  const [form, setForm] = useState<Partial<PricingRule>>(initial)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof PricingRule, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const needsDates      = form.rule_type === 'season_high' || form.rule_type === 'season_low'
  const needsThreshold  = form.rule_type === 'early_bird' || form.rule_type === 'last_minute'
  const needsOccupancy  = form.rule_type === 'occupancy'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Nom de la règle</label>
          <input className="input" required value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="ex: Été 2026" />
        </div>

        <div>
          <label className="label">Type de règle</label>
          <select className="input" value={form.rule_type ?? 'season_high'} onChange={e => set('rule_type', e.target.value)}>
            {RULE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Variation en % (négatif = réduction)</label>
          <input className="input" type="number" step="0.01" required
            value={form.percent_change ?? '0'}
            onChange={e => set('percent_change', e.target.value)}
            placeholder="+20 ou -15" />
        </div>

        {needsDates && (
          <>
            <div>
              <label className="label">Date début</label>
              <input className="input" type="date" value={form.date_start ?? ''} onChange={e => set('date_start', e.target.value)} />
            </div>
            <div>
              <label className="label">Date fin</label>
              <input className="input" type="date" value={form.date_end ?? ''} onChange={e => set('date_end', e.target.value)} />
            </div>
          </>
        )}

        {needsThreshold && (
          <div className="sm:col-span-2">
            <label className="label">
              {form.rule_type === 'early_bird' ? 'Réserver au moins X jours à l\'avance' : 'Réserver dans les X derniers jours'}
            </label>
            <input className="input" type="number" min="1" value={form.days_threshold ?? ''}
              onChange={e => set('days_threshold', e.target.value ? Number(e.target.value) : null)}
              placeholder="ex: 30" />
          </div>
        )}

        {needsOccupancy && (
          <div className="sm:col-span-2">
            <label className="label">Se déclenche à partir de X% d'occupation de l'hôtel</label>
            <input className="input" type="number" min="1" max="100" value={form.occupancy_threshold ?? ''}
              onChange={e => set('occupancy_threshold', e.target.value ? Number(e.target.value) : null)}
              placeholder="ex: 80" />
            <p className="text-xs text-gray-400 mt-1">
              Le taux d'occupation est recalculé à chaque réservation, à la date d'arrivée demandée.
            </p>
          </div>
        )}

        <div>
          <label className="label">Priorité (plus grand = appliqué en premier)</label>
          <input className="input" type="number" min="0" value={form.priority ?? 0} onChange={e => set('priority', Number(e.target.value))} />
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-hotel-gold" checked={form.is_active ?? true}
              onChange={e => set('is_active', e.target.checked)} />
            <span className="text-sm font-medium text-gray-700">Règle active</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

export default function PricingRulesPage() {
  const [rules, setRules]     = useState<PricingRule[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<PricingRule | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    roomsApi.listPricingRules({ page: String(page) })
      .then(d => { setRules(d.results); setTotal(d.count) })
      .catch(err => toast.error(getApiError(err)))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(load, [load])

  const handleSave = async (form: Partial<PricingRule>) => {
    try {
      if (editing) {
        await roomsApi.updatePricingRule(editing.id, form)
        toast.success('Règle mise à jour')
      } else {
        await roomsApi.createPricingRule(form)
        toast.success('Règle créée')
      }
      setModal(null)
      setEditing(null)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const handleDelete = async (rule: PricingRule) => {
    if (!confirm(`Supprimer la règle "${rule.name}" ?`)) return
    try {
      await roomsApi.deletePricingRule(rule.id)
      toast.success('Règle supprimée')
      load()
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const handleToggle = async (rule: PricingRule) => {
    try {
      await roomsApi.updatePricingRule(rule.id, { is_active: !rule.is_active })
      load()
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const pct = (v: string) => {
    const n = parseFloat(v)
    return n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700 font-medium">Saisons, weekend, early-bird &amp; last minute</p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={() => { setEditing(null); setModal('create') }}>
            <i className="bi bi-plus-lg" /> Nouvelle règle
          </button>
        </div>
      </PageHeader>

      {/* Légende types */}
      <div className="flex flex-wrap gap-2 mb-4">
        {RULE_TYPES.map(r => (
          <span key={r.value} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${r.color}`}>
            <i className={`bi ${r.icon}`} />{r.label}
          </span>
        ))}
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={8} cols={4} withToolbar={false} />
      ) : rules.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <i className="bi bi-tag text-4xl" />
          <p className="mt-2 font-medium">Aucune règle de tarification</p>
          <p className="text-sm mt-1">Créez votre première règle pour commencer.</p>
        </div>
      ) : (
        <div>
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className={`card flex items-center gap-4 ${!rule.is_active ? 'opacity-50' : ''}`}>
              {/* Type badge */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ruleColor(rule.rule_type)}`}>
                <i className={`bi ${ruleIcon(rule.rule_type)} text-lg`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{rule.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ruleColor(rule.rule_type)}`}>
                    {ruleLabel(rule.rule_type)}
                  </span>
                  {rule.room_type_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {rule.room_type_name}
                    </span>
                  )}
                  {!rule.is_active && <span className="text-xs text-gray-400">(inactif)</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {rule.date_start && rule.date_end && `${rule.date_start} → ${rule.date_end} · `}
                  {rule.days_threshold != null && `Seuil : ${rule.days_threshold} jours · `}
                  {rule.occupancy_threshold != null && `Dès ${rule.occupancy_threshold}% d'occupation · `}
                  Priorité : {rule.priority}
                </p>
              </div>

              {/* Percent */}
              <div className={`text-lg font-bold shrink-0 ${parseFloat(rule.percent_change) >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {pct(rule.percent_change)}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${rule.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  title={rule.is_active ? 'Désactiver' : 'Activer'}
                  onClick={() => handleToggle(rule)}
                >
                  <i className={`bi bi-toggle-${rule.is_active ? 'on' : 'off'} text-xl`} />
                </button>
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  onClick={() => { setEditing(rule); setModal('edit') }}
                >
                  <i className="bi bi-pencil" />
                </button>
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  onClick={() => handleDelete(rule)}
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Pagination page={page} total={total} onChange={setPage} />
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">
              {modal === 'create' ? 'Nouvelle règle de tarification' : 'Modifier la règle'}
            </h3>
            <RuleForm
              initial={editing ?? EMPTY}
              onSave={handleSave}
              onCancel={() => { setModal(null); setEditing(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
