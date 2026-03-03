import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { CloudRenderView } from '../CloudRenderView'

describe('CloudRenderView', () => {
  it('renders page heading', () => {
    render(<CloudRenderView />)
    expect(screen.getByText('Cloud Renders')).toBeInTheDocument()
  })

  it('renders Start Render button', () => {
    render(<CloudRenderView />)
    expect(screen.getByRole('button', { name: /start render/i })).toBeInTheDocument()
  })

  it('renders render queue items', () => {
    render(<CloudRenderView />)
    expect(screen.getByText('Kitchen — Perspective')).toBeInTheDocument()
    expect(screen.getByText('Kitchen — Front Elevation')).toBeInTheDocument()
  })

  it('renders Render Settings section', () => {
    render(<CloudRenderView />)
    expect(screen.getByText('Render Settings')).toBeInTheDocument()
  })

  it('renders Queue Render and Batch Render buttons', () => {
    render(<CloudRenderView />)
    expect(screen.getByRole('button', { name: /queue render/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /batch render all views/i })).toBeInTheDocument()
  })
})
