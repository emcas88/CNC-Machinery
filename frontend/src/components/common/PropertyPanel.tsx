import clsx from 'clsx'

interface PropertyRowProps {
  label: string
  children: React.ReactNode
  className?: string
}

function PropertyRow({ label, children, className }: PropertyRowProps) {
  return (
    <div className={clsx('flex items-center gap-2 py-1.5 border-b border-gray-800', className)}>
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

interface PropertySectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function PropertySection({ title, children }: PropertySectionProps) {
  return (
    <div className="mb-3">
      <div className="px-3 py-1.5 bg-gray-900/60 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
        {title}
      </div>
      <div className="px-3">{children}</div>
    </div>
  )
}

interface PropertyPanelProps {
  title?: string
  children: React.ReactNode
  className?: string
  width?: string
}

export function PropertyPanel({ title = 'Properties', children, className, width = 'w-64' }: PropertyPanelProps) {
  return (
    <aside className={clsx('bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden', width, className)}>
      <div className="px-3 py-2 border-b border-gray-800 shrink-0">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  )
}

PropertyPanel.Row = PropertyRow
PropertyPanel.Section = PropertySection
