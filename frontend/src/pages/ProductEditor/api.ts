// ============================================================
// ProductEditor — API Service
// ============================================================

import type { Product, Material, Hardware } from './types';

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const json = JSON.parse(text);
      if (json.detail) message = json.detail;
      else if (json.message) message = json.message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Products ──────────────────────────────────────────────────

export async function getProduct(id: string): Promise<Product> {
  const res = await fetch(`${API_BASE}/products/${id}`);
  return handleResponse<Product>(res);
}

export async function listProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/products`);
  return handleResponse<Product[]>(res);
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  return handleResponse<Product>(res);
}

export async function updateProduct(
  id: string,
  product: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Product> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  return handleResponse<Product>(res);
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
}

// ── Materials ─────────────────────────────────────────────────

export async function listMaterials(): Promise<Material[]> {
  const res = await fetch(`${API_BASE}/materials`);
  return handleResponse<Material[]>(res);
}

export async function getMaterial(id: string): Promise<Material> {
  const res = await fetch(`${API_BASE}/materials/${id}`);
  return handleResponse<Material>(res);
}

// ── Hardware ──────────────────────────────────────────────────

export async function listHardware(): Promise<Hardware[]> {
  const res = await fetch(`${API_BASE}/hardware`);
  return handleResponse<Hardware[]>(res);
}

export async function getHardwareItem(id: string): Promise<Hardware> {
  const res = await fetch(`${API_BASE}/hardware/${id}`);
  return handleResponse<Hardware>(res);
}
