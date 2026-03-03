import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the auth store
const mockLogin = vi.fn()
const mockClearError = vi.fn()
const mockStore = {
  login: mockLogin,
  isAuthenticated: false,
  isLoading: false,
  error: null as string | null,
  clearError: mockClearError,
}

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: () => mockStore,
}))

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.isAuthenticated = false
    mockStore.isLoading = false
    mockStore.error = null
  })

  function renderLogin() {
    return render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
  }

  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows validation error when email is empty', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
  })

  it('shows validation error when password is empty', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Password is required')).toBeInTheDocument()
  })

  it('calls login with email and password', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'mypassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'mypassword')
    })
  })

  it('shows loading state while submitting', () => {
    mockStore.isLoading = true
    renderLogin()
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('displays store error message', async () => {
    mockStore.error = 'Invalid credentials'
    renderLogin()
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })
})
