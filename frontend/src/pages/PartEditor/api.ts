// ─────────────────────────────────────────────────────────────────────────────
// PartEditor — API Service
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Part,
  Operation,
  UpdatePartPayload,
  AddOperationPayload,
  Material,
} from './types';

const BASE_URL = '/api';

// ─── Internal helper ─────────────────────────────────────────────────────────

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body?.message ?? `Request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

// ─── Parts ────────────────────────────────────────────────────────────────────

/**
 * Fetch a single part by its ID.
 */
export async function getPart(partId: string): Promise<Part> {
  return request<Part>(`/parts/${encodeURIComponent(partId)}`);
}

/**
 * Update mutable fields of a part. Returns the updated Part.
 */
export async function updatePart(
  partId: string,
  payload: UpdatePartPayload
): Promise<Part> {
  return request<Part>(`/parts/${encodeURIComponent(partId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Operations ───────────────────────────────────────────────────────────────

/**
 * List all operations for a given part.
 */
export async function listOperations(partId: string): Promise<Operation[]> {
  return request<Operation[]>(
    `/parts/${encodeURIComponent(partId)}/operations`
  );
}

/**
 * Add a new operation to a part. Returns the newly created Operation.
 */
export async function addOperation(
  partId: string,
  payload: AddOperationPayload
): Promise<Operation> {
  return request<Operation>(
    `/parts/${encodeURIComponent(partId)}/operations`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Update an existing operation.
 */
export async function updateOperation(
  partId: string,
  operationId: string,
  payload: Partial<AddOperationPayload>
): Promise<Operation> {
  return request<Operation>(
    `/parts/${encodeURIComponent(partId)}/operations/${encodeURIComponent(
      operationId
    )}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Delete an operation by ID.
 */
export async function deleteOperation(
  partId: string,
  operationId: string
): Promise<void> {
  await request<void>(
    `/parts/${encodeURIComponent(partId)}/operations/${encodeURIComponent(
      operationId
    )}`,
    { method: 'DELETE' }
  );
}

// ─── Materials ────────────────────────────────────────────────────────────────

/**
 * List all available materials (used for dropdowns).
 */
export async function listMaterials(): Promise<Material[]> {
  return request<Material[]>('/materials');
}
