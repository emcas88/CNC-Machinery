import api from './api'
import type { Quote, CreateQuote, CostEstimate } from '@/types'

export const quotesService = {
  getQuotes: (jobId: string) =>
    api.get<Quote[]>(`/jobs/${jobId}/quotes`).then((r) => r.data),

  getQuote: (id: string) =>
    api.get<Quote>(`/quotes/${id}`).then((r) => r.data),

  createQuote: (data: CreateQuote) =>
    api.post<Quote>('/quotes', data).then((r) => r.data),

  updateQuote: (id: string, data: Partial<CreateQuote>) =>
    api.patch<Quote>(`/quotes/${id}`, data).then((r) => r.data),

  deleteQuote: (id: string) =>
    api.delete(`/quotes/${id}`).then((r) => r.data),

  generateEstimate: (jobId: string) =>
    api.post<CostEstimate>(`/jobs/${jobId}/estimate`).then((r) => r.data),

  exportQuote: (id: string, format: 'pdf' | 'csv') =>
    api.get(`/quotes/${id}/export`, { params: { format }, responseType: 'blob' }).then((r) => r.data),

  sendQuote: (id: string, email: string) =>
    api.post(`/quotes/${id}/send`, { email }).then((r) => r.data),
}
