import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/auth'
import { getApiError, mediaUrl } from '../utils'
import FormField from '../components/FormField'

const ROLE_COLORS: Record<string, string> = {
  admin:        'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  manager:      'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  receptionist: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
}
const ROLE_ICONS: Record<string, string> = {
  admin:        'bi-shield-fill',
  manager:      'bi-briefcase-fill',
  receptionist: 'bi-headset',
}

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // ── Profile form ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    first_name: user?.first_name ?? '',
    last_name:  user?.last_name  ?? '',
    email:      user?.email      ?? '',
    phone:      user?.phone      ?? '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileErrors, setProfileErrors] = useState<Partial<typeof profile>>({})

  // ── Password form ─────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ old: '', new: '', confirm: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdErrors, setPwdErrors] = useState<Partial<typeof pwd>>({})

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'
  const avatarSrc = avatarPreview ?? (user?.avatar ? mediaUrl(user.avatar) : null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Sélectionnez une image (JPG, PNG, WEBP)'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo)'); return }

    // Prévisualisation immédiate
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploadingAvatar(true)
    try {
      const updated = await authApi.updateAvatar(file)
      setUser(updated)
      setAvatarPreview(null)
      toast.success('Photo mise à jour')
    } catch (err) {
      setAvatarPreview(null)
      toast.error(getApiError(err))
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user?.avatar) return
    if (!confirm('Supprimer votre photo de profil ?')) return
    setUploadingAvatar(true)
    try {
      const updated = await authApi.removeAvatar()
      setUser(updated)
      toast.success('Photo supprimée')
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setUploadingAvatar(false) }
  }
  const setP = (field: keyof typeof profile) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfile(f => ({ ...f, [field]: e.target.value }))
      setProfileErrors(err => ({ ...err, [field]: undefined }))
    }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Partial<typeof profile> = {}
    if (!profile.first_name.trim()) errs.first_name = 'Prénom requis'
    if (!profile.last_name.trim())  errs.last_name  = 'Nom requis'
    if (Object.keys(errs).length) { setProfileErrors(errs); return }

    setSavingProfile(true)
    try {
      const updated = await authApi.updateMe(profile)
      setUser(updated)
      toast.success('Profil mis à jour')
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setSavingProfile(false) }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Partial<typeof pwd> = {}
    if (!pwd.old)             errs.old     = 'Mot de passe actuel requis'
    if (!pwd.new)             errs.new     = 'Nouveau mot de passe requis'
    if (pwd.new.length < 8)   errs.new     = 'Minimum 8 caractères'
    if (pwd.new !== pwd.confirm) errs.confirm = 'Les mots de passe ne correspondent pas'
    if (Object.keys(errs).length) { setPwdErrors(errs); return }

    setSavingPwd(true)
    try {
      await authApi.changePassword(pwd.old, pwd.new)
      setPwd({ old: '', new: '', confirm: '' })
      toast.success('Mot de passe modifié avec succès')
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setSavingPwd(false) }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* Avatar card */}
      <div className="card mb-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative shrink-0 group">
          {/* Avatar */}
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg shadow-amber-200 relative focus:outline-none focus:ring-2 focus:ring-amber-400">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-3xl font-bold">
                {initials}
              </div>
            )}
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingAvatar
                ? <i className="bi bi-arrow-repeat animate-spin text-white text-xl" />
                : <i className="bi bi-camera-fill text-white text-xl" />}
            </div>
          </button>

          {/* Badge rôle */}
          <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${ROLE_COLORS[user?.role ?? 'receptionist']}`}>
            <i className={`bi ${ROLE_ICONS[user?.role ?? 'receptionist']}`} />
          </span>

          {/* Input fichier caché */}
          <input ref={fileInputRef} type="file" accept="image/*"
            className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="text-center sm:text-left flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {user?.first_name} {user?.last_name}
          </h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">@{user?.username}</p>
          <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[user?.role ?? 'receptionist']}`}>
              <i className={`bi ${ROLE_ICONS[user?.role ?? 'receptionist']} text-[10px]`} />
              {user?.role === 'admin' ? 'Administrateur' : user?.role === 'manager' ? 'Manager' : 'Réceptionniste'}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${user?.is_active ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
              <i className={`bi ${user?.is_active ? 'bi-check-circle-fill' : 'bi-x-circle'} text-[10px]`} />
              {user?.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>

        <div className="text-center sm:text-right shrink-0 space-y-2">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Identifiant</p>
            <p className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">{user?.username}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Non modifiable</p>
          </div>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium flex items-center gap-1 justify-end disabled:opacity-40">
              <i className="bi bi-camera" /> Changer la photo
            </button>
            {user?.avatar && (
              <button type="button" onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-xs text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium flex items-center gap-1 justify-end disabled:opacity-40">
                <i className="bi bi-trash" /> Supprimer la photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <div className="card mb-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <i className="bi bi-person-gear text-blue-600 dark:text-blue-400 text-lg" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Informations personnelles</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">Modifiez vos informations de contact</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Prénom" icon="bi-person" error={profileErrors.first_name} required>
              <input value={profile.first_name} onChange={setP('first_name')} placeholder="Jean" />
            </FormField>
            <FormField label="Nom" icon="bi-person" error={profileErrors.last_name} required>
              <input value={profile.last_name} onChange={setP('last_name')} placeholder="Dupont" />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Email" icon="bi-envelope">
              <input type="email" value={profile.email} onChange={setP('email')} placeholder="jean@monhotel.ci" />
            </FormField>
            <FormField label="Téléphone" icon="bi-telephone">
              <input type="tel" value={profile.phone} placeholder="07XXXXXXXX"
                maxLength={10} minLength={10} pattern="[0-9]{10}"
                onChange={e => setP('phone')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 10) } } as React.ChangeEvent<HTMLInputElement>)} />
            </FormField>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
            <button type="submit" disabled={savingProfile} className="btn-primary min-w-[140px] justify-center">
              {savingProfile
                ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</>
                : <><i className="bi bi-check-lg" /> Enregistrer</>}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <i className="bi bi-lock text-amber-600 dark:text-amber-400 text-lg" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Changer le mot de passe</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">Minimum 8 caractères</p>
          </div>
        </div>

        <form onSubmit={handleSavePassword} className="space-y-4">
          <FormField label="Mot de passe actuel" icon="bi-lock" error={pwdErrors.old} required>
            <input type="password" value={pwd.old}
              onChange={e => { setPwd(p => ({ ...p, old: e.target.value })); setPwdErrors(err => ({ ...err, old: undefined })) }}
              placeholder="Votre mot de passe actuel" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nouveau mot de passe" icon="bi-lock-fill" error={pwdErrors.new} required>
              <input type="password" value={pwd.new}
                onChange={e => { setPwd(p => ({ ...p, new: e.target.value })); setPwdErrors(err => ({ ...err, new: undefined })) }}
                placeholder="Minimum 8 caractères" />
            </FormField>
            <FormField label="Confirmer" icon="bi-lock-fill" error={pwdErrors.confirm} required>
              <input type="password" value={pwd.confirm}
                onChange={e => { setPwd(p => ({ ...p, confirm: e.target.value })); setPwdErrors(err => ({ ...err, confirm: undefined })) }}
                placeholder="Répétez le nouveau mot de passe" />
            </FormField>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
            <button type="submit" disabled={savingPwd} className="btn-primary min-w-[160px] justify-center">
              {savingPwd
                ? <><i className="bi bi-arrow-repeat animate-spin" /> Modification…</>
                : <><i className="bi bi-shield-check" /> Changer le mot de passe</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
