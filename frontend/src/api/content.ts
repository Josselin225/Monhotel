import api from './client'

export interface HotelInfo {
  name: string; tagline?: string; logo_url?: string
  location: string; address: string; city: string
  phone: string; email: string; stars: number; since: string
  lat?: number; lng?: number
  google_review_url?: string; tripadvisor_review_url?: string
  bank_name?: string; bank_account_holder?: string; bank_iban?: string; bank_bic?: string
}
export interface HeroContent {
  eyebrow: string; title1: string; title2: string; subtitle: string; image: string
}
export interface Stat { value: string; label: string }
export interface RoomItem {
  name: string; price: string; badge: string; features: string[]; image: string
}
export interface ServiceItem {
  icon: string; title: string; desc: string; image: string
}
export interface GalleryItem { image: string; label: string }
export interface VideoContent { url: string; title: string }
export interface Testimonial { author: string; role: string; text: string }
export interface CtaContent { title: string; subtitle: string; button_text: string }
export interface FooterContent {
  about: string; schedule_week: string; schedule_weekend: string
  checkin: string; checkout: string
}
export interface EmergencyContact {
  name: string; phone: string; email: string; whatsapp: string
}

export interface SiteContent {
  hotel: HotelInfo
  hero: HeroContent
  stats: Stat[]
  rooms: RoomItem[]
  services: ServiceItem[]
  gallery: GalleryItem[]
  video: VideoContent
  testimonials: Testimonial[]
  cta: CtaContent
  footer: FooterContent
  emergency_contact: EmergencyContact
}

export const getContent = (): Promise<SiteContent> =>
  api.get('/content/').then((r: { data: SiteContent }) => r.data)

export const updateContent = (data: Partial<SiteContent>): Promise<SiteContent> =>
  api.put('/content/', data).then((r: { data: SiteContent }) => r.data)

export const uploadContentImage = (file: File): Promise<string> => {
  const form = new FormData()
  form.append('image', file)
  return api.post('/content/image/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r: { data: { image_url: string } }) => r.data.image_url)
}

export const uploadLogo = (file: File): Promise<string> => {
  const form = new FormData()
  form.append('logo', file)
  return api.post('/content/logo/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r: { data: { logo_url: string } }) => r.data.logo_url)
}

export const removeLogo = (): Promise<void> =>
  api.delete('/content/logo/')

export const uploadContentVideo = (file: File): Promise<string> => {
  const form = new FormData()
  form.append('video', file)
  return api.post('/content/video/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r: { data: { video_url: string } }) => r.data.video_url)
}

export const removeContentVideo = (): Promise<void> =>
  api.delete('/content/video/')
