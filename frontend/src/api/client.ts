import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // Envoie les cookies HttpOnly automatiquement
})

// Plus d'injection manuelle de token — les cookies sont gérés par le navigateur

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // Ne pas tenter de refresh pour /auth/me/ (c'est un simple check d'état)
    // ni pour /auth/refresh/ lui-même (évite la boucle infinie)
    const url: string = original?.url ?? ''
    const isAuthCheck = url.includes('/auth/me/') || url.includes('/auth/refresh/')

    if (error.response?.status === 401 && !original._retry && !isAuthCheck) {
      original._retry = true
      try {
        await axios.post('/api/auth/refresh/', {}, { withCredentials: true })
        return api(original)
      } catch {
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
