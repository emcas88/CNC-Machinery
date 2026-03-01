import { useState, useMemo } from 'react'
import { ChevronUpDownIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: keyof T
  onRowClick?: (row: T) => void
  selectedRowKey?: string | number
  emptyMessage?: string
  className?: string
  compact?: boolean
}

type SortDir = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  onRowClick,
  selectedRowKey,
  emptyMessage = 'No data',
  className,
  compact = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortKey(null)
      setSortDir(null)
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data
    return [...data].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronUpDownIcon className="w-3 h-3 opacity-40" />
    if (sortDir === 'asc') return <ChevronUpIcon className="w-3 h-3 text-cyan-400" />
    return <ChevronDownIcon className="w-3 h-3 text-cyan-400" />
  }

  return (
    <div className={clsx('overflow-auto', className)}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={col.width ? { width: col.width } : {}}
                className={clsx(col.sortable && 'cursor-pointer select-none hover:bg-gray-800')}
                onClick={() => col.sortable && handleSort(String(col.key))}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && <SortIcon colKey={String(col.key)} />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={String(row[rowKey as string])}
                className={clsx(
                  onRowClick && 'cursor-pointer',
                  selectedRowKey !== undefined &&
                    row[rowKey as string] === selectedRowKey &&
                    'bg-cyan-900/20'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={clsx(compact && 'py-1', !compact && 'py-2')}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.key as string] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
