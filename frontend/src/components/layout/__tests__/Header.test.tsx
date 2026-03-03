import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { Header } from '@/components/layout/Header'

// Mock useAppStore
vi.mock('@/store', () => ({
  useAppStore: () => ({ currentJob: null }),
}))

describe('Header', () => {
  beforeEach(() => {
    // Set path to /dashboard so we get a known title
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard' },
      writable: true,
    })
  })

  it('renders without crashing', () => {
    render(<Header />)
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('renders page title derived from path', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard' },
      writable: true,
    })
    render(<Header />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<Header />)
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })

  it('renders notification bell button', () => {
    render(<Header />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders settings link', () => {
    render(<Header />)
    const settingsLink = document.querySelector('a[href="/settings"]')
    expect(settingsLink).toBeInTheDocument()
  })

  it('renders user avatar area with "User" text', () => {
    render(<Header />)
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  it('renders different title for /bom path', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/bom' },
      writable: true,
    })
    render(<Header />)
    expect(screen.getByText('Bill of Materials')).toBeInTheDocument()
  })
})
