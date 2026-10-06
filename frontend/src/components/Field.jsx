import { Info } from 'lucide-react'

export default function Field({ label, hint, tip, children }) {
  return (
    <div className="field">
      <label>
        {label}
        {hint && <span className="hint"> ({hint})</span>}
        {tip && (
          <span className="tip" tabIndex={0} data-tip={tip} aria-label={`About ${label}`}>
            <Info size={12} strokeWidth={2.25} aria-hidden="true" />
          </span>
        )}
      </label>
      {children}
    </div>
  )
}
