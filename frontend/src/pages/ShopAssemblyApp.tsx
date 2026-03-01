import { CheckCircleIcon, ClockIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

export function ShopAssemblyApp() {
  const tasks = [
    { id: '1', part: 'Upper Cabinet L1', job: 'JOB-2024-089', status: 'pending', assignee: 'Tom R.' },
    { id: '2', part: 'Base Cabinet B2', job: 'JOB-2024-089', status: 'in_progress', assignee: 'Mike T.' },
    { id: '3', part: 'Pantry Unit P1', job: 'JOB-2024-091', status: 'done', assignee: 'Sarah K.' },
    { id: '4', part: 'Island Cabinet IC1', job: 'JOB-2024-092', status: 'pending', assignee: 'Tom R.' },
  ]

  const icon = (status: string) => {
    if (status === 'done') return <CheckCircleIcon className="w-5 h-5 text-green-400" />
    if (status === 'in_progress') return <WrenchScrewdriverIcon className="w-5 h-5 text-yellow-400" />
    return <ClockIcon className="w-5 h-5 text-gray-400" />
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Shop Assembly</h1>
        <p className="text-gray-400 mt-1">Assembly queue for shop floor</p>
      </div>

      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon(task.status)}
              <div>
                <p className="font-medium text-white">{task.part}</p>
                <p className="text-xs text-gray-400">{task.job} • {task.assignee}</p>
              </div>
            </div>
            <button className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Update
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
