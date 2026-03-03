// ─── ShopFloorDashboard ───────────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Main hub for the shop floor: job queue, machine status cards, progress, next-up parts.

import React, { useState, useCallback } from 'react';
import {
  Job,
  MachineStatus,
  JobPart,
  JobPriority,
  MachineState,
  DashboardState,
} from './types';
import { formatDuration } from './hooks';

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<JobPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const PRIORITY_COLORS: Record<JobPriority, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: '#3b82f6',
  low: '#6b7280',
};

const PRIORITY_BG: Record<JobPriority, string> = {
  urgent: '#fef2f2',
  high: '#fff7ed',
  normal: '#eff6ff',
  low: '#f9fafb',
};

export function sortJobsByPriority(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const po = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (po !== 0) return po;
    return new Date(a.scheduledStart ?? a.createdAt).getTime() -
      new Date(b.scheduledStart ?? b.createdAt).getTime();
  });
}

// ─── MachineStateIndicator ────────────────────────────────────────────────────

interface MachineStateIndicatorProps {
  state: MachineState;
  pulse?: boolean;
}

export const MachineStateIndicator: React.FC<MachineStateIndicatorProps> = ({
  state,
  pulse = false,
}) => {
  const STATE_STYLES: Record<MachineState, { bg: string; label: string }> = {
    idle: { bg: '#22c55e', label: 'Idle' },
    running: { bg: '#3b82f6', label: 'Running' },
    error: { bg: '#ef4444', label: 'Error' },
    maintenance: { bg: '#f59e0b', label: 'Maintenance' },
    offline: { bg: '#6b7280', label: 'Offline' },
  };

  const { bg, label } = STATE_STYLES[state];

  return (
    <span
      data-testid="machine-state-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 9999,
        background: bg + '22',
        color: bg,
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 0.5,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: bg,
          display: 'inline-block',
          animation: pulse && state === 'running' ? 'shopfloor-pulse 1.4s infinite' : undefined,
        }}
      />
      {label}
    </span>
  );
};

// ─── JobProgressBar ───────────────────────────────────────────────────────────

interface JobProgressBarProps {
  progress: number;
  label?: string;
  height?: number;
  showPercent?: boolean;
}

export const JobProgressBar: React.FC<JobProgressBarProps> = ({
  progress,
  label,
  height = 12,
  showPercent = true,
}) => {
  const pct = Math.max(0, Math.min(100, progress));
  const color = pct < 33 ? '#3b82f6' : pct < 66 ? '#f59e0b' : '#22c55e';

  return (
    <div data-testid="job-progress-bar" style={{ width: '100%' }}>
      {(label ?? showPercent) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            fontSize: 12,
            color: '#6b7280',
          }}
        >
          {label && <span>{label}</span>}
          {showPercent && <span style={{ fontWeight: 700, color }}>{pct}%</span>}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height,
          background: '#e5e7eb',
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: height / 2,
            transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

// ─── JobQueueCard ─────────────────────────────────────────────────────────────

interface JobQueueCardProps {
  job: Job;
  isActive?: boolean;
  onSelect?: (job: Job) => void;
}

export const JobQueueCard: React.FC<JobQueueCardProps> = ({
  job,
  isActive = false,
  onSelect,
}) => {
  const priorityColor = PRIORITY_COLORS[job.priority];
  const priorityBg = PRIORITY_BG[job.priority];

  const remaining = job.estimatedDurationSeconds - job.elapsedSeconds;

  return (
    <div
      data-testid="job-queue-card"
      onClick={() => onSelect?.(job)}
      style={{
        background: isActive ? '#f0f9ff' : '#fff',
        border: `2px solid ${isActive ? '#3b82f6' : '#e5e7eb'}`,
        borderLeft: `4px solid ${priorityColor}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'border-color 0.18s, box-shadow 0.18s',
        boxShadow: isActive ? '0 0 0 2px #3b82f633' : 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
            {job.jobNumber}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{job.name}</div>
        </div>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 9999,
            background: priorityBg,
            color: priorityColor,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {job.priority}
        </span>
      </div>

      {/* Progress (only if running) */}
      {job.status === 'running' && (
        <div style={{ marginBottom: 8 }}>
          <JobProgressBar progress={job.progress} height={8} showPercent />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
        <span data-testid="job-parts-count">{job.parts.length} part{job.parts.length !== 1 ? 's' : ''}</span>
        {job.status === 'running' && remaining > 0 && (
          <span>ETA: {formatDuration(remaining)}</span>
        )}
        {job.scheduledStart && job.status === 'queued' && (
          <span>
            Sched: {new Date(job.scheduledStart).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── MachineStatusCard ────────────────────────────────────────────────────────

interface MachineStatusCardProps {
  machine: MachineStatus;
  onSelect?: (machine: MachineStatus) => void;
}

export const MachineStatusCard: React.FC<MachineStatusCardProps> = ({
  machine,
  onSelect,
}) => {
  const hasAlarms = machine.alarms.filter((a) => !a.acknowledged).length > 0;

  return (
    <div
      data-testid="machine-status-card"
      onClick={() => onSelect?.(machine)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hasAlarms ? '#ef4444' : '#e5e7eb'}`,
        borderRadius: 12,
        padding: 18,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'border-color 0.18s, box-shadow 0.18s',
        position: 'relative',
      }}
    >
      {/* Alarm badge */}
      {hasAlarms && (
        <span
          data-testid="alarm-badge"
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            background: '#ef4444',
            color: '#fff',
            borderRadius: 9999,
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
          }}
        >
          {machine.alarms.filter((a) => !a.acknowledged).length} ALARM
        </span>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{machine.name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{machine.model}</div>
        </div>
        <MachineStateIndicator state={machine.state} pulse />
      </div>

      {/* Current operation */}
      {machine.currentOperation && (
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>Op: </span>
          {machine.currentOperation}
        </div>
      )}

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 14 }}>
        {machine.state === 'running' && (
          <>
            <MetricChip
              label="Feed"
              value={`${machine.feedRate}`}
              unit="mm/min"
              testId="feed-rate-chip"
            />
            <MetricChip
              label="RPM"
              value={`${machine.spindleRpm.toLocaleString()}`}
              testId="rpm-chip"
            />
          </>
        )}
        {machine.estimatedTimeRemaining != null && machine.state === 'running' && (
          <MetricChip
            label="ETA"
            value={formatDuration(machine.estimatedTimeRemaining)}
            testId="eta-chip"
          />
        )}
      </div>
    </div>
  );
};

const MetricChip: React.FC<{
  label: string;
  value: string;
  unit?: string;
  testId?: string;
}> = ({ label, value, unit, testId }) => (
  <div
    data-testid={testId}
    style={{
      background: '#f3f4f6',
      borderRadius: 6,
      padding: '4px 8px',
      minWidth: 60,
    }}
  >
    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
      {value}
      {unit && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>{unit}</span>}
    </div>
  </div>
);

// ─── NextUpPartsList ──────────────────────────────────────────────────────────

interface NextUpPartsListProps {
  parts: JobPart[];
}

export const NextUpPartsList: React.FC<NextUpPartsListProps> = ({ parts }) => {
  if (parts.length === 0) {
    return (
      <div
        data-testid="next-up-parts-empty"
        style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '24px 0' }}
      >
        No parts queued
      </div>
    );
  }

  return (
    <div data-testid="next-up-parts-list">
      {parts.map((part, index) => (
        <div
          key={part.id}
          data-testid="next-up-part-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 0',
            borderBottom: index < parts.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#6b7280',
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {part.name}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {part.partNumber} · Qty {part.quantity}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
            {formatDuration(part.estimatedTime)}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── ShopFloorDashboard (main component) ──────────────────────────────────────

export interface ShopFloorDashboardProps {
  /** Injected for testing – otherwise fetched via useDashboard */
  dashboardData?: DashboardState;
  loading?: boolean;
  error?: string | null;
  onMachineSelect?: (machine: MachineStatus) => void;
  onJobSelect?: (job: Job) => void;
  /** Operator identifier shown in the header */
  operatorId?: string;
  /** CSS class for outer container */
  className?: string;
}

export const ShopFloorDashboard: React.FC<ShopFloorDashboardProps> = ({
  dashboardData,
  loading = false,
  error = null,
  onMachineSelect,
  onJobSelect,
  operatorId = 'Operator',
  className,
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handleJobSelect = useCallback(
    (job: Job) => {
      setSelectedJobId(job.id);
      onJobSelect?.(job);
    },
    [onJobSelect],
  );

  if (loading) {
    return (
      <div data-testid="dashboard-loading" style={styles.centered}>
        <div style={styles.spinner} />
        <p style={{ color: '#6b7280', marginTop: 16 }}>Loading shop floor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="dashboard-error" style={styles.centered}>
        <div style={{ color: '#ef4444', fontSize: 16, fontWeight: 600 }}>
          Connection Error
        </div>
        <p style={{ color: '#6b7280', marginTop: 8, maxWidth: 400, textAlign: 'center' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div data-testid="dashboard-empty" style={styles.centered}>
        <p style={{ color: '#9ca3af' }}>No data available</p>
      </div>
    );
  }

  const { machines, activeJobs, jobQueue, nextUpParts, lastUpdated } = dashboardData;
  const sortedQueue = sortJobsByPriority(jobQueue);
  const activeJob = activeJobs[0] ?? null;

  return (
    <div
      data-testid="shop-floor-dashboard"
      className={className}
      style={styles.container}
    >
      {/* ── Global styles ── */}
      <style>{`
        @keyframes shopfloor-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes shopfloor-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Shop Floor">
              <circle cx="12" cy="12" r="4" fill="#3b82f6" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
              <path d="M5.64 5.64l2.83 2.83M15.54 15.54l2.83 2.83M5.64 18.36l2.83-2.83M15.54 8.46l2.83-2.83" stroke="#3b82f650" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>Shop Floor</h1>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {operatorId} ·{' '}
              Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <StatusSummaryBadge
            machines={machines}
          />
        </div>
      </header>

      {/* ── Main grid ── */}
      <div style={styles.grid}>

        {/* Left column: Job queue */}
        <section style={styles.panel} aria-label="Job Queue">
          <h2 style={styles.sectionTitle}>
            Job Queue
            <span style={styles.badge}>{sortedQueue.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 420 }}>
            {sortedQueue.length === 0 ? (
              <div style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>
                Queue is empty
              </div>
            ) : (
              sortedQueue.map((job) => (
                <JobQueueCard
                  key={job.id}
                  job={job}
                  isActive={job.id === selectedJobId}
                  onSelect={handleJobSelect}
                />
              ))
            )}
          </div>
        </section>

        {/* Middle column: Current job + Next-up */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Current job progress */}
          <section style={styles.panel} aria-label="Current Job">
            <h2 style={styles.sectionTitle}>Current Job</h2>
            {activeJob ? (
              <div data-testid="active-job-section">
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                    {activeJob.jobNumber}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 14, marginTop: 2 }}>
                    {activeJob.name}
                  </div>
                </div>
                <JobProgressBar
                  progress={activeJob.progress}
                  label={`${activeJob.elapsedSeconds > 0 ? formatDuration(activeJob.elapsedSeconds) + ' elapsed' : 'Starting'}`}
                  height={16}
                />
                <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
                  <MetricChip
                    label="Parts"
                    value={`${activeJob.parts.length}`}
                    testId="active-job-parts"
                  />
                  <MetricChip
                    label="Remaining"
                    value={formatDuration(activeJob.estimatedDurationSeconds - activeJob.elapsedSeconds)}
                    testId="active-job-eta"
                  />
                  <MetricChip
                    label="Machine"
                    value={activeJob.machineId}
                    testId="active-job-machine"
                  />
                </div>
              </div>
            ) : (
              <div
                data-testid="no-active-job"
                style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0', fontSize: 15 }}
              >
                No active job
              </div>
            )}
          </section>

          {/* Next-up parts */}
          <section style={styles.panel} aria-label="Next-Up Parts">
            <h2 style={styles.sectionTitle}>
              Next Up
              <span style={styles.badge}>{nextUpParts.length}</span>
            </h2>
            <NextUpPartsList parts={nextUpParts} />
          </section>
        </div>

        {/* Right column: Machine cards */}
        <section style={styles.panel} aria-label="Machines">
          <h2 style={styles.sectionTitle}>
            Machines
            <span style={styles.badge}>{machines.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 500 }}>
            {machines.map((m) => (
              <MachineStatusCard key={m.id} machine={m} onSelect={onMachineSelect} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

// ─── StatusSummaryBadge ───────────────────────────────────────────────────────

const StatusSummaryBadge: React.FC<{ machines: MachineStatus[] }> = ({ machines }) => {
  const running = machines.filter((m) => m.state === 'running').length;
  const errors = machines.filter((m) => m.state === 'error').length;
  const idle = machines.filter((m) => m.state === 'idle').length;

  return (
    <div
      data-testid="status-summary-badge"
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
    >
      <Pill label={`${running} running`} color="#3b82f6" />
      <Pill label={`${idle} idle`} color="#22c55e" />
      {errors > 0 && <Pill label={`${errors} error`} color="#ef4444" />}
    </div>
  );
};

const Pill: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span
    style={{
      padding: '4px 10px',
      borderRadius: 9999,
      background: color + '18',
      color,
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {label}
  </span>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '0 0 32px',
  } as React.CSSProperties,
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  } as React.CSSProperties,
  logo: {
    width: 40,
    height: 40,
    background: '#eff6ff',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
    padding: '20px 24px',
    maxWidth: 1400,
    margin: '0 auto',
  } as React.CSSProperties,
  panel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: 20,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#374151',
    margin: '0 0 14px',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  badge: {
    background: '#f3f4f6',
    color: '#6b7280',
    borderRadius: 9999,
    padding: '1px 8px',
    fontSize: 12,
    fontWeight: 700,
  } as React.CSSProperties,
  centered: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  } as React.CSSProperties,
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'shopfloor-spin 0.8s linear infinite',
  } as React.CSSProperties,
};

export default ShopFloorDashboard;
