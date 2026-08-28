import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { format, addDays, addWeeks, subWeeks, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { schedulingApi, employeeApi, Shift, Employee, POSITIONS, CreateAccountPayload } from '../api/scheduling'
import { getApiError } from '../utils'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import { SkeletonChart, SkeletonTablePage } from '../components/Skeleton'

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

const EMPTY_FORM = { employee: '', date: '', start_time: '08:00', end_time: '16:00', position: 'reception', notes: '' }
const EMPTY_EMP = { name: '', position: 'reception', phone: '', email: '', notes: '', is_active: true }
const ROLE_OPTIONS = [
  { value: 'receptionist', label: 'Réceptionniste' },
  { value: 'manager',      label: 'Manager' },
  { value: 'admin',        label: 'Administrateur' },
]
const EMPTY_ACCOUNT = { username: '', first_name: '', last_name: '', email: '', phone: '', role: 'receptionist', password: '', confirm_password: '' }

export default function StaffSchedulePage() {
  const { user: me } = useAuth()
  const isManager = me?.role === 'admin' || me?.role === 'manager'

  const [tab, setTab] = useState<'schedule' | 'employees'>('schedule')

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [summary, setSummary] = useState<{ employee: number; employee_name: string; hours: number }[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // ── Employee roster state ──────────────────────────────────────────
  const [empLoading, setEmpLoading] = useState(false)
  const [showEmpModal, setShowEmpModal] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [empForm, setEmpForm] = useState(EMPTY_EMP)
  const [savingEmp, setSavingEmp] = useState(false)

  const [accountTarget, setAccountTarget] = useState<Employee | null>(null)
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT)
  const [savingAccount, setSavingAccount] = useState(false)

  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const weekEnd = addDays(weekStart, 6)
  const dateFrom = format(weekStart, 'yyyy-MM-dd')
  const dateTo = format(weekEnd, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [emp, s, sum] = await Promise.all([
        employeeApi.list(),
        schedulingApi.list({ date_from: dateFrom, date_to: dateTo }),
        schedulingApi.summary({ date_from: dateFrom, date_to: dateTo }),
      ])
      setEmployees(emp)
      setShifts(s)
      setSummary(sum)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const loadEmployees = async () => {
    setEmpLoading(true)
    try {
      const all = await employeeApi.list()
      setEmployees(all)
    } catch (err) { toast.error(getApiError(err)) }
    finally { setEmpLoading(false) }
  }

  const activeEmployees = employees.filter(e => e.is_active)

  const shiftsFor = (employeeId: number, date: Date) =>
    shifts.filter(s => s.employee === employeeId && s.date === format(date, 'yyyy-MM-dd'))

  const openCreate = (employeeId: number, date: Date) => {
    if (!isManager) return
    setEditing(null)
    setForm({ ...EMPTY_FORM, employee: String(employeeId), date: format(date, 'yyyy-MM-dd') })
    setShowModal(true)
  }

  const openEdit = (shift: Shift) => {
    if (!isManager) return
    setEditing(shift)
    setForm({
      employee: String(shift.employee), date: shift.date,
      start_time: shift.start_time.slice(0, 5), end_time: shift.end_time.slice(0, 5),
      position: shift.position, notes: shift.notes,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, employee: Number(form.employee) }
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

  const openCreateEmp = () => {
    if (!isManager) return
    setEditingEmp(null); setEmpForm(EMPTY_EMP); setShowEmpModal(true)
  }
  const openEditEmp = (emp: Employee) => {
    if (!isManager) return
    setEditingEmp(emp)
    setEmpForm({ name: emp.name, position: emp.position, phone: emp.phone, email: emp.email, notes: emp.notes, is_active: emp.is_active })
    setShowEmpModal(true)
  }

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empForm.name.trim()) { toast.error('Le nom est requis'); return }
    if (!empForm.phone.trim()) { toast.error('Le téléphone est requis'); return }
    setSavingEmp(true)
    try {
      if (editingEmp) {
        await employeeApi.update(editingEmp.id, empForm)
        toast.success('Employé mis à jour')
      } else {
        await employeeApi.create(empForm)
        toast.success('Employé enregistré')
      }
      setShowEmpModal(false)
      loadEmployees()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setSavingEmp(false) }
  }

  const handleEmpDelete = async (id: number) => {
    if (!isManager) return
    if (!confirm('Supprimer cet employé ? Ses créneaux planifiés seront également supprimés.')) return
    try { await employeeApi.delete(id); toast.success('Employé supprimé'); loadEmployees() }
    catch (err) { toast.error(getApiError(err)) }
  }

  const openCreateAccount = (emp: Employee) => {
    if (me?.role !== 'admin') return
    const [first_name, ...rest] = emp.name.trim().split(/\s+/)
    setAccountTarget(emp)
    setAccountForm({
      ...EMPTY_ACCOUNT,
      first_name: first_name || '',
      last_name: rest.join(' '),
      email: emp.email,
      phone: emp.phone,
    })
  }

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountTarget) return
    if (!accountForm.username.trim()) { toast.error("L'identifiant est requis"); return }
    if (accountForm.password.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères'); return }
    if (accountForm.password !== accountForm.confirm_password) { toast.error('Les mots de passe ne correspondent pas'); return }
    setSavingAccount(true)
    try {
      const payload: CreateAccountPayload = {
        username: accountForm.username, first_name: accountForm.first_name, last_name: accountForm.last_name,
        email: accountForm.email, phone: accountForm.phone, role: accountForm.role, password: accountForm.password,
      }
      await employeeApi.createAccount(accountTarget.id, payload)
      toast.success('Compte créé et relié à l\'employé')
      setAccountTarget(null)
      loadEmployees()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setSavingAccount(false) }
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          {tab === 'schedule' ? (
            <>
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
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700 font-medium">{employees.length} employé{employees.length > 1 ? 's' : ''}</p>
              {isManager && (
                <button onClick={openCreateEmp} className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
                  <i className="bi bi-plus-lg" /> Nouvel employé
                </button>
              )}
            </>
          )}
        </div>
      </PageHeader>

      {/* Onglets */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([
          { key: 'schedule',  label: 'Planning',  icon: 'bi-calendar-week' },
          { key: 'employees', label: 'Employés',  icon: 'bi-people' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-hotel-gold text-hotel-gold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            <i className={`bi ${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        loading ? (
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
                  {activeEmployees.map(emp => (
                    <tr key={emp.id} className={`border-b border-gray-50 last:border-0 ${emp.user === me?.id ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-700 sticky left-0 bg-white whitespace-nowrap">
                        {emp.name}
                        <div className="text-xs text-gray-400 font-normal">{emp.position_display}</div>
                      </td>
                      {days.map(d => (
                        <td
                          key={d.toISOString()}
                          className={`px-1.5 py-1.5 align-top ${isManager ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={() => shiftsFor(emp.id, d).length === 0 && openCreate(emp.id, d)}
                        >
                          <div className="space-y-1">
                            {shiftsFor(emp.id, d).map(s => (
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
                  {activeEmployees.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                      <i className="bi bi-people text-3xl block mb-2 opacity-30" />
                      Aucun employé actif — ajoutez-en un dans l'onglet Employés
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Résumé heures */}
            {summary.length > 0 && (
              <div className="card mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Total d'heures planifiées cette semaine</p>
                <div className="flex flex-wrap gap-3">
                  {summary.map(s => (
                    <div key={s.employee} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium text-gray-700">{s.employee_name}</span>
                      <span className="text-hotel-gold font-bold">{s.hours}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}

      {tab === 'employees' && (
        <div>
          {empLoading ? (
            <SkeletonTablePage cardCount={0} rows={6} cols={5} withToolbar={false} />
          ) : (
            <div className="card p-0 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Nom','Poste','Contact','Compte lié','Créneaux','Statut','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            <span className="text-amber-700 text-sm font-bold">{emp.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-medium text-gray-900">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge border text-blue-700 bg-blue-50 border-blue-200">{emp.position_display}</span>
                      </td>
                      <td className="px-4 py-3">
                        {emp.phone && <p className="text-sm text-gray-700"><i className="bi bi-telephone me-1 text-gray-400" />{emp.phone}</p>}
                        {emp.email && <p className="text-xs text-gray-500"><i className="bi bi-envelope me-1 text-gray-400" />{emp.email}</p>}
                        {!emp.phone && !emp.email && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {emp.user_username ? (
                          <span className="badge border text-purple-700 bg-purple-50 border-purple-200">
                            <i className="bi bi-person-check me-1" />{emp.user_username}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{emp.shifts_count}</td>
                      <td className="px-4 py-3">
                        <span className={`badge border ${emp.is_active ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                          {emp.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {!emp.user_username && me?.role === 'admin' && (
                            <button onClick={() => openCreateAccount(emp)} className="btn-secondary text-xs px-2 py-1" title="Créer un compte de connexion">
                              <i className="bi bi-person-plus" />
                            </button>
                          )}
                          {isManager && (
                            <>
                              <button onClick={() => openEditEmp(emp)} className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                              <button onClick={() => handleEmpDelete(emp.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                      <i className="bi bi-people text-3xl block mb-2 opacity-30" />
                      Aucun employé enregistré
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Shift modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5">
              {editing ? 'Modifier le créneau' : 'Nouveau créneau'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="Employé" icon="bi-person" required>
                <select value={form.employee} onChange={e => setForm(f => ({ ...f, employee: e.target.value }))} required>
                  <option value="">Sélectionner…</option>
                  {activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
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

      {/* ── Employee modal ──────────────────────────────────────── */}
      {showEmpModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEmpModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="bi bi-person-badge text-amber-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editingEmp ? 'Modifier l\'employé' : 'Nouvel employé'}</h3>
                  <p className="text-xs text-gray-400">Membre du personnel planifiable, avec ou sans accès au logiciel</p>
                </div>
              </div>
              <button onClick={() => setShowEmpModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <form onSubmit={handleEmpSubmit} className="p-6 space-y-4">
              <FormField label="Nom complet" icon="bi-person" required>
                <input type="text" placeholder="Ex: Yao Kouassi" value={empForm.name}
                  onChange={e => setEmpForm({...empForm, name: e.target.value})} />
              </FormField>

              <FormField label="Poste" icon="bi-briefcase" required>
                <select value={empForm.position} onChange={e => setEmpForm({...empForm, position: e.target.value})} className="appearance-none" required>
                  {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Téléphone" icon="bi-telephone" required>
                  <input type="tel" placeholder="07XXXXXXXX" value={empForm.phone}
                    maxLength={10} minLength={10} pattern="[0-9]{10}" required
                    onChange={e => setEmpForm({...empForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} />
                </FormField>
                <FormField label="Email" icon="bi-envelope">
                  <input type="email" placeholder="employe@email.com" value={empForm.email}
                    onChange={e => setEmpForm({...empForm, email: e.target.value})} />
                </FormField>
              </div>

              <FormField label="Notes" icon="bi-card-text">
                <textarea value={empForm.notes} onChange={e => setEmpForm({...empForm, notes: e.target.value})}
                  placeholder="Informations supplémentaires, disponibilités…" rows={2}
                  className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
              </FormField>

              {editingEmp && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={empForm.is_active} onChange={e => setEmpForm({...empForm, is_active: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300 text-hotel-gold" />
                  <span className="text-sm text-gray-700">Employé actif</span>
                </label>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowEmpModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={savingEmp} className="btn-primary min-w-[120px] justify-center">
                  {savingEmp ? <i className="bi bi-arrow-repeat animate-spin" /> : <><i className={`bi ${editingEmp ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editingEmp ? 'Enregistrer' : 'Ajouter'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create account modal ────────────────────────────────── */}
      {accountTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAccountTarget(null)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                  <i className="bi bi-person-plus text-purple-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Créer un compte pour {accountTarget.name}</h3>
                  <p className="text-xs text-gray-400">Le compte sera automatiquement relié à cette fiche employé</p>
                </div>
              </div>
              <button onClick={() => setAccountTarget(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <form onSubmit={handleAccountSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Prénom" icon="bi-person" required>
                  <input value={accountForm.first_name} onChange={e => setAccountForm({...accountForm, first_name: e.target.value})} />
                </FormField>
                <FormField label="Nom" icon="bi-person" required>
                  <input value={accountForm.last_name} onChange={e => setAccountForm({...accountForm, last_name: e.target.value})} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Identifiant" icon="bi-at" required>
                  <input value={accountForm.username} placeholder="jean.dupont" autoFocus
                    onChange={e => setAccountForm({...accountForm, username: e.target.value})} />
                </FormField>
                <FormField label="Rôle" icon="bi-shield">
                  <select value={accountForm.role} onChange={e => setAccountForm({...accountForm, role: e.target.value})} className="appearance-none">
                    {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Email" icon="bi-envelope">
                  <input type="email" value={accountForm.email} onChange={e => setAccountForm({...accountForm, email: e.target.value})} />
                </FormField>
                <FormField label="Téléphone" icon="bi-telephone">
                  <input type="tel" value={accountForm.phone} maxLength={10} minLength={10} pattern="[0-9]{10}"
                    onChange={e => setAccountForm({...accountForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Mot de passe" icon="bi-lock" required>
                  <input type="password" value={accountForm.password} placeholder="Minimum 8 caractères"
                    onChange={e => setAccountForm({...accountForm, password: e.target.value})} />
                </FormField>
                <FormField label="Confirmer" icon="bi-lock-fill" required>
                  <input type="password" value={accountForm.confirm_password} placeholder="Répétez le mot de passe"
                    onChange={e => setAccountForm({...accountForm, confirm_password: e.target.value})} />
                </FormField>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setAccountTarget(null)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={savingAccount} className="btn-primary min-w-[120px] justify-center">
                  {savingAccount ? <i className="bi bi-arrow-repeat animate-spin" /> : <><i className="bi bi-check-lg" />Créer le compte</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
