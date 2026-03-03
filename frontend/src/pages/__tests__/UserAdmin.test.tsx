import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { UserAdmin } from '@/pages/UserAdmin'

describe('UserAdmin', () => {
  it('renders without crashing', () => {
    render(<UserAdmin />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "User Administration" heading', () => {
    render(<UserAdmin />)
    expect(screen.getByText('User Administration')).toBeInTheDocument()
  })

  it('renders the active users count summary', () => {
    render(<UserAdmin />)
    expect(screen.getByText(/active users/)).toBeInTheDocument()
  })

  it('renders the "Add User" button', () => {
    render(<UserAdmin />)
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument()
  })

  it('renders the users table with column headers', () => {
    render(<UserAdmin />)
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Last Login')).toBeInTheDocument()
  })

  it('renders mock user rows', () => {
    render(<UserAdmin />)
    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('Tom Robertson')).toBeInTheDocument()
    expect(screen.getByText('Sarah Kim')).toBeInTheDocument()
    expect(screen.getByText('Inactive User')).toBeInTheDocument()
  })

  it('renders Active and inactive status', () => {
    render(<UserAdmin />)
    const activeElements = screen.getAllByText('active')
    expect(activeElements.length).toBeGreaterThan(0)
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })
})
