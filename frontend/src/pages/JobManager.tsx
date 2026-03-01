import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobsService } from '@/services/jobs'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SearchBar } from '@/components/common/SearchBar'
import { formatDate, formatCurrency } from '@/utils/format'
import { useAppStore } from '@/store'
import {
  PlusIcon,
  TrashIcon,
  FolderOpenIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'
import type { Job } from '@/types'

export function JobManager() {
  const navigate = useNavigate()
  const { setCurrentJob } = useAppStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: jobsService.list,
  })

  const deleteJob = useMutation({
    mutationFn: jobsService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const filtered = jobs.filter((j: Job) => {
    const matchSearch = !search || j.name.toLowerCase().includes(search.toLowerCase()) || j.clientName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900">
        <BriefcaseIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Job Manager</h1>
        <div className="flex-1" />
        <SearchBar value={search} onChange={setSearch} placeholder="Search jobs…" className="w-52" />
        <select
          className="select-field text-xs w-32"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </select>
        <button
          className="btn-primary text-xs flex items-center gap-1.5"
          onClick={() => navigate('/jobs/new')}
        >
          <PlusIcon className="w-4 h-4" />
          New Job
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600">
            <BriefcaseIcon className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No jobs found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Client</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job: Job) => (
                <tr key={job.id}>
                  <td className="font-medium text-gray-100">{job.name}</td>
                  <td className="text-gray-400">{job.clientName}</td>
                  <td><StatusBadge status={job.status} /></td>
                  <td className="text-gray-400">{formatDate(job.dueDate)}</td>
                  <td className="mono text-cyan-400">{formatCurrency(job.estimatedValue ?? 0)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-ghost text-xs flex items-center gap-1"
                        onClick={() => { setCurrentJob(job); navigate(`/jobs/${job.id}`) }}
                      >
                        <FolderOpenIcon className="w-3.5 h-3.5" /> Open
                      </button>
                      <button
                        className="btn-ghost text-xs text-red-500 hover:text-red-400"
                        onClick={() => deleteJob.mutate(job.id)}
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
