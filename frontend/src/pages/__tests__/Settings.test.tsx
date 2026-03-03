import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { Settings } from '@/pages/Settings'

describe('Settings', () => {
  const renderPage = () => render(<Settings />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Settings" heading', () => {
    renderPage()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders the sidebar tabs', () => {
    renderPage()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it('renders Profile Settings by default', () => {
    renderPage()
    expect(screen.getByText('Profile Settings')).toBeInTheDocument()
    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Last Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('renders Save Changes button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })
})
