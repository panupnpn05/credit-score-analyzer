import Button from './Button.jsx'

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionIcon: ActionIcon, onAction }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={48} strokeWidth={1.25} />}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" icon={ActionIcon} onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}
