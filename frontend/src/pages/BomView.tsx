import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cutlistsService } from '@/services/cutlists'
import { useAppStore } from '@/store'
import { DataTable, Column } from '@/components/common/DataTable'
import { ArrowDownTrayIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '@/utils/format'
import { TabBar } from '@/components/layout/TabBar'
import type { BomRow } from '@/services/cutlists'

export function BomView() {
  const { currentJob } = useAppStore()
  const [activeTab, setActiveTab] = useState<'bom' | 'boq'>('bom')

  const { data: bom = [], isLoading: bomLoading } = useQuery({
    queryKey: ['bom', currentJob?.id],
    queryFn: () => cutlistsService.getBom(currentJob!.id),
    enabled: !!currentJob?.id,
  })

  const { data: boq = [], isLoading: boqLoading } = useQuery({
    queryKey: ['boq', currentJob?.id],
    queryFn: () => cutlistsService.getBoq(currentJob!.id),
    enabled: !!currentJob?.id,
  })

  const data = activeTab === 'bom' ? bom : boq
  const isLoading = activeTab === 'bom' ? bomLoading : boqLoading

  const columns: Column<BomRow>[] = [
    { key: 'description', header: 'Description', sortable: true, render: (r) => <span className="font-medium text-gray-100">{r.description}</span> },
    { key: 'category', header: 'Category', sortable: true, width: '120px' },
    { key: 'quantity', header: 'Qty', width: '70px', sortable: true, render: (r) => <span className="mono">{r.quantity}</span> },
    { key: 'unit', header: 'Unit', width: '70px' },
    { key: 'unitCost', header: 'Unit Cost', width: '100px', sortable: true, render: (r) => <span className="mono">{formatCurrency(r.unitCost)}</span> },
    { key: 'total', header: 'Total', width: '100px', sortable: true, render: (r) => <span className="mono font-semibold text-cyan-400">{formatCurrency(r.total)}</span> },
    { key: 'supplier', header: 'Supplier', render: (r) => <span className="text-gray-500">{r.supplier ?? '—'}</span> },
  ]

  const grandTotal = data.reduce((s, r) => s + r.total, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900">
        <ClipboardDocumentListIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">
          {activeTab === 'bom' ? 'Bill of Materials' : 'Bill of Quantities'}
        </h1>
        <div className="flex-1" />
        <button className="btn-secondary flex items-center gap-1.5 text-xs">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export
        </button>
      </div>

      <TabBar
        tabs={[
          { id: 'bom', label: 'Bill of Materials (BOM)' },
          { id: 'boq', label: 'Bill of Quantities (BOQ)' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as 'bom' | 'boq')}
        className="px-4 bg-gray-900"
      />

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">Loading…</div>
        ) : (
          <DataTable
            columns={columns}
            data={data as unknown as Record<string, unknown>[]}
            rowKey="id"
            emptyMessage={currentJob ? 'No data' : 'Select a job first'}
          />
        )}
      </div>

      <div className="px-6 py-2 border-t border-gray-800 bg-gray-900 flex items-center justify-between text-xs">
        <span className="text-gray-500">{data.length} line items</span>
        <span className="font-semibold text-cyan-400">Grand Total: {formatCurrency(grandTotal)}</span>
      </div>
    </div>
  )
}
