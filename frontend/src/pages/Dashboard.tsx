import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobsService } from '@/services/jobs'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate, formatCurrency } from '@/utils/format'
import {
  BriefcaseIcon,
  PlusIcon,
  ArrowRightIcon,
  ClockIcon,
  CubeIcon,
  HomeModernIcon,
} from '@heroicons/react/24/outline'
import { useAppStore } from '@/store'
import type { Job } from '@/types'

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-cyan-900/40 rounded-lg flex items-center justify-center text-cyan-400 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-100">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  return (
    <button
      className="panel p-4 text-left hover:border-gray-600 hover:bg-gray-800/60 transition-all w-full"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-100">{job.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{job.clientName}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <ClockIcon className="w-3.5 h-3.5" />
          Due {formatDate(job.dueDate)}
        </span>
        <span className="flex items-center gap-1">
          <CubeIcon className="w-3.5 h-3.5" />
          {job.productCount ?? 0} products
        </span>
        <span className="flex items-center gap-1">
          <HomeModernIcon className="w-3.5 h-3.5" />
          {job.roomCount ?? 0} rooms
        </span>
      </div>
    </button>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const { setCurrentJob } = useAppStore()

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: jobsService.getJobs,
  })

  const activeJobs = jobs.filter((j) => j.status === 'in_progress')
  const draftJobs = jobs.filter((j) => j.status === 'draft')

  return (
    <div className="flex flex-col h-full overflow-auto p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500">CNC Cabinet Manufacturing</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => navigate('/jobs/new')}
        >
          <PlusIcon className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={jobs.length} icon={<BriefcaseIcon className="w-5 h-5" />} />
        <StatCard label="Active" value={activeJobs.length} icon={<ArrowRightIcon className="w-5 h-5" />} />
        <StatCard label="Drafts" value={draftJobs.length} icon={<ClockIcon className="w-5 h-5" />} />
        <StatCard label="Completed" value={jobs.filter(j => j.status === 'completed').length} icon={<CubeIcon className="w-5 h-5" />} />
      </div>

      {/* Active Jobs */}
      {isLoading ? (
        <div className="text-sm text-gray-600">Loading jobs…</div>
      ) : (
        <>
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Active Jobs</h2>
            {activeJobs.length === 0 ? (
              <p className="text-sm text-gray-600">No active jobs</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {activeJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => { setCurrentJob(job); navigate(`/jobs/${job.id}`) }}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Draft Jobs</h2>
            {draftJobs.length === 0 ? (
              <p className="text-sm text-gray-600">No drafts</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {draftJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => { setCurrentJob(job); navigate(`/jobs/${job.id}`) }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
