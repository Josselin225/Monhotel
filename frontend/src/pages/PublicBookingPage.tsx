import { useState, useEffect } from 'react'
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
  const [confirmation, setConfirmation] = useState<{ reference: string; total_price: number } | null>(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    adults: 1, children: 0, special_requests: '',
  })

  const [hotelName, setHotelName] = useState('Mon Hôtel')
  const [logoUrl,   setLogoUrl]   = useState('')

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
    setStep('form')
    window.scrollTo(0, 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoom) return
    setError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/bookings/request_booking/', {
        ...form,
        room_id: selectedRoom.id,
        check_in: checkIn,
        check_out: checkOut,
      })
      setConfirmation({ reference: data.reference, total_price: selectedRoom.total_price })
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
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
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
                <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
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
