import { useState, useEffect, useRef } from 'react'
import { getAvailableRooms, createPublicBooking, getPublicMenu, PublicRoomType, BookingConfirmation, PublicMenuItem } from '../api/public'

const MENU_CATEGORY_ORDER = ['starter', 'main', 'dessert', 'drink']

const MEALS = [
  { key: 'breakfast', label: 'Petit-déjeuner', time: '08:00' },
  { key: 'lunch',     label: 'Déjeuner',       time: '12:30' },
  { key: 'dinner',    label: 'Dîner',          time: '19:30' },
] as const

/** Chaque date de séjour de check-in (inclus) à check-out (exclu) — une par nuit. */
function stayDates(checkIn: string, checkOut: string): string[] {
  if (!checkIn || !checkOut) return []
  const dates: string[] = []
  const cur = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function fmt(n: number | string) {
  return new Intl.NumberFormat('fr-FR').format(Number(n)) + ' FCFA'
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const STEPS = ['Dates', 'Chambre', 'Coordonnées']

const INPUT = 'w-full bg-neutral-900/80 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-hotel-gold text-sm transition-colors [color-scheme:dark]'

interface HotelMeta {
  name?: string; address?: string; city?: string; phone?: string; email?: string
  bank_name?: string; bank_account_holder?: string; bank_iban?: string; bank_bic?: string
}

interface Props {
  initialCheckIn?:  string
  initialCheckOut?: string
  hotelName?:       string
  hotel?:           HotelMeta
}

function esc(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printReceipt(c: BookingConfirmation, hotel: HotelMeta, clientName: string, restaurant: { meals: { label: string; time: string }[]; dates: string[]; party_size: number } | null) {
  const hotelName = hotel.name ?? 'Mon Hôtel'
  const win = window.open('', '_blank', 'width=620,height=850')
  if (!win) return

  const now = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const rows = [
    ['Client',   esc(clientName)],
    ['Chambre',  `${esc(c.room_type)} — n° ${esc(String(c.room_number))}`],
    ['Arrivée',  fmtDate(c.check_in)],
    ['Départ',   fmtDate(c.check_out)],
    ['Durée',    `${c.nights} nuit${c.nights > 1 ? 's' : ''}`],
  ].map(([k, v]) => `
    <div class="row">
      <span class="key">${k}</span>
      <span class="val">${v}</span>
    </div>`).join('')

  const restaurantRows = restaurant ? [
    ...restaurant.meals.map(m => [m.label, m.time]),
    restaurant.dates.length > 1
      ? ['Dates', `${restaurant.dates.length} occasions (${fmtDate(restaurant.dates[0])} → ${fmtDate(restaurant.dates[restaurant.dates.length - 1])})`]
      : ['Date', fmtDate(restaurant.dates[0])],
    ['Personnes', `${restaurant.party_size}`],
  ].map(([k, v]) => `
    <div class="row">
      <span class="key">${k}</span>
      <span class="val">${esc(v)}</span>
    </div>`).join('') : ''

  const bankRows = c.payment_method === 'transfer' ? [
    ['Banque', hotel.bank_name],
    ['Titulaire', hotel.bank_account_holder],
    ['IBAN', hotel.bank_iban],
    ['BIC / SWIFT', hotel.bank_bic],
  ].filter(([, v]) => v).map(([k, v]) => `
    <div class="row">
      <span class="key">${k}</span>
      <span class="val">${esc(v as string)}</span>
    </div>`).join('') : ''

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Reçu ${esc(c.reference)} — ${esc(hotelName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,serif;color:#1a1208;background:#fff}
  .page{max-width:480px;margin:0 auto;padding:44px 36px}
  .print-date{font-size:10px;color:#bbb;text-align:right;font-family:Arial,sans-serif;margin-bottom:10px}
  .header{text-align:center;border-bottom:2px solid #b8860b;padding-bottom:22px;margin-bottom:24px}
  .hotel{font-size:26px;font-weight:700;color:#b8860b;letter-spacing:3px;text-transform:uppercase}
  .doc-title{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#aaa;margin-top:4px;font-family:Arial,sans-serif}
  .ref-box{background:#1a1208;border-radius:10px;padding:20px;text-align:center;margin-bottom:28px}
  .ref-label{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(184,134,11,.6);font-family:Arial,sans-serif;margin-bottom:6px}
  .ref-val{font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:6px;color:#b8860b}
  .section-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#b8860b;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e8e0d0;font-family:Arial,sans-serif}
  .row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f5f0e8;font-size:13px}
  .row:last-child{border-bottom:none}
  .key{color:#888;font-family:Arial,sans-serif}
  .val{font-weight:600;text-align:right}
  .total{background:#f8f4ed;border:1px solid #e8e0d0;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
  .total-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif}
  .total-val{font-size:22px;font-weight:700;color:#b8860b}
  .status-wrap{text-align:center;margin:24px 0}
  .status-label{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#aaa;font-family:Arial,sans-serif;margin-bottom:8px}
  .badge{display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:100px;padding:5px 16px;font-size:12px;font-weight:600;font-family:Arial,sans-serif}
  .footer{text-align:center;border-top:1px dashed #e8e0d0;padding-top:20px;margin-top:24px}
  .footer p{font-size:11px;color:#aaa;line-height:1.8;font-family:Arial,sans-serif}
  @media print{@page{margin:1cm}}
</style>
</head>
<body>
<div class="page">
  <p class="print-date">Imprimé le ${now}</p>
  <div class="header">
    <div class="hotel">${esc(hotelName)}</div>
    <div class="doc-title">Reçu de réservation</div>
  </div>
  <div class="ref-box">
    <div class="ref-label">Référence</div>
    <div class="ref-val">${esc(c.reference)}</div>
  </div>
  <div class="section-title">Détails du séjour</div>
  <div style="margin-bottom:20px">${rows}</div>
  <div class="total">
    <span class="total-label">Montant total</span>
    <span class="total-val">${esc(fmt(c.total_price))}</span>
  </div>
  <div class="status-wrap">
    <div class="status-label">Statut</div>
    <span class="badge">En attente de confirmation</span>
  </div>
  ${restaurantRows ? `
  <div class="section-title">Réservation restaurant</div>
  <div style="margin-bottom:20px">${restaurantRows}</div>` : ''}
  ${bankRows ? `
  <div class="section-title">Virement bancaire à effectuer</div>
  <div style="margin-bottom:20px">${bankRows}</div>
  <p style="font-size:11px;color:#888;font-family:Arial,sans-serif;margin-bottom:20px">
    Merci d'indiquer la référence <strong>${esc(c.reference)}</strong> en libellé du virement.
  </p>` : ''}
  <div class="footer">
    <p><strong>${esc(hotelName)}</strong><br>
    ${hotel.address ? esc(hotel.address) + (hotel.city ? ' · ' + esc(hotel.city) : '') + '<br>' : ''}
    ${hotel.phone ? esc(hotel.phone) + '<br>' : ''}
    ${hotel.email ? esc(hotel.email) + '<br>' : ''}
    </p>
    <p style="margin-top:8px">Merci pour votre réservation. Notre équipe vous contactera pour confirmer votre séjour.<br>
    Veuillez conserver ce reçu comme justificatif.</p>
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body>
</html>`)
  win.document.close()
}

export default function BookingSection({ initialCheckIn = '', initialCheckOut = '', hotelName = 'Mon Hôtel', hotel }: Props) {
  const hotelMeta: HotelMeta = hotel ?? { name: hotelName }
  const [step, setStep]           = useState(0)
  const [checkIn, setCheckIn]     = useState(initialCheckIn)
  const [checkOut, setCheckOut]   = useState(initialCheckOut)
  const [adults, setAdults]       = useState(1)
  const [children, setChildren]   = useState(0)
  const [roomTypes, setRoomTypes] = useState<PublicRoomType[]>([])
  const [selected, setSelected]   = useState<PublicRoomType | null>(null)
  const [form, setForm]           = useState({ first_name: '', last_name: '', phone: '', email: '', special_requests: '' })
  const [paymentMethod, setPaymentMethod] = useState<'on_site' | 'transfer'>('on_site')
  const bankReady = !!(hotelMeta.bank_iban && hotelMeta.bank_name)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Fait défiler vers le message d'erreur dès qu'il apparaît : sur un long
  // formulaire (mobile notamment), l'utilisateur reste scrollé sur le bouton
  // "Confirmer" et ne voit sinon ni l'erreur ni le moyen de revenir en arrière.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [error])

  const [menu, setMenu] = useState<PublicMenuItem[]>([])
  const [wantsRestaurant, setWantsRestaurant] = useState(false)
  const [restaurantForm, setRestaurantForm] = useState({
    meals: [] as ('breakfast' | 'lunch' | 'dinner')[],
    times: { breakfast: '08:00', lunch: '12:30', dinner: '19:30' } as Record<'breakfast' | 'lunch' | 'dinner', string>,
    frequency: 'once' as 'once' | 'daily',
    date: '', party_size: 2,
  })

  const toggleMeal = (key: 'breakfast' | 'lunch' | 'dinner') => {
    setRestaurantForm(f => ({
      ...f,
      meals: f.meals.includes(key) ? f.meals.filter(m => m !== key) : [...f.meals, key],
    }))
  }

  useEffect(() => { getPublicMenu().then(setMenu).catch(() => {}) }, [])

  const nights = (checkIn && checkOut)
    ? Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 0

  /* ── Step 0 → 1 ── */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const types = await getAvailableRooms(checkIn, checkOut)
      setRoomTypes(types)
      setStep(1)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur de connexion au serveur.')
    } finally { setLoading(false) }
  }

  /* ── Step 1 → 2 ── */
  const handlePickRoom = (rt: PublicRoomType) => {
    if (rt.available_count === 0) return
    setSelected(rt)
    setRestaurantForm(f => ({ ...f, date: checkIn }))
    setStep(2)
  }

  /* ── Step 2 → Confirmation ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    if (wantsRestaurant && restaurantForm.meals.length === 0) {
      setError('Sélectionnez au moins un repas, ou décochez la réservation au restaurant.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const conf = await createPublicBooking({
        check_in: checkIn, check_out: checkOut,
        room_type_id: selected.id,
        first_name: form.first_name, last_name: form.last_name,
        phone: form.phone, email: form.email,
        adults, children,
        special_requests: form.special_requests,
        payment_method: bankReady ? paymentMethod : 'on_site',
        ...(wantsRestaurant && restaurantForm.meals.length > 0 ? {
          restaurant_meals: restaurantForm.meals.map(m => ({ meal: m, time: restaurantForm.times[m] })),
          restaurant_frequency: restaurantForm.frequency,
          restaurant_party_size: restaurantForm.party_size,
          ...(restaurantForm.frequency === 'once' ? { restaurant_date: restaurantForm.date } : {}),
        } : {}),
      })
      setConfirmation(conf)
      setStep(3)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la réservation.')
    } finally { setLoading(false) }
  }

  const reset = () => {
    setStep(0); setCheckIn(''); setCheckOut('')
    setAdults(1); setChildren(0); setSelected(null)
    setConfirmation(null); setError('')
    setForm({ first_name: '', last_name: '', phone: '', email: '', special_requests: '' })
    setPaymentMethod('on_site')
    setWantsRestaurant(false)
    setRestaurantForm({ meals: [], times: { breakfast: '08:00', lunch: '12:30', dinner: '19:30' }, frequency: 'once', date: '', party_size: 2 })
  }

  return (
    <section id="book" className="py-24 px-6 bg-hotel-dark relative overflow-hidden">
      {/* Decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/15 via-transparent to-black/30 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hotel-gold/30 to-transparent" />

      <div className="max-w-2xl mx-auto relative">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-hotel-gold text-xs font-medium tracking-[0.4em] uppercase mb-3">Réservation en ligne</p>
          <h3 className="text-3xl md:text-4xl font-serif font-bold text-white">Réservez votre séjour</h3>
          <div className="w-16 h-0.5 bg-hotel-gold mx-auto mt-4" />
        </div>

        {/* Step indicator */}
        {step < 3 && (
          <div className="flex items-center justify-center mb-10">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    i < step  ? 'bg-hotel-gold text-white' :
                    i === step ? 'bg-hotel-gold text-white ring-4 ring-hotel-gold/25' :
                    'bg-white/8 border border-white/15 text-white/30'
                  }`}>
                    {i < step ? <i className="bi bi-check-lg text-xs" /> : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:block transition-colors ${i <= step ? 'text-hotel-gold' : 'text-white/25'}`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-14 sm:w-20 h-px mx-3 mb-4 sm:mb-5 transition-colors duration-300 ${i < step ? 'bg-hotel-gold' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div ref={errorRef} className="mb-6 p-4 bg-red-950/60 border border-red-800/50 rounded-xl text-red-300 text-sm flex items-center gap-3 scroll-mt-24">
            <i className="bi bi-exclamation-circle text-lg shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 0 : Dates & voyageurs ── */}
        {step === 0 && (
          <form onSubmit={handleSearch} className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Arrivée *</label>
                <input type="date" required min={todayStr()} value={checkIn}
                  className={INPUT}
                  onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }} />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Départ *</label>
                <input type="date" required min={checkIn || tomorrowStr()} value={checkOut}
                  className={INPUT}
                  onChange={e => setCheckOut(e.target.value)} />
              </div>
            </div>

            {nights > 0 && (
              <p className="text-center text-sm text-white/50">
                {fmtDate(checkIn)} → {fmtDate(checkOut)} ·{' '}
                <span className="text-hotel-gold font-semibold">{nights} nuit{nights > 1 ? 's' : ''}</span>
              </p>
            )}

            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-3">Voyageurs</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { label: 'Adultes', val: adults, min: 1, set: setAdults },
                  { label: 'Enfants', val: children, min: 0, set: setChildren },
                ] as const).map(({ label, val, min, set }) => (
                  <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-white/60 text-sm">{label}</span>
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => set(v => Math.max(min, v - 1))}
                        className="w-9 h-9 rounded-full bg-white/10 text-white hover:bg-hotel-gold/40 transition-colors flex items-center justify-center text-xl leading-none shrink-0">
                        −
                      </button>
                      <span className="text-white font-semibold text-base w-5 text-center">{val}</span>
                      <button type="button" onClick={() => set(v => Math.min(10, v + 1))}
                        className="w-9 h-9 rounded-full bg-white/10 text-white hover:bg-hotel-gold/40 transition-colors flex items-center justify-center text-xl leading-none shrink-0">
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading || !checkIn || !checkOut}
              className="w-full py-4 bg-hotel-gold text-white rounded-xl font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm tracking-wide">
              {loading
                ? <><i className="bi bi-arrow-repeat animate-spin" /> Recherche en cours…</>
                : <><i className="bi bi-search" /> Vérifier les disponibilités</>}
            </button>
          </form>
        )}

        {/* ── STEP 1 : Choix de chambre ── */}
        {step === 1 && (
          <div>
            <button type="button" onClick={() => setStep(0)}
              className="mb-4 text-xs text-hotel-gold/70 hover:text-hotel-gold transition-colors flex items-center gap-1.5 font-medium">
              <i className="bi bi-arrow-left" /> Retour aux dates / voyageurs
            </button>
            {/* Résumé */}
            <div className="flex items-start gap-3 mb-6">
              <div>
                <p className="text-white font-semibold">
                  {nights} nuit{nights > 1 ? 's' : ''} · {fmtDate(checkIn)} → {fmtDate(checkOut)}
                </p>
                <p className="text-white/40 text-sm">
                  {adults} adulte{adults > 1 ? 's' : ''}{children > 0 ? ` · ${children} enfant${children > 1 ? 's' : ''}` : ''}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {roomTypes.length === 0 && (
                <p className="text-center text-white/40 py-12 text-sm">Aucun type de chambre configuré.</p>
              )}
              {roomTypes.map(rt => {
                const ok = rt.available_count > 0
                return (
                  <div key={rt.id}
                    onClick={() => handlePickRoom(rt)}
                    className={`bg-white/5 border rounded-2xl p-5 transition-all duration-200 ${
                      ok
                        ? 'border-white/10 hover:border-hotel-gold/60 hover:bg-white/8 cursor-pointer group'
                        : 'border-white/5 opacity-40 cursor-not-allowed'
                    }`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-white font-bold text-lg leading-tight">{rt.name}</h4>
                          {ok
                            ? <span className="text-[11px] bg-green-900/50 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full font-medium">
                                {rt.available_count} dispo{rt.available_count > 1 ? 's' : ''}
                              </span>
                            : <span className="text-[11px] bg-red-900/50 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full font-medium">
                                Complet
                              </span>
                          }
                        </div>
                        {rt.description && (
                          <p className="text-white/40 text-sm mb-3 line-clamp-2">{rt.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs text-white/30 flex items-center gap-1">
                            <i className="bi bi-people" /> {rt.capacity} pers. max
                          </span>
                          {(rt.amenities as string[]).slice(0, 5).map((a, i) => (
                            <span key={i} className="text-xs bg-white/8 text-white/50 px-2 py-0.5 rounded-full">{a}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-hotel-gold font-bold text-xl font-serif leading-tight">{fmt(rt.base_price)}</p>
                        <p className="text-white/30 text-xs">/ nuit</p>
                        {nights > 0 && (
                          <p className="text-white/50 text-sm font-medium mt-1">{fmt(Number(rt.base_price) * nights)}</p>
                        )}
                        {ok && (
                          <div className="mt-3 text-xs px-3 py-1.5 border border-hotel-gold/40 text-hotel-gold rounded-lg group-hover:bg-hotel-gold group-hover:text-white transition-all font-medium">
                            Choisir →
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── STEP 2 : Informations personnelles ── */}
        {step === 2 && selected && (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4">
              <button type="button" onClick={() => setStep(1)}
                className="text-xs text-hotel-gold/70 hover:text-hotel-gold transition-colors flex items-center gap-1.5 font-medium">
                <i className="bi bi-arrow-left" /> Retour au choix de la chambre
              </button>
              <button type="button" onClick={() => setStep(0)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5 font-medium">
                <i className="bi bi-arrow-left" /> Retour aux dates / voyageurs
              </button>
            </div>
            {/* Récap de la sélection */}
            <div className="bg-hotel-gold/10 border border-hotel-gold/20 rounded-2xl p-5 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-hotel-gold font-bold text-base">{selected.name}</p>
                  <p className="text-white/60 text-sm mt-0.5">
                    {fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} nuit{nights > 1 ? 's' : ''}
                  </p>
                  <p className="text-white/40 text-xs">
                    {adults} adulte{adults > 1 ? 's' : ''}{children > 0 ? ` · ${children} enfant${children > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-hotel-gold font-bold text-xl">{fmt(Number(selected.base_price) * nights)}</p>
                  <p className="text-white/30 text-xs">{fmt(selected.base_price)} × {nights}n</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h4 className="text-white font-semibold text-sm uppercase tracking-widest">Vos coordonnées</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Prénom *</label>
                  <input required className={INPUT} value={form.first_name} placeholder="Jean"
                    onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Nom *</label>
                  <input required className={INPUT} value={form.last_name} placeholder="Dupont"
                    onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Téléphone *</label>
                <input required type="tel" className={INPUT} value={form.phone} placeholder="07XXXXXXXX"
                  maxLength={10} minLength={10} pattern="[0-9]{10}"
                  onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
              </div>

              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Email</label>
                <input type="email" className={INPUT} value={form.email} placeholder="jean@email.com"
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Demandes spéciales</label>
                <textarea rows={3} className={`${INPUT} resize-none`} value={form.special_requests}
                  placeholder="Chambre non-fumeur, lit supplémentaire, étage élevé…"
                  onChange={e => setForm({ ...form, special_requests: e.target.value })} />
              </div>

              {/* Réservation restaurant optionnelle */}
              <div className="border border-white/10 rounded-xl p-4 bg-white/5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={wantsRestaurant} onChange={e => setWantsRestaurant(e.target.checked)}
                    className="w-4 h-4 accent-hotel-gold" />
                  <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <i className="bi bi-cup-hot text-hotel-gold" /> Réserver une table au restaurant
                  </span>
                </label>

                {wantsRestaurant && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Repas (un ou plusieurs)</label>
                      <div className="grid grid-cols-3 gap-2">
                        {MEALS.map(m => (
                          <button key={m.key} type="button"
                            onClick={() => toggleMeal(m.key)}
                            className={`text-center rounded-lg border px-2 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                              restaurantForm.meals.includes(m.key)
                                ? 'border-hotel-gold bg-hotel-gold/15 text-hotel-gold'
                                : 'border-white/15 text-white/60 hover:border-white/30'
                            }`}>
                            {restaurantForm.meals.includes(m.key) && <i className="bi bi-check-lg text-[10px]" />}
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {restaurantForm.meals.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Heure de chaque repas</label>
                        {MEALS.filter(m => restaurantForm.meals.includes(m.key)).map(m => (
                          <div key={m.key} className="flex items-center gap-3">
                            <span className="text-xs text-white/60 w-28 shrink-0">{m.label}</span>
                            <input type="time" className={`${INPUT} flex-1`} value={restaurantForm.times[m.key]}
                              onChange={e => setRestaurantForm({ ...restaurantForm, times: { ...restaurantForm.times, [m.key]: e.target.value } })} />
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Fréquence</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setRestaurantForm({ ...restaurantForm, frequency: 'daily' })}
                          className={`text-left rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                            restaurantForm.frequency === 'daily'
                              ? 'border-hotel-gold bg-hotel-gold/15 text-hotel-gold'
                              : 'border-white/15 text-white/60 hover:border-white/30'
                          }`}>
                          Chaque jour de mon séjour
                          {nights > 0 && <span className="block text-white/30 font-normal mt-0.5">{nights} occasion{nights > 1 ? 's' : ''}</span>}
                        </button>
                        <button type="button" onClick={() => setRestaurantForm({ ...restaurantForm, frequency: 'once' })}
                          className={`text-left rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                            restaurantForm.frequency === 'once'
                              ? 'border-hotel-gold bg-hotel-gold/15 text-hotel-gold'
                              : 'border-white/15 text-white/60 hover:border-white/30'
                          }`}>
                          Une seule fois
                        </button>
                      </div>
                    </div>

                    <div className={`grid grid-cols-1 ${restaurantForm.frequency === 'once' ? 'sm:grid-cols-2' : ''} gap-4`}>
                      {restaurantForm.frequency === 'once' && (
                        <div>
                          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Date</label>
                          <input type="date" className={INPUT} value={restaurantForm.date} min={checkIn} max={checkOut}
                            onChange={e => setRestaurantForm({ ...restaurantForm, date: e.target.value })} />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Personnes</label>
                        <input type="number" min={1} max={20} className={INPUT} value={restaurantForm.party_size}
                          onChange={e => setRestaurantForm({ ...restaurantForm, party_size: Number(e.target.value) })} />
                      </div>
                    </div>

                    {menu.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Menu du jour</p>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                          {MENU_CATEGORY_ORDER.filter(cat => menu.some(m => m.category === cat)).map(cat => (
                            <div key={cat}>
                              <p className="text-xs font-medium text-hotel-gold mb-1">{menu.find(m => m.category === cat)?.category_display}</p>
                              {menu.filter(m => m.category === cat).map(item => (
                                <div key={item.id} className="flex justify-between items-start text-sm py-1 border-b border-white/10 last:border-0">
                                  <div>
                                    <p className="text-white/80">{item.name}</p>
                                    {item.description && <p className="text-xs text-white/30">{item.description}</p>}
                                  </div>
                                  <span className="text-white/50 font-medium shrink-0 ml-3">{fmt(item.price)}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {bankReady && (
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Mode de paiement</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      ['on_site', 'bi-cash-coin', 'Sur place', "Vous payez à l'arrivée"],
                      ['transfer', 'bi-bank2', 'Virement bancaire', 'Payer à l\'avance par virement'],
                    ] as const).map(([val, icon, label, hint]) => (
                      <button key={val} type="button" onClick={() => setPaymentMethod(val)}
                        className={`text-left rounded-xl border px-4 py-3 transition-all ${
                          paymentMethod === val
                            ? 'border-hotel-gold bg-hotel-gold/10'
                            : 'border-white/15 bg-white/5 hover:border-white/30'
                        }`}>
                        <span className={`flex items-center gap-2 font-semibold text-sm ${paymentMethod === val ? 'text-hotel-gold' : 'text-white/70'}`}>
                          <i className={`bi ${icon}`} /> {label}
                        </span>
                        <span className="block text-white/35 text-xs mt-1">{hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-white/25 text-xs text-center mt-4 mb-6 leading-relaxed">
              Votre réservation sera en statut « En attente » jusqu'à confirmation par l'hôtel.
              Nous vous contacterons dans les plus brefs délais.
            </p>

            <button type="submit" disabled={loading}
              className="w-full py-4 bg-hotel-gold text-white rounded-xl font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm">
              {loading
                ? <><i className="bi bi-arrow-repeat animate-spin" /> Envoi en cours…</>
                : <><i className="bi bi-check-circle" /> Confirmer la réservation</>}
            </button>
          </form>
        )}

        {/* ── STEP 3 : Confirmation ── */}
        {step === 3 && confirmation && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-500/60 flex items-center justify-center mx-auto mb-6 animate-[fadeInScale_0.5s_ease]">
              <i className="bi bi-check-lg text-green-400 text-4xl" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">Demande envoyée !</h3>
            <p className="text-white/50 mb-10 text-sm leading-relaxed max-w-md mx-auto">
              Notre équipe vous contactera pour confirmer votre réservation. Conservez votre référence.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left mb-8 max-w-sm mx-auto">
              {/* Référence */}
              <div className="text-center border-b border-white/10 pb-4 mb-4">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Référence de réservation</p>
                <p className="text-hotel-gold font-bold text-3xl font-mono tracking-wider">{confirmation.reference}</p>
              </div>

              {/* Détails */}
              <div className="space-y-3">
                {[
                  ['Client',   `${form.first_name} ${form.last_name}`],
                  ['Chambre',  `${confirmation.room_type} · n° ${confirmation.room_number}`],
                  ['Arrivée',  fmtDate(confirmation.check_in)],
                  ['Départ',   fmtDate(confirmation.check_out)],
                  ['Durée',    `${confirmation.nights} nuit${confirmation.nights > 1 ? 's' : ''}`],
                  ['Total',    fmt(confirmation.total_price)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm gap-4">
                    <span className="text-white/40 shrink-0">{k}</span>
                    <span className="text-white font-medium text-right">{v}</span>
                  </div>
                ))}
              </div>

              {confirmation.restaurant_reserved && (
                <p className="mt-4 pt-4 border-t border-white/10 text-sm text-hotel-gold flex items-center justify-center gap-2 text-center">
                  <i className="bi bi-cup-hot shrink-0" />
                  {MEALS.filter(m => restaurantForm.meals.includes(m.key)).map(m => m.label).join(', ')} demandé{restaurantForm.meals.length > 1 ? 's' : ''}
                  {restaurantForm.frequency === 'daily'
                    ? ` chaque jour de votre séjour (${confirmation.restaurant_occasions} occasion${confirmation.restaurant_occasions > 1 ? 's' : ''})`
                    : ` le ${fmtDate(restaurantForm.date)}`}.
                </p>
              )}

              <div className="mt-5 pt-4 border-t border-white/10">
                <p className="text-white/30 text-xs text-center leading-relaxed">
                  Statut initial : <span className="text-yellow-500">En attente de confirmation</span>
                </p>
              </div>
            </div>

            {confirmation.payment_method === 'transfer' && (
              <div className="bg-hotel-gold/10 border border-hotel-gold/25 rounded-2xl p-6 text-left mb-8 max-w-sm mx-auto">
                <p className="text-hotel-gold font-semibold text-sm flex items-center gap-2 mb-3">
                  <i className="bi bi-bank2" /> Virement bancaire à effectuer
                </p>
                <div className="space-y-2 text-sm">
                  {hotelMeta.bank_name && (
                    <div className="flex justify-between gap-4"><span className="text-white/40">Banque</span><span className="text-white font-medium text-right">{hotelMeta.bank_name}</span></div>
                  )}
                  {hotelMeta.bank_account_holder && (
                    <div className="flex justify-between gap-4"><span className="text-white/40">Titulaire</span><span className="text-white font-medium text-right">{hotelMeta.bank_account_holder}</span></div>
                  )}
                  {hotelMeta.bank_iban && (
                    <div className="flex justify-between gap-4"><span className="text-white/40">IBAN</span><span className="text-white font-medium text-right font-mono">{hotelMeta.bank_iban}</span></div>
                  )}
                  {hotelMeta.bank_bic && (
                    <div className="flex justify-between gap-4"><span className="text-white/40">BIC / SWIFT</span><span className="text-white font-medium text-right font-mono">{hotelMeta.bank_bic}</span></div>
                  )}
                  <div className="flex justify-between gap-4 pt-2 border-t border-white/10"><span className="text-white/40">Montant</span><span className="text-hotel-gold font-bold text-right">{fmt(confirmation.total_price)}</span></div>
                </div>
                <p className="text-white/30 text-xs mt-4 leading-relaxed">
                  Merci d'indiquer la référence <span className="text-hotel-gold font-mono">{confirmation.reference}</span> en libellé du virement, afin que nous puissions l'identifier.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => printReceipt(confirmation, hotelMeta, `${form.first_name} ${form.last_name}`, confirmation.restaurant_reserved ? {
                  meals: MEALS.filter(m => restaurantForm.meals.includes(m.key)).map(m => ({ label: m.label, time: restaurantForm.times[m.key] })),
                  dates: restaurantForm.frequency === 'daily' ? stayDates(checkIn, checkOut) : [restaurantForm.date],
                  party_size: restaurantForm.party_size,
                } : null)}
                className="px-8 py-3 bg-hotel-gold text-white rounded-xl hover:brightness-110 transition-all text-sm font-semibold flex items-center gap-2"
              >
                <i className="bi bi-printer" /> Imprimer le reçu
              </button>
              <button onClick={reset}
                className="px-8 py-3 border border-hotel-gold/40 text-hotel-gold rounded-xl hover:bg-hotel-gold/10 transition-colors text-sm">
                <i className="bi bi-plus-circle mr-2" />Nouvelle réservation
              </button>
            </div>
            <p className="text-center text-white/30 text-xs mt-4">
              Besoin de modifier ou suivre votre réservation ?{' '}
              <a href="/my-booking" target="_blank" rel="noopener noreferrer" className="text-hotel-gold hover:underline">
                Gérer ma réservation
              </a>
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  )
}
