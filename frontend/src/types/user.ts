export enum UserRole {
  ADMIN = 'admin',
  DESIGNER = 'designer',
  PRODUCTION = 'production',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface CreateUser {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateUser {
  id: string
  name?: string
  email?: string
  role?: UserRole
  isActive?: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
  expiresAt: string
}
