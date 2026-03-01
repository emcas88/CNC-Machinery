import clsx from 'clsx'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
  size?: 'sm' | 'md'
}

export function TabBar({ tabs, activeTab, onChange, className, size = 'md' }: TabBarProps) {
  return (
    <div className={clsx('flex border-b border-gray-700', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={clsx(
            'flex items-center gap-1.5 border-b-2 transition-colors',
            size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm',
            activeTab === tab.id
              ? 'text-cyan-400 border-cyan-500 font-medium'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-500',
            tab.disabled && 'opacity-40 pointer-events-none'
          )}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
