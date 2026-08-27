import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { satisfactionApi } from '../api/satisfaction'
import { getContent } from '../api/content'

type Step = 'loading' | 'form' | 'submitted' | 'already' | 'error'

// Seuil à partir duquel on invite le client à publier un avis public — on ne
// sollicite jamais un client mécontent pour un avis Google/TripAdvisor.
const REVIEW_PROMPT_THRESHOLD = 4

function StarInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i} type="button"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(i)}
            className="text-3xl transition-transform hover:scale-110"
          >
            <i className={`bi bi-star${i <= (hovered || value) ? '-fill' : ''} ${i <= (hovered || value) ? 'text-amber-400' : 'text-gray-200'}`} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SurveyFormPage() {
  const { token } = useParams<{ token: string }>()
  const [step, setStep] = useState<Step>('loading')
  const [info, setInfo]   = useState<{ booking_ref: string; client_name: string } | null>(null)
  const [form, setForm]   = useState({
    score_overall: 0, score_cleanliness: 0, score_service: 0,
    score_comfort: 0, score_value: 0, comment: '', would_return: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [hotelName, setHotelName] = useState('Mon Hôtel')
  const [reviewUrls, setReviewUrls] = useState({ google: '', tripadvisor: '' })

  useEffect(() => {
    if (!token) { setStep('error'); return }
    satisfactionApi.getPublic(token)
      .then(d => {
        if (d.is_submitted) { setStep('already'); return }
        setInfo(d)
        setStep('form')
      })
      .catch(() => setStep('error'))
    getContent().then(c => {
      setHotelName(c.hotel.name || 'Mon Hôtel')
      setReviewUrls({
        google: c.hotel.google_review_url || '',
        tripadvisor: c.hotel.tripadvisor_review_url || '',
      })
    }).catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.score_overall) { setError('Veuillez donner au moins une note globale.'); return }
    setSaving(true)
    try {
      await satisfactionApi.submit(token!, form)
      setStep('submitted')
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally { setSaving(false) }
  }

  const set = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-hotel-gold mx-auto mb-3">
            <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M10 27 L10 18 L14.5 22.5 L20 14 L25.5 22.5 L30 18 L30 27 Z" fill="currentColor"/>
            <rect x="10" y="27" width="20" height="2.5" rx="1.25" fill="currentColor"/>
          </svg>
          <h1 className="text-2xl font-serif font-bold text-gray-900">{hotelName}</h1>
          <p className="text-sm text-gray-500 mt-1">Questionnaire de satisfaction</p>
        </div>

        {step === 'loading' && (
          <div className="text-center text-gray-400">
            <i className="bi bi-arrow-repeat animate-spin text-3xl" />
            <p className="mt-2">Chargement…</p>
          </div>
        )}

        {step === 'error' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <i className="bi bi-exclamation-triangle text-4xl text-red-400" />
            <h2 className="text-lg font-bold text-gray-900 mt-3">Lien invalide</h2>
            <p className="text-sm text-gray-500 mt-1">Ce lien est invalide ou a expiré.</p>
          </div>
        )}

        {step === 'already' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <i className="bi bi-check-circle-fill text-4xl text-green-500" />
            <h2 className="text-lg font-bold text-gray-900 mt-3">Déjà soumis</h2>
            <p className="text-sm text-gray-500 mt-1">Vous avez déjà répondu à ce questionnaire. Merci !</p>
          </div>
        )}

        {step === 'submitted' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <i className="bi bi-emoji-smile text-5xl text-hotel-gold" />
            <h2 className="text-xl font-bold text-gray-900 mt-4">Merci pour votre avis !</h2>
            <p className="text-sm text-gray-500 mt-2">
              Vos retours nous aident à nous améliorer continuellement.<br />
              Nous espérons vous revoir bientôt !
            </p>

            {form.score_overall >= REVIEW_PROMPT_THRESHOLD && (reviewUrls.google || reviewUrls.tripadvisor) && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Ravis que votre séjour vous ait plu ! Auriez-vous une minute pour partager votre expérience publiquement ?
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  {reviewUrls.google && (
                    <a href={reviewUrls.google} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-hotel-gold hover:text-hotel-gold transition-colors">
                      <i className="bi bi-google" /> Avis Google
                    </a>
                  )}
                  {reviewUrls.tripadvisor && (
                    <a href={reviewUrls.tripadvisor} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-hotel-gold hover:text-hotel-gold transition-colors">
                      <i className="bi bi-airplane" /> Avis TripAdvisor
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'form' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {info && (
              <div className="bg-amber-50 rounded-xl p-4 mb-6 text-sm text-gray-700">
                <p className="font-semibold">{info.client_name}</p>
                <p className="text-gray-500">Réservation {info.booking_ref}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <StarInput label="Note globale *" value={form.score_overall} onChange={v => set('score_overall', v)} />
              <StarInput label="Propreté"        value={form.score_cleanliness} onChange={v => set('score_cleanliness', v)} />
              <StarInput label="Service"          value={form.score_service}    onChange={v => set('score_service', v)} />
              <StarInput label="Confort"          value={form.score_comfort}    onChange={v => set('score_comfort', v)} />
              <StarInput label="Rapport qualité/prix" value={form.score_value}  onChange={v => set('score_value', v)} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire (optionnel)</label>
                <textarea
                  rows={3}
                  value={form.comment}
                  onChange={e => set('comment', e.target.value)}
                  placeholder="Dites-nous ce qui vous a plu ou ce que nous pouvons améliorer…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-hotel-gold/40 focus:border-hotel-gold resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reviendriez-vous ?</label>
                <div className="flex gap-3">
                  {[true, false].map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => set('would_return', v)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                        form.would_return === v
                          ? v ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-600'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {v ? '👍 Oui' : '👎 Non'}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-hotel-gold text-white rounded-xl font-semibold hover:brightness-110 transition-all disabled:opacity-60"
              >
                {saving ? 'Envoi…' : 'Envoyer mon avis'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
