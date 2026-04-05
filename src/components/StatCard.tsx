interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  accent?: 'navy' | 'amber' | 'red' | 'emerald'
  loading?: boolean
}

const accentMap = {
  navy:    'bg-navy-50 text-navy-700',
  amber:   'bg-amber-50 text-amber-600',
  red:     'bg-red-50 text-red-500',
  emerald: 'bg-emerald-50 text-emerald-600',
}

export default function StatCard({ label, value, icon, accent = 'navy', loading }: StatCardProps) {
  return (
    <div className="card p-4 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentMap[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-6 w-16 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-navy-900 mt-0.5 leading-none">{value}</p>
        )}
      </div>
    </div>
  )
}
