import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { CloudRenderView } from '../CloudRenderView'

describe('CloudRenderView', () => {
  it('renders page heading', () => {
    render(<CloudRenderView />)
    expect(screen.getByText(/cloud render/i)).toBeInTheDocument()
  })

  it('renders submit button', () => {
    render(<CloudRenderView />)
    expect(screen.getByText(/submit|render/i)).toBeInTheDocument()
  })

  it('renders render queue', () => {
    render(<CloudRenderView />)
    expect(screen.getByText(/queue/i)).toBeInTheDocument()
  })

  it('renders status badges', () => {
    render(<CloudRenderView />)
    const badges = screen.getAllByText(/pending|processing|complete/i)
    expect(badges.length).toBeGreaterThan(0)
  })

  it('renders credits indicator', () => {
    render(<CloudRenderView />)
    expect(screen.getByText(/credit/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<CloudRenderView />)
    expect(container).toMatchSnapshot()
  })
})
