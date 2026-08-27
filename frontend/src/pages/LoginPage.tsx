import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getContent } from '../api/content'
import { mediaUrl } from '../utils'

function HotelLogo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-hotel-gold">
      <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 27 L10 18 L14.5 22.5 L20 14 L25.5 22.5 L30 18 L30 27 Z"
        fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
      <rect x="10" y="27" width="20" height="2.5" rx="1.25" fill="currentColor" />
      <circle cx="20" cy="14" r="1.5" fill="currentColor" />
    </svg>
  )
}

function LoginSuccessScreen({ hotelName, logoUrl }: { hotelName: string; logoUrl: string }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{ backgroundColor: '#1a1208', animation: 'lsFadeIn 0.35s ease forwards' }}
    >
      <style>{`
        @keyframes lsFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lsBounceIn {
          0%   { transform: scale(0.2); opacity: 0; }
          55%  { transform: scale(1.18); opacity: 1; }
          75%  { transform: scale(0.94); }
          100% { transform: scale(1); }
        }
        @keyframes lsArcDraw {
          from { stroke-dashoffset: 327; opacity: 0; }
          10%  { opacity: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes lsCheckPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          80%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes lsCheckDraw {
          from { stroke-dashoffset: 22; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes lsSlideUp {
          from { transform: translateY(18px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes lsDotBounce {
          0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
          40%            { transform: translateY(-7px); opacity: 1;   }
        }
      `}</style>

      {/* Logo + badge */}
      <div
        className="relative"
        style={{ animation: 'lsBounceIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both' }}
      >
        {/* Arc tournant autour du logo */}
        <svg
          className="absolute inset-0"
          width="140" height="140"
          viewBox="0 0 140 140"
          style={{ top: '-12px', left: '-12px' }}
        >
          <circle
            cx="70" cy="70" r="66"
            fill="none"
            stroke="#c9973a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="415"
            style={{
              animation: 'lsArcDraw 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.9s both',
              opacity: 0,
              transformOrigin: '70px 70px',
              transform: 'rotate(-90deg)',
            }}
          />
        </svg>

        {/* Cercle fond + logo */}
        <div
          className="w-[116px] h-[116px] rounded-full flex items-center justify-center"
          style={{
            border: '1.5px solid rgba(201,151,58,0.25)',
            boxShadow: '0 0 56px rgba(201,151,58,0.22), 0 0 14px rgba(201,151,58,0.12)',
          }}
        >
          {logoUrl
            ? <img src={logoUrl} alt={hotelName} className="w-16 h-16 rounded-full object-cover" />
            : <HotelLogo size={64} />
          }
        </div>

        {/* Badge coche */}
        <div
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
          style={{
            backgroundColor: '#c9973a',
            animation: 'lsCheckPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 2.1s both',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 8L6.5 11L12.5 5"
              stroke="#1a1208"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="22"
              style={{ animation: 'lsCheckDraw 0.4s ease 2.55s both' }}
            />
          </svg>
        </div>
      </div>

      {/* Texte */}
      <div
        className="mt-9 text-center"
        style={{ animation: 'lsSlideUp 0.6s ease 1.8s both', opacity: 0 }}
      >
        <h2 className="text-3xl font-serif font-bold text-hotel-gold">Bienvenue chez {hotelName}</h2>
        <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>
          Chargement du tableau de bord…
        </p>
      </div>

      {/* Dots */}
      <div
        className="flex gap-2 mt-6"
        style={{ animation: 'lsSlideUp 0.6s ease 2.2s both', opacity: 0 }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: '#c9973a',
              animation: `lsDotBounce 1.4s ease ${i * 0.22}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [needsCode, setNeedsCode] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [hotelName, setHotelName] = useState('Mon Hôtel')
  const [hotelTag,  setHotelTag]  = useState('Connexion au système de gestion')
  const [logoUrl,   setLogoUrl]   = useState('')
  const [heroUrl,   setHeroUrl]   = useState('')
  const [stars,     setStars]     = useState(0)
  const [city,      setCity]      = useState('')
  const [since,     setSince]     = useState('')

  useEffect(() => {
    getContent().then(c => {
      const name = c.hotel.name || 'Mon Hôtel'
      const logo = mediaUrl(c.hotel.logo_url) || ''
      setHotelName(name)
      setHotelTag(c.hotel.tagline || 'Connexion au système de gestion')
      setLogoUrl(logo)
      setHeroUrl(mediaUrl(c.hero?.image) || '')
      setStars(c.hotel.stars || 0)
      setCity(c.hotel.city || '')
      setSince(c.hotel.since || '')
      document.title = `${name} — Connexion`
      if (logo) {
        const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
        if (favicon) favicon.href = logo
      }
    }).catch(() => {})
  }, [])

  if (user && !success) return <Navigate to="/app" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const otp_code    = needsCode && !useBackupCode ? code : undefined
      const backup_code = needsCode && useBackupCode  ? code : undefined
      const result = await login(form.username, form.password, otp_code, backup_code)
      if (result.twoFactorRequired) {
        setNeedsCode(true)
        setLoading(false)
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/app'), 4000)
    } catch {
      setError(needsCode ? 'Code de vérification incorrect.' : 'Identifiant ou mot de passe incorrect.')
      setLoading(false)
    }
  }

  if (success) return <LoginSuccessScreen hotelName={hotelName} logoUrl={logoUrl} />

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-hotel-dark">
      {/* ── Fond plein écran : photo floutée ou dégradé décoratif ── */}
      {heroUrl ? (
        <img src={heroUrl} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm" />
      ) : (
        <>
          <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-hotel-gold/20 blur-[120px]" />
          <div className="absolute -bottom-40 -right-24 w-[560px] h-[560px] rounded-full bg-hotel-gold/10 blur-[130px]" />
        </>
      )}
      <div className="absolute inset-0 bg-hotel-dark/80" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 35%, transparent 0%, rgba(26,18,8,0.55) 75%)' }}
      />

      {/* ── Colonne centrale ── */}
      <div className="relative z-10 w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 flex items-center justify-center mb-4 shadow-xl shadow-black/30">
            {logoUrl
              ? <img src={logoUrl} alt={hotelName} className="w-10 h-10 rounded-lg object-cover" />
              : <HotelLogo size={32} />
            }
          </div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-wide">{hotelName}</h1>
          <p className="text-white/40 text-sm mt-1">{hotelTag}</p>
          {(stars > 0 || city || since) && (
            <div className="flex items-center gap-3 mt-3 text-white/35 text-xs">
              {stars > 0 && (
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: stars }).map((_, i) => (
                    <i key={i} className="bi bi-star-fill text-hotel-gold text-[10px]" />
                  ))}
                </span>
              )}
              {city && <span>{city}</span>}
              {since && <span>Depuis {since}</span>}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="backdrop-blur-2xl bg-white/[0.06] border border-white/15 rounded-3xl p-7 sm:p-8 shadow-2xl shadow-black/50"
        >
          <h2 className="text-xl font-serif font-bold text-white">
            {needsCode ? 'Vérification' : 'Bienvenue'}
          </h2>
          <p className="text-sm text-white/40 mt-1 mb-6">
            {needsCode ? 'Confirmez votre identité pour continuer.' : 'Connectez-vous pour accéder à votre espace.'}
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-300 flex items-start gap-2">
              <i className="bi bi-exclamation-circle mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {!needsCode ? (
            <div className="space-y-4">
              <div className="relative">
                <i className="bi bi-person absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[15px]" />
                <input
                  type="text"
                  placeholder="Nom d'utilisateur"
                  className="field-on-dark w-full pl-10 pr-3.5 py-3 text-sm bg-white/[0.06] border border-white/15 text-white placeholder:text-white/30 rounded-xl outline-none transition-all focus:bg-white/10 focus:border-hotel-gold focus:ring-4 focus:ring-hotel-gold/15"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="relative">
                <i className="bi bi-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[15px]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mot de passe"
                  className="field-on-dark w-full pl-10 pr-10 py-3 text-sm bg-white/[0.06] border border-white/15 text-white placeholder:text-white/30 rounded-xl outline-none transition-all focus:bg-white/10 focus:border-hotel-gold focus:ring-4 focus:ring-hotel-gold/15"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} text-[15px]`} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-white/45">
                {useBackupCode
                  ? 'Entrez un de vos codes de secours à usage unique.'
                  : 'Entrez le code à 6 chiffres généré par votre application d\'authentification.'}
              </p>
              <input
                type="text"
                inputMode={useBackupCode ? 'text' : 'numeric'}
                placeholder={useBackupCode ? '••••••••' : '••••••'}
                className="field-on-dark w-full py-3 text-center text-xl tracking-[0.4em] bg-white/[0.06] border border-white/15 text-white placeholder:text-white/20 rounded-xl outline-none transition-all focus:bg-white/10 focus:border-hotel-gold focus:ring-4 focus:ring-hotel-gold/15"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={useBackupCode ? 8 : 6}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setUseBackupCode(v => !v); setCode(''); setError('') }}
                className="text-xs text-hotel-gold hover:underline"
              >
                {useBackupCode ? 'Utiliser le code de mon application' : 'Utiliser un code de secours'}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 rounded-xl bg-hotel-gold text-white font-semibold text-sm hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-hotel-gold/25"
          >
            {loading
              ? <><i className="bi bi-arrow-repeat animate-spin" /> Connexion…</>
              : needsCode ? 'Vérifier' : <>Se connecter <i className="bi bi-arrow-right" /></>}
          </button>

          {needsCode && (
            <button
              type="button"
              onClick={() => { setNeedsCode(false); setCode(''); setError('') }}
              className="w-full mt-3 text-sm text-white/35 hover:text-white/60 flex items-center justify-center gap-1.5"
            >
              <i className="bi bi-arrow-left" /> Retour
            </button>
          )}
        </form>

        <p className="text-center text-white/25 text-xs mt-6">
          © {new Date().getFullYear()} {hotelName} — Tous droits réservés
        </p>
      </div>
    </div>
  )
}
