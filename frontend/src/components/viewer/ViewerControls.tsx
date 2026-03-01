import clsx from 'clsx'

type ViewMode = 'perspective' | 'top' | 'front' | 'side'

interface ViewerControlsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  showDimensions: boolean
  onToggleDimensions: () => void
  onResetCamera: () => void
  className?: string
}

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'perspective', label: '3D' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
]

export function ViewerControls({
  viewMode,
  onViewModeChange,
  showDimensions,
  onToggleDimensions,
  onResetCamera,
  className,
}: ViewerControlsProps) {
  return (
    <div className={clsx('flex items-center gap-2 p-2 bg-gray-900/80 backdrop-blur rounded-lg border border-gray-700', className)}>
      <div className="flex gap-1">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.id}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              viewMode === mode.id
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            )}
            onClick={() => onViewModeChange(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-gray-700" />
      <button
        className={clsx(
          'px-2 py-1 text-xs rounded transition-colors',
          showDimensions ? 'bg-blue-600/40 text-blue-300' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
        )}
        onClick={onToggleDimensions}
      >
        Dims
      </button>
      <button
        className="px-2 py-1 text-xs rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
        onClick={onResetCamera}
        title="Reset camera"
      >
        Reset
      </button>
    </div>
  )
}
