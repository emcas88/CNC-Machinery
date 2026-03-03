import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { HardwareLibrary } from '../HardwareLibrary'

describe('HardwareLibrary', () => {
  it('renders page heading', () => {
    render(<HardwareLibrary />)
    expect(screen.getByText('Hardware Library')).toBeInTheDocument()
  })

  it('renders Add Hardware button', () => {
    render(<HardwareLibrary />)
    expect(screen.getByRole('button', { name: /add hardware/i })).toBeInTheDocument()
  })

  it('renders hardware items', () => {
    render(<HardwareLibrary />)
    expect(screen.getByText(/Blum Tandembox Antaro/i)).toBeInTheDocument()
    expect(screen.getByText(/Blum Clip Top 110° Hinge/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Drawer System/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Hinge/i).length).toBeGreaterThan(0)
  })

  it('renders table headers', () => {
    render(<HardwareLibrary />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Supplier')).toBeInTheDocument()
    expect(screen.getByText('SKU')).toBeInTheDocument()
    expect(screen.getByText('Unit Price')).toBeInTheDocument()
  })
})
