// ─── ShopFloor.test.tsx ──────────────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Comprehensive test suite — 50+ tests covering all components and utilities.
// Target: 85%+ coverage.

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ─── Components ───────────────────────────────────────────────────────────────────
import ShopFloorDashboard, {
  ShopFloorDashboardProps,
  JobQueueCard,
  MachineStatusCard,
  MachineStateIndicator,
  JobProgressBar,
  NextUpPartsList,
  sortJobsByPriority,
  StatusSummaryBadge,
} from './ShopFloorDashboard';

import CutListView, {
  CutListViewProps,
  CutListItemRow,
  MaterialGroupSection,
  CutListProgress,
} from './CutListView';

import MachineMonitor, {
  MachineMonitorProps,
  EmergencyStopButton,
  ToolStatusPanel,
  MetricPanel,
  AlarmList,
  OperationHistoryLog,
} from './MachineMonitor';

import QualityCheckView, {
  QualityCheckViewProps,
  PassFailToggle,
  DimensionCheckRow,
  PhotoPlaceholder,
  VisualInspectionChecklist,
  QCResultSummary,
} from './QualityCheckView';

// ─── Utilities/hooks ────────────────────────────────────────────────────────
import {
  getMaterialLabel,
  groupCutListByMaterial,
  formatDuration,
  formatDimensions,
} from './hooks';

// ─── Types ─────────────────────────────────────────────────────────────────────
import {
  Job,
  MachineStatus,
  CutListItem,
  QualityCheck,
  OperatorAction,
  DashboardState,
  CutListGroup,
  DimensionCheck,
  ToolInfo,
  MachineAlarm,
  MachineOperation,
} from './types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  jobNumber: 'JOB-001',
  name: 'Bracket Assembly',
  priority: 'normal',
  status: 'running',
  machineId: 'cnc-1',
  createdAt: '2026-03-03T08:00:00Z',
  scheduledStart: '2026-03-03T09:00:00Z',
  progress: 55,
  parts: [
    {
      id: 'part-1',
      name: 'Top Bracket',
      partNumber: 'BRK-001',
      quantity: 2,
      material: 'aluminum',
      dimensions: { width: 120, height: 80, depth: 10 },
      estimatedTime: 1800,
    },
  ],
  estimatedDurationSeconds: 3600,
  elapsedSeconds: 1980,
  ...overrides,
});

const makeMachine = (overrides: Partial<MachineStatus> = {}): MachineStatus => ({
  id: 'cnc-1',
  name: 'CNC-Alpha',
  model: 'Haas VF-2',
  serialNumber: 'SN-00123',
  state: 'running',
  currentOperation: 'Contour milling',
  currentTool: {
    id: 'T01',
    name: '6mm End Mill',
    diameter: 6,
    length: 75,
    material: 'Carbide',
    remainingLife: 78,
    wearStatus: 'good',
  },
  feedRate: 800,
  spindleRpm: 12000,
  temperature: 42,
  coolantLevel: 85,
  estimatedTimeRemaining: 1250,
  runTimeToday: 21600,
  alarms: [],
  operationHistory: [
    {
      id: 'op-1',
      name: 'Face milling',
      startedAt: '2026-03-03T08:00:00Z',
      completedAt: '2026-03-03T08:30:00Z',
      result: 'success',
    },
  ],
  lastMaintenanceDate: '2026-02-01T00:00:00Z',
  nextMaintenanceDate: '2026-04-01T00:00:00Z',
  location: 'Bay 3',
  ...overrides,
});

const makeCutListItem = (overrides: Partial<CutListItem> = {}): CutListItem => ({
  id: 'cli-1',
  jobId: 'job-1',
  partId: 'part-1',
  partName: 'Top Bracket',
  partNumber: 'BRK-001',
  material: 'aluminum',
  dimensions: { width: 120, height: 80, depth: 10 },
  quantity: 2,
  quantityCut: 0,
  isCut: false,
  ...overrides,
});

const makeDimensionCheck = (overrides: Partial<DimensionCheck> = {}): DimensionCheck => ({
  id: 'dim-1',
  featureName: 'Total Length',
  nominalValue: 120,
  tolerance: { upper: 0.1, lower: -0.1 },
  unit: 'mm',
  result: 'pending',
  ...overrides,
});

const makeQualityCheck = (overrides: Partial<QualityCheck> = {}): QualityCheck => ({
  id: 'qc-1',
  jobId: 'job-1',
  partId: 'part-1',
  partName: 'Top Bracket',
  partNumber: 'BRK-001',
  machineId: 'cnc-1',
  createdAt: '2026-03-03T10:00:00Z',
  overallResult: 'pending',
  dimensionChecks: [makeDimensionCheck()],
  photoUrls: [],
  notes: '',
  requiresReinspection: false,
  ...overrides,
});

const makeDashboard = (overrides: Partial<DashboardState> = {}): DashboardState => ({
  machines: [makeMachine()],
  activeJobs: [makeJob()],
  jobQueue: [
    makeJob({ id: 'job-2', jobNumber: 'JOB-002', priority: 'high', status: 'queued' }),
    makeJob({ id: 'job-3', jobNumber: 'JOB-003', priority: 'urgent', status: 'queued' }),
  ],
  nextUpParts: [
    {
      id: 'part-2',
      name: 'Side Panel',
      partNumber: 'PNL-002',
      quantity: 4,
      material: 'steel',
      dimensions: { width: 200, height: 150, depth: 5 },
      estimatedTime: 2400,
    },
  ],
  recentActions: [],
  lastUpdated: '2026-03-03T11:30:00Z',
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────────
// 1. UTILITY TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('Utility: getMaterialLabel', () => {
  it('returns correct label for aluminum', () => {
    expect(getMaterialLabel('aluminum')).toBe('Aluminum');
  });

  it('returns correct label for stainless_steel', () => {
    expect(getMaterialLabel('stainless_steel')).toBe('Stainless Steel');
  });

  it('returns correct label for other', () => {
    expect(getMaterialLabel('other')).toBe('Other');
  });
});

describe('Utility: formatDuration', () => {
  it('formats seconds under 60', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(130)).toBe('2m 10s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(7320)).toBe('2h 2m');
  });

  it('formats exactly 0 seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('Utility: formatDimensions', () => {
  it('formats dimensions in mm', () => {
    expect(formatDimensions({ width: 100, height: 50, depth: 20 })).toBe('100 × 50 × 20 mm');
  });

  it('supports custom unit', () => {
    expect(formatDimensions({ width: 5, height: 3, depth: 1 }, 'in')).toBe('5 × 3 × 1 in');
  });
});

describe('Utility: groupCutListByMaterial', () => {
  it('groups items by material', () => {
    const items = [
      makeCutListItem({ id: 'a', material: 'aluminum' }),
      makeCutListItem({ id: 'b', material: 'steel', partId: 'p2' }),
      makeCutListItem({ id: 'c', material: 'aluminum', partId: 'p3' }),
    ];
    const groups = groupCutListByMaterial(items);
    expect(groups).toHaveLength(2);
    const alGroup = groups.find((g) => g.material === 'aluminum');
    expect(alGroup?.items).toHaveLength(2);
  });

  it('calculates totalParts and cutParts correctly', () => {
    const items = [
      makeCutListItem({ quantity: 3, quantityCut: 2 }),
      makeCutListItem({ id: 'b', partId: 'p2', quantity: 5, quantityCut: 5 }),
    ];
    const groups = groupCutListByMaterial(items);
    expect(groups[0].totalParts).toBe(8);
    expect(groups[0].cutParts).toBe(7);
  });
});

describe('Utility: sortJobsByPriority', () => {
  it('sorts urgent before high before normal before low', () => {
    const jobs = [
      makeJob({ id: '1', priority: 'low' }),
      makeJob({ id: '2', priority: 'urgent' }),
      makeJob({ id: '3', priority: 'normal' }),
      makeJob({ id: '4', priority: 'high' }),
    ];
    const sorted = sortJobsByPriority(jobs);
    expect(sorted.map((j) => j.priority)).toEqual(['urgent', 'high', 'normal', 'low']);
  });

  it('preserves original array (does not mutate)', () => {
    const jobs = [makeJob({ id: '1', priority: 'low' }), makeJob({ id: '2', priority: 'urgent' })];
    const original = [...jobs];
    sortJobsByPriority(jobs);
    expect(jobs[0].priority).toBe(original[0].priority);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. SHOPFLOORDASHBOARD TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('ShopFloorDashboard', () => {
  it('renders loading state', () => {
    render(<ShopFloorDashboard loading />);
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<ShopFloorDashboard error="Network timeout" />);
    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
    expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<ShopFloorDashboard />);
    expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument();
  });

  it('renders full dashboard with data', () => {
    render(<ShopFloorDashboard dashboardData={makeDashboard()} />);
    expect(screen.getByTestId('shop-floor-dashboard')).toBeInTheDocument();
  });

  it('displays active job information', () => {
    render(<ShopFloorDashboard dashboardData={makeDashboard()} />);
    expect(screen.getByTestId('active-job-section')).toBeInTheDocument();
    expect(screen.getByText('JOB-001')).toBeInTheDocument();
  });

  it('displays "No active job" when no active jobs', () => {
    render(<ShopFloorDashboard dashboardData={makeDashboard({ activeJobs: [] })} />);
    expect(screen.getByTestId('no-active-job')).toBeInTheDocument();
  });

  it('renders machine status cards', () => {
    render(<ShopFloorDashboard dashboardData={makeDashboard()} />);
    expect(screen.getAllByTestId('machine-status-card')).toHaveLength(1);
  });

  it('calls onMachineSelect when machine card clicked', () => {
    const onSelect = jest.fn();
    render(<ShopFloorDashboard dashboardData={makeDashboard()} onMachineSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('machine-status-card'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'cnc-1' }));
  });

  it('calls onJobSelect when job card clicked', () => {
    const onSelect = jest.fn();
    render(<ShopFloorDashboard dashboardData={makeDashboard()} onJobSelect={onSelect} />);
    // The queue cards are the queued jobs
    const cards = screen.getAllByTestId('job-queue-card');
    fireEvent.click(cards[0]);
    expect(onSelect).toHaveBeenCalled();
  });

  it('renders next-up parts list', () => {
    render(<ShopFloorDashboard dashboardData={makeDashboard()} />);
    expect(screen.getByTestId('next-up-parts-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('next-up-part-item')).toHaveLength(1);
  });

  it('renders next-up empty state when no parts', () => {
    render(<ShopFloorDashboard dashboardData={makeDashboard({ nextUpParts: [] })} />);
    expect(screen.getByTestId('next-up-parts-empty')).toBeInTheDocument();
  });

  it('renders status summary badge', () => {
    render(<ShopFloorDashboard dashboardData={makeDashboard()} />);
    expect(screen.getByTestId('status-summary-badge')).toBeInTheDocument();
  });
});

describe('JobProgressBar', () => {
  it('renders with correct aria attributes', () => {
    render(<JobProgressBar progress={60} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps progress below 0 to 0', () => {
    render(<JobProgressBar progress={-10} showPercent />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('clamps progress above 100 to 100', () => {
    render(<JobProgressBar progress={150} showPercent />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows label when provided', () => {
    render(<JobProgressBar progress={30} label="In progress" />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });
});

describe('MachineStateIndicator', () => {
  it.each(['idle', 'running', 'error', 'maintenance', 'offline'] as const)(
    'renders %s state',
    (state) => {
      render(<MachineStateIndicator state={state} />);
      expect(screen.getByTestId('machine-state-indicator')).toBeInTheDocument();
    },
  );
});

describe('JobQueueCard', () => {
  it('renders job number and name', () => {
    render(<JobQueueCard job={makeJob()} />);
    expect(screen.getByText('JOB-001')).toBeInTheDocument();
    expect(screen.getByText('Bracket Assembly')).toBeInTheDocument();
  });

  it('shows part count', () => {
    render(<JobQueueCard job={makeJob()} />);
    expect(screen.getByTestId('job-parts-count')).toHaveTextContent('1 part');
  });

  it('shows progress bar for running job', () => {
    render(<JobQueueCard job={makeJob({ status: 'running' })} />);
    expect(screen.getByTestId('job-progress-bar')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    const job = makeJob();
    render(<JobQueueCard job={job} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('job-queue-card'));
    expect(onSelect).toHaveBeenCalledWith(job);
  });

  it('applies isActive styling', () => {
    render(<JobQueueCard job={makeJob()} isActive />);
    const card = screen.getByTestId('job-queue-card');
    expect(card).toHaveStyle({ background: '#f0f9ff' });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. CUTLISTVIEW TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('CutListView', () => {
  const makeGroup = (): CutListGroup => ({
    material: 'aluminum',
    items: [
      makeCutListItem(),
      makeCutListItem({ id: 'b', partId: 'p2', partName: 'Base Plate', isCut: true, quantityCut: 3 }),
    ],
    totalParts: 5,
    cutParts: 3,
  });

  it('renders loading state', () => {
    render(<CutListView loading />);
    expect(screen.getByTestId('cut-list-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<CutListView error="Server error" />);
    expect(screen.getByTestId('cut-list-error')).toBeInTheDocument();
    expect(screen.getByText(/Server error/)).toBeInTheDocument();
  });

  it('renders main view', () => {
    render(<CutListView groups={[makeGroup()]} progress={{ total: 5, cut: 3, percent: 60 }} />);
    expect(screen.getByTestId('cut-list-view')).toBeInTheDocument();
  });

  it('renders progress summary', () => {
    render(<CutListView groups={[makeGroup()]} progress={{ total: 5, cut: 3, percent: 60 }} />);
    expect(screen.getByTestId('cut-list-progress')).toBeInTheDocument();
  });

  it('shows material group sections', () => {
    render(<CutListView groups={[makeGroup()]} progress={{ total: 5, cut: 3, percent: 60 }} />);
    expect(screen.getByTestId('material-group-section')).toBeInTheDocument();
  });

  it('shows empty state when no groups', () => {
    render(<CutListView groups={[]} />);
    expect(screen.getByTestId('cut-list-empty')).toBeInTheDocument();
  });

  it('calls onToggleCut when checkbox is clicked', () => {
    const onToggle = jest.fn();
    render(
      <CutListView
        groups={[makeGroup()]}
        onToggleCut={onToggle}
        progress={{ total: 5, cut: 3, percent: 60 }}
      />,
    );
    const checkboxes = screen.getAllByTestId('cut-checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders large mode', () => {
    render(<CutListView groups={[makeGroup()]} largeMode />);
    expect(screen.getByTestId('cut-list-view')).toBeInTheDocument();
  });
});

describe('CutListItemRow', () => {
  it('renders part name and dimensions', () => {
    const item = makeCutListItem();
    const onToggle = jest.fn();
    render(<CutListItemRow item={item} onToggle={onToggle} />);
    expect(screen.getByText('Top Bracket')).toBeInTheDocument();
    expect(screen.getByTestId('item-dimensions')).toHaveTextContent('120 × 80 × 10 mm');
  });

  it('renders quantity', () => {
    const item = makeCutListItem({ quantity: 5 });
    render(<CutListItemRow item={item} onToggle={() => {}} />);
    expect(screen.getByTestId('item-quantity')).toHaveTextContent('5');
  });

  it('shows checkbox as pressed when isCut', () => {
    const item = makeCutListItem({ isCut: true });
    render(<CutListItemRow item={item} onToggle={() => {}} />);
    expect(screen.getByTestId('cut-checkbox')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows notes when present', () => {
    const item = makeCutListItem({ notes: 'Handle with care' });
    render(<CutListItemRow item={item} onToggle={() => {}} />);
    expect(screen.getByTestId('item-notes')).toHaveTextContent('Handle with care');
  });

  it('calls onToggle with partId', () => {
    const onToggle = jest.fn();
    const item = makeCutListItem({ partId: 'p-test' });
    render(<CutListItemRow item={item} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('cut-checkbox'));
    expect(onToggle).toHaveBeenCalledWith('p-test');
  });
});

describe('CutListProgress', () => {
  it('shows correct percentage', () => {
    render(<CutListProgress total={10} cut={7} percent={70} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('shows completion message at 100%', () => {
    render(<CutListProgress total={10} cut={10} percent={100} />);
    expect(screen.getByText(/All parts cut/)).toBeInTheDocument();
  });

  it('renders progress bar with correct aria', () => {
    render(<CutListProgress total={4} cut={2} percent={50} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });
});

describe('MaterialGroupSection', () => {
  const makeGroup = (): CutListGroup => ({
    material: 'steel',
    items: [makeCutListItem({ material: 'steel' })],
    totalParts: 2,
    cutParts: 0,
  });

  it('renders material label', () => {
    render(<MaterialGroupSection group={makeGroup()} onToggle={() => {}} />);
    expect(screen.getByText('Steel')).toBeInTheDocument();
  });

  it('toggles expand/collapse on header click', () => {
    render(<MaterialGroupSection group={makeGroup()} onToggle={() => {}} />);
    // Items visible by default
    expect(screen.getByTestId('cut-list-item-row')).toBeInTheDocument();
    // Collapse
    fireEvent.click(screen.getByTestId('material-group-header'));
    expect(screen.queryByTestId('cut-list-item-row')).not.toBeInTheDocument();
    // Expand again
    fireEvent.click(screen.getByTestId('material-group-header'));
    expect(screen.getByTestId('cut-list-item-row')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. MACHINEMONITOR TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('MachineMonitor', () => {
  it('renders loading state', () => {
    render(<MachineMonitor loading />);
    expect(screen.getByTestId('machine-monitor-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<MachineMonitor error="Connection refused" />);
    expect(screen.getByTestId('machine-monitor-error')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<MachineMonitor />);
    expect(screen.getByTestId('machine-monitor-empty')).toBeInTheDocument();
  });

  it('renders machine data', () => {
    render(<MachineMonitor machine={makeMachine()} />);
    expect(screen.getByTestId('machine-monitor')).toBeInTheDocument();
    expect(screen.getByText('CNC-Alpha')).toBeInTheDocument();
  });

  it('shows current operation', () => {
    render(<MachineMonitor machine={makeMachine()} />);
    expect(screen.getByTestId('current-operation')).toHaveTextContent('Contour milling');
  });

  it('shows metrics row for running machine', () => {
    render(<MachineMonitor machine={makeMachine()} />);
    expect(screen.getByTestId('metrics-row')).toBeInTheDocument();
    expect(screen.getByTestId('feed-rate-panel')).toBeInTheDocument();
    expect(screen.getByTestId('spindle-rpm-panel')).toBeInTheDocument();
  });

  it('does not show metrics row for idle machine', () => {
    render(<MachineMonitor machine={makeMachine({ state: 'idle' })} />);
    expect(screen.queryByTestId('metrics-row')).not.toBeInTheDocument();
  });

  it('renders tool status panel when tool present', () => {
    render(<MachineMonitor machine={makeMachine()} />);
    expect(screen.getByTestId('tool-status-panel')).toBeInTheDocument();
  });

  it('switches to alarms tab', () => {
    render(<MachineMonitor machine={makeMachine()} />);
    fireEvent.click(screen.getByTestId('tab-alarms'));
    expect(screen.getByTestId('tab-content-alarms')).toBeInTheDocument();
  });

  it('switches to history tab', () => {
    render(<MachineMonitor machine={makeMachine()} />);
    fireEvent.click(screen.getByTestId('tab-history'));
    expect(screen.getByTestId('tab-content-history')).toBeInTheDocument();
  });

  it('shows alarm badge count', () => {
    const machine = makeMachine({
      alarms: [
        {
          id: 'a1',
          code: 'ALM-001',
          message: 'Spindle overload',
          severity: 'error',
          timestamp: new Date().toISOString(),
          acknowledged: false,
        },
      ],
    });
    render(<MachineMonitor machine={machine} />);
    expect(screen.getByTestId('unacknowledged-alarms-count')).toBeInTheDocument();
  });
});

describe('EmergencyStopButton', () => {
  it('renders with correct label', () => {
    render(<EmergencyStopButton onStop={() => {}} active={false} />);
    expect(screen.getByTestId('emergency-stop-button')).toBeInTheDocument();
    expect(screen.getByText('E-STOP')).toBeInTheDocument();
  });

  it('requires two clicks (confirm) before firing onStop', () => {
    const onStop = jest.fn();
    render(<EmergencyStopButton onStop={onStop} active={false} />);
    fireEvent.click(screen.getByTestId('emergency-stop-button'));
    expect(onStop).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('e-stop-confirm'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('can cancel the confirm dialog', () => {
    const onStop = jest.fn();
    render(<EmergencyStopButton onStop={onStop} active={false} />);
    fireEvent.click(screen.getByTestId('emergency-stop-button'));
    expect(screen.getByTestId('e-stop-cancel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('e-stop-cancel'));
    expect(onStop).not.toHaveBeenCalled();
    expect(screen.queryByTestId('e-stop-confirm')).not.toBeInTheDocument();
  });

  it('shows STOPPED label when active', () => {
    render(<EmergencyStopButton onStop={() => {}} active />);
    expect(screen.getByTestId('e-stop-active-label')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<EmergencyStopButton onStop={() => {}} active={false} disabled />);
    expect(screen.getByTestId('emergency-stop-button')).toBeDisabled();
  });
});

describe('AlarmList', () => {
  it('shows empty state with no alarms', () => {
    render(<AlarmList alarms={[]} />);
    expect(screen.getByTestId('alarm-list-empty')).toBeInTheDocument();
  });

  it('renders alarm items', () => {
    const alarm: MachineAlarm = {
      id: 'a1',
      code: 'ALM-100',
      message: 'Tool wear critical',
      severity: 'warning',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    render(<AlarmList alarms={[alarm]} />);
    expect(screen.getByTestId('alarm-list')).toBeInTheDocument();
    expect(screen.getByTestId('alarm-item')).toBeInTheDocument();
    expect(screen.getByText('Tool wear critical')).toBeInTheDocument();
  });

  it('calls onAcknowledge when ack button clicked', () => {
    const onAck = jest.fn();
    const alarm: MachineAlarm = {
      id: 'alarm-xyz',
      code: 'A1',
      message: 'Test alarm',
      severity: 'info',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    render(<AlarmList alarms={[alarm]} onAcknowledge={onAck} />);
    fireEvent.click(screen.getByTestId('acknowledge-alarm-btn'));
    expect(onAck).toHaveBeenCalledWith('alarm-xyz');
  });
});

describe('OperationHistoryLog', () => {
  it('shows empty state when no history', () => {
    render(<OperationHistoryLog history={[]} />);
    expect(screen.getByTestId('op-history-empty')).toBeInTheDocument();
  });

  it('renders history items', () => {
    const ops: MachineOperation[] = [
      {
        id: 'o1',
        name: 'Roughing',
        startedAt: '2026-03-03T08:00:00Z',
        completedAt: '2026-03-03T08:20:00Z',
        result: 'success',
      },
    ];
    render(<OperationHistoryLog history={ops} />);
    expect(screen.getByTestId('history-item')).toBeInTheDocument();
    expect(screen.getByText('Roughing')).toBeInTheDocument();
  });

  it('respects maxItems limit', () => {
    const ops: MachineOperation[] = Array.from({ length: 20 }, (_, i) => ({
      id: `op-${i}`,
      name: `Op ${i}`,
      startedAt: '2026-03-03T08:00:00Z',
      result: 'success' as const,
    }));
    render(<OperationHistoryLog history={ops} maxItems={5} />);
    expect(screen.getAllByTestId('history-item')).toHaveLength(5);
  });
});

describe('ToolStatusPanel', () => {
  const tool: ToolInfo = {
    id: 'T01',
    name: '10mm End Mill',
    diameter: 10,
    length: 100,
    material: 'HSS',
    remainingLife: 45,
    wearStatus: 'worn',
  };

  it('renders tool name', () => {
    render(<ToolStatusPanel tool={tool} />);
    expect(screen.getByText('10mm End Mill')).toBeInTheDocument();
  });

  it('shows wear badge', () => {
    render(<ToolStatusPanel tool={tool} />);
    expect(screen.getByTestId('tool-wear-badge')).toHaveTextContent('worn');
  });

  it('renders remaining life progress bar', () => {
    render(<ToolStatusPanel tool={tool} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '45');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. QUALITYCHECKVIEW TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('QualityCheckView', () => {
  it('renders loading state', () => {
    render(<QualityCheckView loading />);
    expect(screen.getByTestId('qc-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<QualityCheckView error="Load failed" />);
    expect(screen.getByTestId('qc-error')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<QualityCheckView />);
    expect(screen.getByTestId('qc-empty')).toBeInTheDocument();
  });

  it('renders the form with check data', () => {
    render(<QualityCheckView check={makeQualityCheck()} />);
    expect(screen.getByTestId('quality-check-view')).toBeInTheDocument();
    expect(screen.getByText('Top Bracket')).toBeInTheDocument();
  });

  it('shows incomplete warning when not all checks filled', () => {
    render(<QualityCheckView check={makeQualityCheck()} onSubmit={() => {}} />);
    expect(screen.getByTestId('incomplete-warning')).toBeInTheDocument();
  });

  it('submit button is disabled when checks incomplete', () => {
    render(<QualityCheckView check={makeQualityCheck()} onSubmit={() => {}} />);
    expect(screen.getByTestId('submit-qc-btn')).toBeDisabled();
  });

  it('submit button enabled when all checks pass', () => {
    const check = makeQualityCheck({
      dimensionChecks: [makeDimensionCheck({ result: 'pass' })],
      visualInspectionPassed: true,
      surfaceFinishPassed: true,
    });
    render(<QualityCheckView check={check} onSubmit={() => {}} />);
    expect(screen.getByTestId('submit-qc-btn')).not.toBeDisabled();
  });

  it('calls onSubmit when submit button clicked', () => {
    const onSubmit = jest.fn();
    const check = makeQualityCheck({
      dimensionChecks: [makeDimensionCheck({ result: 'pass' })],
      visualInspectionPassed: true,
      surfaceFinishPassed: true,
    });
    render(<QualityCheckView check={check} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('submit-qc-btn'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows submitted badge when submitted', () => {
    render(<QualityCheckView check={makeQualityCheck()} submitted />);
    expect(screen.getByTestId('submitted-badge')).toBeInTheDocument();
  });

  it('calls onReset when reset button clicked', () => {
    const onReset = jest.fn();
    render(<QualityCheckView check={makeQualityCheck()} onReset={onReset} />);
    fireEvent.click(screen.getByTestId('reset-qc-btn'));
    expect(onReset).toHaveBeenCalled();
  });

  it('notes textarea updates on change', () => {
    const onSetNotes = jest.fn();
    render(<QualityCheckView check={makeQualityCheck()} onSetNotes={onSetNotes} />);
    fireEvent.change(screen.getByTestId('qc-notes-input'), {
      target: { value: 'Test notes' },
    });
    expect(onSetNotes).toHaveBeenCalledWith('Test notes');
  });

  it('shows "No dimension checks" when check has none', () => {
    render(<QualityCheckView check={makeQualityCheck({ dimensionChecks: [] })} />);
    expect(screen.getByTestId('no-dimension-checks')).toBeInTheDocument();
  });
});

describe('PassFailToggle', () => {
  it('renders pass and fail buttons', () => {
    render(<PassFailToggle result="pending" onChange={() => {}} />);
    expect(screen.getByTestId('pass-button')).toBeInTheDocument();
    expect(screen.getByTestId('fail-button')).toBeInTheDocument();
  });

  it('calls onChange with pass when pass clicked', () => {
    const onChange = jest.fn();
    render(<PassFailToggle result="pending" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('pass-button'));
    expect(onChange).toHaveBeenCalledWith('pass');
  });

  it('calls onChange with fail when fail clicked', () => {
    const onChange = jest.fn();
    render(<PassFailToggle result="pending" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('fail-button'));
    expect(onChange).toHaveBeenCalledWith('fail');
  });

  it('disables buttons when disabled prop is true', () => {
    render(<PassFailToggle result="pending" onChange={() => {}} disabled />);
    expect(screen.getByTestId('pass-button')).toBeDisabled();
    expect(screen.getByTestId('fail-button')).toBeDisabled();
  });

  it('applies active style to pass button when result is pass', () => {
    render(<PassFailToggle result="pass" onChange={() => {}} />);
    expect(screen.getByTestId('pass-button')).toHaveStyle({ background: '#16a34a' });
  });
});

describe('DimensionCheckRow', () => {
  it('renders feature name and nominal value', () => {
    render(
      <DimensionCheckRow
        check={makeDimensionCheck()}
        onUpdateResult={() => {}}
        index={0}
      />,
    );
    expect(screen.getByText('Total Length')).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  it('auto-sets pass when measured value within tolerance', () => {
    const onUpdate = jest.fn();
    render(
      <DimensionCheckRow
        check={makeDimensionCheck()}
        onUpdateResult={onUpdate}
        index={0}
      />,
    );
    fireEvent.change(screen.getByTestId('measured-value-input'), {
      target: { value: '120.05' },
    });
    expect(onUpdate).toHaveBeenCalledWith('dim-1', 'pass', 120.05, undefined);
  });

  it('auto-sets fail when measured value out of tolerance', () => {
    const onUpdate = jest.fn();
    render(
      <DimensionCheckRow
        check={makeDimensionCheck()}
        onUpdateResult={onUpdate}
        index={0}
      />,
    );
    fireEvent.change(screen.getByTestId('measured-value-input'), {
      target: { value: '119.5' },
    });
    expect(onUpdate).toHaveBeenCalledWith('dim-1', 'fail', 119.5, undefined);
  });

  it('shows note textarea when add-note clicked', () => {
    render(
      <DimensionCheckRow
        check={makeDimensionCheck()}
        onUpdateResult={() => {}}
        index={0}
      />,
    );
    fireEvent.click(screen.getByTestId('add-note-btn'));
    expect(screen.getByTestId('dimension-note-input')).toBeInTheDocument();
  });
});

describe('VisualInspectionChecklist', () => {
  it('renders two visual checks', () => {
    render(
      <VisualInspectionChecklist
        onVisualChange={() => {}}
        onSurfaceChange={() => {}}
      />,
    );
    expect(screen.getByTestId('visual-check-visual')).toBeInTheDocument();
    expect(screen.getByTestId('visual-check-surface')).toBeInTheDocument();
  });

  it('calls onVisualChange when pass clicked on visual', () => {
    const onVisual = jest.fn();
    render(
      <VisualInspectionChecklist
        onVisualChange={onVisual}
        onSurfaceChange={() => {}}
      />,
    );
    // Get pass buttons - first one is visual
    const passButtons = screen.getAllByTestId('pass-button');
    fireEvent.click(passButtons[0]);
    expect(onVisual).toHaveBeenCalledWith(true);
  });
});

describe('PhotoPlaceholder', () => {
  it('renders add photo button when not disabled', () => {
    render(<PhotoPlaceholder photoUrls={[]} />);
    expect(screen.getByTestId('add-photo-btn')).toBeInTheDocument();
  });

  it('does not render add button when disabled', () => {
    render(<PhotoPlaceholder photoUrls={[]} disabled />);
    expect(screen.queryByTestId('add-photo-btn')).not.toBeInTheDocument();
  });

  it('renders thumbnails for existing photos', () => {
    render(<PhotoPlaceholder photoUrls={['http://example.com/img1.png', 'http://example.com/img2.png']} />);
    expect(screen.getAllByTestId('photo-thumbnail')).toHaveLength(2);
  });
});

describe('QCResultSummary', () => {
  it('shows PASS for passing check', () => {
    const check = makeQualityCheck({ overallResult: 'pass' });
    render(<QCResultSummary check={check} />);
    expect(screen.getByText('PASS')).toBeInTheDocument();
  });

  it('shows FAIL for failing check', () => {
    const check = makeQualityCheck({ overallResult: 'fail' });
    render(<QCResultSummary check={check} />);
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });

  it('shows dimension pass/fail counts', () => {
    const check = makeQualityCheck({
      overallResult: 'fail',
      dimensionChecks: [
        makeDimensionCheck({ id: 'd1', result: 'pass' }),
        makeDimensionCheck({ id: 'd2', result: 'fail' }),
        makeDimensionCheck({ id: 'd3', result: 'pending' }),
      ],
    });
    render(<QCResultSummary check={check} />);
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/1 pending/)).toBeInTheDocument();
  });
});

describe('MetricPanel', () => {
  it('renders label and value', () => {
    render(<MetricPanel label="RPM" value="12,000" testId="test-metric" />);
    expect(screen.getByTestId('test-metric')).toBeInTheDocument();
    expect(screen.getByText('RPM')).toBeInTheDocument();
    expect(screen.getByText('12,000')).toBeInTheDocument();
  });

  it('renders unit when provided', () => {
    render(<MetricPanel label="Feed" value="800" unit="mm/min" />);
    expect(screen.getByText('mm/min')).toBeInTheDocument();
  });
});
