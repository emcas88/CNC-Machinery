import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { HardwareLibrary } from '../HardwareLibrary'

describe('HardwareLibrary', () => {
  it('renders page heading', () => {
    render(<HardwareLibrary />)
    expect(screen.getByText(/hardware library/i)).toBeInTheDocument()
  })

  it('renders hardware items', () => {
    render(<HardwareLibrary />)
    expect(screen.getByText(/hinge|slide|handle/i)).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<HardwareLibrary />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders add button', () => {
    render(<HardwareLibrary />)
    expect(screen.getByText(/add|new/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<HardwareLibrary />)
    expect(container).toMatchSnapshot()
  })
})
