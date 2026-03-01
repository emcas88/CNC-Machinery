import clsx from 'clsx'
import {
  CursorArrowRaysIcon,
  HandRaisedIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline'

export type CanvasTool = 'select' | 'pan' | 'zoom-in' | 'zoom-out'

interface CanvasToolbarProps {
  activeTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  onUndo?: () => void
  onRedo?: () => void
  onFitView?: () => void
  canUndo?: boolean
  canRedo?: boolean
  className?: string
}

interface ToolButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolButton({ icon, label, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-cyan-700 text-white'
          : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  )
}

export function CanvasToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onFitView,
  canUndo = false,
  canRedo = false,
  className,
}: CanvasToolbarProps) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-1 p-1.5 bg-gray-900 border border-gray-700 rounded-xl shadow-lg',
        className
      )}
    >
      <ToolButton
        icon={<CursorArrowRaysIcon className="w-5 h-5" />}
        label="Select (V)"
        active={activeTool === 'select'}
        onClick={() => onToolChange('select')}
      />
      <ToolButton
        icon={<HandRaisedIcon className="w-5 h-5" />}
        label="Pan (H)"
        active={activeTool === 'pan'}
        onClick={() => onToolChange('pan')}
      />
      <ToolButton
        icon={<MagnifyingGlassPlusIcon className="w-5 h-5" />}
        label="Zoom In (+)"
        active={activeTool === 'zoom-in'}
        onClick={() => onToolChange('zoom-in')}
      />
      <ToolButton
        icon={<MagnifyingGlassMinusIcon className="w-5 h-5" />}
        label="Zoom Out (-)"
        active={activeTool === 'zoom-out'}
        onClick={() => onToolChange('zoom-out')}
      />
      <div className="border-t border-gray-700 my-0.5" />
      <ToolButton
        icon={<ArrowUturnLeftIcon className="w-5 h-5" />}
        label="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => onUndo?.()}
      />
      <ToolButton
        icon={<ArrowUturnRightIcon className="w-5 h-5" />}
        label="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={() => onRedo?.()}
      />
      {onFitView && (
        <>
          <div className="border-t border-gray-700 my-0.5" />
          <ToolButton
            icon={<ViewfinderCircleIcon className="w-5 h-5" />}
            label="Fit View (F)"
            onClick={() => onFitView()}
          />
        </>
      )}
    </div>
  )
}
