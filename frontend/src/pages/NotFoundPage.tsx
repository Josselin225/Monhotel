import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col items-center justify-center p-6 text-center">
      <svg width="80" height="80" viewBox="0 0 64 64" fill="none" className="mb-6 opacity-80">
        <rect width="64" height="64" rx="14" fill="#b8860b"/>
        <circle cx="32" cy="32" r="22" fill="none" stroke="#ffd700" strokeWidth="1.5"/>
        <path d="M16 43 L16 28 L22 34 L32 20 L42 34 L48 28 L48 43 Z" fill="#ffd700"/>
        <rect x="16" y="43" width="32" height="4" rx="2" fill="#ffd700"/>
      </svg>

      <h1 className="text-8xl font-bold text-gray-200 leading-none select-none">404</h1>
      <h2 className="text-2xl font-bold text-gray-900 mt-2">Page introuvable</h2>
      <p className="text-gray-500 mt-2 max-w-sm">
        Cette page n'existe pas ou a été déplacée.
      </p>

      <div className="flex gap-3 mt-8">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ← Retour
        </button>
        <button
          onClick={() => navigate(user ? '/app' : '/')}
          className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          {user ? 'Tableau de bord' : 'Accueil'}
        </button>
      </div>
    </div>
  )
}
