import { useState } from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

type RemakeStatus = 'pending' | 'in_progress' | 'completed'

interface RemakeItem {
  id: string
  partName: string
  jobNumber: string
  reason: string
  status: RemakeStatus
  createdAt: string
  assignedTo?: string
}

export function RemakeBin() {
  const [filter, setFilter] = useState<RemakeStatus | 'all'>('all')

  const mockItems: RemakeItem[] = [
    { id: '1', partName: 'Upper Cabinet Door LH', jobNumber: 'JOB-2024-089', reason: 'Grain direction wrong', status: 'pending', createdAt: '2024-01-15', assignedTo: 'Mike T.' },
    { id: '2', partName: 'Drawer Front 600mm', jobNumber: 'JOB-2024-091', reason: 'Incorrect dimensions', status: 'in_progress', createdAt: '2024-01-14', assignedTo: 'Sarah K.' },
    { id: '3', partName: 'Shelf Panel 1200mm', jobNumber: 'JOB-2024-085', reason: 'Chip on edge', status: 'completed', createdAt: '2024-01-13' },
    { id: '4', partName: 'Base Cabinet Carcass', jobNumber: 'JOB-2024-092', reason: 'Wrong material used', status: 'pending', createdAt: '2024-01-15' },
  ]

  const filtered = filter === 'all' ? mockItems : mockItems.filter(i => i.status === filter)

  const statusConfig: Record<RemakeStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700', icon: <ExclamationTriangleIcon className="w-4 h-4" /> },
    in_progress: { label: 'In Progress', color: 'bg-blue-900/40 text-blue-300 border-blue-700', icon: <ArrowPathIcon className="w-4 h-4" /> },
    completed: { label: 'Completed', color: 'bg-green-900/40 text-green-300 border-green-700', icon: <CheckCircleIcon className="w-4 h-4" /> },
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Remake Bin</h1>
          <p className="text-gray-400 mt-1">Track parts flagged for remaking</p>
        </div>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
          + Flag Part
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'in_progress', 'completed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {filtered.map(item => (
          <div key={item.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{item.partName}</h3>
                <p className="text-sm text-gray-400 mt-0.5">Job: {item.jobNumber}</p>
                <p className="text-sm text-gray-300 mt-1">Reason: {item.reason}</p>
                {item.assignedTo && (
                  <p className="text-xs text-gray-500 mt-1">Assigned to: {item.assignedTo}</p>
                )}
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig[item.status].color}`}>
                {statusConfig[item.status].icon}
                {statusConfig[item.status].label}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Created: {item.createdAt}</span>
              <div className="flex gap-2">
                <button className="text-xs px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors">Edit</button>
                <button className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">Update Status</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
