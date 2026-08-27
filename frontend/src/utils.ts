// ── Formatage monétaire ────────────────────────────────────────────────────────

const CURRENCY_META: Record<string, { symbol: string; prefix: boolean; decimals: number }> = {
  XOF: { symbol: 'FCFA', prefix: false, decimals: 0 },
  EUR: { symbol: '€',    prefix: true,  decimals: 2 },
  USD: { symbol: '$',    prefix: true,  decimals: 2 },
  GBP: { symbol: '£',   prefix: true,  decimals: 2 },
}

// Variables module — mises à jour par Layout via setActive*()
let _currency = 'XOF'
let _rates: Record<string, number> = { EUR: 655.957, USD: 620, GBP: 790 }

export function setActiveCurrency(c: string)              { _currency = c }
export function setActiveRates(r: Record<string, number>) { _rates = r }
export function getActiveCurrency(): string               { return _currency }

export function getCurrencyLabel(): string {
  return CURRENCY_META[_currency]?.symbol ?? _currency
}

// Convertit un montant XOF vers la devise active
function convertFromXOF(xof: number): number {
  if (_currency === 'XOF') return xof
  const rate = _rates[_currency]
  return rate ? xof / rate : xof
}

function applySymbol(formatted: string): string {
  const meta = CURRENCY_META[_currency] ?? { symbol: _currency, prefix: false }
  return meta.prefix ? meta.symbol + ' ' + formatted : formatted + ' ' + meta.symbol
}

export function formatFcfa(n: number | string): string {
  const converted = convertFromXOF(Number(n))
  const meta = CURRENCY_META[_currency] ?? { decimals: 0 }
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(converted)
  return applySymbol(formatted)
}

export function formatFcfaShort(n: number): string {
  const converted = convertFromXOF(n)
  const meta = CURRENCY_META[_currency] ?? { decimals: 0 }
  // Pour les devises à préfixe (€, $) on garde le format compact international
  if (meta.prefix) {
    if (Math.abs(converted) >= 1_000_000)
      return applySymbol((converted / 1_000_000).toFixed(1) + 'M')
    if (Math.abs(converted) >= 1_000)
      return applySymbol((converted / 1_000).toFixed(1) + 'k')
    return applySymbol(String(Math.round(converted)))
  }
  // Pour le FCFA : format local — nombre entier espacé + symbole
  if (Math.abs(converted) >= 1_000_000)
    return applySymbol((converted / 1_000_000).toFixed(1).replace('.', ',') + ' M')
  return formatFcfa(n)
}

export function formatFcfaShort_(n: number): string { return formatFcfaShort(n) }

// ── Formatage dates ────────────────────────────────────────────────────────────

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Couleurs statuts ───────────────────────────────────────────────────────────

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed:  'bg-blue-100   text-blue-700   border-blue-200',
  checked_in: 'bg-green-100  text-green-700  border-green-200',
  checked_out:'bg-gray-100   text-gray-600   border-gray-200',
  cancelled:  'bg-red-100    text-red-700    border-red-200',
  no_show:    'bg-orange-100 text-orange-700 border-orange-200',
}

export const ROOM_STATUS_COLORS: Record<string, string> = {
  available:   'bg-green-100  text-green-700  border-green-200',
  occupied:    'bg-red-100    text-red-700    border-red-200',
  maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cleaning:    'bg-blue-100   text-blue-700   border-blue-200',
}

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100   text-gray-600   border-gray-200',
  issued:    'bg-blue-100   text-blue-700   border-blue-200',
  paid:      'bg-green-100  text-green-700  border-green-200',
  cancelled: 'bg-red-100    text-red-700    border-red-200',
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending:    'En attente',
  confirmed:  'Confirmée',
  checked_in: 'En cours',
  checked_out:'Terminée',
  cancelled:  'Annulée',
  no_show:    'No show',
}

export const ROOM_STATUS_LABELS: Record<string, string> = {
  available:   'Disponible',
  occupied:    'Occupée',
  maintenance: 'Maintenance',
  cleaning:    'Nettoyage',
}

// ── Export CSV ────────────────────────────────────────────────────────────────

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(';'),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h]
        const str = val == null ? '' : String(val)
        return str.includes(';') || str.includes('\n') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(';')
    ),
  ].join('\n')

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Erreur API ────────────────────────────────────────────────────────────────

/** Transforme une URL media Django en chemin relatif proxy-able (fonctionne via ngrok et en production). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  // data URI ou blob : retourne tel quel
  if (path.startsWith('data:') || path.startsWith('blob:')) return path
  // URL absolue (http/https) : extrait le chemin pour passer par le proxy Vite
  if (path.startsWith('http')) {
    try { return new URL(path).pathname } catch { return path }
  }
  // Chemin relatif déjà correct
  return path
}

export function getApiError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Une erreur est survenue.'
  const e = err as { response?: { data?: Record<string, unknown> | string } }
  const data = e.response?.data
  if (!data) return 'Erreur réseau. Vérifiez votre connexion.'
  if (typeof data === 'string') return data
  const messages: string[] = []
  for (const [key, val] of Object.entries(data)) {
    const label = key === 'non_field_errors' || key === 'detail' ? '' : `${key}: `
    if (Array.isArray(val)) messages.push(label + val.join(', '))
    else messages.push(label + String(val))
  }
  return messages.join(' | ') || 'Une erreur est survenue.'
}
