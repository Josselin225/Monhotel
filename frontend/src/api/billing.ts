import api from './client'
import { Invoice, InvoiceStats, Payment, PaginatedResponse } from '../types'

export const billingApi = {
  list: async (params?: Record<string, string>) => {
    const { data } = await api.get<PaginatedResponse<Invoice>>('/invoices/', { params })
    return data
  },
  get: async (id: number) => {
    const { data } = await api.get<Invoice>(`/invoices/${id}/`)
    return data
  },
  create: async (payload: Partial<Invoice>) => {
    const { data } = await api.post<Invoice>('/invoices/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Invoice>) => {
    const { data } = await api.patch<Invoice>(`/invoices/${id}/`, payload)
    return data
  },
  issue: async (id: number) => {
    const { data } = await api.post<Invoice>(`/invoices/${id}/issue/`)
    return data
  },
  markPaid: async (id: number, payment_method: string) => {
    const { data } = await api.post<Invoice>(`/invoices/${id}/mark_paid/`, { payment_method })
    return data
  },
  stats: async (): Promise<InvoiceStats> => {
    const { data } = await api.get('/invoices/stats/')
    return data
  },
  monthlyRevenue: async (): Promise<{ month: string; year: number; revenue: number }[]> => {
    const { data } = await api.get('/invoices/monthly_revenue/')
    return data
  },
  listPayments: async (invoiceId: number): Promise<{ payments: Payment[]; total_paid: number; balance: number }> => {
    const { data } = await api.get(`/invoices/${invoiceId}/payments/`)
    return data
  },
  addPayment: async (
    invoiceId: number,
    payload: { amount: number; method: string; reference?: string; note?: string },
  ): Promise<Payment> => {
    const { data } = await api.post(`/invoices/${invoiceId}/add_payment/`, payload)
    return data
  },
}
