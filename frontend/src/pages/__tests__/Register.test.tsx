import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Register } from '../Register'

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockLoginWithTokens = vi.fn()
const mockAuthState = {
  isAuthenticated: false,
  isLoading: false,
  loginWithTokens: mockLoginWithTokens,
}

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: typeof mockAuthState) => unknown) =>
      selector ? selector(mockAuthState) : mockAuthState,
    { getState: () => mockAuthState },
  ),
}))

const mockRegister = vi.fn()
vi.mock('@/services/users', () => ({
  usersService: { register: (...args: unknown[]) => mockRegister(...args) },
}))

vi.mock('@/types', () => ({
  UserRole: {
    ADMIN: 'admin',
    DESIGNER: 'designer',
    PRODUCTION: 'production',
    OPERATOR: 'operator',
    VIEWER: 'viewer',
  },
}))

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Register />
    </MemoryRouter>,
  )
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<'name' | 'email' | 'password' | 'confirm', string>> = {},
) {
  const vals = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'StrongPass1',
    confirm: 'StrongPass1',
    ...overrides,
  }
  await user.type(screen.getByLabelText(/full name/i), vals.name)
  await user.type(screen.getByLabelText(/^email$/i), vals.email)
  await user.type(screen.getByLabelText(/^password$/i), vals.password)
  await user.type(screen.getByLabelText(/confirm password/i), vals.confirm)
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.isAuthenticated = false
  })

  // 1
  it('renders all form fields', () => {
    renderRegister()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  // 2
  it('validates that name is required', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
  })

  // 3
  it('validates that email is required', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/full name/i), 'John')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required')
  })

  // 4
  it('validates password minimum length', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/full name/i), 'John')
    await user.type(screen.getByLabelText(/^email$/i), 'j@e.com')
    await user.type(screen.getByLabelText(/^password$/i), 'Ab1')
    await user.type(screen.getByLabelText(/confirm password/i), 'Ab1')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters')
  })

  // 5
  it('validates password must have uppercase letter', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/full name/i), 'John')
    await user.type(screen.getByLabelText(/^email$/i), 'j@e.com')
    await user.type(screen.getByLabelText(/^password$/i), 'lowercase1')
    await user.type(screen.getByLabelText(/confirm password/i), 'lowercase1')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('uppercase letter')
  })

  // 6
  it('validates password must have lowercase letter', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/full name/i), 'John')
    await user.type(screen.getByLabelText(/^email$/i), 'j@e.com')
    await user.type(screen.getByLabelText(/^password$/i), 'UPPERCASE1')
    await user.type(screen.getByLabelText(/confirm password/i), 'UPPERCASE1')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('lowercase letter')
  })

  // 7
  it('validates password must have a digit', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/full name/i), 'John')
    await user.type(screen.getByLabelText(/^email$/i), 'j@e.com')
    await user.type(screen.getByLabelText(/^password$/i), 'NoDigitHere')
    await user.type(screen.getByLabelText(/confirm password/i), 'NoDigitHere')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('digit')
  })

  // 8
  it('validates passwords must match', async () => {
    const user = userEvent.setup()
    renderRegister()
    await fillForm(user, { confirm: 'DifferentPass1' })
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
  })

  // 9
  it('calls usersService.register with correct data on valid form', async () => {
    const tokens = { access_token: 'tok', refresh_token: 'ref', token_type: 'Bearer', expires_in: 3600 }
    mockRegister.mockResolvedValueOnce(tokens)
    mockLoginWithTokens.mockResolvedValueOnce(undefined)

    const user = userEvent.setup()
    renderRegister()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'StrongPass1',
        role: 'operator',
      })
    })
  })

  // 10
  it('redirects to /dashboard on successful registration', async () => {
    const tokens = { access_token: 'tok', refresh_token: 'ref', token_type: 'Bearer', expires_in: 3600 }
    mockRegister.mockResolvedValueOnce(tokens)
    mockLoginWithTokens.mockResolvedValueOnce(undefined)

    const user = userEvent.setup()
    renderRegister()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockLoginWithTokens).toHaveBeenCalledWith(tokens)
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  // 11
  it('shows error on registration failure', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email already exists'))

    const user = userEvent.setup()
    renderRegister()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already exists')
    })
  })

  // 12
  it('has a link to the login page', () => {
    renderRegister()
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  // 13
  it('redirects to /dashboard if already authenticated', () => {
    mockAuthState.isAuthenticated = true
    renderRegister()
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  // 14
  it('shows password strength indicator as user types', async () => {
    const user = userEvent.setup()
    renderRegister()

    const pwInput = screen.getByLabelText(/^password$/i)
    await user.type(pwInput, 'a')
    expect(screen.getByTestId('password-strength')).toHaveTextContent('Weak')

    await user.clear(pwInput)
    await user.type(pwInput, 'abcdefgh')
    expect(screen.getByTestId('password-strength')).toHaveTextContent('Fair')

    await user.clear(pwInput)
    await user.type(pwInput, 'Abcdefgh')
    expect(screen.getByTestId('password-strength')).toHaveTextContent('Good')

    await user.clear(pwInput)
    await user.type(pwInput, 'Abcdefg1')
    expect(screen.getByTestId('password-strength')).toHaveTextContent('Strong')
  })

  // 15
  it('shows loading state while submitting', async () => {
    mockRegister.mockReturnValueOnce(new Promise(() => {}))

    const user = userEvent.setup()
    renderRegister()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent(/creating account/i)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })
})
