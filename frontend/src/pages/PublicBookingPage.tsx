import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { getContent } from '../api/content'

const api = axios.create({ baseURL: (import.meta as any).env?.VITE_API_URL || '/api' })

interface AvailableRoom {
  id: number
  number: string
  room_type: string
  floor: number
  floor_display: string
  price_per_night: number
  total_price: number
  nights: number
}

interface PublicMenuItem {
  id: number
  name: string
  description: string
  category: string
  category_display: string
  price: string
}

const MENU_CATEGORY_ORDER = ['starter', 'main', 'dessert', 'drink']

const MEALS = [
  { key: 'breakfast', label: 'Petit-déjeuner', time: '08:00' },
  { key: 'lunch',     label: 'Déjeuner',       time: '12:30' },
  { key: 'dinner',    label: 'Dîner',          time: '19:30' },
] as const

type Step = 'search' | 'form' | 'done'

const FLOOR_LABELS: Record<number, string> = {
  0: 'Rez-de-chaussée', 1: '1er étage', 2: '2ème étage', 3: '3ème étage', 4: '4ème étage',
}

function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
}

export default function PublicBookingPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [step, setStep] = useState<Step>('search')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [rooms, setRooms] = useState<AvailableRoom[]>([])
  const [nights, setNights] = useState(0)
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{ reference: string; total_price: number; restaurantReserved: boolean; restaurantOccasions: number } | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Fait défiler vers l'erreur dès qu'elle apparaît : sur un formulaire long
  // (mobile notamment), l'utilisateur reste scrollé sur le bouton de
  // soumission et ne voit sinon ni l'erreur ni les champs à corriger.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [error])

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    adults: 1, children: 0, special_requests: '',
  })

  const [hotelName, setHotelName] = useState('Mon Hôtel')
  const [logoUrl,   setLogoUrl]   = useState('')

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

  useEffect(() => {
    getContent().then(c => {
      const name = c.hotel.name || 'Mon Hôtel'
      const logo = c.hotel.logo_url || ''
      setHotelName(name)
      setLogoUrl(logo)
      document.title = `${name} — Réservation en ligne`
      if (logo) {
        const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
        if (favicon) favicon.href = logo
      }
    }).catch(() => {})
    api.get('/menu-items/public/').then(r => setMenu(r.data)).catch(() => {})
  }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSearching(true)
    try {
      const { data } = await api.get('/bookings/availability/', { params: { check_in: checkIn, check_out: checkOut } })
      setRooms(data.rooms)
      setNights(data.nights)
      setStep('search')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la recherche.')
    } finally {
      setSearching(false)
    }
  }

  function selectRoom(room: AvailableRoom) {
    setSelectedRoom(room)
    setRestaurantForm(f => ({ ...f, date: checkIn }))
    setStep('form')
    window.scrollTo(0, 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoom) return
    if (wantsRestaurant && restaurantForm.meals.length === 0) {
      setError('Sélectionnez au moins un repas, ou décochez la réservation au restaurant.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/bookings/request_booking/', {
        ...form,
        room_id: selectedRoom.id,
        check_in: checkIn,
        check_out: checkOut,
        ...(wantsRestaurant && restaurantForm.meals.length > 0 ? {
          restaurant_meals: restaurantForm.meals.map(m => ({ meal: m, time: restaurantForm.times[m] })),
          restaurant_frequency: restaurantForm.frequency,
          restaurant_party_size: restaurantForm.party_size,
          ...(restaurantForm.frequency === 'once' ? { restaurant_date: restaurantForm.date } : {}),
        } : {}),
      })
      setConfirmation({
        reference: data.reference, total_price: selectedRoom.total_price,
        restaurantReserved: !!data.restaurant_reserved, restaurantOccasions: data.restaurant_occasions ?? 0,
      })
      setStep('done')
      window.scrollTo(0, 0)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la réservation.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-amber-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt={hotelName} className="w-full h-full object-cover" />
              : <i className="bi bi-building text-white text-sm" />
            }
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-lg leading-none">{hotelName}</h1>
            <p className="text-xs text-gray-500">Réservation en ligne</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step: confirmation */}
        {step === 'done' && confirmation && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-check-lg text-green-600 text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Demande enregistrée !</h2>
            <p className="text-gray-500 mb-6">
              Votre demande de réservation <strong className="text-amber-600">{confirmation.reference}</strong> a été reçue.<br />
              Notre équipe vous contactera sous 24h pour confirmer votre séjour.
            </p>
            <div className="inline-block bg-amber-50 border border-amber-200 rounded-xl p-5 text-left mb-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <span className="text-gray-500">Référence</span>
                <span className="font-bold text-amber-600">{confirmation.reference}</span>
                <span className="text-gray-500">Arrivée</span>
                <span className="font-medium">{new Date(checkIn + 'T00:00').toLocaleDateString('fr-FR')}</span>
                <span className="text-gray-500">Départ</span>
                <span className="font-medium">{new Date(checkOut + 'T00:00').toLocaleDateString('fr-FR')}</span>
                <span className="text-gray-500">Chambre</span>
                <span className="font-medium">#{selectedRoom?.number} — {selectedRoom?.room_type}</span>
                <span className="text-gray-500">Total estimé</span>
                <span className="font-bold">{fmt(confirmation.total_price)}</span>
              </div>
              {confirmation.restaurantReserved && (
                <p className="mt-3 pt-3 border-t border-amber-200 text-sm text-amber-700 flex items-center gap-2">
                  <i className="bi bi-cup-hot" />
                  {MEALS.filter(m => restaurantForm.meals.includes(m.key)).map(m => m.label).join(', ')} demandé{restaurantForm.meals.length > 1 ? 's' : ''}
                  {restaurantForm.frequency === 'daily'
                    ? ` chaque jour de votre séjour (${confirmation.restaurantOccasions} occasion${confirmation.restaurantOccasions > 1 ? 's' : ''})`
                    : ` le ${new Date(restaurantForm.date + 'T00:00').toLocaleDateString('fr-FR')}`}.
                </p>
              )}
            </div>
            <button
              onClick={() => { setStep('search'); setRooms([]); setCheckIn(''); setCheckOut(''); setSelectedRoom(null) }}
              className="text-sm text-amber-600 hover:underline"
            >
              Faire une autre réservation
            </button>
          </div>
        )}

        {/* Step: form */}
        {step === 'form' && selectedRoom && (
          <>
            <button onClick={() => setStep('search')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
              <i className="bi bi-arrow-left" /> Retour aux chambres
            </button>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Selected room summary */}
              <div className="md:col-span-1">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sticky top-4">
                  <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-2">Votre sélection</p>
                  <p className="font-bold text-gray-800 text-lg">Chambre #{selectedRoom.number}</p>
                  <p className="text-sm text-gray-600 mb-3">{selectedRoom.room_type} · {FLOOR_LABELS[selectedRoom.floor]}</p>
                  <div className="border-t border-amber-200 pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Arrivée</span>
                      <span className="font-medium">{new Date(checkIn + 'T00:00').toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Départ</span>
                      <span className="font-medium">{new Date(checkOut + 'T00:00').toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Durée</span>
                      <span className="font-medium">{nights} nuit{nights > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-2 mt-2">
                      <span className="font-bold">Total estimé</span>
                      <span className="font-bold text-amber-600">{fmt(selectedRoom.total_price)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Form */}
              <form onSubmit={handleSubmit} className="md:col-span-2 space-y-4">
                <h2 className="text-xl font-bold text-gray-800">Vos coordonnées</h2>
                {error && (
                  <div ref={errorRef} className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 scroll-mt-24">{error}</div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                    <input required className="input-box w-full" value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input required className="input-box w-full" value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input required type="email" className="input-box w-full" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input type="tel" className="input-box w-full" value={form.phone}
                      placeholder="07XXXXXXXX" maxLength={10} minLength={10} pattern="[0-9]{10}"
                      onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adultes</label>
                    <input type="number" min={1} max={10} className="input-box w-full" value={form.adults}
                      onChange={e => setForm({ ...form, adults: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enfants</label>
                    <input type="number" min={0} max={10} className="input-box w-full" value={form.children}
                      onChange={e => setForm({ ...form, children: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Demandes spéciales</label>
                  <textarea rows={3} className="input-box w-full resize-none" value={form.special_requests}
                    onChange={e => setForm({ ...form, special_requests: e.target.value })}
                    placeholder="Lit bébé, vue sur jardin, chambre calme…" />
                </div>

                {/* Réservation restaurant optionnelle */}
                <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={wantsRestaurant} onChange={e => setWantsRestaurant(e.target.checked)}
                      className="w-4 h-4 accent-amber-600" />
                    <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <i className="bi bi-cup-hot text-amber-600" /> Réserver une table au restaurant
                    </span>
                  </label>

                  {wantsRestaurant && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Repas (un ou plusieurs)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {MEALS.map(m => (
                            <button key={m.key} type="button"
                              onClick={() => toggleMeal(m.key)}
                              className={`text-center rounded-lg border px-2 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                restaurantForm.meals.includes(m.key)
                                  ? 'border-amber-500 bg-amber-100 text-amber-700'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}>
                              {restaurantForm.meals.includes(m.key) && <i className="bi bi-check-lg text-[10px]" />}
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {restaurantForm.meals.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Heure de chaque repas</label>
                          {MEALS.filter(m => restaurantForm.meals.includes(m.key)).map(m => (
                            <div key={m.key} className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 w-28 shrink-0">{m.label}</span>
                              <input type="time" className="input-box flex-1" value={restaurantForm.times[m.key]}
                                onChange={e => setRestaurantForm({ ...restaurantForm, times: { ...restaurantForm.times, [m.key]: e.target.value } })} />
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Fréquence</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setRestaurantForm({ ...restaurantForm, frequency: 'daily' })}
                            className={`text-left rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                              restaurantForm.frequency === 'daily'
                                ? 'border-amber-500 bg-amber-100 text-amber-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                            Chaque jour de mon séjour
                            {nights > 0 && <span className="block text-gray-400 font-normal mt-0.5">{nights} occasion{nights > 1 ? 's' : ''}</span>}
                          </button>
                          <button type="button" onClick={() => setRestaurantForm({ ...restaurantForm, frequency: 'once' })}
                            className={`text-left rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                              restaurantForm.frequency === 'once'
                                ? 'border-amber-500 bg-amber-100 text-amber-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                            Une seule fois
                          </button>
                        </div>
                      </div>

                      <div className={`grid ${restaurantForm.frequency === 'once' ? 'sm:grid-cols-2' : ''} gap-4`}>
                        {restaurantForm.frequency === 'once' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <input type="date" className="input-box w-full" value={restaurantForm.date} min={checkIn} max={checkOut}
                              onChange={e => setRestaurantForm({ ...restaurantForm, date: e.target.value })} />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Personnes</label>
                          <input type="number" min={1} max={20} className="input-box w-full" value={restaurantForm.party_size}
                            onChange={e => setRestaurantForm({ ...restaurantForm, party_size: Number(e.target.value) })} />
                        </div>
                      </div>

                      {menu.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Menu du jour</p>
                          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                            {MENU_CATEGORY_ORDER.filter(cat => menu.some(m => m.category === cat)).map(cat => (
                              <div key={cat}>
                                <p className="text-xs font-medium text-amber-600 mb-1">{menu.find(m => m.category === cat)?.category_display}</p>
                                {menu.filter(m => m.category === cat).map(item => (
                                  <div key={item.id} className="flex justify-between items-start text-sm py-1 border-b border-amber-100 last:border-0">
                                    <div>
                                      <p className="text-gray-800">{item.name}</p>
                                      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                                    </div>
                                    <span className="text-gray-600 font-medium shrink-0 ml-3">{fmt(Number(item.price))}</span>
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

                <button type="submit" disabled={submitting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                  {submitting ? 'Envoi en cours…' : 'Envoyer ma demande de réservation'}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Votre demande sera confirmée par notre équipe sous 24h.
                </p>
              </form>
            </div>
          </>
        )}

        {/* Step: search */}
        {step === 'search' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Réservez votre séjour</h2>
              <p className="text-gray-500">Choisissez vos dates et découvrez nos chambres disponibles</p>
            </div>
            <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Arrivée</label>
                  <input required type="date" min={today} value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    className="input-box w-full" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Départ</label>
                  <input required type="date" min={checkIn || today} value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    className="input-box w-full" />
                </div>
                <button type="submit" disabled={searching}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap">
                  {searching ? (
                    <span className="flex items-center gap-2">
                      <i className="bi bi-arrow-repeat animate-spin" /> Recherche…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <i className="bi bi-search" /> Rechercher
                    </span>
                  )}
                </button>
              </div>
              {error && (
                <div ref={errorRef} className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 scroll-mt-24">{error}</div>
              )}
            </form>

            {rooms.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">{rooms.length} chambre{rooms.length > 1 ? 's' : ''} disponible{rooms.length > 1 ? 's' : ''}</h3>
                  <span className="text-sm text-gray-400">{nights} nuit{nights > 1 ? 's' : ''}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map(room => (
                    <div key={room.id} className="bg-white rounded-2xl border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all p-5 flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-800 text-lg">Chambre #{room.number}</p>
                          <p className="text-sm text-gray-500">{room.room_type}</p>
                          <p className="text-xs text-gray-400">{FLOOR_LABELS[room.floor]}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <span className="w-2 h-2 rounded-full bg-green-500 block" />
                        </div>
                      </div>
                      <div className="mt-auto pt-3 border-t border-gray-100">
                        <div className="flex items-end justify-between mb-3">
                          <div>
                            <p className="text-xs text-gray-400">{fmt(room.price_per_night)} / nuit</p>
                            <p className="font-bold text-amber-600 text-lg">{fmt(room.total_price)}</p>
                            <p className="text-xs text-gray-400">pour {nights} nuit{nights > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => selectRoom(room)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                        >
                          Sélectionner cette chambre
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!searching && rooms.length === 0 && checkIn && checkOut && (
              <div className="text-center py-12 text-gray-400">
                <i className="bi bi-door-closed text-4xl block mb-3" />
                <p className="font-medium text-gray-500">Aucune chambre disponible pour ces dates</p>
                <p className="text-sm mt-1">Essayez d'autres dates</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
