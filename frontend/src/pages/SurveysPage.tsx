import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { satisfactionApi, Survey, SurveyStats } from '../api/satisfaction'
import { getApiError, formatDate } from '../utils'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import { SkeletonCards } from '../components/Skeleton'

function Stars({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300 text-xs">—</span>
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <i key={i} className={`bi bi-star${i <= Math.round(score) ? '-fill' : ''} text-amber-400 text-xs`} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{score.toFixed(1)}</span>
    </span>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value ? (value / 5) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{value?.toFixed(1) ?? '—'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full bg-hotel-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function SurveysPage() {
  const [surveys, setSurveys]   = useState<Survey[]>([])
  const [stats, setStats]       = useState<SurveyStats | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      satisfactionApi.list({ page: String(page) }),
      satisfactionApi.stats(),
    ])
      .then(([s, st]) => {
        setSurveys(s.results)
        setTotal(s.count)
        setStats(st)
      })
      .catch(err => toast.error(getApiError(err)))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(load, [load])

  const handleSend = async (id: number) => {
    try {
      await satisfactionApi.sendSurvey(id)
      toast.success('Email envoyé')
      load()
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const handleRemind = async (id: number) => {
    try {
      await satisfactionApi.sendReminder(id)
      toast.success('Rappel envoyé')
      load()
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const SCORE_LABELS: Record<string, string> = {
    overall: 'Note globale',
    cleanliness: 'Propreté',
    service: 'Service',
    comfort: 'Confort',
    value: 'Rapport qualité/prix',
  }

  return (
    <div className="p-4">
      <PageHeader>
        <p className="text-sm text-gray-700 font-medium">Questionnaires post-séjour</p>
      </PageHeader>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-hotel-gold">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">Réponses reçues</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
            <p className="text-xs text-gray-400 mt-1">En attente</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-hotel-gold">
              {stats.scores.overall?.toFixed(1) ?? '—'}
              <span className="text-sm text-gray-400">/5</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Note globale moy.</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-emerald-600">
              {stats.would_return_pct !== null ? `${stats.would_return_pct}%` : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Reviendraient</p>
          </div>
        </div>
      )}

      {/* Score bars */}
      {stats && stats.total > 0 && (
        <div className="card mb-4">
          <h3 className="font-semibold text-gray-900 mb-4">Scores moyens par critère</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(SCORE_LABELS).map(([key, label]) => (
              <ScoreBar key={key} label={label} value={stats.scores[key as keyof typeof stats.scores]} />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonCards count={4} />
      ) : surveys.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <i className="bi bi-emoji-smile text-4xl" />
          <p className="mt-2 font-medium">Aucun questionnaire</p>
          <p className="text-sm">Ils sont créés automatiquement après chaque check-out.</p>
        </div>
      ) : (
        <div>
        <div className="space-y-3">
          {surveys.map(s => (
            <div key={s.id} className="card">
              <div className="flex items-center gap-4">
                {/* Status indicator */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.is_submitted ? 'bg-green-100' : 'bg-amber-50'}`}>
                  <i className={`bi bi-${s.is_submitted ? 'check-circle-fill text-green-600' : 'hourglass-split text-amber-500'} text-lg`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{s.client_name}</p>
                    <span className="text-xs text-gray-400 font-mono">{s.booking_ref}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_submitted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.is_submitted ? 'Répondu' : 'En attente'}
                    </span>
                    {s.is_submitted && s.comment && s.score_overall !== null && s.score_overall >= 4 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-hotel-gold/10 text-hotel-gold border border-hotel-gold/20 flex items-center gap-1">
                        <i className="bi bi-house-fill text-[10px]" /> Accueil
                      </span>
                    )}
                  </div>
                  {s.is_submitted ? (
                    <div className="mt-1">
                      <Stars score={s.average_score} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-500">Envoyé le {formatDate(s.created_at)}</p>
                      {s.reminder_sent_at && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                          <i className="bi bi-bell-fill me-1" />Rappel {formatDate(s.reminder_sent_at)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!s.is_submitted && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSend(s.id)}
                        title="Renvoyer le questionnaire"
                        className="text-xs px-3 py-1.5 bg-hotel-gold text-white rounded-lg hover:brightness-110 transition font-medium"
                      >
                        <i className="bi bi-envelope me-1" />Envoyer
                      </button>
                      <button
                        onClick={() => handleRemind(s.id)}
                        title="Envoyer un rappel"
                        className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                      >
                        <i className="bi bi-bell me-1" />Rappel
                      </button>
                    </div>
                  )}
                  {s.is_submitted && (
                    <button
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                    >
                      <i className={`bi bi-chevron-${expanded === s.id ? 'up' : 'down'} me-1`} />
                      Détails
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expanded === s.id && s.is_submitted && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                    {[
                      ['Note globale',     s.score_overall],
                      ['Propreté',         s.score_cleanliness],
                      ['Service',          s.score_service],
                      ['Confort',          s.score_comfort],
                      ['Qualité/prix',     s.score_value],
                    ].map(([label, score]) => (
                      <div key={String(label)} className="text-center">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <Stars score={score as number | null} />
                      </div>
                    ))}
                  </div>
                  {s.comment && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-1">Commentaire</p>
                      <p className="text-sm text-gray-700 italic">"{s.comment}"</p>
                    </div>
                  )}
                  {s.would_return !== null && (
                    <p className={`mt-2 text-sm font-medium flex items-center gap-1 ${s.would_return ? 'text-green-600' : 'text-red-500'}`}>
                      <i className={`bi bi-${s.would_return ? 'check-circle-fill' : 'x-circle-fill'}`} />
                      {s.would_return ? 'Reviendrait' : 'Ne reviendrait pas'}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <Pagination page={page} total={total} onChange={setPage} />
        </div>
      )}
    </div>
  )
}
