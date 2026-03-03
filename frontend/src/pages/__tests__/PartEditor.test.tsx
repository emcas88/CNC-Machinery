import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { PartEditor } from '@/pages/PartEditor'

describe('PartEditor', () => {
  const renderPage = () => render(<PartEditor />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Part Editor" heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Part Editor' })).toBeInTheDocument()
  })

  it('renders the coming soon message', () => {
    renderPage()
    expect(screen.getByText('2D part editing canvas coming soon')).toBeInTheDocument()
  })

  it('renders the Part Editor subtitle in the canvas area', () => {
    renderPage()
    expect(screen.getAllByText('Part Editor').length).toBeGreaterThan(0)
  })
})
