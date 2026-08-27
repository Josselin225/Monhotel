import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { User } from '../types'
import NotificationBell from './NotificationBell'
import GlobalSearch from './GlobalSearch'
import ClockWidget from './ClockWidget'
import { useTheme } from '../hooks/useTheme'
import { loadSettings, Settings } from '../pages/SettingsPage'
import { setActiveCurrency, setActiveRates, mediaUrl } from '../utils'
import { getContent, updateContent, EmergencyContact } from '../api/content'
import { useRoomSocket } from '../hooks/useRoomSocket'
import { useInactivityTimer } from '../hooks/useInactivityTimer'
import { auditLogApi } from '../api/auditLog'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
  href?: string
  managerOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
  adminOnly?: boolean
  superuserOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    label: '',
    items: [
      { to: '/app', label: 'Tableau de bord', icon: 'bi-speedometer2', end: true },
    ],
  },
  {
    label: 'Hébergement',
    items: [
      { to: '/app/rooms',         label: 'Chambres',      icon: 'bi-door-open' },
      { to: '/app/room-map',      label: 'Plan des ch.', icon: 'bi-grid-3x3' },
      { to: '/app/planning',      label: 'Planning',      icon: 'bi-calendar3' },
      { to: '/app/bookings',      label: 'Réservations',  icon: 'bi-bookmark-check' },
    ],
  },
  {
    label: 'Exploitation',
    items: [
      { to: '/app/housekeeping',  label: 'Ménage',        icon: 'bi-bucket' },
      { to: '/app/maintenance',   label: 'Maintenance',   icon: 'bi-tools' },
      { to: '/app/inventory',     label: 'Stocks',        icon: 'bi-box-seam' },
      { to: '/app/schedule',      label: 'Planning personnel', icon: 'bi-calendar-week' },
    ],
  },
  {
    label: 'Clients',
    items: [
      { to: '/app/clients',  label: 'Clients',       icon: 'bi-people' },
      { to: '/app/crm',      label: 'CRM',           icon: 'bi-heart-pulse' },
      { to: '/app/surveys',  label: 'Satisfaction',  icon: 'bi-emoji-smile' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/app/billing',    label: 'Facturation',  icon: 'bi-receipt' },
      { to: '/app/accounting', label: 'Comptabilité', icon: 'bi-journal-text', managerOnly: true },
      { to: '/app/analytics',  label: 'Analytics',    icon: 'bi-graph-up-arrow' },
    ],
  },
  {
    label: 'Rapports',
    items: [
      { to: '/app/daily-report', label: 'Rapport journalier', icon: 'bi-sun',                      end: true },
      { to: '/app/reports',      label: 'Rapports mensuels', icon: 'bi-file-earmark-bar-graph',   end: true, managerOnly: true },
      { to: '/app/reports/full', label: 'Bilan mensuel',     icon: 'bi-building', managerOnly: true },
    ],
  },
  {
    label: 'Site',
    items: [
      { to: '/app/content', label: "Page d'accueil", icon: 'bi-layout-text-window' },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { to: '/app/pricing',    label: 'Tarification', icon: 'bi-tags' },
      { to: '/app/users',      label: 'Utilisateurs', icon: 'bi-person-gear' },
      { to: '/app/audit-log',  label: "Journal d'audit", icon: 'bi-shield-check' },
    ],
  },
  {
    label: 'Plateforme',
    superuserOnly: true,
    items: [
      { to: '/app/group-dashboard', label: 'Tableau de bord groupe', icon: 'bi-diagram-3' },
    ],
  },
  {
    label: '',
    items: [
      { to: '/app/settings', label: 'Paramètres', icon: 'bi-gear' },
      { to: '#guide', label: 'Guide utilisateur', icon: 'bi-book', href: '/guide-utilisateur.pdf' },
      { to: '/app/carte-visite', label: 'Carte de visite', icon: 'bi-person-vcard' },
    ],
  },
]

const SIDEBAR_FULL = 240
const SIDEBAR_MINI = 72

const PAGE_TITLES: Record<string, string> = {
  '/app':          'Tableau de bord',
  '/app/rooms':    'Chambres',
  '/app/planning': 'Planning',
  '/app/bookings': 'Réservations',
  '/app/clients':  'Clients',
  '/app/billing':  'Facturation',
  '/app/crm':      'CRM Clients',
  '/app/content':  "Page d'accueil",
  '/app/users':    'Utilisateurs',
  '/app/profile':      'Mon profil',
  '/app/housekeeping': 'Ménage des chambres',
  '/app/analytics':   'Analytics',
  '/app/pricing':     'Tarification dynamique',
  '/app/surveys':     'Satisfaction clients',
  '/app/accounting':  'Comptabilité',
  '/app/maintenance': 'Maintenance',
  '/app/audit-log':   "Journal d'audit",
  '/app/daily-report':     'Rapport journalier',
  '/app/room-map':         'Plan des chambres',
  '/app/reports':          'Rapports mensuels',
  '/app/reports/full':     'Bilan mensuel',
  '/app/settings':    'Paramètres',
  '/app/group-dashboard': 'Tableau de bord groupe',
  '/app/inventory':    'Stocks',
  '/app/schedule':     'Planning personnel',
  '/app/carte-visite': 'Carte de visite',
}

function groupIsActive(group: NavGroup, pathname: string) {
  return group.items.some(item =>
    item.end ? pathname === item.to : pathname.startsWith(item.to)
  )
}

interface SidebarProps {
  collapsed: boolean
  isMobile: boolean
  logoUrl: string
  hotelName: string
  hotelTag: string
  user: User | null
  pathname: string
  openGroups: Record<string, boolean>
  toggleGroup: (label: string) => void
  onCloseMobile: () => void
  onToggleCollapsed: () => void
}

/* Composant à part (mémoïsé) : évite que le contenu du sidebar soit démonté puis
   remonté à chaque rendu de Layout (ex: le compte à rebours d'inactivité qui
   déclenche un rendu par seconde), ce qui provoquerait des saccades inutiles. */
const Sidebar = memo(function Sidebar({
  collapsed, isMobile, logoUrl, hotelName, hotelTag, user, pathname,
  openGroups, toggleGroup, onCloseMobile, onToggleCollapsed,
}: SidebarProps) {
  return (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-white/10 flex-shrink-0">
        {(collapsed && !isMobile) ? (
          <NavLink to="/" className="flex items-center justify-center w-full">
            {logoUrl ? (
              <img src={logoUrl} alt={hotelName} className="w-8 h-8 object-contain rounded"
                onError={e => { e.currentTarget.style.display='none' }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="text-hotel-gold">
                <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M10 27 L10 18 L14.5 22.5 L20 14 L25.5 22.5 L30 18 L30 27 Z" fill="currentColor" strokeWidth="0.5" strokeLinejoin="round" stroke="currentColor"/>
                <rect x="10" y="27" width="20" height="2.5" rx="1.25" fill="currentColor" />
              </svg>
            )}
          </NavLink>
        ) : (
          <NavLink to="/" className="flex items-center gap-2.5 min-w-0 flex-1">
            {logoUrl ? (
              <img src={logoUrl} alt={hotelName} className="w-8 h-8 object-contain rounded shrink-0"
                onError={e => { e.currentTarget.style.display='none' }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="text-hotel-gold shrink-0">
                <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M10 27 L10 18 L14.5 22.5 L20 14 L25.5 22.5 L30 18 L30 27 Z" fill="currentColor" strokeWidth="0.5" strokeLinejoin="round" stroke="currentColor"/>
                <rect x="10" y="27" width="20" height="2.5" rx="1.25" fill="currentColor" />
              </svg>
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-serif font-bold text-hotel-gold leading-tight truncate">{hotelName}</p>
              <p className="text-[10px] text-white/40 tracking-wide truncate">{hotelTag}</p>
            </div>
          </NavLink>
        )}
        {/* Bouton fermer sur mobile */}
        {isMobile && (
          <button onClick={onCloseMobile} className="ml-auto text-white/50 hover:text-white p-1">
            <i className="bi bi-x-lg text-lg" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group) => {
          if (group.adminOnly && user?.role !== 'admin') return null
          if (group.superuserOnly && !user?.is_superuser) return null

          const isManager = user?.role === 'admin' || user?.role === 'manager'
          const items = group.items.filter(item => !item.managerOnly || isManager)
          if (items.length === 0) return null

          const mini       = collapsed && !isMobile
          const isOpen     = !group.label || mini || openGroups[group.label]
          const hasActive  = group.label ? groupIsActive({ ...group, items }, pathname) : false

          return (
            <div key={group.label || '__root'} className="px-2">

              {/* ── Accordion header (groupes avec label, mode étendu uniquement) ── */}
              {group.label && !mini && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 mt-1 rounded-lg text-left transition-colors duration-150 select-none
                    ${hasActive && !isOpen
                      ? 'text-hotel-gold/90 hover:bg-white/8'
                      : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                    }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em]">
                    {group.label}
                  </span>
                  <i className={`bi bi-chevron-right text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                </button>
              )}

              {/* Séparateur en mode mini */}
              {group.label && mini && (
                <div className="my-2 mx-2 h-px bg-white/10" />
              )}

              {/* ── Contenu du tiroir ── */}
              <div
                className="grid transition-all duration-200 ease-in-out"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5 py-0.5">
                    {items.map((item) => item.href ? (
                      <a
                        key={item.to}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={mini ? item.label : undefined}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-white/60 hover:bg-white/8 hover:text-white"
                      >
                        <i className={`bi ${item.icon} text-[18px] shrink-0 text-white/50 group-hover:text-white transition-colors`} />
                        {!mini && <span className="truncate">{item.label}</span>}
                      </a>
                    ) : (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        title={mini ? item.label : undefined}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                            isActive
                              ? 'bg-hotel-gold text-white shadow-md shadow-hotel-gold/20'
                              : 'text-white/60 hover:bg-white/8 hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <i className={`bi ${item.icon} text-[18px] shrink-0 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white'} transition-colors`} />
                            {!mini && <span className="truncate">{item.label}</span>}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )
        })}
      </nav>

      {/* Toggle collapse — desktop only */}
      {!isMobile && (
        <button
          onClick={onToggleCollapsed}
          className="absolute -right-3 top-[52px] w-6 h-6 rounded-full bg-hotel-gold text-white flex items-center justify-center shadow-lg hover:brightness-110 transition-all z-50"
          title={collapsed ? 'Agrandir' : 'Réduire'}
        >
          <i className={`bi bi-chevron-${collapsed ? 'right' : 'left'} text-[10px] font-bold`} />
        </button>
      )}
    </>
  )
})

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate  = useNavigate()
  useRoomSocket()
  const location  = useLocation()

  const [collapsed,   setCollapsed]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth < 768)

  const [sidebarColor, setSidebarColor] = useState(() =>
    loadSettings(user?.username ?? 'guest').sidebarColor
  )
  const [inactivityTimeout, setInactivityTimeout] = useState(() =>
    loadSettings(user?.username ?? 'guest').inactivityTimeout
  )
  const [hotelName, setHotelName]   = useState('Mon Hôtel')
  const [hotelTag,  setHotelTag]    = useState('Système de gestion')
  const [logoUrl,   setLogoUrl]     = useState('')

  const EMPTY_EC: EmergencyContact  = { name: '', phone: '', email: '', whatsapp: '' }
  const [ec,     setEc]             = useState<EmergencyContact>(EMPTY_EC)
  const [ecEdit, setEcEdit]         = useState<EmergencyContact>(EMPTY_EC)
  const [savingEc, setSavingEc]     = useState(false)

  // Dropdown profil + modal support
  const [profileOpen,  setProfileOpen]  = useState(false)
  const [supportOpen,  setSupportOpen]  = useState(false)
  const [editingEc,    setEditingEc]    = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getContent().then(c => {
      const name = c.hotel.name || 'Mon Hôtel'
      const logo = mediaUrl(c.hotel.logo_url) || ''
      setHotelName(name)
      setHotelTag(c.hotel.tagline || 'Système de gestion')
      setLogoUrl(logo)
      document.title = `${name} — Système de Gestion`
      if (logo) {
        const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
        if (favicon) favicon.href = logo
      }
      const loaded = c.emergency_contact ?? EMPTY_EC
      setEc(loaded)
      setEcEdit(loaded)
    }).catch(() => {})
  }, [])

  // Ferme le dropdown si click en dehors
  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [profileOpen])

  const saveEc = async () => {
    setSavingEc(true)
    try {
      await updateContent({ emergency_contact: ecEdit })
      setEc(ecEdit)
      setEditingEc(false)
    } catch { /* ignore */ }
    finally { setSavingEc(false) }
  }

  useEffect(() => {
    const handler = (e: Event) => setSidebarColor((e as CustomEvent<string>).detail)
    window.addEventListener('mh-sidebar-color', handler)
    return () => window.removeEventListener('mh-sidebar-color', handler)
  }, [])

  // Applique devise + mode compact au chargement et à chaque changement
  useEffect(() => {
    const initial = loadSettings(user?.username ?? 'guest')
    setActiveCurrency(initial.currency)
    setActiveRates(initial.exchangeRates)
    document.documentElement.classList.toggle('compact', initial.compactMode)
  }, [user?.username])

  useEffect(() => {
    const handler = (e: Event) => {
      const s = (e as CustomEvent<Settings>).detail
      setActiveCurrency(s.currency)
      setActiveRates(s.exchangeRates)
      document.documentElement.classList.toggle('compact', s.compactMode)
      setInactivityTimeout(s.inactivityTimeout)
    }
    window.addEventListener('mh-settings-changed', handler)
    return () => window.removeEventListener('mh-settings-changed', handler)
  }, [])

  /* Accordion state — open the active group by default */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    navGroups.forEach(g => {
      if (g.label) init[g.label] = groupIsActive(g, location.pathname)
    })
    return init
  })

  const toggleGroup = (label: string) =>
    setOpenGroups(prev => {
      const opening = !prev[label]
      const next: Record<string, boolean> = {}
      navGroups.forEach(g => { if (g.label) next[g.label] = false })
      if (opening) next[label] = true
      return next
    })

  /* Auto-open the active group on route change, close the rest */
  useEffect(() => {
    const active = navGroups.find(g => g.label && groupIsActive(g, location.pathname))
    if (!active) return
    setOpenGroups(prev => {
      if (prev[active.label]) return prev
      const next: Record<string, boolean> = {}
      navGroups.forEach(g => { if (g.label) next[g.label] = false })
      next[active.label] = true
      return next
    })
  }, [location.pathname])

  /* Detect viewport */
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* Close mobile drawer on route change */
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  /* Journal d'audit : consigne la consultation de chaque page de l'app */
  useEffect(() => {
    const label = PAGE_TITLES[location.pathname] ?? location.pathname
    auditLogApi.logView(label, location.pathname).catch(() => {})
  }, [location.pathname])

  const sidebarW       = collapsed ? SIDEBAR_MINI : SIDEBAR_FULL
  const mainMarginLeft = isMobile ? 0 : sidebarW
  const headerLeft     = isMobile ? 0 : sidebarW
  const pageTitle      = PAGE_TITLES[location.pathname] ?? 'Mon Hôtel'

  const handleLogout = useCallback(async () => { await logout(); navigate('/') }, [logout, navigate])

  const { warning, countdown, extend } = useInactivityTimer(inactivityTimeout, handleLogout)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Backdrop mobile ── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        style={{
          width: isMobile ? SIDEBAR_FULL : sidebarW,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_FULL}px)`) : 'none',
          backgroundColor: sidebarColor,
        }}
        className="fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out overflow-hidden print:hidden"
      >
        <Sidebar
          collapsed={collapsed}
          isMobile={isMobile}
          logoUrl={logoUrl}
          hotelName={hotelName}
          hotelTag={hotelTag}
          user={user}
          pathname={location.pathname}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
          onCloseMobile={() => setMobileOpen(false)}
          onToggleCollapsed={() => setCollapsed(c => !c)}
        />
      </aside>

      {/* ── Header fixe ── */}
      <header
        style={{ left: headerLeft }}
        className="fixed top-0 right-0 h-14 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 md:px-6 transition-all duration-300 ease-in-out print:hidden"
      >
        {/* Left: hamburger + page title */}
        <div className="flex items-center gap-3 min-w-0">
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors shrink-0"
            >
              <i className="bi bi-list text-xl" />
            </button>
          )}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-1 h-6 rounded-full bg-hotel-gold shrink-0" />
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">{pageTitle}</h1>
          </div>
        </div>

        {/* Right: actions + user */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Global search trigger */}
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-400 text-sm transition-colors mr-1"
            title="Recherche globale (Ctrl+K)"
          >
            <i className="bi bi-search text-xs" />
            <span className="text-xs text-gray-400 hidden md:inline">Rechercher…</span>
            <kbd className="text-[10px] bg-white border border-gray-200 rounded px-1 text-gray-400 hidden md:inline">Ctrl K</kbd>
          </button>
          <ClockWidget />
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-fill'} text-sm`} />
          </button>
          <NotificationBell />
          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* User pill — dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-amber-50 transition-colors group"
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-hotel-gold flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-amber-200 group-hover:ring-amber-300 transition-all">
                  {user?.avatar
                    ? <img src={mediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
                    : <span>{user?.first_name?.[0] ?? user?.username?.[0] ?? '?'}</span>}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
              </div>
              <div className="hidden md:block text-left leading-tight">
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
                  {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                </p>
                <p className="text-[10px] text-gray-400">
                  {user?.role === 'admin' ? 'Administrateur' : user?.role === 'manager' ? 'Manager' : 'Réceptionniste'}
                </p>
              </div>
              <i className={`bi bi-chevron-down text-[10px] text-gray-400 hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 z-50 py-1.5 animate-in">
                <Link
                  to="/app/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <i className="bi bi-person text-hotel-gold" /> Mon profil
                </Link>
                <button
                  onClick={() => { setSupportOpen(true); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <i className="bi bi-headset text-hotel-gold" /> Support technicien
                </button>
                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                <button
                  onClick={() => { handleLogout(); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <i className="bi bi-box-arrow-left" /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Global search palette ── */}
      <GlobalSearch />

      {/* ── Contenu principal ── */}
      <main
        style={{ marginLeft: mainMarginLeft }}
        className="min-h-screen pt-14 transition-all duration-300 ease-in-out bg-gray-50 dark:bg-gray-950 print:ml-0 print:pt-0"
      >
        <div className="pb-4">
          <Outlet />
        </div>
      </main>

      {/* ── Modal Support technicien ── */}
      {supportOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setSupportOpen(false); setEditingEc(false) } }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <i className="bi bi-headset text-hotel-gold text-lg" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white text-sm">Support technicien</h2>
                  <p className="text-[11px] text-gray-400">Contactez le responsable</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {user?.role === 'admin' && !editingEc && (
                  <button onClick={() => setEditingEc(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-hotel-gold hover:bg-amber-50 transition-colors"
                    title="Modifier">
                    <i className="bi bi-pencil text-xs" />
                  </button>
                )}
                <button onClick={() => { setSupportOpen(false); setEditingEc(false) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <i className="bi bi-x-lg text-xs" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {editingEc ? (
                /* ── Formulaire édition (admin) ── */
                <div className="space-y-3">
                  {([
                    { key: 'name',     label: 'Nom complet', icon: 'bi-person',    type: 'text',  ph: 'Jean Dupont' },
                    { key: 'phone',    label: 'Téléphone',   icon: 'bi-telephone', type: 'tel',   ph: '07XXXXXXXX' },
                    { key: 'email',    label: 'Email',       icon: 'bi-envelope',  type: 'email', ph: 'contact@email.com' },
                    { key: 'whatsapp', label: 'WhatsApp',    icon: 'bi-whatsapp',  type: 'tel',   ph: '07XXXXXXXX' },
                  ] as { key: keyof EmergencyContact; label: string; icon: string; type: string; ph: string }[]).map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                        <i className={`bi ${f.icon} text-hotel-gold`} /> {f.label}
                      </label>
                      <input
                        type={f.type}
                        value={ecEdit[f.key]}
                        placeholder={f.ph}
                        maxLength={f.key === 'phone' || f.key === 'whatsapp' ? 10 : undefined}
                        onChange={e => {
                          let v = e.target.value
                          if (f.key === 'phone' || f.key === 'whatsapp') v = v.replace(/\D/g, '').slice(0, 10)
                          setEcEdit(prev => ({ ...prev, [f.key]: v }))
                        }}
                        className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-hotel-gold"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setEditingEc(false); setEcEdit(ec) }}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                      Annuler
                    </button>
                    <button onClick={saveEc} disabled={savingEc}
                      className="flex-1 py-2 rounded-xl bg-hotel-gold text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-60">
                      {savingEc ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              ) : ec.name ? (
                /* ── Affichage contact ── */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-hotel-gold flex items-center justify-center shrink-0">
                      <i className="bi bi-person-fill text-white text-xl" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-white">{ec.name}</p>
                      <p className="text-xs text-gray-500">Responsable technique</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {ec.phone && (
                      <a href={`tel:${ec.phone}`}
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-hotel-gold hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                          <i className="bi bi-telephone-fill text-hotel-gold" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Téléphone</p>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-hotel-gold">{ec.phone}</p>
                        </div>
                        <i className="bi bi-arrow-up-right text-gray-300 group-hover:text-hotel-gold ml-auto text-xs transition-colors" />
                      </a>
                    )}
                    {ec.whatsapp && (
                      <a href={`https://wa.me/225${ec.whatsapp}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                          <i className="bi bi-whatsapp text-green-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">WhatsApp</p>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-green-600">{ec.whatsapp}</p>
                        </div>
                        <i className="bi bi-arrow-up-right text-gray-300 group-hover:text-green-400 ml-auto text-xs transition-colors" />
                      </a>
                    )}
                    {ec.email && (
                      <a href={`mailto:${ec.email}`}
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                          <i className="bi bi-envelope-fill text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Email</p>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600">{ec.email}</p>
                        </div>
                        <i className="bi bi-arrow-up-right text-gray-300 group-hover:text-blue-400 ml-auto text-xs transition-colors" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Aucun contact configuré ── */
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <i className="bi bi-person-x text-gray-400 text-xl" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Aucun contact configuré.</p>
                  {user?.role === 'admin' && (
                    <button onClick={() => setEditingEc(true)}
                      className="mt-3 text-sm text-hotel-gold hover:underline">
                      Ajouter un contact
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal veille automatique ── */}
      {warning && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-5">
              <i className="bi bi-clock-history text-amber-600 dark:text-amber-400 text-3xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Session inactive</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Vous allez être déconnecté automatiquement dans
            </p>
            <div className="text-5xl font-bold text-hotel-gold mb-6 tabular-nums">
              {countdown}s
            </div>
            <button
              onClick={extend}
              className="w-full py-3 bg-hotel-gold text-white rounded-xl font-semibold text-sm hover:brightness-110 transition-all shadow-lg shadow-hotel-gold/20"
            >
              <i className="bi bi-hand-thumbs-up me-2" />Je suis encore là
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
