import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ProductEditor } from '@/pages/ProductEditor'

describe('ProductEditor', () => {
  const renderPage = () => render(<ProductEditor />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Product Editor" heading', () => {
    renderPage()
    expect(screen.getByText('Product Editor')).toBeInTheDocument()
  })

  it('renders the 3D Product Editor subtitle', () => {
    renderPage()
    expect(screen.getByText('3D Product Editor')).toBeInTheDocument()
  })

  it('renders the coming soon message', () => {
    renderPage()
    expect(screen.getByText('Cabinet design canvas coming soon')).toBeInTheDocument()
  })
})
