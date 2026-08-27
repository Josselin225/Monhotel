import { useState } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../context/AuthContext'
import TwoFactorSettings from '../components/TwoFactorSettings'
import LoginHistoryList from '../components/LoginHistoryList'

const CURRENCY_OPTIONS = [
  { value: 'XOF', label: 'Franc CFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar US (USD)' },
  { value: 'GBP', label: 'Livre sterling (GBP)' },
]

const DATE_FORMAT_OPTIONS = [
  { value: 'dd/MM/yyyy', label: 'JJ/MM/AAAA' },
  { value: 'MM/dd/yyyy', label: 'MM/JJ/AAAA' },
  { value: 'yyyy-MM-dd', label: 'AAAA-MM-JJ (ISO)' },
]

export const SIDEBAR_COLORS = [
  { value: '#1a1208', label: 'Bois sombre' },
  { value: '#0f172a', label: 'Bleu nuit' },
  { value: '#0f1f27', label: 'Bleu pétrole' },
  { value: '#0f271f', label: 'Forêt' },
  { value: '#1f0f17', label: 'Bordeaux' },
  { value: '#111827', label: 'Anthracite' },
  { value: '#1a0f2e', label: 'Violet' },
  { value: '#27200f', label: 'Caramel' },
  { value: '#0f2020', label: 'Émeraude' },
  { value: '#1f1520', label: 'Prune' },
]

export interface ExchangeRates {
  EUR: number  // XOF par 1 EUR (taux fixe officiel CFA)
  USD: number  // XOF par 1 USD
  GBP: number  // XOF par 1 GBP
  [key: string]: number
}

export interface Settings {
  currency: string
  dateFormat: string
  language: string
  clockFormat: '24h' | '12h'
  notifSound: boolean
  compactMode: boolean
  sidebarColor: string
  exchangeRates: ExchangeRates
  inactivityTimeout: number  // secondes, 0 = désactivé
}

export const DEFAULT_RATES: ExchangeRates = {
  EUR: 655.957,   // taux de parité fixe officiel XOF/EUR
  USD: 620,
  GBP: 790,
}

export const DEFAULTS: Settings = {
  currency: 'XOF',
  dateFormat: 'dd/MM/yyyy',
  language: 'fr',
  clockFormat: '24h',
  notifSound: true,
  compactMode: false,
  sidebarColor: '#1a1208',
  exchangeRates: DEFAULT_RATES,
  inactivityTimeout: 0,
}

const TIMEOUT_OPTIONS = [
  { value: 0,     label: 'Désactivé' },
  { value: 300,   label: '5 minutes' },
  { value: 600,   label: '10 minutes' },
  { value: 900,   label: '15 minutes' },
  { value: 1800,  label: '30 minutes' },
  { value: 3600,  label: '1 heure' },
  { value: 7200,  label: '2 heures' },
]

export function settingsKey(username: string) {
  return `mh_settings_${username}`
}

export function loadSettings(username: string): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(settingsKey(username)) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

/* ── Composants UI ── */
function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <i className={`bi ${icon} text-hotel-gold text-lg`} />
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-hotel-gold focus:border-transparent outline-none"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-hotel-gold focus:ring-offset-2 ${checked ? 'bg-hotel-gold' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

/* ── Page ── */
export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const username = user?.username ?? 'guest'

  const [s, setS] = useState<Settings>(() => loadSettings(username))

  const set = <K extends keyof Settings>(key: K, val: Settings[K]) =>
    setS(prev => ({ ...prev, [key]: val }))

  // Applique la couleur sidebar immédiatement + notifie Layout
  const pickColor = (color: string) => {
    set('sidebarColor', color)
    window.dispatchEvent(new CustomEvent('mh-sidebar-color', { detail: color }))
  }

  const save = () => {
    localStorage.setItem(settingsKey(username), JSON.stringify(s))
    window.dispatchEvent(new CustomEvent('mh-sidebar-color', { detail: s.sidebarColor }))
    window.dispatchEvent(new CustomEvent('mh-settings-changed', { detail: s }))
    toast.success('Paramètres enregistrés')
  }

  const reset = () => {
    setS(DEFAULTS)
    localStorage.removeItem(settingsKey(username))
    window.dispatchEvent(new CustomEvent('mh-sidebar-color', { detail: DEFAULTS.sidebarColor }))
    window.dispatchEvent(new CustomEvent('mh-settings-changed', { detail: DEFAULTS }))
    toast.info('Paramètres réinitialisés')
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">

      {/* Couleur du sidebar */}
      <Card title="Couleur du sidebar" icon="bi-palette">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Personnalisez la couleur du menu latéral — chaque utilisateur a ses propres préférences.
        </p>

        {/* Palette prédéfinie */}
        <div className="flex flex-wrap gap-3 pt-1">
          {SIDEBAR_COLORS.map(c => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => pickColor(c.value)}
              className="group relative w-10 h-10 rounded-xl transition-all duration-150 hover:scale-110 focus:outline-none"
              style={{ backgroundColor: c.value }}
            >
              {s.sidebarColor === c.value && (
                <span className="absolute inset-0 rounded-xl ring-2 ring-hotel-gold ring-offset-2" />
              )}
              {/* Barre dorée en bas pour simuler l'accent du sidebar */}
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-amber-400 opacity-60" />
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {c.label}
              </span>
            </button>
          ))}

          {/* Couleur personnalisée */}
          <label
            title="Couleur personnalisée"
            className="relative w-10 h-10 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-hotel-gold transition-colors overflow-hidden"
          >
            <i className="bi bi-plus text-gray-400 text-lg" />
            <input
              type="color"
              value={s.sidebarColor}
              onChange={e => pickColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            {!SIDEBAR_COLORS.find(c => c.value === s.sidebarColor) && (
              <span className="absolute inset-0 rounded-xl ring-2 ring-hotel-gold ring-offset-2" />
            )}
          </label>
        </div>

        {/* Prévisualisation */}
        <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="w-6 h-16 rounded-md flex flex-col items-center justify-between py-1.5 gap-1"
            style={{ backgroundColor: s.sidebarColor }}>
            {[...Array(3)].map((_, i) => (
              <span key={i} className="w-3 h-0.5 rounded-full bg-white/30" />
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aperçu</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{s.sidebarColor}</p>
          </div>
        </div>
      </Card>

      {/* Affichage */}
      <Card title="Affichage" icon="bi-display">
        <Row label="Thème" hint="Clair ou sombre">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-hotel-gold transition-colors"
          >
            <i className={`bi ${theme === 'dark' ? 'bi-moon-fill' : 'bi-sun-fill'} text-hotel-gold`} />
            {theme === 'dark' ? 'Mode sombre' : 'Mode clair'}
          </button>
        </Row>
        <div className="border-t border-gray-100 dark:border-gray-800" />
        <Row label="Mode compact" hint="Réduit l'espacement des listes et tableaux">
          <Toggle checked={s.compactMode} onChange={v => set('compactMode', v)} />
        </Row>
      </Card>

      {/* Régionalisation */}
      <Card title="Régionalisation" icon="bi-globe2">
        <Row label="Devise" hint="Utilisée pour l'affichage des prix">
          <Select value={s.currency} onChange={v => set('currency', v)} options={CURRENCY_OPTIONS} />
        </Row>
        <div className="border-t border-gray-100 dark:border-gray-800" />
        <Row label="Format de date">
          <Select value={s.dateFormat} onChange={v => set('dateFormat', v)} options={DATE_FORMAT_OPTIONS} />
        </Row>
        <div className="border-t border-gray-100 dark:border-gray-800" />
        <Row label="Format de l'heure">
          <Select
            value={s.clockFormat}
            onChange={v => set('clockFormat', v as '24h' | '12h')}
            options={[{ value: '24h', label: '24h (14:30)' }, { value: '12h', label: '12h (2:30 PM)' }]}
          />
        </Row>
        {s.currency !== 'XOF' && (
          <>
            <div className="border-t border-gray-100 dark:border-gray-800" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Taux de conversion (1 {s.currency} = ? FCFA)
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                EUR/FCFA est un taux fixe officiel (655,957). Mettez à jour USD et GBP selon le marché.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(['EUR', 'USD', 'GBP'] as const).map(code => (
                  <div key={code}>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                      {code === 'EUR' ? '€ EUR' : code === 'USD' ? '$ USD' : '£ GBP'}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="1"
                      value={s.exchangeRates[code]}
                      readOnly={code === 'EUR'}
                      onChange={e => set('exchangeRates', { ...s.exchangeRates, [code]: parseFloat(e.target.value) || s.exchangeRates[code] })}
                      className={`w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-hotel-gold ${code === 'EUR' ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                    {code === 'EUR' && <p className="text-[10px] text-gray-400 mt-0.5">Taux fixe officiel</p>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Notifications */}
      <Card title="Notifications" icon="bi-bell">
        <Row label="Son des notifications" hint="Jouer un son lors des nouvelles notifications">
          <Toggle checked={s.notifSound} onChange={v => set('notifSound', v)} />
        </Row>
      </Card>

      {/* Sécurité */}
      <Card title="Sécurité" icon="bi-shield-lock">
        <Row
          label="Veille automatique"
          hint="L'application déconnecte l'utilisateur après une période d'inactivité"
        >
          <select
            value={s.inactivityTimeout}
            onChange={e => set('inactivityTimeout', Number(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-hotel-gold focus:border-transparent outline-none"
          >
            {TIMEOUT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Row>
        {s.inactivityTimeout > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <i className="bi bi-info-circle" />
            Un avertissement s'affichera 60 secondes avant la déconnexion automatique.
          </p>
        )}

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Double authentification (2FA)</p>
          <TwoFactorSettings />
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Historique de connexions</p>
          <LoginHistoryList />
        </div>
      </Card>

      {/* À propos */}
      <Card title="À propos" icon="bi-info-circle">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Application', 'Mon Hôtel — Système de gestion'],
            ['Version', '1.0.0'],
            ['Backend', 'Django 5.1 · DRF 3.15'],
            ['Frontend', 'React 18 · Vite 6 · TypeScript'],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{k}</p>
              <p className="text-gray-700 dark:text-gray-300 font-medium mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={reset} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
          Réinitialiser les paramètres
        </button>
        <button
          onClick={save}
          className="px-6 py-2.5 bg-hotel-gold text-white rounded-lg text-sm font-semibold hover:brightness-110 transition-all shadow-md shadow-hotel-gold/20"
        >
          Enregistrer
        </button>
      </div>

    </div>
  )
}
