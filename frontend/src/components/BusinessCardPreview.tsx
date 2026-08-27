import { CardData, CardTemplate, getGoldPalette } from '../types/businessCard'
import { mediaUrl } from '../utils'

export const CARD_TEMPLATES: { id: CardTemplate; label: string; swatch: string }[] = [
  { id: 'golden',  label: 'Doré',      swatch: 'linear-gradient(135deg,#f3d98b,#c9973a 55%,#8a611c)' },
  { id: 'classic', label: 'Classique', swatch: 'linear-gradient(135deg,#fdf6ee,#f4d4a5)' },
  { id: 'dark',    label: 'Sombre',    swatch: 'linear-gradient(135deg,#3a2e18,#1a1208)' },
]

interface CardProps { card: CardData; initials: string }

// Format ID-1 (ISO/IEC 7810) : taille réelle des cartes d'identité / cartes bancaires,
// aussi le format de carte de visite le plus standard.
export const CARD_MM = { width: 85.6, height: 53.98 }

const CARD_PX_WIDTH = 420
const CARD_PX_HEIGHT = CARD_PX_WIDTH * (CARD_MM.height / CARD_MM.width)
export const CARD_PX = { width: CARD_PX_WIDTH, height: CARD_PX_HEIGHT }

const CARD_SIZE = { width: `${CARD_PX.width}px`, height: `${CARD_PX.height}px` }

function GoldenCard({ card, initials }: CardProps) {
  const g = getGoldPalette(card.goldColor)
  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl p-6 flex flex-col justify-between"
      style={{ ...CARD_SIZE, background: `linear-gradient(135deg, ${g.light} 0%, ${g.base} 50%, ${g.dark} 100%)`, border: '1px solid rgba(255,255,255,0.4)' }}
    >
      <div className="absolute inset-[6px] rounded-lg pointer-events-none" style={{ border: '1px solid rgba(255,255,255,0.35)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 30%)' }} />
      <i className="bi bi-gem absolute -bottom-4 -right-4 text-[9rem] text-white/10 pointer-events-none" />

      <div className="relative flex items-center gap-2.5">
        {card.logoUrl ? (
          <img src={mediaUrl(card.logoUrl)} alt={card.hotelName} className="w-8 h-8 object-contain rounded" />
        ) : (
          <i className="bi bi-award-fill text-hotel-dark text-xl" />
        )}
        <div>
          <div className="font-serif font-bold text-hotel-dark text-sm leading-tight tracking-wide uppercase">{card.hotelName || 'Mon Hôtel'}</div>
          {card.hotelTagline && <div className="text-[9px] italic text-hotel-dark/70 leading-snug">{card.hotelTagline}</div>}
        </div>
      </div>

      <div className="relative">
        <div className="text-2xl font-serif font-bold text-hotel-dark tracking-wide">{card.fullName || initials}</div>
        {card.role && <div className="text-[11px] font-semibold text-hotel-dark/80 uppercase tracking-[0.15em] mt-1">{card.role}</div>}
      </div>

      <div className="relative h-px bg-hotel-dark/30" />

      <div className="relative space-y-1 text-[11px] text-hotel-dark font-medium">
        {card.phone && <div className="flex items-center gap-2"><i className="bi bi-telephone-fill" /> {card.phone}</div>}
        {card.whatsapp && <div className="flex items-center gap-2"><i className="bi bi-whatsapp" /> {card.whatsapp}</div>}
        {card.email && <div className="flex items-center gap-2"><i className="bi bi-envelope-fill" /> {card.email}</div>}
        {card.address && <div className="flex items-center gap-2"><i className="bi bi-geo-alt-fill" /> {card.address}</div>}
      </div>
    </div>
  )
}

function ClassicCard({ card, initials }: CardProps) {
  const g = getGoldPalette(card.goldColor)
  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl p-7 flex flex-col items-center justify-center text-center"
      style={{ ...CARD_SIZE, background: '#fdf6ee', border: `2px solid ${g.base}` }}
    >
      <div className="absolute inset-[5px] rounded-lg pointer-events-none" style={{ border: `1px solid ${g.base}55` }} />

      {card.logoUrl ? (
        <img src={mediaUrl(card.logoUrl)} alt={card.hotelName} className="w-9 h-9 object-contain rounded mb-2" />
      ) : (
        <i className="bi bi-building text-2xl mb-2" style={{ color: g.base }} />
      )}
      <div className="font-serif font-bold text-hotel-dark text-xs uppercase tracking-[0.25em]">{card.hotelName || 'Mon Hôtel'}</div>
      {card.hotelTagline && <div className="text-[9px] italic text-gray-500 mt-0.5">{card.hotelTagline}</div>}

      <div className="flex items-center gap-2 my-4 w-full">
        <div className="h-px flex-1" style={{ background: `${g.base}80` }} />
        <i className="bi bi-gem text-xs" style={{ color: g.base }} />
        <div className="h-px flex-1" style={{ background: `${g.base}80` }} />
      </div>

      <div className="text-2xl font-serif font-bold text-hotel-dark">{card.fullName || initials}</div>
      {card.role && <div className="text-[11px] font-semibold uppercase tracking-[0.15em] mt-1" style={{ color: g.dark }}>{card.role}</div>}

      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-600 font-medium flex-wrap">
        {card.phone && <span className="flex items-center gap-1.5"><i className="bi bi-telephone-fill" style={{ color: g.base }} /> {card.phone}</span>}
        {card.whatsapp && <span className="flex items-center gap-1.5"><i className="bi bi-whatsapp" style={{ color: g.base }} /> {card.whatsapp}</span>}
        {card.email && <span className="flex items-center gap-1.5"><i className="bi bi-envelope-fill" style={{ color: g.base }} /> {card.email}</span>}
      </div>
      {card.address && <div className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1.5"><i className="bi bi-geo-alt-fill" style={{ color: g.base }} /> {card.address}</div>}
    </div>
  )
}

function DarkCard({ card, initials }: CardProps) {
  const g = getGoldPalette(card.goldColor)
  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl flex"
      style={{ ...CARD_SIZE, background: '#1a1208' }}
    >
      <div className="w-2 shrink-0 h-full" style={{ background: `linear-gradient(180deg, ${g.light}, ${g.base}, ${g.dark})` }} />
      <div className="relative flex-1 p-6 flex flex-col justify-between">
        <i className="bi bi-gem absolute -top-6 -right-6 text-[9rem] text-white/5 pointer-events-none" />

        <div className="relative flex items-center gap-2.5">
          {card.logoUrl ? (
            <img src={mediaUrl(card.logoUrl)} alt={card.hotelName} className="w-8 h-8 object-contain rounded" />
          ) : (
            <i className="bi bi-award-fill text-xl" style={{ color: g.base }} />
          )}
          <div>
            <div className="font-semibold text-xs leading-tight tracking-[0.2em] uppercase" style={{ color: g.base }}>{card.hotelName || 'Mon Hôtel'}</div>
            {card.hotelTagline && <div className="text-[9px] italic text-white/50 leading-snug">{card.hotelTagline}</div>}
          </div>
        </div>

        <div className="relative">
          <div className="text-2xl font-bold text-white tracking-wide">{card.fullName || initials}</div>
          {card.role && <div className="text-[11px] font-semibold uppercase tracking-[0.15em] mt-1" style={{ color: g.base }}>{card.role}</div>}
        </div>

        <div className="relative h-px bg-white/15" />

        <div className="relative space-y-1 text-[11px] text-white/80 font-medium">
          {card.phone && <div className="flex items-center gap-2"><i className="bi bi-telephone-fill" style={{ color: g.base }} /> {card.phone}</div>}
          {card.whatsapp && <div className="flex items-center gap-2"><i className="bi bi-whatsapp" style={{ color: g.base }} /> {card.whatsapp}</div>}
          {card.email && <div className="flex items-center gap-2"><i className="bi bi-envelope-fill" style={{ color: g.base }} /> {card.email}</div>}
          {card.address && <div className="flex items-center gap-2"><i className="bi bi-geo-alt-fill" style={{ color: g.base }} /> {card.address}</div>}
        </div>
      </div>
    </div>
  )
}

export default function BusinessCardPreview({ card }: { card: CardData }) {
  const initials = card.fullName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  if (card.template === 'classic') return <ClassicCard card={card} initials={initials} />
  if (card.template === 'dark') return <DarkCard card={card} initials={initials} />
  return <GoldenCard card={card} initials={initials} />
}
