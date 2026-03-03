import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Login } from '../Login'

/* ------------------------------------------------------------------ */
/* Mock navigate                                                       */
/* ------------------------------------------------------------------ */
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

/* ------------------------------------------------------------------ */
/* Mock auth store                                                     */
/* ------------------------------------------------------------------ */
const mockLoginWithTokens = vi.fn()
const mockAuthState = { isAuthenticated: false, loginWithTokens: mockLoginWithTokens }
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector?: (s: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}))

/* ------------------------------------------------------------------ */
/* Mock usersService                                                   */
/* ------------------------------------------------------------------ */
const mockLogin = vi.fn()
vi.mock('@/services/users', () => ({
  usersService: { login: mockLogin },
}))

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */
describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.isAuthenticated = false
  })

  // 1
  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  // 2
  it('shows error when email is empty on submit', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required')
  })

  // 3
  it('shows error when password is empty', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Password is required')
  })

  // 4
  it('calls usersService.login with trimmed credentials', async () => {
    mockLogin.mockResolvedValue({ access_token: 'at', refresh_token: 'rt' })
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), '  user@example.com  ')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'secret',
      }),
    )
  })

  // 5
  it('calls loginWithTokens and navigates on success', async () => {
    const fakeTokens = { access_token: 'at', refresh_token: 'rt' }
    mockLogin.mockResolvedValue(fakeTokens)
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockLoginWithTokens).toHaveBeenCalledWith(fakeTokens))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  // 6
  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  // 7
  it('disables submit button while loading', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}))
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled(),
    )
  })

  // 8
  it('toggle shows and hides password', async () => {
    renderLogin()
    const input = screen.getByLabelText('Password') as HTMLInputElement
    expect(input.type).toBe('password')
    await userEvent.click(screen.getByRole('button', { name: /show password/i }))
    expect(input.type).toBe('text')
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(input.type).toBe('password')
  })
})
