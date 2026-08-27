import { useEffect, useRef, useState } from 'react'
import { SkeletonContent } from '../components/Skeleton'
import { getContent, updateContent, uploadLogo, removeLogo, uploadContentImage, SiteContent } from '../api/content'

type Tab = 'hotel' | 'hero' | 'stats' | 'rooms' | 'services' | 'gallery' | 'testimonials' | 'cta' | 'footer'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'hotel',        label: 'Hôtel',          icon: 'bi-building' },
  { key: 'hero',         label: 'Hero',            icon: 'bi-image' },
  { key: 'stats',        label: 'Statistiques',   icon: 'bi-bar-chart' },
  { key: 'rooms',        label: 'Chambres',        icon: 'bi-door-open' },
  { key: 'services',     label: 'Services',        icon: 'bi-grid' },
  { key: 'gallery',      label: 'Galerie',         icon: 'bi-images' },
  { key: 'testimonials', label: 'Témoignages',     icon: 'bi-chat-quote' },
  { key: 'cta',          label: 'Call to action',  icon: 'bi-megaphone' },
  { key: 'footer',       label: 'Footer',          icon: 'bi-layout-text-window' },
]

function Field({ label, value, onChange, textarea = false, hint }: {
  label: string; value: string; onChange: (v: string) => void
  textarea?: boolean; hint?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {textarea
        ? <textarea className="input min-h-[80px] resize-y" value={value} onChange={e => onChange(e.target.value)} />
        : <input className="input" value={value} onChange={e => onChange(e.target.value)} />
      }
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setPreview(value) }, [value])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setUploading(true)
    try {
      const url = await uploadContentImage(file)
      onChange(url)
      setPreview(url)
    } catch {
      setPreview(value)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <label className="label">{label}</label>
      {preview && (
        <img src={preview} alt="" className="h-32 w-full object-cover rounded-lg border border-gray-200"
          onError={() => setPreview('')} />
      )}
      <div className="flex gap-2 items-center">
        <label className={`btn-secondary cursor-pointer text-sm shrink-0 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <i className="bi bi-upload" />
          {uploading ? 'Envoi…' : 'Uploader'}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        <input
          className="input text-sm"
          value={value}
          onChange={e => { onChange(e.target.value); setPreview(e.target.value) }}
          placeholder="ou coller une URL…"
        />
      </div>
    </div>
  )
}

function LogoUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setPreview(value) }, [value])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setUploading(true)
    try {
      const url = await uploadLogo(file)
      onChange(url)
    } catch {
      setPreview(value)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    setUploading(true)
    try {
      await removeLogo()
      onChange('')
      setPreview('')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="col-span-2">
      <label className="label">Logo de l'hôtel</label>
      <div className="flex items-center gap-4 mt-2">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
          {preview
            ? <img src={preview} alt="Logo" className="w-full h-full object-cover" onError={() => setPreview('')} />
            : <i className="bi bi-building text-gray-400 text-xl" />
          }
        </div>
        <div className="flex flex-col gap-2">
          <label className={`btn-secondary cursor-pointer text-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <i className="bi bi-upload" />
            {uploading ? 'Envoi…' : 'Choisir un fichier'}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          {preview && !uploading && (
            <button type="button" className="text-xs text-red-500 hover:text-red-700 text-left" onClick={handleRemove}>
              Supprimer le logo
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">PNG, JPG, SVG · Max 2 Mo<br />Laisser vide = icône par défaut</p>
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {title && <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">{title}</h4>}
      {children}
    </div>
  )
}

export default function ContentPage() {
  const [content, setContent] = useState<SiteContent | null>(null)
  const [tab, setTab] = useState<Tab>('hotel')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getContent().then(setContent)
  }, [])

  const save = async () => {
    if (!content) return
    setSaving(true)
    try {
      const updated = await updateContent(content)
      setContent(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof SiteContent>(section: K, value: SiteContent[K]) => {
    setContent(c => c ? { ...c, [section]: value } : c)
  }

  if (!content) return <SkeletonContent />

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Contenu de la page d'accueil</h1>
          <p className="text-sm text-gray-500 mt-0.5">Modifiez les textes, images et informations affichés sur le site vitrine.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary gap-2 self-start sm:self-auto">
          {saving
            ? <><i className="bi bi-arrow-repeat animate-spin" /> Sauvegarde…</>
            : saved
            ? <><i className="bi bi-check-lg" /> Enregistré !</>
            : <><i className="bi bi-floppy" /> Enregistrer</>
          }
        </button>
      </div>

      {/* Mobile tab strip */}
      <nav className="flex sm:hidden gap-1 overflow-x-auto pb-2 mb-4 -mx-6 px-6 scrollbar-none">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-primary-50 text-primary-700' : 'text-gray-600 bg-gray-100'
            }`}>
            <i className={`bi ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex gap-4">
        {/* Sidebar tabs — desktop only */}
        <nav className="hidden sm:block w-44 shrink-0 space-y-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                tab === t.key
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <i className={`bi ${t.icon}`} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* ── Hôtel ── */}
          {tab === 'hotel' && (
            <SectionCard title="Informations générales">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom de l'hôtel" value={content.hotel.name} onChange={v => set('hotel', { ...content.hotel, name: v })} />
                <Field label="Tagline sidebar" value={content.hotel.tagline ?? ''} onChange={v => set('hotel', { ...content.hotel, tagline: v })} hint="Sous le nom dans la barre latérale" />
                <LogoUploadField value={content.hotel.logo_url ?? ''} onChange={v => set('hotel', { ...content.hotel, logo_url: v })} />
                <Field label="Localisation (header)" value={content.hotel.location} onChange={v => set('hotel', { ...content.hotel, location: v })} hint="Ex: Abidjan · Côte d'Ivoire" />
                <Field label="Adresse complète" value={content.hotel.address} onChange={v => set('hotel', { ...content.hotel, address: v })} />
                <Field label="Ville" value={content.hotel.city} onChange={v => set('hotel', { ...content.hotel, city: v })} />
                <Field label="Téléphone" value={content.hotel.phone} onChange={v => set('hotel', { ...content.hotel, phone: v })} />
                <Field label="Email" value={content.hotel.email} onChange={v => set('hotel', { ...content.hotel, email: v })} />
                <Field label="Année d'ouverture" value={content.hotel.since} onChange={v => set('hotel', { ...content.hotel, since: v })} />
                <Field label="Étoiles" value={String(content.hotel.stars)} onChange={v => set('hotel', { ...content.hotel, stars: Number(v) })} />
                <Field label="Latitude (carte)" value={String(content.hotel.lat ?? '')} onChange={v => set('hotel', { ...content.hotel, lat: parseFloat(v) || undefined })} hint="Ex: 5.3190" />
                <Field label="Longitude (carte)" value={String(content.hotel.lng ?? '')} onChange={v => set('hotel', { ...content.hotel, lng: parseFloat(v) || undefined })} hint="Ex: -4.0170" />
              </div>
            </SectionCard>
          )}

          {/* ── Avis clients ── */}
          {tab === 'hotel' && (
            <SectionCard title="Demande d'avis publics">
              <p className="text-sm text-gray-500 mb-4 -mt-2">
                Après un questionnaire de satisfaction noté 4★ ou plus, le client sera invité à partager son avis sur ces plateformes.
                Laissez vide pour désactiver.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Lien avis Google" value={content.hotel.google_review_url ?? ''}
                  onChange={v => set('hotel', { ...content.hotel, google_review_url: v })}
                  hint="Lien 'Rédiger un avis' de votre fiche Google Business" />
                <Field label="Lien avis TripAdvisor" value={content.hotel.tripadvisor_review_url ?? ''}
                  onChange={v => set('hotel', { ...content.hotel, tripadvisor_review_url: v })}
                  hint="Lien vers votre page TripAdvisor" />
              </div>
            </SectionCard>
          )}

          {/* ── Coordonnées bancaires ── */}
          {tab === 'hotel' && (
            <SectionCard title="Coordonnées bancaires (paiement par virement)">
              <p className="text-sm text-gray-500 mb-4 -mt-2">
                Affichées au client qui choisit de payer sa réservation en ligne par virement bancaire.
                Laissez vide pour désactiver cette option de paiement sur le site.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom de la banque" value={content.hotel.bank_name ?? ''}
                  onChange={v => set('hotel', { ...content.hotel, bank_name: v })} />
                <Field label="Titulaire du compte" value={content.hotel.bank_account_holder ?? ''}
                  onChange={v => set('hotel', { ...content.hotel, bank_account_holder: v })} />
                <Field label="IBAN" value={content.hotel.bank_iban ?? ''}
                  onChange={v => set('hotel', { ...content.hotel, bank_iban: v })} />
                <Field label="BIC / SWIFT" value={content.hotel.bank_bic ?? ''}
                  onChange={v => set('hotel', { ...content.hotel, bank_bic: v })} />
              </div>
            </SectionCard>
          )}

          {/* ── Hero ── */}
          {tab === 'hero' && (
            <SectionCard title="Section héro (bannière principale)">
              <Field label="Accroche (bandeau étoiles)" value={content.hero.eyebrow} onChange={v => set('hero', { ...content.hero, eyebrow: v })} />
              <Field label="Titre — ligne 1" value={content.hero.title1} onChange={v => set('hero', { ...content.hero, title1: v })} />
              <Field label="Titre — ligne 2 (dorée)" value={content.hero.title2} onChange={v => set('hero', { ...content.hero, title2: v })} />
              <Field label="Sous-titre" value={content.hero.subtitle} onChange={v => set('hero', { ...content.hero, subtitle: v })} textarea />
              <ImageField label="Image de fond" value={content.hero.image} onChange={v => set('hero', { ...content.hero, image: v })} />
            </SectionCard>
          )}

          {/* ── Stats ── */}
          {tab === 'stats' && (
            <>
              {content.stats.map((stat, i) => (
                <SectionCard key={i} title={`Statistique ${i + 1}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Valeur" value={stat.value} onChange={v => {
                      const s = [...content.stats]; s[i] = { ...s[i], value: v }; set('stats', s)
                    }} />
                    <Field label="Label" value={stat.label} onChange={v => {
                      const s = [...content.stats]; s[i] = { ...s[i], label: v }; set('stats', s)
                    }} />
                  </div>
                </SectionCard>
              ))}
            </>
          )}

          {/* ── Chambres ── */}
          {tab === 'rooms' && (
            <>
              {content.rooms.map((room, i) => (
                <SectionCard key={i} title={`Chambre ${i + 1}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nom" value={room.name} onChange={v => {
                      const r = [...content.rooms]; r[i] = { ...r[i], name: v }; set('rooms', r)
                    }} />
                    <Field label="Badge" value={room.badge} onChange={v => {
                      const r = [...content.rooms]; r[i] = { ...r[i], badge: v }; set('rooms', r)
                    }} />
                    <Field label="Prix (FCFA / nuit)" value={room.price} onChange={v => {
                      const r = [...content.rooms]; r[i] = { ...r[i], price: v }; set('rooms', r)
                    }} />
                    <Field label="Caractéristiques (séparées par virgule)" value={room.features.join(', ')} onChange={v => {
                      const r = [...content.rooms]; r[i] = { ...r[i], features: v.split(',').map(s => s.trim()) }; set('rooms', r)
                    }} hint="Ex: Vue jardin, 25 m², 2 personnes" />
                  </div>
                  <ImageField label="Photo" value={room.image} onChange={v => {
                    const r = [...content.rooms]; r[i] = { ...r[i], image: v }; set('rooms', r)
                  }} />
                </SectionCard>
              ))}
            </>
          )}

          {/* ── Services ── */}
          {tab === 'services' && (
            <>
              {content.services.map((svc, i) => (
                <SectionCard key={i} title={`Service ${i + 1}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Titre" value={svc.title} onChange={v => {
                      const s = [...content.services]; s[i] = { ...s[i], title: v }; set('services', s)
                    }} />
                    <Field label="Icône Bootstrap" value={svc.icon} onChange={v => {
                      const s = [...content.services]; s[i] = { ...s[i], icon: v }; set('services', s)
                    }} hint="Ex: bi-fork-knife, bi-flower1, bi-water" />
                  </div>
                  <Field label="Description" value={svc.desc} onChange={v => {
                    const s = [...content.services]; s[i] = { ...s[i], desc: v }; set('services', s)
                  }} textarea />
                  <ImageField label="Photo" value={svc.image} onChange={v => {
                    const s = [...content.services]; s[i] = { ...s[i], image: v }; set('services', s)
                  }} />
                </SectionCard>
              ))}
            </>
          )}

          {/* ── Galerie ── */}
          {tab === 'gallery' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {content.gallery.map((item, i) => (
                  <SectionCard key={i} title={`Photo ${i + 1}`}>
                    <Field label="Légende" value={item.label} onChange={v => {
                      const g = [...content.gallery]; g[i] = { ...g[i], label: v }; set('gallery', g)
                    }} />
                    <ImageField label="URL de l'image" value={item.image} onChange={v => {
                      const g = [...content.gallery]; g[i] = { ...g[i], image: v }; set('gallery', g)
                    }} />
                  </SectionCard>
                ))}
              </div>
            </>
          )}

          {/* ── Témoignages ── */}
          {tab === 'testimonials' && (
            <>
              <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <i className="bi bi-info-circle-fill text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold mb-0.5">Avis dynamiques activés</p>
                  <p className="text-amber-700/80">
                    Dès qu'un client soumet un questionnaire avec un commentaire et une note ≥ 4/5,
                    ses avis remplacent automatiquement ceux ci-dessous sur la page d'accueil.
                    Ces témoignages servent uniquement de <strong>contenu de secours</strong> tant qu'il n'y a pas encore de vrais avis.
                    Gérez les avis réels depuis <a href="/app/surveys" className="underline font-semibold">Satisfaction clients</a>.
                  </p>
                </div>
              </div>
              {content.testimonials.map((t, i) => (
                <SectionCard key={i} title={`Témoignage ${i + 1}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nom" value={t.author} onChange={v => {
                      const ts = [...content.testimonials]; ts[i] = { ...ts[i], author: v }; set('testimonials', ts)
                    }} />
                    <Field label="Rôle / Description" value={t.role} onChange={v => {
                      const ts = [...content.testimonials]; ts[i] = { ...ts[i], role: v }; set('testimonials', ts)
                    }} />
                  </div>
                  <Field label="Texte du témoignage" value={t.text} onChange={v => {
                    const ts = [...content.testimonials]; ts[i] = { ...ts[i], text: v }; set('testimonials', ts)
                  }} textarea />
                </SectionCard>
              ))}
            </>
          )}

          {/* ── CTA ── */}
          {tab === 'cta' && (
            <SectionCard title="Section appel à l'action">
              <Field label="Titre" value={content.cta.title} onChange={v => set('cta', { ...content.cta, title: v })} />
              <Field label="Sous-titre" value={content.cta.subtitle} onChange={v => set('cta', { ...content.cta, subtitle: v })} textarea />
              <Field label="Texte du bouton" value={content.cta.button_text} onChange={v => set('cta', { ...content.cta, button_text: v })} />
            </SectionCard>
          )}

          {/* ── Footer ── */}
          {tab === 'footer' && (
            <SectionCard title="Pied de page">
              <Field label="Texte de présentation" value={content.footer.about} onChange={v => set('footer', { ...content.footer, about: v })} textarea />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Horaires semaine" value={content.footer.schedule_week} onChange={v => set('footer', { ...content.footer, schedule_week: v })} />
                <Field label="Horaires week-end" value={content.footer.schedule_weekend} onChange={v => set('footer', { ...content.footer, schedule_weekend: v })} />
                <Field label="Check-in" value={content.footer.checkin} onChange={v => set('footer', { ...content.footer, checkin: v })} />
                <Field label="Check-out" value={content.footer.checkout} onChange={v => set('footer', { ...content.footer, checkout: v })} />
              </div>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  )
}
