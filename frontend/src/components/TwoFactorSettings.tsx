import { useState } from 'react'
import { toast } from 'sonner'
import { authApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { getApiError } from '../utils'

type Step = 'idle' | 'setup' | 'backup-codes'

export default function TwoFactorSettings() {
  const { user, refreshUser } = useAuth()
  const [step, setStep] = useState<Step>('idle')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [disablePwd, setDisablePwd] = useState('')
  const [showDisable, setShowDisable] = useState(false)

  const enabled = !!user?.two_factor_enabled

  const handleStart = async () => {
    setLoading(true)
    try {
      const { secret, qr_code } = await authApi.setup2FA()
      setSecret(secret)
      setQr(qr_code)
      setStep('setup')
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { backup_codes } = await authApi.confirm2FA(code)
      setBackupCodes(backup_codes)
      setStep('backup-codes')
      setCode('')
      await refreshUser()
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }

  const handleFinish = () => {
    setStep('idle')
    setBackupCodes([])
    toast.success('Double authentification activée')
  }

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.disable2FA(disablePwd)
      setShowDisable(false)
      setDisablePwd('')
      await refreshUser()
      toast.success('Double authentification désactivée')
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }

  if (step === 'setup') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Scannez ce QR code avec Google Authenticator, Authy ou une application équivalente, puis entrez le code généré.
        </p>
        <div className="flex justify-center">
          <img src={qr} alt="QR code 2FA" className="w-44 h-44 rounded-lg border border-gray-200 dark:border-gray-700" />
        </div>
        <p className="text-xs text-gray-400 text-center">
          Impossible de scanner ? Entrez ce code manuellement : <span className="font-mono">{secret}</span>
        </p>
        <form onSubmit={handleConfirm} className="flex flex-col items-center gap-3">
          <input
            type="text" inputMode="numeric" maxLength={6} required autoFocus
            value={code} onChange={e => setCode(e.target.value)}
            className="input text-center text-lg tracking-widest w-40"
            placeholder="000000"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('idle')} className="btn-secondary text-sm px-4 py-2">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary text-sm px-4 py-2">
              {loading ? 'Vérification…' : 'Activer'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (step === 'backup-codes') {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <i className="bi bi-exclamation-triangle-fill mt-0.5" />
          <span>Notez ces codes de secours dans un endroit sûr. Chacun ne peut être utilisé qu'une seule fois pour vous connecter si vous perdez l'accès à votre application d'authentification. Ils ne seront plus jamais affichés.</span>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          {backupCodes.map(c => (
            <div key={c} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-center">{c}</div>
          ))}
        </div>
        <button onClick={handleFinish} className="btn-primary w-full justify-center py-2.5">
          J'ai noté mes codes de secours
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
          <i className={`bi ${enabled ? 'bi-shield-fill-check' : 'bi-shield'} text-[11px]`} />
          {enabled ? 'Activée' : 'Désactivée'}
        </span>
        {!enabled ? (
          <button onClick={handleStart} disabled={loading} className="btn-primary text-sm px-4 py-2">
            Activer la double authentification
          </button>
        ) : (
          <button onClick={() => setShowDisable(v => !v)} className="text-sm text-red-500 hover:text-red-600 font-medium">
            Désactiver
          </button>
        )}
      </div>

      {showDisable && (
        <form onSubmit={handleDisable} className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <input
            type="password" required autoFocus placeholder="Mot de passe pour confirmer"
            value={disablePwd} onChange={e => setDisablePwd(e.target.value)}
            className="input flex-1 text-sm"
          />
          <button type="submit" disabled={loading} className="btn-secondary text-sm px-3 py-2 shrink-0">Confirmer</button>
        </form>
      )}
    </div>
  )
}
