interface EmptyStateProps {
  icon?:    React.ReactNode
  title:    string
  message?: string
  action?:  { label: string; onClick: () => void }
}

export default function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="card p-10 text-center">
      {icon && (
        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-slate-400">{icon}</span>
        </div>
      )}
      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{title}</p>
      {message && <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{message}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mx-auto">{action.label}</button>
      )}
    </div>
  )
}
