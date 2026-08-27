export type CardTemplate = 'golden' | 'classic' | 'dark'
export type GoldColorId = 'gold' | 'rose' | 'champagne' | 'bronze' | 'green'

export interface GoldPalette {
  id: GoldColorId
  label: string
  light: string
  base: string
  dark: string
}

export const GOLD_PALETTES: GoldPalette[] = [
  { id: 'gold',      label: 'Or classique', light: '#f3d98b', base: '#c9973a', dark: '#8a611c' },
  { id: 'rose',      label: 'Or rose',      light: '#f0cfc8', base: '#c98a7a', dark: '#8a4f42' },
  { id: 'champagne', label: 'Champagne',    light: '#f7eccb', base: '#d4b96a', dark: '#a3823a' },
  { id: 'bronze',    label: 'Bronze',       light: '#e0b080', base: '#b87333', dark: '#7a4a1e' },
  { id: 'green',     label: 'Or vert',      light: '#e8e6b0', base: '#a8a05a', dark: '#6e6a35' },
]

export function getGoldPalette(id: GoldColorId): GoldPalette {
  return GOLD_PALETTES.find(p => p.id === id) ?? GOLD_PALETTES[0]
}

export interface CardData {
  template: CardTemplate
  goldColor: GoldColorId
  hotelName: string
  hotelTagline: string
  fullName: string
  role: string
  phone: string
  whatsapp: string
  email: string
  address: string
  logoUrl: string
}
