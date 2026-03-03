import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { TextureManager } from '@/pages/TextureManager'

describe('TextureManager', () => {
  it('renders without crashing', () => {
    render(<TextureManager />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Texture Manager" heading', () => {
    render(<TextureManager />)
    expect(screen.getByText('Texture Manager')).toBeInTheDocument()
  })

  it('renders the subtitle "Manage material textures for 3D visualisation"', () => {
    render(<TextureManager />)
    expect(screen.getByText('Manage material textures for 3D visualisation')).toBeInTheDocument()
  })

  it('renders the "Upload Texture" button', () => {
    render(<TextureManager />)
    expect(screen.getByRole('button', { name: /upload texture/i })).toBeInTheDocument()
  })

  it('renders texture grid items with names', () => {
    render(<TextureManager />)
    expect(screen.getByText('Birch Ply Natural')).toBeInTheDocument()
    expect(screen.getByText('White Melamine')).toBeInTheDocument()
    expect(screen.getByText('Oak Veneer')).toBeInTheDocument()
    expect(screen.getByText('Walnut Veneer')).toBeInTheDocument()
  })

  it('renders texture categories', () => {
    render(<TextureManager />)
    expect(screen.getByText('Ply')).toBeInTheDocument()
    expect(screen.getByText('Melamine')).toBeInTheDocument()
    const veneerElements = screen.getAllByText('Veneer')
    expect(veneerElements.length).toBeGreaterThan(0)
  })

  it('renders "Used in X jobs" for textures', () => {
    render(<TextureManager />)
    const usedInElements = screen.getAllByText(/Used in \d+ jobs/)
    expect(usedInElements.length).toBeGreaterThan(0)
  })

  it('renders Add Texture slot', () => {
    render(<TextureManager />)
    expect(screen.getByText('Add Texture')).toBeInTheDocument()
  })
})
