interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>}
    </div>
  )
}
