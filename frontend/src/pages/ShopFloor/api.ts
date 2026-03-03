// ─── Shop Floor API Layer ─────────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Handles all HTTP interactions with the backend CNC management API.

import {
  Job,
  MachineStatus,
  CutListItem,
  QualityCheck,
  OperatorAction,
  DashboardState,
  ApiResponse,
  PaginatedResponse,
  QCResult,
} from './types';

// ─── Base Config ──────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? '/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });

    if (!res.ok) {
      throw new ApiError(
        `HTTP ${res.status}: ${res.statusText}`,
        res.status,
        String(res.status),
      );
    }

    return (await res.json()) as ApiResponse<T>;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function fetchDashboard(): Promise<DashboardState> {
  const res = await request<DashboardState>('/shop-floor/dashboard');
  return res.data;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function fetchJobQueue(
  machineId?: string,
): Promise<PaginatedResponse<Job>> {
  const qs = machineId ? `?machineId=${encodeURIComponent(machineId)}` : '';
  return request<Job[]>(`/jobs/queue${qs}`) as unknown as PaginatedResponse<Job>;
}

export async function fetchJob(jobId: string): Promise<Job> {
  const res = await request<Job>(`/jobs/${encodeURIComponent(jobId)}`);
  return res.data;
}

export async function startJob(jobId: string, operatorId: string): Promise<Job> {
  const res = await request<Job>(`/jobs/${encodeURIComponent(jobId)}/start`, {
    method: 'POST',
    body: JSON.stringify({ operatorId }),
  });
  return res.data;
}

export async function pauseJob(
  jobId: string,
  operatorId: string,
  reason?: string,
): Promise<Job> {
  const res = await request<Job>(`/jobs/${encodeURIComponent(jobId)}/pause`, {
    method: 'POST',
    body: JSON.stringify({ operatorId, reason }),
  });
  return res.data;
}

export async function resumeJob(jobId: string, operatorId: string): Promise<Job> {
  const res = await request<Job>(`/jobs/${encodeURIComponent(jobId)}/resume`, {
    method: 'POST',
    body: JSON.stringify({ operatorId }),
  });
  return res.data;
}

export async function completeJob(jobId: string, operatorId: string): Promise<Job> {
  const res = await request<Job>(`/jobs/${encodeURIComponent(jobId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ operatorId }),
  });
  return res.data;
}

export async function cancelJob(
  jobId: string,
  operatorId: string,
  reason: string,
): Promise<Job> {
  const res = await request<Job>(`/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ operatorId, reason }),
  });
  return res.data;
}

// ─── Machines ─────────────────────────────────────────────────────────────────

export async function fetchMachines(): Promise<MachineStatus[]> {
  const res = await request<MachineStatus[]>('/machines');
  return res.data;
}

export async function fetchMachine(machineId: string): Promise<MachineStatus> {
  const res = await request<MachineStatus>(
    `/machines/${encodeURIComponent(machineId)}`,
  );
  return res.data;
}

export async function sendEmergencyStop(
  machineId: string,
  operatorId: string,
): Promise<{ acknowledged: boolean }> {
  const res = await request<{ acknowledged: boolean }>(
    `/machines/${encodeURIComponent(machineId)}/emergency-stop`,
    {
      method: 'POST',
      body: JSON.stringify({ operatorId, timestamp: new Date().toISOString() }),
    },
  );
  return res.data;
}

export async function resetMachine(
  machineId: string,
  operatorId: string,
): Promise<MachineStatus> {
  const res = await request<MachineStatus>(
    `/machines/${encodeURIComponent(machineId)}/reset`,
    {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    },
  );
  return res.data;
}

export async function acknowledgeAlarm(
  machineId: string,
  alarmId: string,
  operatorId: string,
): Promise<void> {
  await request<void>(
    `/machines/${encodeURIComponent(machineId)}/alarms/${encodeURIComponent(alarmId)}/acknowledge`,
    {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    },
  );
}

// ─── Cut List ─────────────────────────────────────────────────────────────────

export async function fetchCutList(jobId: string): Promise<CutListItem[]> {
  const res = await request<CutListItem[]>(
    `/jobs/${encodeURIComponent(jobId)}/cut-list`,
  );
  return res.data;
}

export async function markPartCut(
  jobId: string,
  partId: string,
  operatorId: string,
  quantity?: number,
): Promise<CutListItem> {
  const res = await request<CutListItem>(
    `/jobs/${encodeURIComponent(jobId)}/cut-list/${encodeURIComponent(partId)}/cut`,
    {
      method: 'POST',
      body: JSON.stringify({ operatorId, quantity }),
    },
  );
  return res.data;
}

export async function unmarkPartCut(
  jobId: string,
  partId: string,
  operatorId: string,
): Promise<CutListItem> {
  const res = await request<CutListItem>(
    `/jobs/${encodeURIComponent(jobId)}/cut-list/${encodeURIComponent(partId)}/uncut`,
    {
      method: 'POST',
      body: JSON.stringify({ operatorId }),
    },
  );
  return res.data;
}

// ─── Quality Checks ───────────────────────────────────────────────────────────

export async function fetchQualityChecks(
  jobId: string,
): Promise<QualityCheck[]> {
  const res = await request<QualityCheck[]>(
    `/jobs/${encodeURIComponent(jobId)}/quality-checks`,
  );
  return res.data;
}

export async function fetchQualityCheck(checkId: string): Promise<QualityCheck> {
  const res = await request<QualityCheck>(
    `/quality-checks/${encodeURIComponent(checkId)}`,
  );
  return res.data;
}

export async function submitQualityCheck(
  check: Omit<QualityCheck, 'id' | 'submittedAt'>,
): Promise<QualityCheck> {
  const res = await request<QualityCheck>('/quality-checks', {
    method: 'POST',
    body: JSON.stringify(check),
  });
  return res.data;
}

export async function updateDimensionCheckResult(
  checkId: string,
  dimensionId: string,
  result: QCResult,
  measuredValue?: number,
  notes?: string,
): Promise<QualityCheck> {
  const res = await request<QualityCheck>(
    `/quality-checks/${encodeURIComponent(checkId)}/dimensions/${encodeURIComponent(dimensionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ result, measuredValue, notes }),
    },
  );
  return res.data;
}

// ─── Operator Actions ─────────────────────────────────────────────────────────

export async function logOperatorAction(
  action: Omit<OperatorAction, 'id'>,
): Promise<OperatorAction> {
  const res = await request<OperatorAction>('/operator-actions', {
    method: 'POST',
    body: JSON.stringify(action),
  });
  return res.data;
}

export async function fetchOperatorActions(
  machineId?: string,
  jobId?: string,
  limit = 50,
): Promise<OperatorAction[]> {
  const params = new URLSearchParams();
  if (machineId) params.set('machineId', machineId);
  if (jobId) params.set('jobId', jobId);
  params.set('limit', String(limit));

  const res = await request<OperatorAction[]>(
    `/operator-actions?${params.toString()}`,
  );
  return res.data;
}

// Export error class for consumers
export { ApiError };
