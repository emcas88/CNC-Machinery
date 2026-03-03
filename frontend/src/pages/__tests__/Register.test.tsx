import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from '../Register'
import { useAuthStore } from '@/store/useAuthStore'

vi.mock('@/store/useAuthStore')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Register Page', () => {
  const mockRegister = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      register: mockRegister,
    })
  })

  const fillForm = (overrides: Record<string, string> = {}) => {
    const defaults = {
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      email: 'john@example.com',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
    }
    const values = { ...defaults, ...overrides }

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: values.first_name },
    })
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: values.last_name },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: values.username },
    })
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: values.email },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: values.password },
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: values.confirmPassword },
    })
  }

  it('renders registration form', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    expect(screen.getByText('CNC Machinery')).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('submits with valid data', async () => {
    mockRegister.mockResolvedValueOnce(undefined)
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'SecurePass1!',
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
      })
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('validates password mismatch', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    fillForm({ confirmPassword: 'DifferentPass1!' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('validates short password', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    fillForm({ password: 'short', confirmPassword: 'short' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it('validates required fields', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    fillForm({ first_name: '' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument()
    })
  })

  it('shows error on failed registration', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email already exists'))
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument()
    })
  })

  it('shows loading state', async () => {
    mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText('Creating account...')).toBeInTheDocument()
  })

  it('has link to login page', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    expect(screen.getByText(/sign in here/i)).toBeInTheDocument()
  })

  it('clears field error on change', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    fillForm({ first_name: '' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Jane' },
    })
    expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument()
  })
})
