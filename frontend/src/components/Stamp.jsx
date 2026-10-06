const TONES = {
  stamp: '',
  ok: ' stamp-ok',
  warn: ' stamp-warn',
  bad: ' stamp-bad',
  ink: ' stamp-ink',
}

/** A rubber-stamp mark — the logbook's unit of record. */
export default function Stamp({ tone = 'stamp', large = false, children, className = '' }) {
  return <span className={`stamp${TONES[tone] || ''}${large ? ' stamp-lg' : ''} ${className}`}>{children}</span>
}
