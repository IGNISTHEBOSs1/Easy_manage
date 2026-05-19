import type { Fee, Expense, Payment } from '../lib/supabase'

export interface FinanceSummary {
  revenue:  number
  expenses: number
  profit:   number
}

interface FeeInput {
  status:       Fee['status']
  total_amount: number
  payments?:    Pick<Payment, 'amount'>[]
  paid_amount?: number
}

interface ExpenseInput {
  amount: number
  date?:  string
}

function resolveActualPaid(fee: FeeInput): number {
  if (fee.payments && fee.payments.length > 0) {
    return fee.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  }
  if (fee.paid_amount !== undefined) {
    return Number(fee.paid_amount)
  }
  return 0
}

export function filterByMonth<T extends { date?: string }>(
  data: T[],
  selectedMonth?: string,
): T[] {
  if (!selectedMonth) return data
  return data.filter(item => item.date?.startsWith(selectedMonth))
}

export function calculateFinance(
  fees:           FeeInput[],
  expenses:       ExpenseInput[],
  selectedMonth?: string,
): FinanceSummary {
  const filteredExpenses = filterByMonth(
    expenses as Array<ExpenseInput & { date?: string }>,
    selectedMonth,
  )
  let revenue = 0
  for (const fee of fees) revenue += resolveActualPaid(fee)

  let totalExpenses = 0
  for (const exp of filteredExpenses) totalExpenses += Number(exp.amount)

  return {
    revenue:  Math.round(revenue * 100) / 100,
    expenses: Math.round(totalExpenses * 100) / 100,
    profit:   Math.round((revenue - totalExpenses) * 100) / 100,
  }
}
