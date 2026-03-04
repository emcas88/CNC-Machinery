import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { jobsService } from '@/services/jobs'
import { useAppStore } from '@/store'
import type { CreateJob } from '@/types'

export default function JobCreate() {
  const navigate = useNavigate()
  const { setCurrentJob } = useAppStore()

  const [form, setForm] = useState<CreateJob>({
    name: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    projectAddress: '',
    notes: '',
    dueDate: '',
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateJob) => jobsService.createJob(data),
    onSuccess: (job) => {
      setCurrentJob(job)
      navigate(`/jobs/${job.id}`)
    },
  })

  const update = (field: keyof CreateJob, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const canSubmit = form.name.trim().length > 0 && form.clientName.trim().length > 0

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Create New Job</h1>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Job Name *</label>
            <input
              type="text"
              className="input-field w-full"
              placeholder="e.g. Kitchen Renovation"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Client Name *</label>
            <input
              type="text"
              className="input-field w-full"
              placeholder="e.g. John Smith"
              value={form.clientName}
              onChange={(e) => update('clientName', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Client Email</label>
            <input
              type="email"
              className="input-field w-full"
              placeholder="john@example.com"
              value={form.clientEmail}
              onChange={(e) => update('clientEmail', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Client Phone</label>
            <input
              type="tel"
              className="input-field w-full"
              placeholder="+1 555-0123"
              value={form.clientPhone}
              onChange={(e) => update('clientPhone', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Project Address</label>
          <input
            type="text"
            className="input-field w-full"
            placeholder="123 Main St, City"
            value={form.projectAddress}
            onChange={(e) => update('projectAddress', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Due Date</label>
          <input
            type="date"
            className="input-field w-full"
            value={form.dueDate}
            onChange={(e) => update('dueDate', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
          <textarea
            className="input-field w-full h-24 resize-none"
            placeholder="Additional notes about this job..."
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </div>

        {createMutation.isError && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            {(createMutation.error as Error)?.message || 'Failed to create job'}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => createMutation.mutate(form)}
            disabled={!canSubmit || createMutation.isPending}
            className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Job'}
          </button>
          <button
            onClick={() => navigate('/jobs')}
            className="btn-secondary px-6 py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
