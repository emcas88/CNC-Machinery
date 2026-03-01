import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { GCodeViewer } from '../GCodeViewer'

describe('GCodeViewer', () => {
  it('renders page heading', () => {
    render(<GCodeViewer />)
    expect(screen.getByText(/g.?code viewer/i)).toBeInTheDocument()
  })

  it('renders code display area', () => {
    render(<GCodeViewer />)
    expect(screen.getByText(/g00|g01|m30|t1/i)).toBeInTheDocument()
  })

  it('renders simulation controls', () => {
    render(<GCodeViewer />)
    expect(screen.getByText(/play|pause|stop|simulate/i)).toBeInTheDocument()
  })

  it('renders line number display', () => {
    render(<GCodeViewer />)
    expect(screen.getByText(/line|n\d+/i)).toBeInTheDocument()
  })

  it('renders file info', () => {
    render(<GCodeViewer />)
    expect(screen.getByText(/file|program|tool/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<GCodeViewer />)
    expect(container).toMatchSnapshot()
  })
})
