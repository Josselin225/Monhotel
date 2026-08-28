import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersApi, UserPayload } from '../api/users'
import { User } from '../types'
import { getApiError } from '../utils'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { SkeletonTablePage } from '../components/Skeleton'

const ROLE_OPTIONS = [
  { value: 'admin',        label: 'Administrateur' },
  { value: 'manager',      label: 'Manager' },
  { value: 'receptionist', label: 'Réceptionniste' },
]

const ROLE_COLORS: Record<string, string> = {
  admin:        'bg-red-50 text-red-700 border-red-200',
  manager:      'bg-purple-50 text-purple-700 border-purple-200',
  receptionist: 'bg-blue-50 text-blue-700 border-blue-200',
}

const ROLE_ICONS: Record<string, string> = {
  admin:        'bi-shield-fill',
  manager:      'bi-briefcase-fill',
  receptionist: 'bi-headset',
}

const EMPTY_FORM: UserPayload & { password: string; confirm_password: string } = {
  username: '', first_name: '', last_name: '', email: '',
  phone: '', role: 'receptionist', is_active: true,
  password: '', confirm_password: '',
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState<User | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await usersApi.list())
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ username: u.username, first_name: u.first_name, last_name: u.last_name,
      email: u.email, phone: u.phone, role: u.role,
      is_active: u.is_active, password: '', confirm_password: '' })
    setErrors({}); setShowModal(true)
  }

  const set = (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value
      setForm(f => ({ ...f, [field]: val }))
      setErrors(err => ({ ...err, [field]: undefined }))
    }

  const validate = () => {
    const errs: typeof errors = {}
    if (!form.username.trim()) errs.username = 'Identifiant requis'
    if (!form.first_name.trim()) errs.first_name = 'Prénom requis'
    if (!form.last_name.trim()) errs.last_name = 'Nom requis'
    if (form.password && form.password.length < 8) errs.password = 'Minimum 8 caractères'
    if (form.password && form.password !== form.confirm_password) errs.confirm_password = 'Les mots de passe ne correspondent pas'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload: Partial<UserPayload> & { password?: string } = {
        username: form.username, first_name: form.first_name,
        last_name: form.last_name, email: form.email,
        phone: form.phone, role: form.role, is_active: form.is_active,
      }
      if (form.password) payload.password = form.password

      await usersApi.update(editing.id, payload)
      toast.success('Utilisateur mis à jour')
      setShowModal(false); load()
    } catch (err) { toast.error(getApiError(err))
    } finally { setSaving(false) }
  }

  const handleDelete = async (u: User) => {
    if (u.id === me?.id) { toast.error('Vous ne pouvez pas supprimer votre propre compte.'); return }
    if (!confirm(`Supprimer l'utilisateur "${u.username}" ?`)) return
    try {
      await usersApi.delete(u.id); toast.success('Utilisateur supprimé'); load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const toggleActive = async (u: User) => {
    if (u.id === me?.id) { toast.error('Vous ne pouvez pas désactiver votre propre compte.'); return }
    try {
      await usersApi.update(u.id, { is_active: !u.is_active })
      toast.success(u.is_active ? 'Compte désactivé' : 'Compte activé')
      load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const counts = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admin: users.filter(u => u.role === 'admin').length,
    manager: users.filter(u => u.role === 'manager').length,
    receptionist: users.filter(u => u.role === 'receptionist').length,
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">{counts.active} actif{counts.active > 1 ? 's' : ''} sur {counts.total}</p>
        </div>
      </PageHeader>

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
        <i className="bi bi-info-circle mt-0.5" />
        <p>Un compte est toujours rattaché à un employé. Pour créer un nouvel utilisateur, ajoutez-le d'abord comme employé dans <Link to="/app/schedule" className="font-medium text-hotel-gold hover:underline">Planning personnel</Link>, puis cliquez sur « Créer un compte » depuis sa fiche.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total',          val: counts.total,        icon: 'bi-people',       color: 'text-gray-600'  },
          { label: 'Admins',         val: counts.admin,        icon: 'bi-shield-fill',  color: 'text-red-600'   },
          { label: 'Managers',       val: counts.manager,      icon: 'bi-briefcase',    color: 'text-purple-600'},
          { label: 'Réceptionnistes',val: counts.receptionist, icon: 'bi-headset',      color: 'text-blue-600'  },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <i className={`bi ${s.icon} text-2xl ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.val}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={8} cols={5} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Utilisateur', 'Identifiant', 'Email', 'Téléphone', 'Rôle', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50/60 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' :
                        u.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                        {u.id === me?.id && <span className="text-xs text-amber-600 font-medium">Vous</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge border flex items-center gap-1 w-fit ${ROLE_COLORS[u.role]}`}>
                      <i className={`bi ${ROLE_ICONS[u.role]} text-[10px]`} />
                      {u.role_display}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)} disabled={u.id === me?.id}
                      className={`badge border text-xs cursor-pointer transition-colors ${
                        u.is_active
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      } disabled:cursor-default`}>
                      <i className={`bi ${u.is_active ? 'bi-check-circle-fill' : 'bi-x-circle'} mr-1`} />
                      {u.is_active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="btn-secondary text-xs px-2 py-1" title="Modifier">
                        <i className="bi bi-pencil" />
                      </button>
                      <button onClick={() => handleDelete(u)} disabled={u.id === me?.id}
                        className="btn-danger text-xs px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed" title="Supprimer">
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  <i className="bi bi-people text-3xl block mb-2 opacity-40" />
                  Aucun utilisateur
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal édition */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <i className="bi bi-person-gear text-indigo-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Modifier — {editing?.username}
                  </h3>
                  <p className="text-xs text-gray-400">Laissez le mot de passe vide pour ne pas le changer</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Identité */}
              <div>
                <p className="form-section mb-3">Identité</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Prénom" icon="bi-person" error={errors.first_name} required>
                    <input value={form.first_name} onChange={set('first_name')} placeholder="Jean" autoFocus />
                  </FormField>
                  <FormField label="Nom" icon="bi-person" error={errors.last_name} required>
                    <input value={form.last_name} onChange={set('last_name')} placeholder="Dupont" />
                  </FormField>
                </div>
              </div>

              {/* Compte */}
              <div>
                <p className="form-section mb-3">Compte</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Identifiant" icon="bi-at" error={errors.username} required>
                    <input value={form.username} onChange={set('username')} placeholder="jean.dupont" />
                  </FormField>
                  <FormField label="Rôle" icon="bi-shield">
                    <select value={form.role} onChange={set('role')} className="appearance-none">
                      {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <FormField label="Email" icon="bi-envelope">
                    <input type="email" value={form.email} onChange={set('email')} placeholder="jean@monhotel.ci" />
                  </FormField>
                  <FormField label="Téléphone" icon="bi-telephone">
                    <input type="tel" value={form.phone} placeholder="07XXXXXXXX"
                      maxLength={10} minLength={10} pattern="[0-9]{10}"
                      onChange={e => set('phone')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 10) } } as React.ChangeEvent<HTMLInputElement>)} />
                  </FormField>
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <p className="form-section mb-3">Réinitialiser le mot de passe (optionnel)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Nouveau mot de passe" icon="bi-lock" error={errors.password}>
                    <input type="password" value={form.password} onChange={set('password')} placeholder="Minimum 8 caractères" />
                  </FormField>
                  <FormField label="Confirmer" icon="bi-lock-fill" error={errors.confirm_password} required={!!form.password}>
                    <input type="password" value={form.confirm_password} onChange={set('confirm_password')} placeholder="Répétez le mot de passe" />
                  </FormField>
                </div>
              </div>

              {/* Statut */}
              <div className="flex items-center gap-3 pt-1">
                  <input type="checkbox" id="is_active" checked={form.is_active ?? true}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500" />
                  <label htmlFor="is_active" className="text-sm text-gray-700">Compte actif</label>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary min-w-[120px] justify-center">
                  {saving
                    ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</>
                    : <><i className="bi bi-check-lg" /> Enregistrer</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
