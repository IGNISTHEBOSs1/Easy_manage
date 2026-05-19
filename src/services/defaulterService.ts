import type { Fee, Payment } from '../lib/supabase'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface DefaulterData {
  isOverdue:       boolean
  remainingAmount: number
  daysLate:        number
  riskLevel:       RiskLevel
}

interface FeeInput {
  id:           string
  total_amount: number
  status:       Fee['status']
  due_date:     string
  payments?:    Pick<Payment, 'amount'>[]
  paid_amount?: number
}

function getPaidAmount(fee: FeeInput): number {
  if (fee.payments && fee.payments.length > 0) {
    return fee.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  }
  return Number(fee.paid_amount ?? 0)
}

function getRiskLevel(daysLate: number): RiskLevel {
  if (daysLate >= 30) return 'high'
  if (daysLate >= 10) return 'medium'
  return 'low'
}

function getDaysLate(dueDate: Date, today: Date): number {
  const ms = today.getTime() - dueDate.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function getDefaulterData(fee: FeeInput, today: Date): DefaulterData {
  const totalAmount = Number(fee.total_amount)
  const paidAmount  = getPaidAmount(fee)
  const remaining   = Math.max(totalAmount - paidAmount, 0)

  if (remaining <= 0) {
    return { isOverdue: false, remainingAmount: 0, daysLate: 0, riskLevel: 'low' }
  }

  const dueDate   = new Date(fee.due_date)
  const isOverdue = dueDate < today

  if (!isOverdue) {
    return { isOverdue: false, remainingAmount: remaining, daysLate: 0, riskLevel: 'low' }
  }

  const daysLate = getDaysLate(dueDate, today)
  return { isOverdue: true, remainingAmount: remaining, daysLate, riskLevel: getRiskLevel(daysLate) }
}

export function processDefaulters(
  fees: FeeInput[],
  today: Date = new Date(),
): Array<{ feeId: string; data: DefaulterData }> {
  const overdue: Array<{ feeId: string; data: DefaulterData }> = []
  for (const fee of fees) {
    const data = getDefaulterData(fee, today)
    if (data.isOverdue) overdue.push({ feeId: fee.id, data })
  }
  return overdue.sort((a, b) => b.data.daysLate - a.data.daysLate)
}
