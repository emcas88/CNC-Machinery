import clsx from 'clsx'
import type { Part } from '@/types'

interface PartsListProps {
  parts: Part[]
  selectedPartId?: string | null
  onSelect?: (partId: string) => void
}

export function PartsList({ parts, selectedPartId, onSelect }: PartsListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 bg-gray-900 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase tracking-wide flex justify-between">
        <span>Parts</span>
        <span className="text-gray-600">{parts.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {parts.length === 0 ? (
          <p className="p-4 text-xs text-gray-600 text-center">No parts</p>
        ) : (
          parts.map((part) => (
            <button
              key={part.id}
              className={clsx(
                'w-full flex items-start gap-2 px-3 py-2 border-b border-gray-800 text-left hover:bg-gray-800 transition-colors',
                selectedPartId === part.id && 'bg-cyan-900/20 border-l-2 border-l-cyan-500'
              )}
              onClick={() => onSelect?.(part.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{part.name}</p>
                <p className="text-xs text-gray-500 font-mono">
                  {part.width} × {part.height} × {part.thickness}mm
                </p>
              </div>
              <span className="text-xs text-gray-600 shrink-0">×{part.quantity}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
