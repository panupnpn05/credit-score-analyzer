export function SkeletonCard() {
  return <div className="skeleton skeleton-card enter" />
}

export function SkeletonLines({ n = 4 }) {
  return (
    <div>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}
