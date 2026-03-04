export * from './user'
export * from './job'
export * from './product'
export * from './part'
export * from './material'
export * from './machine'
export * from './hardware'
export * from './operation'
export * from './optimization'
export * from './texture'
export * from './tool'
export * from './quote'
export * from './room'
export * from './drawing'
export * from './label'
export * from './construction-method'
export * from './post-processor'
export * from './remnant'

export type { RenderJob, RenderSettings } from '../services/rendering'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  first_name?: string
  last_name?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface ApiError {
  error: string
}

export interface IdResponse {
  id: string
}
