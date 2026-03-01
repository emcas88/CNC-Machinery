import { http, HttpResponse } from 'msw'

const BASE = '/api'

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ token: 'mock-token', user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'designer', isActive: true, createdAt: '', updatedAt: '' } })
  ),
  http.post(`${BASE}/auth/logout`, () => HttpResponse.json({ ok: true })),
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ id: 'u1', name: 'Test User', email: 'test@example.com', role: 'designer', isActive: true, createdAt: '', updatedAt: '' })
  ),

  // Jobs
  http.get(`${BASE}/jobs`, () => HttpResponse.json([])),
  http.post(`${BASE}/jobs`, () => HttpResponse.json({ id: 'job-1', name: 'New Job' }, { status: 201 })),
  http.get(`${BASE}/jobs/:id`, ({ params }) => HttpResponse.json({ id: params.id, name: 'Job' })),
  http.patch(`${BASE}/jobs/:id`, ({ params }) => HttpResponse.json({ id: params.id })),
  http.delete(`${BASE}/jobs/:id`, () => new HttpResponse(null, { status: 204 })),

  // Rooms
  http.get(`${BASE}/jobs/:jobId/rooms`, () => HttpResponse.json([])),
  http.post(`${BASE}/rooms`, () => HttpResponse.json({ id: 'room-1' }, { status: 201 })),
  http.get(`${BASE}/rooms/:id`, ({ params }) => HttpResponse.json({ id: params.id })),
  http.patch(`${BASE}/rooms/:id`, ({ params }) => HttpResponse.json({ id: params.id })),
  http.delete(`${BASE}/rooms/:id`, () => new HttpResponse(null, { status: 204 })),

  // Materials
  http.get(`${BASE}/materials`, () => HttpResponse.json([])),
  http.post(`${BASE}/materials`, () => HttpResponse.json({ id: 'mat-1' }, { status: 201 })),
  http.get(`${BASE}/materials/:id`, ({ params }) => HttpResponse.json({ id: params.id })),
  http.patch(`${BASE}/materials/:id`, ({ params }) => HttpResponse.json({ id: params.id })),
  http.delete(`${BASE}/materials/:id`, () => new HttpResponse(null, { status: 204 })),
]
