import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import { useAuth } from '../context/AuthContext'
import { getContent } from '../api/content'
import { getApiError, mediaUrl } from '../utils'
import FormField from '../components/FormField'
import BusinessCardPreview, { CARD_TEMPLATES, CARD_MM, CARD_PX } from '../components/BusinessCardPreview'
import { CardData, GOLD_PALETTES } from '../types/businessCard'

const MAX_LOGO_SIZE = 1.5 * 1024 * 1024 // 1.5 Mo, stocké en base64 dans le navigateur

// Format réel ID-1 (ISO/IEC 7810, cartes d'identité/bancaires) : 85,60 x 53,98mm.
// L'aperçu écran est un mockup zoomé (CARD_PX) ; à l'impression on ramène le bloc
// à sa taille physique exacte via un facteur d'échelle (1mm CSS = 96/25.4 px CSS).
const PRINT_SCALE = (CARD_MM.width * (96 / 25.4)) / CARD_PX.width

const EMPTY: CardData = { template: 'golden', goldColor: 'gold', hotelName: '', hotelTagline: '', fullName: '', role: '', phone: '', whatsapp: '', email: '', address: '', logoUrl: '' }

const COPIES_OPTIONS = [4, 6, 8, 10, 12, 16, 20]

function storageKey(username: string) {
  return `mh_business_card_${username}`
}

function loadSaved(username: string): Partial<CardData> {
  try { return JSON.parse(localStorage.getItem(storageKey(username)) ?? '{}') }
  catch { return {} }
}

export default function BusinessCardPage() {
  const { user } = useAuth()
  const [defaults, setDefaults] = useState<CardData>(EMPTY)
  const [card, setCard] = useState<CardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [exportingPng, setExportingPng] = useState(false)
  const [copiesPerPage, setCopiesPerPage] = useState(8)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getContent()
      .then(content => {
        const hotel = content.hotel
        const d: CardData = {
          template: 'golden',
          goldColor: 'gold',
          hotelName: hotel?.name ?? 'Mon Hôtel',
          hotelTagline: hotel?.tagline ?? '',
          fullName: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.username || '',
          role: user?.role_display ?? '',
          phone: user?.phone ?? '',
          whatsapp: '',
          email: user?.email ?? '',
          address: [hotel?.address, hotel?.city].filter(Boolean).join(', '),
          logoUrl: hotel?.logo_url ?? '',
        }
        setDefaults(d)
        setCard(user ? { ...d, ...loadSaved(user.username) } : d)
      })
      .catch(err => toast.error(getApiError(err)))
      .finally(() => setLoading(false))
  }, [user])

  const set = (field: keyof CardData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCard(c => ({ ...c, [field]: e.target.value }))

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Sélectionnez une image (JPG, PNG, WEBP)'); return }
    if (file.size > MAX_LOGO_SIZE) { toast.error('Image trop lourde (max 1,5 Mo)'); return }

    const reader = new FileReader()
    reader.onload = ev => setCard(c => ({ ...c, logoUrl: ev.target?.result as string }))
    reader.readAsDataURL(file)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const handleRemoveLogo = () => setCard(c => ({ ...c, logoUrl: '' }))

  const handleSave = () => {
    if (!user) return
    localStorage.setItem(storageKey(user.username), JSON.stringify(card))
    toast.success('Carte enregistrée')
  }

  const handleReset = () => {
    if (user) localStorage.removeItem(storageKey(user.username))
    setCard(defaults)
    toast.success('Carte réinitialisée')
  }

  const handleDownloadPng = async () => {
    if (!cardRef.current) return
    setExportingPng(true)
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: null, useCORS: true })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `carte-de-visite-${(card.fullName || 'contact').replace(/\s+/g, '_')}.png`
      a.click()
    } catch {
      toast.error("Impossible de générer l'image")
    } finally {
      setExportingPng(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <i className="bi bi-arrow-repeat animate-spin text-2xl text-hotel-gold" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Carte de visite</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">Personnalisez les informations puis imprimez ou exportez</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            Cartes/page
            <select
              value={copiesPerPage}
              onChange={e => setCopiesPerPage(Number(e.target.value))}
              className="border border-gray-200 dark:border-gray-700 rounded-lg text-xs px-2 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-amber-500"
            >
              {COPIES_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button onClick={() => window.print()} className="btn-secondary text-sm px-3 py-2 flex items-center gap-1.5">
            <i className="bi bi-printer" /> Imprimer
          </button>
          <button onClick={handleDownloadPng} disabled={exportingPng} className="btn-primary text-sm px-3 py-2 flex items-center gap-1.5 disabled:opacity-50">
            {exportingPng
              ? <i className="bi bi-arrow-repeat animate-spin" />
              : <i className="bi bi-file-earmark-image" />} Télécharger PNG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Formulaire de personnalisation */}
        <div className="card space-y-4 print:hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Informations</h3>
            <button onClick={handleReset} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-medium flex items-center gap-1">
              <i className="bi bi-arrow-counterclockwise" /> Réinitialiser
            </button>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">Modèle</label>
            <div className="grid grid-cols-3 gap-2">
              {CARD_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCard(c => ({ ...c, template: t.id }))}
                  className={`rounded-lg overflow-hidden border-2 transition-colors ${card.template === t.id ? 'border-hotel-gold' : 'border-transparent'}`}
                >
                  <div className="h-10 w-full" style={{ background: t.swatch }} />
                  <div className={`text-[10px] font-medium py-1 text-center ${card.template === t.id ? 'text-hotel-gold bg-amber-50 dark:bg-amber-950/40' : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'}`}>
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">Teinte dorée</label>
            <div className="flex items-center gap-2.5">
              {GOLD_PALETTES.map(g => (
                <button
                  key={g.id}
                  type="button"
                  title={g.label}
                  onClick={() => setCard(c => ({ ...c, goldColor: g.id }))}
                  className={`w-8 h-8 rounded-full transition-transform ${card.goldColor === g.id ? 'ring-2 ring-offset-2 ring-hotel-gold scale-110' : 'hover:scale-105'}`}
                  style={{ background: `linear-gradient(135deg, ${g.light}, ${g.base}, ${g.dark})` }}
                />
              ))}
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">{GOLD_PALETTES.find(g => g.id === card.goldColor)?.label}</span>
            </div>
          </div>

          <FormField label="Nom complet" icon="bi-person">
            <input value={card.fullName} onChange={set('fullName')} placeholder="Jean Dupont" />
          </FormField>
          <FormField label="Poste / fonction" icon="bi-briefcase">
            <input value={card.role} onChange={set('role')} placeholder="Réceptionniste" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Téléphone" icon="bi-telephone">
              <input value={card.phone} onChange={set('phone')} placeholder="07XXXXXXXX" />
            </FormField>
            <FormField label="WhatsApp" icon="bi-whatsapp">
              <input value={card.whatsapp} onChange={set('whatsapp')} placeholder="07XXXXXXXX" />
            </FormField>
          </div>
          <FormField label="Email" icon="bi-envelope">
            <input value={card.email} onChange={set('email')} placeholder="jean@monhotel.ci" />
          </FormField>

          <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">Logo</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800 shrink-0">
                {card.logoUrl
                  ? <img src={mediaUrl(card.logoUrl)} alt="Logo" className="w-full h-full object-contain" />
                  : <i className="bi bi-image text-gray-300 dark:text-gray-600 text-xl" />}
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium flex items-center gap-1">
                  <i className="bi bi-upload" /> Changer le logo
                </button>
                {card.logoUrl && (
                  <button type="button" onClick={handleRemoveLogo}
                    className="text-xs text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium flex items-center gap-1">
                    <i className="bi bi-trash" /> Retirer
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>

          <FormField label="Nom de l'hôtel" icon="bi-building">
            <input value={card.hotelName} onChange={set('hotelName')} placeholder="Mon Hôtel" />
          </FormField>
          <FormField label="Slogan" icon="bi-stars">
            <input value={card.hotelTagline} onChange={set('hotelTagline')} placeholder="L'excellence à votre service" />
          </FormField>
          <FormField label="Adresse" icon="bi-geo-alt">
            <input value={card.address} onChange={set('address')} placeholder="Abidjan, Côte d'Ivoire" />
          </FormField>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
            <button onClick={handleSave} className="btn-primary min-w-[140px] justify-center">
              <i className="bi bi-check-lg" /> Enregistrer
            </button>
          </div>
        </div>

        {/* Aperçu carte — format ID-1 (85,60x53,98mm) à l'échelle écran */}
        <div className="flex items-start justify-center py-6">
          <div ref={cardRef}>
            <BusinessCardPreview card={card} />
          </div>
        </div>
      </div>

      {/* Planche d'impression — rendue hors du layout via portail, plusieurs cartes à taille réelle avec repères de découpe */}
      {createPortal(
        <div id="business-card-print-root">
          {Array.from({ length: copiesPerPage }).map((_, i) => (
            <div key={i} className="business-card-cut">
              <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${PRINT_SCALE})`, transformOrigin: 'top left' }}>
                <BusinessCardPreview card={card} />
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

      <style>{`
        @media screen {
          #business-card-print-root { display: none; }
        }
        @media print {
          body > *:not(#business-card-print-root) { display: none !important; }
          #business-card-print-root {
            display: grid !important;
            grid-template-columns: repeat(2, ${CARD_MM.width}mm);
            justify-content: center;
            gap: 5mm 6mm;
          }
          .business-card-cut {
            width: ${CARD_MM.width}mm;
            height: ${CARD_MM.height}mm;
            overflow: hidden;
            position: relative;
            outline: 0.35mm dashed #999;
            outline-offset: 2.5mm;
            break-inside: avoid;
          }
          #business-card-print-root, #business-card-print-root * {
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  )
}
