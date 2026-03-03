import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopService } from '@/services/shop';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TaskStatus = 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'high' | 'medium' | 'low';
type SortField = 'priority' | 'name' | 'status';

interface AssemblyStep {
  id: string;
  description: string;
  completed: boolean;
}

interface AssemblyTask {
  id: string;
  partId: string;
  productName: string;
  steps: AssemblyStep[];
  assignedWorker: string;
  priority: TaskPriority;
  status: TaskStatus;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-orange-500/20 text-orange-400',
  low: 'bg-gray-500/20 text-gray-400',
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const STATUS_TABS: { label: string; value: TaskStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------
interface ProgressBarProps {
  total: number;
  cut: number;
  assembled: number;
  percent: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ total, cut, assembled, percent }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6" data-testid="progress-bar">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-300">Assembly Progress</span>
      <span className="text-sm font-bold text-cyan-400">{percent}%</span>
    </div>
    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
      <div
        className="bg-cyan-500 h-3 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%` }}
        data-testid="progress-fill"
      />
    </div>
    <div className="flex gap-4 mt-2 text-xs text-gray-400">
      <span>Total: {total}</span>
      <span>Cut: {cut}</span>
      <span>Assembled: {assembled}</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Task Card
// ---------------------------------------------------------------------------
interface TaskCardProps {
  task: AssemblyTask;
  onMarkComplete: (partId: string) => void;
  isUpdating: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onMarkComplete, isUpdating }) => {
  const completedSteps = task.steps.filter((s) => s.completed).length;
  const totalSteps = task.steps.length;
  const stepPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:border-gray-600 transition-colors"
      data-testid={`task-card-${task.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-base truncate">{task.productName}</h3>
          <p className="text-sm text-gray-400 mt-0.5">Worker: {task.assignedWorker}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_COLORS[task.priority]}`} data-testid={`priority-badge-${task.id}`}>
            {task.priority}
          </span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[task.status]}`}
            data-testid={`status-badge-${task.id}`}
          >
            {STATUS_LABELS[task.status]}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Steps ({completedSteps}/{totalSteps})</span>
          <span>{stepPercent}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-cyan-500 h-1.5 rounded-full transition-all"
            style={{ width: `${stepPercent}%` }}
          />
        </div>
        <ul className="mt-2 space-y-1" data-testid={`steps-list-${task.id}`}>
          {task.steps.map((step) => (
            <li
              key={step.id}
              className={`text-sm flex items-center gap-2 ${
                step.completed ? 'text-gray-500 line-through' : 'text-gray-300'
              }`}
            >
              <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${
                step.completed
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'border-gray-600'
              }`}>
                {step.completed && '✓'}
              </span>
              {step.description}
            </li>
          ))}
        </ul>
      </div>

      {/* Action */}
      {task.status !== 'completed' && (
        <button
          onClick={() => onMarkComplete(task.partId)}
          disabled={isUpdating}
          className="w-full mt-2 px-4 py-2.5 rounded text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`complete-btn-${task.id}`}
        >
          {isUpdating ? 'Updating…' : 'Mark Complete'}
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const ShopAssemblyApp: React.FC = () => {
  const currentJob = useAppStore((s) => s.currentJob);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TaskStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [updatingPartId, setUpdatingPartId] = useState<string | null>(null);

  // Fetch assembly tasks
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    error: tasksError,
  } = useQuery<AssemblyTask[]>({
    queryKey: ['assembly', currentJob?.id],
    queryFn: () => shopService.getAssembly(currentJob!.id),
    enabled: !!currentJob?.id,
  });

  // Fetch progress
  const { data: progress } = useQuery<ProgressBarProps>({
    queryKey: ['progress', currentJob?.id],
    queryFn: () => shopService.getProgress(currentJob!.id),
    enabled: !!currentJob?.id,
  });

  // Mark complete
  const completeMutation = useMutation({
    mutationFn: (partId: string) => shopService.markPartComplete(partId),
    onMutate: (partId) => setUpdatingPartId(partId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assembly', currentJob?.id] });
      queryClient.invalidateQueries({ queryKey: ['progress', currentJob?.id] });
    },
    onSettled: () => setUpdatingPartId(null),
  });

  // Filter and sort
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (activeTab !== 'all') {
      result = result.filter((t) => t.status === activeTab);
    }

    result = [...result].sort((a, b) => {
      switch (sortField) {
        case 'priority':
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case 'name':
          return a.productName.localeCompare(b.productName);
        case 'status': {
          const statusOrder: Record<TaskStatus, number> = { pending: 0, in_progress: 1, completed: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, activeTab, sortField]);

  const handleMarkComplete = useCallback(
    (partId: string) => {
      completeMutation.mutate(partId);
    },
    [completeMutation],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!currentJob) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900" data-testid="no-job-message">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">🔨</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Job Selected</h2>
          <p className="text-gray-400">Select a job to view assembly tasks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6" data-testid="shop-assembly">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Shop Assembly</h1>
        <p className="text-sm text-gray-400 mt-1">
          Job: <span className="text-cyan-400">{currentJob.name}</span>
        </p>
      </div>

      {/* Progress */}
      {progress && (
        <ProgressBar
          total={progress.total}
          cut={progress.cut}
          assembled={progress.assembled}
          percent={progress.percent}
        />
      )}

      {/* Mutation error */}
      {completeMutation.isError && (
        <div
          className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4"
          data-testid="complete-error"
          role="alert"
        >
          Failed to update task: {(completeMutation.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700" data-testid="status-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab.value
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-400">Sort:</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500"
            data-testid="sort-select"
          >
            <option value="priority">Priority</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {tasksLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="loading-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg h-52 animate-pulse border border-gray-700" />
          ))}
        </div>
      )}

      {/* Error */}
      {tasksError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300" data-testid="error-message" role="alert">
          Failed to load assembly tasks.
        </div>
      )}

      {/* Tasks Grid */}
      {!tasksLoading && !tasksError && (
        <>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500" data-testid="empty-tasks">
              No assembly tasks found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="tasks-grid">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onMarkComplete={handleMarkComplete}
                  isUpdating={updatingPartId === task.partId && completeMutation.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShopAssemblyApp;
