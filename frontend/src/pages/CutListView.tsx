import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cutlistsService } from '@/services/cutlists'
import { useAppStore } from '@/store'
import { DataTable, Column } from '@/components/common/DataTable'
import { SearchBar } from '@/components/common/SearchBar'
import { ArrowDownTrayIcon, TableCellsIcon } from '@heroicons/react/24/outline'
import type { CutlistRow } from '@/services/cutlists'

export function CutListView() {
  const { currentJob } = useAppStore()
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['cutlist', currentJob?.id],
    queryFn: () => cutlistsService.getCutlists(currentJob!.id),
    enabled: !!currentJob?.id,
  })

  const filtered = rows.filter(
    (r) =>
      !search ||
      (r.partName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.productName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const columns: Column<CutlistRow>[] = [
    { key: 'id', header: 'ID', width: '70px', render: (r) => <span className="mono text-xs text-cyan-400">{r.id.slice(0, 6)}</span> },
    { key: 'partName', header: 'Part Name', sortable: true, render: (r) => <span className="font-medium text-gray-100">{r.partName}</span> },
    { key: 'productName', header: 'Product', sortable: true, render: (r) => <span className="text-gray-300">{r.productName ?? '—'}</span> },
    { key: 'roomName', header: 'Room', sortable: true },
    { key: 'width', header: 'W', width: '70px', sortable: true, render: (r) => <span className="mono">{r.width}</span> },
    { key: 'length', header: 'L', width: '70px', sortable: true, render: (r) => <span className="mono">{r.length}</span> },
    { key: 'thickness', header: 'T', width: '60px', render: (r) => <span className="mono">{r.thickness}</span> },
    { key: 'quantity', header: 'Qty', width: '60px', sortable: true, render: (r) => <span className="mono font-bold">{r.quantity}</span> },
    { key: 'material', header: 'Material', sortable: true },
    { key: 'grainDirection', header: 'Grain', width: '70px' },
    { key: 'edgeBanding', header: 'Edge', width: '70px' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900">
        <TableCellsIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Cut List</h1>
        <div className="flex-1" />
        {!currentJob && (
          <span className="text-xs text-yellow-500">No job selected</span>
        )}
        <SearchBar value={search} onChange={setSearch} placeholder="Filter parts…" className="w-56" />
        <button className="btn-secondary flex items-center gap-1.5 text-xs">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export CSV
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">Loading cut list…</div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered as unknown as Record<string, unknown>[]}
            rowKey="id"
            compact
            emptyMessage={currentJob ? 'No parts in cut list' : 'Select a job to view cut list'}
          />
        )}
      </div>
      <div className="px-6 py-2 border-t border-gray-800 bg-gray-900 flex items-center justify-between text-xs text-gray-500">
        <span>{filtered.length} parts</span>
        <span>Total qty: {filtered.reduce((s, r) => s + r.quantity, 0)}</span>
      </div>
    </div>
  )
}
