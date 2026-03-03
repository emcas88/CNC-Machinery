import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { MachineSetup } from '../MachineSetup'

describe('MachineSetup', () => {
  it('renders without crashing', () => {
    render(<MachineSetup />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Machine Setup" heading', () => {
    render(<MachineSetup />)
    expect(screen.getByText('Machine Setup')).toBeInTheDocument()
  })

  it('renders CNC Router section', () => {
    render(<MachineSetup />)
    expect(screen.getByText('CNC Router')).toBeInTheDocument()
  })

  it('renders machine configuration form fields', () => {
    render(<MachineSetup />)
    expect(screen.getByText('Table Width (mm)')).toBeInTheDocument()
    expect(screen.getByText('Table Height (mm)')).toBeInTheDocument()
    expect(screen.getByText('Spindle RPM Max')).toBeInTheDocument()
    expect(screen.getByText('Feed Rate Max (mm/min)')).toBeInTheDocument()
  })

  it('renders Safety section', () => {
    render(<MachineSetup />)
    expect(screen.getByText('Safety')).toBeInTheDocument()
  })

  it('renders Save Machine Config button', () => {
    render(<MachineSetup />)
    expect(screen.getByRole('button', { name: /save machine config/i })).toBeInTheDocument()
  })
})
