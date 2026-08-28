import api from './client'
import { User } from '../types'

export interface UserPayload {
  username: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  is_active?: boolean
  password?: string
}

export const usersApi = {
  list: async (): Promise<User[]> => {
    const { data } = await api.get('/users/')
    return Array.isArray(data) ? data : data.results
  },

  update: async (id: number, payload: Partial<UserPayload>): Promise<User> => {
    const { data } = await api.patch(`/users/${id}/`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}/`)
  },
}
