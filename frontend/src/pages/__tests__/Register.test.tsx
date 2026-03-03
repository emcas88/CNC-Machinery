import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '../Register'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockRegister = vi.fn()
const mockClearError = vi.fn()
const mockStore = {
  register: mockRegister,
  isAuthenticated: false,
  isLoading: false,
  error: null as string | null,
  clearError: mockClearError,
}

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: () => mockStore,
}))

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.isAuthenticated = false
    mockStore.isLoading = false
    mockStore.error = null
  })

  function renderRegister() {
    return render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
  }

  it('renders all form fields', () => {
    renderRegister()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    // Use getAllByLabelText for password fields to handle multiple matches
    const passwordFields = screen.getAllByLabelText(/password/i)
    expect(passwordFields.length).toBeGreaterThanOrEqual(2)
  })

  it('shows error when email is empty', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
  })

  it('shows error for invalid email format', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('shows error when password is empty', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Password is required')).toBeInTheDocument()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    const [passwordField] = screen.getAllByLabelText(/^password$/i)
    await user.type(passwordField, 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    const passwordFields = screen.getAllByLabelText(/password/i)
    await user.type(passwordFields[0], 'password123')
    await user.type(passwordFields[1], 'different123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  })

  it('calls register with correct payload', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/first name/i), 'Jane')
    await user.type(screen.getByLabelText(/last name/i), 'Smith')
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    const passwordFields = screen.getAllByLabelText(/password/i)
    await user.type(passwordFields[0], 'secret123')
    await user.type(passwordFields[1], 'secret123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'secret123',
        first_name: 'Jane',
        last_name: 'Smith',
      })
    })
  })

  it('shows loading state', () => {
    mockStore.isLoading = true
    renderRegister()
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
  })

  it('displays store error', async () => {
    mockStore.error = 'Email already registered'
    renderRegister()
    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument()
    })
  })
})
