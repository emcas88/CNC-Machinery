import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsService } from '@/services/jobs'
import { roomsService } from '@/services/rooms'
import { useAppStore } from '@/store'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate, formatCurrency } from '@/utils/format'
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ChevronRightIcon,
  HomeModernIcon,
} from '@heroicons/react/24/outline'
import type { Room } from '@/types'

export function JobDashboard() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { setCurrentJob } = useAppStore()
  const queryClient = useQueryClient()

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsService.get(jobId!),
    enabled: !!jobId,
  })

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', jobId],
    queryFn: () => roomsService.list(jobId!),
    enabled: !!jobId,
  })

  const deleteRoom = useMutation({
    mutationFn: (roomId: string) => roomsService.delete(jobId!, roomId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms', jobId] }),
  })

  if (jobLoading) return <div className="flex items-center justify-center h-full text-gray-600">Loading…</div>
  if (!job) return <div className="flex items-center justify-center h-full text-gray-600">Job not found</div>

  return (
    <div className="flex flex-col h-full overflow-auto p-6 space-y-6 fade-in">
      {/* Job header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{job.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{job.clientName} · Due {formatDate(job.dueDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <button
            className="btn-secondary text-xs flex items-center gap-1.5"
            onClick={() => navigate(`/jobs/${jobId}/edit`)}
          >
            <PencilIcon className="w-3.5 h-3.5" />
            Edit Job
          </button>
        </div>
      </div>

      {/* Job stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Rooms', value: rooms.length },
          { label: 'Products', value: job.productCount ?? 0 },
          { label: 'Parts', value: job.partCount ?? 0 },
          { label: 'Est. Value', value: formatCurrency(job.estimatedValue ?? 0) },
        ].map((s) => (
          <div key={s.label} className="panel p-3 text-center">
            <p className="text-xl font-bold text-cyan-400">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rooms */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rooms</h2>
          <button
            className="btn-primary text-xs flex items-center gap-1.5"
            onClick={() => navigate(`/jobs/${jobId}/rooms/new`)}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add Room
          </button>
        </div>

        {roomsLoading ? (
          <p className="text-sm text-gray-600">Loading rooms…</p>
        ) : rooms.length === 0 ? (
          <div className="panel p-6 text-center text-gray-600">
            <HomeModernIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No rooms yet</p>
            <button
              className="btn-primary text-xs mt-3"
              onClick={() => navigate(`/jobs/${jobId}/rooms/new`)}
            >
              Add First Room
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room: Room) => (
              <div key={room.id} className="panel p-3 flex items-center gap-3">
                <HomeModernIcon className="w-5 h-5 text-gray-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100">{room.name}</p>
                  <p className="text-xs text-gray-500">{room.productCount ?? 0} products</p>
                </div>
                <button
                  className="btn-ghost text-xs flex items-center gap-1"
                  onClick={() => {
                    setCurrentJob(job)
                    navigate(`/jobs/${jobId}/rooms/${room.id}`)
                  }}
                >
                  Open <ChevronRightIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  className="btn-ghost text-xs text-red-500 hover:text-red-400"
                  onClick={() => deleteRoom.mutate(room.id)}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
