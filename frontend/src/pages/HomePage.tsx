import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getContent, SiteContent } from '../api/content'
import BookingSection from '../components/BookingSection'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import HotelMap from '../components/HotelMap'
import { satisfactionApi } from '../api/satisfaction'

/* ── Lightbox ── */
function Lightbox({ items, index, onClose }: {
  items: { image: string; label: string }[]
  index: number
  onClose: () => void
}) {
  const [current, setCurrent] = useState(index)

  const prev = useCallback(() => setCurrent(c => (c - 1 + items.length) % items.length), [items.length])
  const next = useCallback(() => setCurrent(c => (c + 1) % items.length), [items.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  const item = items[current]
  const fullSrc = item.image.replace('w=600&q=80', 'w=1600&q=90')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Bouton fermer */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
        aria-label="Fermer"
      >
        <i className="bi bi-x-lg text-2xl" />
      </button>

      {/* Compteur */}
      <span className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm tracking-widest">
        {current + 1} / {items.length}
      </span>

      {/* Prev */}
      <button
        onClick={e => { e.stopPropagation(); prev() }}
        className="absolute left-4 md:left-8 text-white/60 hover:text-white transition-colors z-10 p-2"
        aria-label="Précédente"
      >
        <i className="bi bi-chevron-left text-3xl" />
      </button>

      {/* Image */}
      <div className="max-w-5xl w-full px-16 md:px-24" onClick={e => e.stopPropagation()}>
        <img
          key={current}
          src={fullSrc}
          alt={item.label}
          className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
          style={{ animation: 'fadeInScale 0.25s ease' }}
        />
        <p className="text-center text-white/70 text-sm mt-4 font-medium tracking-wider uppercase">
          {item.label}
        </p>
      </div>

      {/* Next */}
      <button
        onClick={e => { e.stopPropagation(); next() }}
        className="absolute right-4 md:right-8 text-white/60 hover:text-white transition-colors z-10 p-2"
        aria-label="Suivante"
      >
        <i className="bi bi-chevron-right text-3xl" />
      </button>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

/* ── Hook: header transparent → opaque au scroll ── */
function useScrolled(threshold = 60) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

/* ── Hook: animation au scroll (Intersection Observer) ── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

/* ── Logo SVG ── */
function HotelLogo({ size = 38, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1.2" />
      {/* Couronne */}
      <path d="M10 27 L10 18 L14.5 22.5 L20 14 L25.5 22.5 L30 18 L30 27 Z"
        fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
      <rect x="10" y="27" width="20" height="2.5" rx="1.25" fill="currentColor" />
      {/* Gemme centrale */}
      <circle cx="20" cy="14" r="1.5" fill="currentColor" />
    </svg>
  )
}

/* ── Composant section animée ── */
function FadeSection({ children, className = '', delay = 0, onClick }: {
  children: React.ReactNode; className?: string; delay?: number; onClick?: () => void
}) {
  const { ref, visible } = useFadeIn()
  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const scrolled = useScrolled()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [calCheckIn,  setCalCheckIn]  = useState('')
  const [calCheckOut, setCalCheckOut] = useState('')
  const [liveTestimonials, setLiveTestimonials] = useState<{
    author: string; score_overall: number; text: string
    would_return: boolean | null; submitted_at: string
  }[] | null>(null)

  // La page vitrine reste toujours en thème clair, quel que soit le mode
  // sombre choisi côté back-office (la classe "dark" est globale sur <html>
  // et peut persister d'une visite précédente à /app).
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    getContent().then(c => {
      setContent(c)
      const name = c.hotel.name || 'Mon Hôtel'
      document.title = `${name} — Réservation en ligne`
      const logo = c.hotel.logo_url
      if (logo) {
        const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
        if (favicon) favicon.href = logo
      }
    })
  }, [])
  useEffect(() => {
    satisfactionApi.getTestimonials()
      .then(d => { if (d.length >= 1) setLiveTestimonials(d) })
      .catch(() => {})
  }, [])

  if (!content) return (
    <div className="min-h-screen bg-hotel-dark flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-hotel-gold border-t-transparent" />
    </div>
  )

  const { hotel, hero, stats, rooms, services, gallery, testimonials, cta, footer } = content

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* ── Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: scrolled ? 'rgba(26,18,8,0.97)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          boxShadow: scrolled ? '0 2px 32px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hotel.logo_url
              ? <img src={hotel.logo_url} alt={hotel.name} className="w-10 h-10 rounded-full object-cover shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
              : <HotelLogo className="text-hotel-gold shrink-0" />
            }
            <div>
              <h1 className="text-2xl font-serif font-bold text-hotel-gold tracking-wide">{hotel.name}</h1>
              <p className="text-[10px] text-white/40 tracking-[0.25em] uppercase -mt-0.5">{hotel.location}</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            {[['#rooms', 'Chambres'], ['#services', 'Services'], ['#gallery', 'Galerie'], ['#contact', 'Contact']].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-hotel-gold transition-colors duration-200 relative group">
                {label}
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-hotel-gold transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
            <a href="#book" className="text-hotel-gold font-semibold hover:brightness-110 transition-colors">
              Réserver
            </a>
          </nav>
          {user ? (
            <button
              onClick={() => navigate('/app')}
              className="text-sm px-5 py-2 rounded-full bg-hotel-gold text-white hover:brightness-110 transition-all duration-300 font-medium flex items-center gap-2"
            >
              <i className="bi bi-speedometer2" />
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-sm px-5 py-2 rounded-full border border-hotel-gold text-hotel-gold hover:bg-hotel-gold hover:text-white transition-all duration-300 font-medium"
            >
              Connexion
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Image de fond */}
        <img
          src={hero.image}
          alt="Lobby de l'hôtel"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scale(1.05)' }}
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

        {/* Contenu hero */}
        <div className="relative text-center px-6 max-w-5xl mx-auto">
          <p
            className="text-hotel-gold text-xs font-medium tracking-[0.45em] uppercase mb-5"
            style={{ animation: 'fadeDown 0.8s ease both' }}
          >
            {hero.eyebrow}
          </p>
          <h2
            className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white leading-[1.05] mb-6"
            style={{ animation: 'fadeDown 0.8s ease 0.15s both' }}
          >
            {hero.title1}<br />
            <span className="text-hotel-gold">{hero.title2}</span>
          </h2>
          <p
            className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ animation: 'fadeDown 0.8s ease 0.3s both' }}
          >
            {hero.subtitle}
          </p>
          <div
            className="flex flex-wrap gap-4 justify-center"
            style={{ animation: 'fadeDown 0.8s ease 0.45s both' }}
          >
            {user && (
              <button
                onClick={() => navigate('/app')}
                className="px-8 py-3.5 bg-hotel-gold text-white rounded-full font-semibold hover:brightness-110 transition-all duration-300 shadow-xl shadow-hotel-gold/30 hover:-translate-y-0.5 flex items-center gap-2"
              >
                <i className="bi bi-speedometer2 text-lg" />
                Tableau de bord
              </button>
            )}
            <a href="#book"
              className="px-8 py-3.5 bg-hotel-gold text-white rounded-full font-semibold hover:brightness-110 transition-all duration-300 shadow-xl shadow-hotel-gold/30 hover:-translate-y-0.5 flex items-center gap-2"
            >
              <i className="bi bi-calendar-check" />
              Réserver en ligne
            </a>
            <a href="#rooms"
              className="px-8 py-3.5 bg-hotel-gold/15 border border-hotel-gold/50 text-hotel-gold rounded-full font-medium hover:bg-hotel-gold hover:text-white hover:border-hotel-gold transition-all duration-300 hover:-translate-y-0.5"
            >
              Voir nos chambres
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40"
          style={{ animation: 'fadeDown 1s ease 1s both' }}>
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" style={{ animation: 'scrollLine 2s ease-in-out infinite' }} />
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-hotel-dark py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-hotel-gold font-serif">{s.value}</p>
              <p className="text-xs text-white/50 mt-1 tracking-wider uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Chambres ── */}
      <section id="rooms" className="py-28 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <p className="text-hotel-gold text-xs font-medium tracking-[0.4em] uppercase mb-3">Hébergement</p>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-gray-900">Nos chambres & suites</h3>
            <div className="w-16 h-0.5 bg-hotel-gold mx-auto mt-5" />
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-8">
            {rooms.map((room, i) => (
              <FadeSection key={room.name} delay={i * 120}
                className={`group relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ${room.badge === 'Populaire' ? 'ring-2 ring-hotel-gold' : ''}`}
              >
                {room.badge && (
                  <div className="absolute top-4 right-4 z-10 bg-hotel-gold text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                    ★ {room.badge}
                  </div>
                )}
                {/* Image */}
                <div className="relative h-60 overflow-hidden">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <p className="absolute bottom-4 left-4 text-2xl font-bold text-white font-serif">{room.name}</p>
                </div>
                {/* Contenu */}
                <div className="p-6 bg-white">
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-bold text-hotel-gold font-serif">{room.price}</span>
                    <span className="text-sm text-gray-400">FCFA / nuit</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {room.features.map((f) => (
                      <span key={f} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">{f}</span>
                    ))}
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bannière intermédiaire ── */}
      <section className="relative py-24 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1920&q=80" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/65" />
        <FadeSection className="relative text-center px-6 max-w-3xl mx-auto">
          <p className="text-hotel-gold text-xs tracking-[0.4em] uppercase mb-4">Expérience unique</p>
          <h3 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">
            Chaque détail compte
          </h3>
          <p className="text-white/70 text-lg leading-relaxed mb-8">
            De l'accueil au départ, notre équipe dédiée veille à ce que chaque instant de votre séjour soit parfait.
          </p>
          <a href="#book"
            className="inline-block px-8 py-3.5 bg-hotel-gold text-white rounded-full font-medium hover:brightness-110 transition-all duration-300"
          >
            Réserver maintenant
          </a>
        </FadeSection>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-28 px-6 bg-stone-50">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <p className="text-hotel-gold text-xs font-medium tracking-[0.4em] uppercase mb-3">Nos prestations</p>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-gray-900">Tout pour votre confort</h3>
            <div className="w-16 h-0.5 bg-hotel-gold mx-auto mt-5" />
          </FadeSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <FadeSection key={s.title} delay={i * 100}
                className="group rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-white"
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={s.image} alt={s.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-300" />
                  <i className={`bi ${s.icon} absolute top-4 left-4 text-3xl text-white drop-shadow-lg`} />
                </div>
                <div className="p-5">
                  <h4 className="font-semibold text-gray-900 mb-2">{s.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="gallery" className="py-28 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <p className="text-hotel-gold text-xs font-medium tracking-[0.4em] uppercase mb-3">Découvrir</p>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-gray-900">Notre galerie</h3>
            <div className="w-16 h-0.5 bg-hotel-gold mx-auto mt-5" />
          </FadeSection>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.map((item, i) => (
              <FadeSection key={i} delay={i * 80}
                className="group relative overflow-hidden rounded-xl aspect-video cursor-zoom-in"
                onClick={() => setLightboxIndex(i)}
              >
                <img
                  src={item.image}
                  alt={item.label}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-end justify-between p-4">
                  <span className="text-white font-medium text-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                    {item.label}
                  </span>
                  <i className="bi bi-zoom-in text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Calendrier de disponibilité ── */}
      <section className="py-20 px-6 bg-[#1a1208]">
        <div className="max-w-5xl mx-auto">
          <FadeSection className="text-center mb-12">
            <p className="text-hotel-gold text-xs font-medium tracking-[0.4em] uppercase mb-3">Disponibilités</p>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-white">Vérifiez vos dates</h3>
            <div className="w-16 h-0.5 bg-hotel-gold mx-auto mt-5" />
            <p className="text-white/50 mt-4 text-sm">Cliquez sur une date d'arrivée puis une date de départ pour pré-remplir le formulaire de réservation.</p>
          </FadeSection>
          <div className="max-w-md mx-auto">
            <AvailabilityCalendar
              onSelectDate={(ci, co) => {
                setCalCheckIn(ci)
                setCalCheckOut(co)
              }}
            />
          </div>
        </div>
      </section>

      {/* ── Réservation en ligne ── */}
      <BookingSection initialCheckIn={calCheckIn} initialCheckOut={calCheckOut} hotelName={hotel.name} hotel={hotel} />

      {/* ── Témoignages ── */}
      <section className="py-28 px-6 bg-hotel-dark">
        <div className="max-w-6xl mx-auto">
          <FadeSection className="text-center mb-16">
            <p className="text-hotel-gold text-xs font-medium tracking-[0.4em] uppercase mb-3">Avis clients</p>
            <h3 className="text-4xl md:text-5xl font-serif font-bold text-white">Ce qu'ils disent</h3>
            <div className="w-16 h-0.5 bg-hotel-gold mx-auto mt-5" />
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-8">
            {(liveTestimonials ?? testimonials).slice(0, 6).map((t, i) => {
              const isLive = liveTestimonials !== null
              const score  = isLive ? (t as typeof liveTestimonials[0]).score_overall : 5
              const role   = isLive
                ? new Date((t as typeof liveTestimonials[0]).submitted_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : (t as typeof testimonials[0]).role
              return (
                <FadeSection key={t.author + i} delay={i * 120}
                  className="bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-white/10 transition-colors duration-300"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <span key={j} className={`text-sm ${j < score ? 'text-hotel-gold' : 'text-white/15'}`}>★</span>
                    ))}
                  </div>
                  <p className="text-white/75 text-sm leading-relaxed mb-6 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-hotel-gold/20 flex items-center justify-center text-hotel-gold font-bold text-sm">
                      {t.author[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{t.author}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-white/40 text-xs">{role}</p>
                        {isLive && (
                          <span className="text-[10px] text-hotel-gold/60 border border-hotel-gold/20 rounded-full px-1.5 py-px">
                            ✓ vérifié
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </FadeSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-32 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/70" />
        <FadeSection className="relative text-center px-6 max-w-3xl mx-auto">
          <p className="text-hotel-gold text-xs tracking-[0.4em] uppercase mb-4">Réservez votre séjour</p>
          <h3 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6">
            {cta.title}
          </h3>
          <p className="text-white/60 text-lg mb-10">
            {cta.subtitle}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="#book"
              className="px-10 py-4 bg-hotel-gold text-white rounded-full text-base font-semibold hover:brightness-110 transition-all duration-300 shadow-xl hover:-translate-y-0.5"
            >
              {cta.button_text}
            </a>
            <a href="#contact"
              className="px-10 py-4 border border-white/40 text-white rounded-full text-base font-medium hover:bg-white/10 transition-all duration-300"
            >
              Nous appeler
            </a>
          </div>
        </FadeSection>
      </section>

      {/* ── Contact / Footer ── */}
      <footer id="contact" className="bg-hotel-dark border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                {hotel.logo_url
                  ? <img src={hotel.logo_url} alt={hotel.name} className="w-8 h-8 rounded-full object-cover shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
                  : <HotelLogo size={30} className="text-hotel-gold shrink-0" />
                }
                <h4 className="text-2xl font-serif font-bold text-hotel-gold">{hotel.name}</h4>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">{footer.about}</p>
            </div>
            {/* Contact */}
            <div>
              <h5 className="text-white font-semibold text-sm mb-4 tracking-wider uppercase">Contact</h5>
              <ul className="space-y-2 text-sm text-white/50">
                <li>📍 {hotel.address}<br />{hotel.city}</li>
                <li>📞 {hotel.phone}</li>
                <li>✉️ {hotel.email}</li>
              </ul>
            </div>
            {/* Liens */}
            <div>
              <h5 className="text-white font-semibold text-sm mb-4 tracking-wider uppercase">Navigation</h5>
              <ul className="space-y-2 text-sm text-white/50">
                {[['#rooms', 'Nos chambres'], ['#services', 'Services'], ['#gallery', 'Galerie'], ['#contact', 'Contact']].map(([href, label]) => (
                  <li key={href}><a href={href} className="hover:text-hotel-gold transition-colors">{label}</a></li>
                ))}
              </ul>
            </div>
            {/* Horaires */}
            <div>
              <h5 className="text-white font-semibold text-sm mb-4 tracking-wider uppercase">Réception</h5>
              <ul className="space-y-2 text-sm text-white/50">
                <li>{footer.checkin}</li>
                <li>{footer.checkout}</li>
                <li>{footer.schedule_week}</li>
                <li>{footer.schedule_weekend}</li>
              </ul>
            </div>
          </div>
          {/* Carte localisation */}
          {hotel.lat && hotel.lng && (
            <div className="mb-10">
              <h5 className="text-white font-semibold text-sm mb-4 tracking-wider uppercase">
                <i className="bi bi-geo-alt-fill text-hotel-gold mr-2" />
                Nous trouver
              </h5>
              <div className="rounded-lg overflow-hidden border border-white/10" style={{ height: '220px' }}>
                <HotelMap
                  lat={hotel.lat}
                  lng={hotel.lng}
                  name={hotel.name}
                  address={`${hotel.address}, ${hotel.city}`}
                />
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-xs">© 2026 {hotel.name} — Tous droits réservés</p>
            <div className="flex items-center gap-4">
              <a href="/my-booking" className="text-xs text-hotel-gold/60 hover:text-hotel-gold transition-colors">
                Gérer ma réservation
              </a>
              <button
                onClick={() => navigate(user ? '/app' : '/login')}
                className="text-xs text-hotel-gold/60 hover:text-hotel-gold transition-colors"
              >
                Accès gestion →
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Keyframes CSS ── */}
      <style>{`
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollLine {
          0%,100% { transform: scaleY(1); opacity: 1; }
          50%      { transform: scaleY(0.4); opacity: 0.3; }
        }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ── Bouton retour en haut ── */}
      {scrolled && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-hotel-gold text-white shadow-xl hover:brightness-110 transition-all duration-300 flex items-center justify-center hover:-translate-y-0.5"
          aria-label="Retour en haut"
        >
          <i className="bi bi-chevron-up text-lg font-bold" />
        </button>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={gallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
