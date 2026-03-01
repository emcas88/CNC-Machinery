export enum JobStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  IN_PRODUCTION = 'in_production',
  COMPLETED = 'completed',
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled',
}

export interface Job {
  id: string
  name: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  projectAddress?: string
  status: JobStatus
  tags: string[]
  notes?: string
  dueDate?: string
  createdAt: string
  updatedAt: string
  roomCount: number
  productCount: number
  totalValue?: number
  assignedUserId?: string
}

export interface CreateJob {
  name: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  projectAddress?: string
  status?: JobStatus
  tags?: string[]
  notes?: string
  dueDate?: string
}

export interface UpdateJob extends Partial<CreateJob> {
  id: string
}

export interface JobDashboard {
  job: Job
  milestones: { label: string; completed: boolean; date?: string }[]
  stats: {
    rooms: number
    products: number
    parts: number
    sheets: number
    estimatedValue: number
  }
}
