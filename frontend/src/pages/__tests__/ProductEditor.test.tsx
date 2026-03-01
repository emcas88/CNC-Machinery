import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ProductEditor } from '@/pages/ProductEditor'

describe('ProductEditor', () => {
  it('renders without crashing', () => {
    render(<ProductEditor />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Product Editor" heading', () => {
    render(<ProductEditor />)
    expect(screen.getByText('Product Editor')).toBeInTheDocument()
  })

  it('renders the Face Sections panel', () => {
    render(<ProductEditor />)
    expect(screen.getByText('Face Sections')).toBeInTheDocument()
  })

  it('renders the Interior Layout panel', () => {
    render(<ProductEditor />)
    expect(screen.getByText('Interior Layout')).toBeInTheDocument()
  })

  it('renders the Dimensions panel', () => {
    render(<ProductEditor />)
    expect(screen.getByText('Dimensions')).toBeInTheDocument()
  })

  it('renders Width, Height, and Depth dimension inputs', () => {
    render(<ProductEditor />)
    expect(screen.getByText('Width (mm)')).toBeInTheDocument()
    expect(screen.getByText('Height (mm)')).toBeInTheDocument()
    expect(screen.getByText('Depth (mm)')).toBeInTheDocument()
  })

  it('renders the "Regenerate Parts" button', () => {
    render(<ProductEditor />)
    expect(screen.getByRole('button', { name: /regenerate parts/i })).toBeInTheDocument()
  })
})
