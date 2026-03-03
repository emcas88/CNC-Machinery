import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../../auth/ProtectedRoute'

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

const mockAuthState = {
  isAuthenticated: false,
  isLoading: false,
}

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector?: (s: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}))

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function renderWithRouter(isAuth: boolean, loading: boolean) {
  mockAuthState.isAuthenticated = isAuth
  mockAuthState.isLoading = loading

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.isAuthenticated = false
    mockAuthState.isLoading = false
  })

  // 1 (total: 27)
  it('renders children when user is authenticated', () => {
    renderWithRouter(true, false)
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })

  // 2 (total: 28)
  it('redirects to /login when user is not authenticated', () => {
    renderWithRouter(false, false)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  // 3 (total: 29)
  it('shows loading spinner when isLoading is true', () => {
    renderWithRouter(false, true)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
    // The spinner uses animate-spin
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // 4 (total: 30)
  it('does not render children while loading even if authenticated', () => {
    renderWithRouter(true, true)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // 5 (total: 31)
  it('does not show login page while loading', () => {
    renderWithRouter(false, true)
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })
})
