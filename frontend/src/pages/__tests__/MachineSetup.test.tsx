import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { MachineSetup } from '@/pages/MachineSetup'

describe('MachineSetup', () => {
  it('renders without crashing', () => {
    render(<MachineSetup />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Machine Setup" heading', () => {
    render(<MachineSetup />)
    expect(screen.getByText('Machine Setup')).toBeInTheDocument()
  })

  it('renders the Machines list sidebar', () => {
    render(<MachineSetup />)
    expect(screen.getByText('Machines')).toBeInTheDocument()
    expect(screen.getByText(/Biesse Rover B/i)).toBeInTheDocument()
  })

  it('renders machine configuration form fields', () => {
    render(<MachineSetup />)
    expect(screen.getByText('Manufacturer')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('renders the ATC Tool Magazine section', () => {
    render(<MachineSetup />)
    expect(screen.getByText('ATC Tool Magazine')).toBeInTheDocument()
  })

  it('renders 12 tool position slots', () => {
    render(<MachineSetup />)
    // Tool slots labeled 1-12
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders the add machine button', () => {
    render(<MachineSetup />)
    const addBtn = screen.getByRole('button', { name: '+' })
    expect(addBtn).toBeInTheDocument()
  })
})
