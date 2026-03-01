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

  it('renders the user count summary', () => {
    render(<UserAdmin />)
    expect(screen.getByText(/total users/i)).toBeInTheDocument()
  })

  it('renders the "Invite User" button', () => {
    render(<UserAdmin />)
    expect(screen.getByRole('button', { name: /invite user/i })).toBeInTheDocument()
  })

  it('renders the users table with column headers', () => {
    render(<UserAdmin />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders mock user rows', () => {
    render(<UserAdmin />)
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })

  it('renders Active and Pending status badges', () => {
    render(<UserAdmin />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})
