import api from './client'
import { PaginatedResponse } from '../types'

export interface InventoryCategory {
  id: number
  name: string
  icon: string
  items_count: number
  created_at: string
}

export interface InventoryItem {
  id: number
  name: string
  category: number | null
  category_name: string | null
  category_icon: string | null
  unit: string
  unit_display: string
  quantity_on_hand: string
  reorder_threshold: string
  unit_cost: string
  notes: string
  is_active: boolean
  is_low_stock: boolean
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: number
  reference: string
  item: number | null
  item_name: string | null
  item_unit: string | null
  movement_type: 'in' | 'out' | 'adjustment' | 'loss'
  movement_type_display: string
  quantity: string
  room: number | null
  room_number: string | null
  reason: string
  created_by: number | null
  created_by_name: string | null
  created_at: string
}

export interface InventoryStats {
  total_items: number
  low_stock_count: number
  total_value: number
}

export const inventoryApi = {
  listCategories: async (): Promise<InventoryCategory[]> => {
    const { data } = await api.get('/inventory/categories/', { params: { page_size: '200' } })
    return data.results ?? data
  },
  createCategory: async (payload: { name: string; icon?: string }) => {
    const { data } = await api.post<InventoryCategory>('/inventory/categories/', payload)
    return data
  },
  deleteCategory: async (id: number) => api.delete(`/inventory/categories/${id}/`),

  listItems: async (params: Record<string, string> = {}) => {
    const { data } = await api.get<PaginatedResponse<InventoryItem>>('/inventory/items/', { params })
    return data
  },
  createItem: async (payload: Partial<InventoryItem>) => {
    const { data } = await api.post<InventoryItem>('/inventory/items/', payload)
    return data
  },
  updateItem: async (id: number, payload: Partial<InventoryItem>) => {
    const { data } = await api.patch<InventoryItem>(`/inventory/items/${id}/`, payload)
    return data
  },
  deleteItem: async (id: number) => api.delete(`/inventory/items/${id}/`),
  lowStock: async (): Promise<InventoryItem[]> => {
    const { data } = await api.get('/inventory/items/low_stock/')
    return data
  },
  stats: async (): Promise<InventoryStats> => {
    const { data } = await api.get('/inventory/items/stats/')
    return data
  },
  listMovements: async (params: Record<string, string> = {}) => {
    const { data } = await api.get<PaginatedResponse<InventoryMovement>>('/inventory/movements/', { params })
    return data
  },
  createMovement: async (payload: { item: number; movement_type: string; quantity: number; room?: number; reason?: string }) => {
    const { data } = await api.post<InventoryMovement>('/inventory/movements/', payload)
    return data
  },
}
