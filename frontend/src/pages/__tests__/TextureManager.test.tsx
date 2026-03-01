import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { TextureManager } from '@/pages/TextureManager'

describe('TextureManager', () => {
  it('renders without crashing', () => {
    render(<TextureManager />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Texture Library" heading', () => {
    render(<TextureManager />)
    expect(screen.getByText('Texture Library')).toBeInTheDocument()
  })

  it('renders the texture group sidebar', () => {
    render(<TextureManager />)
    expect(screen.getByText('Groups')).toBeInTheDocument()
    expect(screen.getByText('Wood')).toBeInTheDocument()
    expect(screen.getByText('Laminate')).toBeInTheDocument()
  })

  it('renders the texture search bar', () => {
    render(<TextureManager />)
    expect(screen.getByPlaceholderText(/search textures/i)).toBeInTheDocument()
  })

  it('renders the "Import Texture" button', () => {
    render(<TextureManager />)
    expect(screen.getByRole('button', { name: /import texture/i })).toBeInTheDocument()
  })

  it('renders texture grid items with names', () => {
    render(<TextureManager />)
    expect(screen.getByText('Oak Natural')).toBeInTheDocument()
    expect(screen.getByText('Walnut Dark')).toBeInTheDocument()
  })

  it('renders the texture detail panel for the selected texture', () => {
    render(<TextureManager />)
    expect(screen.getByText('Texture Details')).toBeInTheDocument()
    expect(screen.getByText('Dimensions')).toBeInTheDocument()
  })
})
