export default function Button({ variant = 'primary', icon: Icon, children, ...props }) {
  return (
    <button className={variant === 'primary' ? 'btn btn-primary' : 'btn btn-ghost'} {...props}>
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  )
}
