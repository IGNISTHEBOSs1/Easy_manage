interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: 'indigo' | 'amber' | 'red' | 'emerald'
  loading?: boolean
  onClick?: () => void
  hint?: string
}

const colorMap = {
  indigo:  { bg: 'bg-brand-50',   icon: 'bg-brand-600',   text: 'text-brand-700',  value: 'text-brand-900'  },
  amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-500',   text: 'text-amber-700',  value: 'text-amber-900'  },
  red:     { bg: 'bg-red-50',     icon: 'bg-red-500',     text: 'text-red-700',    value: 'text-red-900'    },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-600', text: 'text-emerald-700',value: 'text-emerald-900'},
}

export default function StatCard({ label, value, icon, color, loading, onClick, hint }: StatCardProps) {
  const c = colorMap[color]
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      className={`card p-4 text-left transition-all duration-200 w-full ${onClick ? 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 ${c.icon} rounded-xl flex items-center justify-center text-white shrink-0`}>
          {icon}
        </div>
        {hint && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${c.bg} ${c.text} shrink-0`}>
            {hint}
          </span>
        )}
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-7 w-16 bg-slate-100 rounded-lg animate-pulse mb-1" />
        ) : (
          <p className={`text-2xl font-bold leading-none ${c.value} tracking-tight`}>{value}</p>
        )}
        <p className="text-xs text-slate-500 font-medium mt-1">{label}</p>
      </div>
    </Tag>
  )
}
