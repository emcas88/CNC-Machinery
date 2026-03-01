import clsx from 'clsx'

interface TouchListItemProps {
  primary: string
  secondary?: string
  meta?: string
  checked?: boolean
  onCheck?: () => void
  onClick?: () => void
  badge?: string
  badgeColor?: 'green' | 'red' | 'yellow' | 'blue'
}

const badgeColors = {
  green: 'bg-green-900/60 text-green-300',
  red: 'bg-red-900/60 text-red-300',
  yellow: 'bg-yellow-900/60 text-yellow-300',
  blue: 'bg-blue-900/60 text-blue-300',
}

export function TouchListItem({
  primary,
  secondary,
  meta,
  checked = false,
  onCheck,
  onClick,
  badge,
  badgeColor = 'blue',
}: TouchListItemProps) {
  return (
    <div
      className={clsx(
        'touch-list-item',
        checked && 'opacity-60',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {onCheck && (
        <button
          className={clsx(
            'w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            checked
              ? 'border-green-500 bg-green-900/50 text-green-400'
              : 'border-gray-600 text-transparent'
          )}
          onClick={(e) => { e.stopPropagation(); onCheck() }}
        >
          {checked && (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className={clsx('text-base font-medium', checked ? 'line-through text-gray-500' : 'text-gray-100')}>
          {primary}
        </p>
        {secondary && <p className="text-sm text-gray-400 mt-0.5">{secondary}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {badge && (
          <span className={clsx('badge text-sm', badgeColors[badgeColor])}>
            {badge}
          </span>
        )}
        {meta && <span className="text-sm font-mono text-gray-500">{meta}</span>}
      </div>
    </div>
  )
}

interface TouchListProps {
  children: React.ReactNode
  className?: string
}

export function TouchList({ children, className }: TouchListProps) {
  return <div className={clsx('space-y-2', className)}>{children}</div>
}
