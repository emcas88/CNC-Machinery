import { useState, useMemo } from 'react'
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, CubeIcon } from '@heroicons/react/24/outline'
import { SearchBar } from '@/components/common/SearchBar'
import clsx from 'clsx'

export interface LibraryItem {
  id: string
  name: string
  type: 'category' | 'product'
  children?: LibraryItem[]
}

interface TreeNodeProps {
  item: LibraryItem
  depth: number
  selectedId: string | null
  onSelect: (item: LibraryItem) => void
  expandedIds: Set<string>
  onToggle: (id: string) => void
  searchQuery: string
}

function TreeNode({ item, depth, selectedId, onSelect, expandedIds, onToggle, searchQuery }: TreeNodeProps) {
  const isExpanded = expandedIds.has(item.id)
  const isSelected = selectedId === item.id
  const hasChildren = item.children && item.children.length > 0

  const matchesSearch = !searchQuery ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())

  const childrenMatchSearch = item.children?.some(
    (child) => !searchQuery || child.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? false

  if (!matchesSearch && !childrenMatchSearch) return null

  return (
    <div>
      <button
        className={clsx(
          'w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded transition-colors text-left',
          isSelected
            ? 'bg-cyan-900/40 text-cyan-300'
            : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (hasChildren) onToggle(item.id)
          onSelect(item)
        }}
      >
        {hasChildren ? (
          isExpanded
            ? <ChevronDownIcon className="w-3.5 h-3.5 shrink-0 text-gray-500" />
            : <ChevronRightIcon className="w-3.5 h-3.5 shrink-0 text-gray-500" />
        ) : (
          <span className="w-3.5" />
        )}
        {item.type === 'category'
          ? <FolderIcon className="w-4 h-4 shrink-0 text-yellow-500" />
          : <CubeIcon className="w-4 h-4 shrink-0 text-cyan-500" />
        }
        <span className="truncate">{item.name}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ProductLibraryTreeProps {
  items: LibraryItem[]
  onSelect?: (item: LibraryItem) => void
  className?: string
}

export function ProductLibraryTree({ items, onSelect, className }: ProductLibraryTreeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelect = (item: LibraryItem) => {
    setSelectedId(item.id)
    onSelect?.(item)
  }

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search library…"
        className="mx-2"
      />
      <div className="overflow-y-auto flex-1">
        {items.map((item) => (
          <TreeNode
            key={item.id}
            item={item}
            depth={0}
            selectedId={selectedId}
            onSelect={handleSelect}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </div>
  )
}
