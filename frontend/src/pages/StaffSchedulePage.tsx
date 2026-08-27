import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { format, addDays, addWeeks, subWeeks, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { schedulingApi, Shift, POSITIONS } from '../api/scheduling'
import { usersApi } from '../api/users'
import { User } from '../types'
import { getApiError } from '../utils'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import { SkeletonChart } from '../components/Skeleton'

const POSITION_COLORS: Record<string, string> = {
  reception:    'bg-blue-100 text-blue-700 border-blue-200',
  housekeeping: 'bg-purple-100 text-purple-700 border-purple-200',
  maintenance:  'bg-orange-100 text-orange-700 border-orange-200',
  restaurant:   'bg-green-100 text-green-700 border-green-200',
  management:   'bg-amber-100 text-amber-700 border-amber-200',
  security:     'bg-red-100 text-red-700 border-red-200',
  other:        'bg-gray-100 text-gray-600 border-gray-200',
}

function mondayOf(d: Date) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

const EMPTY_FORM = { user: '', date: '', start_time: '08:00', end_time: '16:00', position: 'reception', notes: '' }

export default function StaffSchedulePage() {
  const { user: me } = useAuth()
  const isManager = me?.role === 'admin' || me?.role === 'manager'

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [users, setUsers] = useState<User[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [summary, setSummary] = useState<{ user: number; user_name: string; hours: number }[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const weekEnd = addDays(weekStart, 6)
  const dateFrom = format(weekStart, 'yyyy-MM-dd')
  const dateTo = format(weekEnd, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, s, sum] = await Promise.all([
        users.length ? Promise.resolve(users) : usersApi.list(),
        schedulingApi.list({ date_from: dateFrom, date_to: dateTo }),
        schedulingApi.summary({ date_from: dateFrom, date_to: dateTo }),
      ])
      setUsers(u)
      setShifts(s)
      setSummary(sum)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const shiftsFor = (userId: number, date: Date) =>
    shifts.filter(s => s.user === userId && s.date === format(date, 'yyyy-MM-dd'))

  const openCreate = (userId: number, date: Date) => {
    if (!isManager) return
    setEditing(null)
    setForm({ ...EMPTY_FORM, user: String(userId), date: format(date, 'yyyy-MM-dd') })
    setShowModal(true)
  }

  const openEdit = (shift: Shift) => {
    if (!isManager) return
    setEditing(shift)
    setForm({
      user: String(shift.user), date: shift.date,
      start_time: shift.start_time.slice(0, 5), end_time: shift.end_time.slice(0, 5),
      position: shift.position, notes: shift.notes,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, user: Number(form.user) }
      if (editing) {
        await schedulingApi.update(editing.id, payload)
        toast.success('Créneau mis à jour')
      } else {
        await schedulingApi.create(payload)
        toast.success('Créneau créé')
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!editing || !confirm('Supprimer ce créneau ?')) return
    try {
      await schedulingApi.remove(editing.id)
      toast.success('Créneau supprimé')
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const blob = await schedulingApi.downloadPdf({ date_from: dateFrom, date_to: dateTo })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `planning_${dateFrom}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setDownloadingPdf(false) }
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-700 font-medium">
            Semaine du {format(weekStart, 'd MMM', { locale: fr })} au {format(weekEnd, 'd MMM yyyy', { locale: fr })}
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setWeekStart(w => subWeeks(w, 1))}>← Préc.</button>
            <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setWeekStart(mondayOf(new Date()))}>Aujourd'hui</button>
            <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setWeekStart(w => addWeeks(w, 1))}>Suiv. →</button>
            <button
              className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5 disabled:opacity-60"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              <i className={`bi ${downloadingPdf ? 'bi-arrow-repeat animate-spin' : 'bi-file-earmark-pdf'}`} />
              {downloadingPdf ? 'Génération…' : 'Télécharger le PDF'}
            </button>
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <SkeletonChart height={400} />
      ) : (
        <>
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[160px]">Employé</th>
                  {days.map(d => (
                    <th key={d.toISOString()} className="px-2 py-3 text-center font-medium text-gray-500 min-w-[130px]">
                      <div className="capitalize">{format(d, 'EEEE', { locale: fr })}</div>
                      <div className="text-xs text-gray-400 font-normal">{format(d, 'd MMM', { locale: fr })}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`border-b border-gray-50 last:border-0 ${u.id === me?.id ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-2 font-medium text-gray-700 sticky left-0 bg-white whitespace-nowrap">
                      {u.first_name || u.username} {u.last_name}
                      <div className="text-xs text-gray-400 font-normal">{u.role_display}</div>
                    </td>
                    {days.map(d => (
                      <td
                        key={d.toISOString()}
                        className={`px-1.5 py-1.5 align-top ${isManager ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        onClick={() => shiftsFor(u.id, d).length === 0 && openCreate(u.id, d)}
                      >
                        <div className="space-y-1">
                          {shiftsFor(u.id, d).map(s => (
                            <div
                              key={s.id}
                              onClick={e => { e.stopPropagation(); openEdit(s) }}
                              className={`rounded-lg border px-2 py-1 text-xs ${POSITION_COLORS[s.position] ?? POSITION_COLORS.other}`}
                            >
                              <div className="font-semibold">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</div>
                              <div className="truncate">{s.position_display}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Résumé heures */}
          {summary.length > 0 && (
            <div className="card mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Total d'heures planifiées cette semaine</p>
              <div className="flex flex-wrap gap-3">
                {summary.map(s => (
                  <div key={s.user} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-gray-700">{s.user_name}</span>
                    <span className="text-hotel-gold font-bold">{s.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">
              {editing ? 'Modifier le créneau' : 'Nouveau créneau'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="Employé" icon="bi-person" required>
                <select value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} required>
                  <option value="">Sélectionner…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </FormField>
              <FormField label="Date" icon="bi-calendar3" required>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Début" icon="bi-clock" required>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
                </FormField>
                <FormField label="Fin" icon="bi-clock-history" required>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
                </FormField>
              </div>
              <FormField label="Poste">
                <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                  {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </FormField>
              <FormField label="Notes" icon="bi-card-text">
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="optionnel" />
              </FormField>
              <div className="flex justify-between items-center pt-2">
                {editing ? (
                  <button type="button" onClick={handleDelete} className="text-sm text-red-500 hover:text-red-600 font-medium">
                    <i className="bi bi-trash" /> Supprimer
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
