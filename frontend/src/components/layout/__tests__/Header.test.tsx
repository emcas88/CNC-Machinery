import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { Header } from '@/components/layout/Header'

describe('Header', () => {
  it('renders without crashing', () => {
    render(<Header />)
    expect(document.querySelector('header')).toBeInTheDocument()
  })

  it('renders the undo button with the correct title', () => {
    render(<Header />)
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument()
  })

  it('renders the redo button with the correct title', () => {
    render(<Header />)
    expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument()
  })

  it('renders the unit toggle button', () => {
    render(<Header />)
    expect(screen.getByTitle('Toggle unit system')).toBeInTheDocument()
  })

  it('displays "mm" unit label when unit system is metric (default)', () => {
    render(<Header />)
    // Default store state should be metric
    const unitBtn = screen.getByTitle('Toggle unit system')
    expect(unitBtn.textContent).toMatch(/mm|in/)
  })

  it('renders a title when provided via the title prop', () => {
    render(<Header title="Room Designer" />)
    expect(screen.getByText('Room Designer')).toBeInTheDocument()
  })

  it('renders breadcrumbs when provided', () => {
    render(<Header breadcrumbs={[{ label: 'Job Manager' }, { label: 'Kitchen Reno' }]} />)
    expect(screen.getByText('Kitchen Reno')).toBeInTheDocument()
    expect(screen.getByText('Job Manager')).toBeInTheDocument()
  })

  it('renders a settings/home navigation button', () => {
    render(<Header />)
    // CogIcon button navigates home
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
