export interface Quote {
  id: string
  jobId: string
  name: string
  status: QuoteStatus
  lineItems: QuoteLineItem[]
  subtotal: number
  markupPercent: number
  taxRate: number
  total: number
  notes?: string
  validUntil?: string
  clientName?: string
  clientEmail?: string
  createdAt: string
  updatedAt: string
}

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

export interface QuoteLineItem {
  id: string
  description: string
  category: string
  quantity: number
  unit: string
  unitCost: number
  total: number
  notes?: string
}

export interface CostEstimate {
  materials: CostBreakdown[]
  hardware: CostBreakdown[]
  labour: CostBreakdown[]
  overheads: CostBreakdown[]
  subtotal: number
  suggested: number
}

export interface CostBreakdown {
  label: string
  quantity: number
  unit: string
  unitCost: number
  total: number
}

export interface CreateQuote {
  jobId: string
  name: string
  lineItems?: QuoteLineItem[]
  markupPercent?: number
  taxRate?: number
  notes?: string
  validUntil?: string
}
