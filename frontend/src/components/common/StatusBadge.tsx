import clsx from 'clsx'
import { JobStatus } from '@/types'

type StatusVariant =
  | 'draft'
  | 'active'
  | 'in_production'
  | 'completed'
  | 'on_hold'
  | 'cancelled'
  | 'pending'
  | 'running'
  | 'failed'
  | 'queued'
  | 'success'
  | 'warning'
  | 'error'

const variantStyles: Record<StatusVariant, string> = {
  draft: 'bg-gray-700 text-gray-300',
  active: 'bg-blue-900/60 text-blue-300 border border-blue-700/50',
  in_production: 'bg-orange-900/60 text-orange-300 border border-orange-700/50',
  completed: 'bg-green-900/60 text-green-300 border border-green-700/50',
  on_hold: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50',
  cancelled: 'bg-red-900/60 text-red-400 border border-red-800/50',
  pending: 'bg-gray-700 text-gray-300',
  running: 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/50',
  failed: 'bg-red-900/60 text-red-400 border border-red-800/50',
  queued: 'bg-purple-900/60 text-purple-300 border border-purple-700/50',
  success: 'bg-green-900/60 text-green-300 border border-green-700/50',
  warning: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50',
  error: 'bg-red-900/60 text-red-400 border border-red-800/50',
}

const statusLabels: Partial<Record<StatusVariant, string>> = {
  in_production: 'In Production',
  on_hold: 'On Hold',
}

interface StatusBadgeProps {
  status: StatusVariant | JobStatus | string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status as StatusVariant
  const styles = variantStyles[key] ?? 'bg-gray-700 text-gray-300'
  const label = statusLabels[key] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <span className={clsx('badge', styles, className)}>{label}</span>
  )
}
