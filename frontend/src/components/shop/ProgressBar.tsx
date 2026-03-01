import clsx from 'clsx'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md' | 'lg'
  color?: 'cyan' | 'green' | 'yellow' | 'red'
  className?: string
}

const colorMap = {
  cyan: 'bg-cyan-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
}

const heightMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  size = 'md',
  color = 'cyan',
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  const colorClass =
    percent >= 80 ? colorMap.green : percent >= 40 ? colorMap.cyan : colorMap.yellow

  return (
    <div className={clsx('w-full', className)}>
      {(label || showPercent) && (
        <div className="flex justify-between items-baseline mb-1">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {showPercent && (
            <span className="text-sm font-mono text-gray-300">{percent.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className={clsx('w-full bg-gray-700 rounded-full overflow-hidden', heightMap[size])}>
        <div
          className={clsx('rounded-full transition-all duration-500', colorClass, heightMap[size])}
          style={{ width: `${percent}%` }}
        />
      </div>
      {max !== 100 && (
        <p className="text-xs text-gray-500 mt-1">
          {value} / {max}
        </p>
      )}
    </div>
  )
}
