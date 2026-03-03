// ─── Shop Floor Types ─────────────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Types for jobs, machines, cut lists, quality checks, and operator actions.

// ─── Enums ────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'setup'
  | 'running'
  | 'paused'
  | 'complete'
  | 'error'
  | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export type MachineState = 'idle' | 'running' | 'error' | 'maintenance' | 'offline';

export type MaterialType =
  | 'aluminum'
  | 'steel'
  | 'stainless_steel'
  | 'titanium'
  | 'brass'
  | 'plastic'
  | 'wood'
  | 'composite'
  | 'other';

export type QCResult = 'pass' | 'fail' | 'pending';

export type OperatorActionType =
  | 'job_start'
  | 'job_pause'
  | 'job_resume'
  | 'job_complete'
  | 'job_cancel'
  | 'part_cut'
  | 'tool_change'
  | 'machine_reset'
  | 'emergency_stop'
  | 'qc_submit'
  | 'note_added';

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface JobPart {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  material: MaterialType;
  /** Width × Height × Depth in mm */
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  /** Estimated machining time in seconds */
  estimatedTime: number;
  notes?: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  name: string;
  description?: string;
  priority: JobPriority;
  status: JobStatus;
  machineId: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  scheduledStart?: string;
  /** ISO timestamp */
  startedAt?: string;
  /** ISO timestamp */
  completedAt?: string;
  /** 0–100 */
  progress: number;
  parts: JobPart[];
  operatorId?: string;
  notes?: string;
  estimatedDurationSeconds: number;
  elapsedSeconds: number;
}

// ─── Machine Status ────────────────────────────────────────────────────────────

export interface ToolInfo {
  id: string;
  name: string;
  diameter: number; // mm
  length: number; // mm
  material: string;
  remainingLife: number; // percent 0-100
  wearStatus: 'good' | 'worn' | 'critical';
}

export interface MachineAlarm {
  id: string;
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  acknowledged: boolean;
}

export interface MachineOperation {
  id: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  result?: 'success' | 'failed' | 'aborted';
  notes?: string;
}

export interface MachineStatus {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  state: MachineState;
  currentJobId?: string;
  currentOperation?: string;
  currentTool?: ToolInfo;
  /** mm/min */
  feedRate: number;
  /** RPM */
  spindleRpm: number;
  /** Celsius */
  temperature?: number;
  /** 0–100 */
  coolantLevel?: number;
  /** Seconds */
  estimatedTimeRemaining?: number;
  /** Seconds */
  runTimeToday: number;
  alarms: MachineAlarm[];
  operationHistory: MachineOperation[];
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  location?: string;
}

// ─── Cut List ─────────────────────────────────────────────────────────────────

export interface CutListItem {
  id: string;
  jobId: string;
  partId: string;
  partName: string;
  partNumber: string;
  material: MaterialType;
  /** Width × Height × Depth in mm */
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  quantity: number;
  quantityCut: number;
  notes?: string;
  isCut: boolean;
  /** ISO timestamp when marked cut */
  cutAt?: string;
  cutBy?: string;
  /** Sheet/stock the part is cut from */
  stockReference?: string;
  /** Nest position on the stock */
  nestingPosition?: string;
}

export interface CutListGroup {
  material: MaterialType;
  items: CutListItem[];
  totalParts: number;
  cutParts: number;
}

// ─── Quality Check ────────────────────────────────────────────────────────────

export interface DimensionCheck {
  id: string;
  featureName: string;
  nominalValue: number;
  tolerance: {
    upper: number;
    lower: number;
  };
  /** mm */
  unit: string;
  measuredValue?: number;
  result: QCResult;
  notes?: string;
}

export interface QualityCheck {
  id: string;
  jobId: string;
  partId: string;
  partName: string;
  partNumber: string;
  inspectorId?: string;
  machineId: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  submittedAt?: string;
  overallResult: QCResult;
  dimensionChecks: DimensionCheck[];
  visualInspectionPassed?: boolean;
  surfaceFinishPassed?: boolean;
  /** Base64 or URL */
  photoUrls: string[];
  notes: string;
  requiresReinspection: boolean;
  signedOffBy?: string;
}

// ─── Operator Action ──────────────────────────────────────────────────────────

export interface OperatorAction {
  id: string;
  type: OperatorActionType;
  operatorId: string;
  operatorName: string;
  machineId?: string;
  jobId?: string;
  partId?: string;
  /** ISO timestamp */
  timestamp: string;
  details?: Record<string, unknown>;
  notes?: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardState {
  machines: MachineStatus[];
  activeJobs: Job[];
  jobQueue: Job[];
  nextUpParts: JobPart[];
  recentActions: OperatorAction[];
  lastUpdated: string;
}

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
