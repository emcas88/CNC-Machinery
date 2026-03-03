import { describe, it, expect } from 'vitest'
import type { User, UserRole, TokenPair, UserProfile, RegisterRequest } from '../user'

describe('User Types', () => {
  it('UserRole accepts valid roles', () => {
    const roles: UserRole[] = ['Admin', 'Manager', 'Operator', 'Viewer']
    expect(roles).toHaveLength(4)
    roles.forEach(role => {
      expect(['Admin', 'Manager', 'Operator', 'Viewer']).toContain(role)
    })
  })

  it('TokenPair has correct shape', () => {
    const token: TokenPair = {
      access_token: 'access123',
      refresh_token: 'refresh456',
      token_type: 'Bearer',
    }
    expect(token.access_token).toBe('access123')
    expect(token.refresh_token).toBe('refresh456')
    expect(token.token_type).toBe('Bearer')
  })

  it('User has all required fields', () => {
    const user: User = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      role: 'Operator',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    expect(user.id).toBeDefined()
    expect(user.email).toBeDefined()
    expect(user.role).toBe('Operator')
  })

  it('UserProfile subset of User fields', () => {
    const profile: UserProfile = {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      role: 'Admin',
      is_active: true,
    }
    expect(profile.role).toBe('Admin')
    // UserProfile does not have created_at/updated_at
    expect('created_at' in profile).toBe(false)
  })

  it('RegisterRequest has required fields', () => {
    const req: RegisterRequest = {
      email: 'new@example.com',
      password: 'SecurePass1!',
      first_name: 'New',
      last_name: 'User',
      username: 'newuser',
    }
    expect(req.email).toBeDefined()
    expect(req.password).toBeDefined()
    expect(req.first_name).toBeDefined()
    expect(req.last_name).toBeDefined()
    expect(req.username).toBeDefined()
  })

  it('User role can be Admin', () => {
    const user: User = {
      id: '1',
      email: 'admin@example.com',
      username: 'admin',
      first_name: 'Admin',
      last_name: 'User',
      role: 'Admin',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    expect(user.role).toBe('Admin')
  })

  it('TokenPair token_type is Bearer', () => {
    const token: TokenPair = {
      access_token: 'abc',
      refresh_token: 'def',
      token_type: 'Bearer',
    }
    expect(token.token_type).toBe('Bearer')
  })

  it('User is_active can be false', () => {
    const user: User = {
      id: '1',
      email: 'inactive@example.com',
      username: 'inactive',
      first_name: 'Inactive',
      last_name: 'User',
      role: 'Viewer',
      is_active: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    expect(user.is_active).toBe(false)
  })

  it('RegisterRequest does not require id', () => {
    const req: RegisterRequest = {
      email: 'test@example.com',
      password: 'pass',
      first_name: 'T',
      last_name: 'U',
      username: 'tu',
    }
    expect('id' in req).toBe(false)
  })
})
