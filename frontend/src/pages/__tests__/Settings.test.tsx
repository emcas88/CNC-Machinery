import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Settings from './Settings'

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockUsersService = {
  me: vi.fn(),
  updateUser: vi.fn(),
  changePassword: vi.fn(),
  getUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}

vi.mock('@/services/users', () => ({ usersService: mockUsersService }))

const mockSetTheme = vi.fn()
const mockSetUnitSystem = vi.fn()
const mockStoreState: Record<string, unknown> = {
  theme: 'dark',
  unitSystem: 'metric',
  setTheme: mockSetTheme,
  setUnitSystem: mockSetUnitSystem,
}

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) => selector(mockStoreState),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const user = {
  id: 'u-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  role: 'admin',
  isActive: true,
  lastLogin: '2026-03-01T10:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function renderPage() {
  const client = createClient()
  return render(
    <QueryClientProvider client={client}>
      <Settings />
    </QueryClientProvider>,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockStoreState.theme = 'dark'
    mockStoreState.unitSystem = 'metric'
  })

  /* ---- Loading ---- */
  it('shows loading spinner while fetching user', () => {
    mockUsersService.me.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  /* ---- Error ---- */
  it('shows error state with retry button', async () => {
    mockUsersService.me.mockRejectedValue(new Error('fail'))
    renderPage()
    await waitFor(() => expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument())
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('retries on Retry click', async () => {
    mockUsersService.me.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(user)
    renderPage()
    await waitFor(() => screen.getByText(/retry/i))
    fireEvent.click(screen.getByText(/retry/i))
    await waitFor(() => expect(mockUsersService.me).toHaveBeenCalledTimes(2))
  })

  /* ---- Profile tab ---- */
  it('renders profile tab with user data', async () => {
    mockUsersService.me.mockResolvedValue(user)
    renderPage()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice Smith')).toBeInTheDocument()
      expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
    })
    expect(screen.getByText(/admin/i)).toBeInTheDocument()
  })

  it('saves profile on submit', async () => {
    mockUsersService.me.mockResolvedValue(user)
    mockUsersService.updateUser.mockResolvedValue({ ...user, name: 'Bob' })
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByDisplayValue('Alice Smith'))

    const nameInput = screen.getByLabelText('Name')
    await u.clear(nameInput)
    await u.type(nameInput, 'Bob')
    await u.click(screen.getByText('Save Profile'))

    await waitFor(() => {
      expect(mockUsersService.updateUser).toHaveBeenCalledWith('u-1', expect.objectContaining({ name: 'Bob' }))
    })
    await waitFor(() => expect(screen.getByText('Profile saved.')).toBeInTheDocument())
  })

  it('shows error when profile save fails', async () => {
    mockUsersService.me.mockResolvedValue(user)
    mockUsersService.updateUser.mockRejectedValue(new Error('fail'))
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByDisplayValue('Alice Smith'))
    await u.click(screen.getByText('Save Profile'))
    await waitFor(() => expect(screen.getByText(/failed to save profile/i)).toBeInTheDocument())
  })

  /* ---- Security tab ---- */
  it('switches to security tab and changes password', async () => {
    mockUsersService.me.mockResolvedValue(user)
    mockUsersService.changePassword.mockResolvedValue({ success: true })
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Security'))

    await u.type(screen.getByLabelText('Current Password'), 'old123')
    await u.type(screen.getByLabelText('New Password'), 'newpass99')
    await u.type(screen.getByLabelText('Confirm Password'), 'newpass99')
    await u.click(screen.getByText('Change Password'))

    await waitFor(() => {
      expect(mockUsersService.changePassword).toHaveBeenCalledWith('old123', 'newpass99')
    })
    await waitFor(() => expect(screen.getByText('Password changed.')).toBeInTheDocument())
  })

  it('shows mismatch error when passwords differ', async () => {
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Security'))

    await u.type(screen.getByLabelText('Current Password'), 'old123')
    await u.type(screen.getByLabelText('New Password'), 'abc')
    await u.type(screen.getByLabelText('Confirm Password'), 'xyz')
    await u.click(screen.getByText('Change Password'))

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    expect(mockUsersService.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when change password fails', async () => {
    mockUsersService.me.mockResolvedValue(user)
    mockUsersService.changePassword.mockRejectedValue(new Error('fail'))
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Security'))

    await u.type(screen.getByLabelText('Current Password'), 'old')
    await u.type(screen.getByLabelText('New Password'), 'newpass99')
    await u.type(screen.getByLabelText('Confirm Password'), 'newpass99')
    await u.click(screen.getByText('Change Password'))

    await waitFor(() => expect(screen.getByText(/failed to change password/i)).toBeInTheDocument())
  })

  /* ---- Notifications tab ---- */
  it('toggles notification preferences and saves to localStorage', async () => {
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Notifications'))

    // Toggle "Weekly summary email" – it defaults to false
    const weeklySwitch = screen.getByRole('switch', { name: /weekly summary email/i })
    expect(weeklySwitch).toHaveAttribute('aria-checked', 'false')
    await u.click(weeklySwitch)
    expect(weeklySwitch).toHaveAttribute('aria-checked', 'true')

    await u.click(screen.getByText('Save Preferences'))
    await waitFor(() => expect(screen.getByText('Preferences saved.')).toBeInTheDocument())

    const stored = JSON.parse(localStorage.getItem('cnc_notification_prefs')!)
    expect(stored.emailWeeklyReport).toBe(true)
  })

  it('loads persisted notification prefs from localStorage', async () => {
    localStorage.setItem('cnc_notification_prefs', JSON.stringify({ ...JSON.parse('{}'), emailWeeklyReport: true }))
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Notifications'))
    expect(screen.getByRole('switch', { name: /weekly summary email/i })).toHaveAttribute('aria-checked', 'true')
  })

  /* ---- Appearance tab ---- */
  it('renders appearance tab with theme and unit toggles', async () => {
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Appearance'))

    expect(screen.getByText('dark')).toBeInTheDocument()
    expect(screen.getByText('light')).toBeInTheDocument()
    expect(screen.getByText('metric')).toBeInTheDocument()
    expect(screen.getByText('imperial')).toBeInTheDocument()
  })

  it('calls setTheme when theme button clicked', async () => {
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Appearance'))
    await u.click(screen.getByText('light'))
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('calls setUnitSystem when unit button clicked', async () => {
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('Appearance'))
    await u.click(screen.getByText('imperial'))
    expect(mockSetUnitSystem).toHaveBeenCalledWith('imperial')
  })

  /* ---- System tab ---- */
  it('renders system info', async () => {
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))
    await u.click(screen.getByText('System'))
    expect(screen.getByText('2.0.0')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  /* ---- Tab switching ---- */
  it('switches between all tabs', async () => {
    mockUsersService.me.mockResolvedValue(user)
    const u = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByText('Profile'))

    for (const tab of ['Security', 'Notifications', 'Appearance', 'System', 'Profile'] as const) {
      await u.click(screen.getByText(tab))
      // Each tab has a heading matching the tab name
      if (tab === 'System') {
        expect(screen.getByText('System Information')).toBeInTheDocument()
      } else {
        expect(screen.getByText(tab)).toBeInTheDocument()
      }
    }
  })
})
