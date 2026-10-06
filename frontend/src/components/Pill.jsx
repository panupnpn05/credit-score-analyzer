const VARIANTS = { success: 'pill pill-success', warning: 'pill pill-warning', danger: 'pill pill-danger' }

export default function Pill({ variant = 'success', icon: Icon, children }) {
  return (
    <span className={VARIANTS[variant] || VARIANTS.success}>
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {children}
    </span>
  )
}
