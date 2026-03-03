import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopService } from '@/services/shop';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RemakeStatus = 'pending' | 'in_progress' | 'completed';

interface RemakeItem {
  id: string;
  partId: string;
  partName: string;
  material: string;
  dimensions: string;
  reason: string;
  status: RemakeStatus;
  quantity: number;
  notes?: string;
  createdAt?: string;
}

const STATUS_TABS: { label: string; value: RemakeStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

const REMAKE_REASONS = [
  'Damaged',
  'Wrong Dimensions',
  'Material Defect',
  'Other',
];

const STATUS_COLORS: Record<RemakeStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const STATUS_LABELS: Record<RemakeStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

// ---------------------------------------------------------------------------
// Flag Part Modal
// ---------------------------------------------------------------------------
interface FlagModalProps {
  onSubmit: (data: { partId: string; reason: string; quantity: number; notes: string }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const FlagPartModal: React.FC<FlagModalProps> = ({ onSubmit, onCancel, isSubmitting }) => {
  const [partId, setPartId] = useState('');
  const [reason, setReason] = useState(REMAKE_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partId.trim()) return;
    onSubmit({ partId: partId.trim(), reason, quantity, notes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="flag-modal">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-700"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Flag Part for Remake</h3>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-300">Part ID</span>
            <input
              type="text"
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              placeholder="Enter part ID"
              required
              className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              data-testid="flag-part-id"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-300">Reason</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              data-testid="flag-reason"
            >
              {REMAKE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-300">Quantity</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              data-testid="flag-quantity"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-300">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional details…"
              className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 resize-none"
              data-testid="flag-notes"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !partId.trim()}
            className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="flag-submit-btn"
          >
            {isSubmitting ? 'Flagging…' : 'Flag Part'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const RemakeBin: React.FC = () => {
  const currentJob = useAppStore((s) => s.currentJob);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<RemakeStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showFlagModal, setShowFlagModal] = useState(false);

  // Fetch remake items
  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery<RemakeItem[]>({
    queryKey: ['remakeBin', currentJob?.id],
    queryFn: () => shopService.remakeBin(currentJob!.id),
    enabled: !!currentJob?.id,
  });

  // Add to remake bin
  const addMutation = useMutation({
    mutationFn: (data: { partId: string; reason: string; quantity: number }) =>
      shopService.addToRemakeBin(data.partId, data.reason, data.quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remakeBin', currentJob?.id] });
      setShowFlagModal(false);
    },
  });

  // Mark part complete
  const completeMutation = useMutation({
    mutationFn: (partId: string) => shopService.markPartComplete(partId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remakeBin', currentJob?.id] });
    },
  });

  // Filter and search
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTab !== 'all') {
      result = result.filter((item) => item.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.partName.toLowerCase().includes(q) ||
          item.material.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, activeTab, search]);

  // Summary stats
  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((i) => i.status === 'pending').length;
    const inProgress = items.filter((i) => i.status === 'in_progress').length;
    const completed = items.filter((i) => i.status === 'completed').length;
    return { total, pending, inProgress, completed };
  }, [items]);

  const handleFlagSubmit = useCallback(
    (data: { partId: string; reason: string; quantity: number; notes: string }) => {
      addMutation.mutate({ partId: data.partId, reason: data.reason, quantity: data.quantity });
    },
    [addMutation],
  );

  const handleStatusChange = useCallback(
    (partId: string, newStatus: RemakeStatus) => {
      if (newStatus === 'completed') {
        completeMutation.mutate(partId);
      }
      // For in_progress we could add another API call; for now we use markPartComplete for completed
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
          <div className="text-5xl mb-4">🔧</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Job Selected</h2>
          <p className="text-gray-400">Please select a job to view the Remake Bin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6" data-testid="remake-bin">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Remake Bin</h1>
          <p className="text-sm text-gray-400 mt-1">
            Job: <span className="text-cyan-400">{currentJob.name}</span>
          </p>
        </div>
        <button
          onClick={() => setShowFlagModal(true)}
          className="px-4 py-2 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          data-testid="flag-part-btn"
        >
          + Flag Part
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6" data-testid="summary-stats">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-gray-400 mt-1">Total Items</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-xs text-gray-400 mt-1">Pending</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.inProgress}</div>
          <div className="text-xs text-gray-400 mt-1">In Progress</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
          <div className="text-xs text-gray-400 mt-1">Completed</div>
        </div>
      </div>

      {/* Mutation errors */}
      {addMutation.isError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4" data-testid="add-error" role="alert">
          Failed to flag part: {(addMutation.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}
      {completeMutation.isError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4" data-testid="complete-error" role="alert">
          Failed to update status: {(completeMutation.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Filter Tabs + Search */}
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
        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by part name, material, or reason…"
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500"
            data-testid="search-input"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" data-testid="loading-skeleton">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg h-28 animate-pulse border border-gray-700" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300" data-testid="error-message" role="alert">
          Failed to load remake bin items.
        </div>
      )}

      {/* Items */}
      {!isLoading && !error && (
        <>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500" data-testid="empty-items">
              {search ? 'No items match your search.' : 'No items in this category.'}
            </div>
          ) : (
            <div className="space-y-3" data-testid="items-list">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  data-testid={`remake-item-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium truncate">{item.partName}</h3>
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[item.status]}`}
                        data-testid={`status-badge-${item.id}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                      <span>Material: {item.material}</span>
                      <span>Dims: {item.dimensions}</span>
                      <span>Qty: {item.quantity}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Reason: <span className="text-gray-300">{item.reason}</span>
                      {item.notes && <span className="ml-2 text-gray-500">— {item.notes}</span>}
                    </div>
                  </div>

                  {item.status !== 'completed' && (
                    <div className="flex-shrink-0">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.partId, e.target.value as RemakeStatus)}
                        className="rounded bg-gray-700 border border-gray-600 px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                        data-testid={`status-select-${item.id}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Flag Part Modal */}
      {showFlagModal && (
        <FlagPartModal
          onSubmit={handleFlagSubmit}
          onCancel={() => setShowFlagModal(false)}
          isSubmitting={addMutation.isPending}
        />
      )}
    </div>
  );
};

export default RemakeBin;
