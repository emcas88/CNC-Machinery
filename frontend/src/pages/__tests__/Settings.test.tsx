import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { Settings } from '@/pages/Settings'

describe('Settings', () => {
  it('renders without crashing', () => {
    render(<Settings />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Application Settings" heading', () => {
    render(<Settings />)
    expect(screen.getByText('Application Settings')).toBeInTheDocument()
  })

  it('renders the Units & Measurements section', () => {
    render(<Settings />)
    expect(screen.getByText('Units & Measurements')).toBeInTheDocument()
    expect(screen.getByText('Unit System')).toBeInTheDocument()
  })

  it('renders the Defaults section with panel thickness inputs', () => {
    render(<Settings />)
    expect(screen.getByText('Defaults')).toBeInTheDocument()
    expect(screen.getByText('Default Panel Thickness (mm)')).toBeInTheDocument()
  })

  it('renders the Auto-Save section', () => {
    render(<Settings />)
    expect(screen.getByText('Auto-Save')).toBeInTheDocument()
    expect(screen.getByText('Auto-Save Interval (min)')).toBeInTheDocument()
  })

  it('renders the Appearance section with color inputs', () => {
    render(<Settings />)
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Canvas Background')).toBeInTheDocument()
  })

  it('renders the Company Info section', () => {
    render(<Settings />)
    expect(screen.getByText('Company Info')).toBeInTheDocument()
    expect(screen.getByText('Company Name')).toBeInTheDocument()
  })

  it('renders Save Settings and Reset to Defaults buttons', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument()
  })
})
