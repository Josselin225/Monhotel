// Composants squelette réutilisables — remplacent les spinners lors du chargement des données

function S({ className }: { className: string }) {
  return <div className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
}

// ─── Briques de base ───────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <S className="h-3 w-20" />
      <S className="h-8 w-28" />
      <S className="h-2.5 w-16" />
    </div>
  )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  const ws = ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-20', 'w-14', 'w-24']
  return (
    <tr className="border-b border-gray-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <S className={`h-3.5 ${ws[i % ws.length]}`} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTable({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  const ws = ['w-20', 'w-28', 'w-16', 'w-24', 'w-16', 'w-20', 'w-14', 'w-18']
  return (
    <div className="card overflow-hidden">
      {/* En-tête table */}
      <div className="flex gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <S key={i} className={`h-3 ${ws[i % ws.length]}`} />
        ))}
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonChart({ height = 180 }: { height?: number }) {
  return (
    <div className="card p-4">
      <S className="h-5 w-44 mb-4" />
      <div className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" style={{ height }} />
    </div>
  )
}

export function SkeletonRoomCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex justify-between items-start">
        <S className="h-6 w-10" />
        <S className="h-5 w-16 rounded-full" />
      </div>
      <S className="h-4 w-24" />
      <S className="h-4 w-20" />
      <div className="flex gap-2 pt-1">
        <S className="h-8 flex-1 rounded-lg" />
        <S className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Modèles de pages entières ─────────────────────────────────────────────

export function SkeletonDashboard() {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="card p-4 flex justify-between items-start">
        <div className="space-y-2">
          <S className="h-3 w-32" />
          <S className="h-7 w-48" />
        </div>
        <S className="h-9 w-32 rounded-lg" />
      </div>
      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><SkeletonChart height={200} /></div>
        <SkeletonChart height={200} />
      </div>
      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SkeletonChart height={160} />
        <div className="card p-4 space-y-3">
          <S className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <S className="h-4 w-32" />
              <S className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonTablePage({ cardCount = 4, rows = 8, cols = 6, withToolbar = true }: {
  cardCount?: number; rows?: number; cols?: number; withToolbar?: boolean
}) {
  return (
    <div className="p-4 space-y-4">
      {withToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <S className="h-9 w-56 rounded-lg" />
            <S className="h-9 w-32 rounded-lg" />
            <S className="h-9 w-32 rounded-lg" />
          </div>
          <S className="h-9 w-36 rounded-lg" />
        </div>
      )}
      {cardCount > 0 && (
        <div className={`grid grid-cols-2 lg:grid-cols-${cardCount} gap-4`}>
          {Array.from({ length: cardCount }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      <SkeletonTable rows={rows} cols={cols} />
    </div>
  )
}

export function SkeletonRoomsGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <S className="h-9 w-48 rounded-lg" />
          <S className="h-9 w-28 rounded-lg" />
        </div>
        <S className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => <SkeletonRoomCard key={i} />)}
      </div>
    </div>
  )
}

export function SkeletonAnalytics() {
  return (
    <div className="p-4 space-y-4">
      {/* KPI cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      {/* Main chart */}
      <SkeletonChart height={220} />
      {/* Two smaller charts side by side */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SkeletonChart height={180} />
        <SkeletonChart height={180} />
      </div>
      {/* Bottom charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <SkeletonChart height={160} />
        <SkeletonChart height={160} />
        <SkeletonChart height={160} />
      </div>
    </div>
  )
}

export function SkeletonContent() {
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <S className="h-7 w-72" />
          <S className="h-4 w-96" />
        </div>
        <S className="h-9 w-28 rounded-lg" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-4">
          <S className="h-5 w-40" />
          <div className="space-y-3">
            <S className="h-4 w-28" />
            <S className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-3">
            <S className="h-4 w-28" />
            <S className="h-24 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
