interface StatCardProps {
  label:    string
  value:    string | number
  sub?:     string
  loading?: boolean
  onClick?: () => void
}

export default function StatCard({ label, value, sub, loading, onClick }: StatCardProps) {
  return (
    <button onClick={onClick} className="card p-4 text-left hover:shadow-card-hover active:scale-[0.98] transition-all w-full">
      {loading ? (
        <div className="h-7 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mb-1" />
      ) : (
        <p className="text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">{value}</p>
      )}
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </button>
  )
}
