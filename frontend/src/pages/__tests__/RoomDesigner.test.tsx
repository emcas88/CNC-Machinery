import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { RoomDesigner } from '@/pages/RoomDesigner'

describe('RoomDesigner', () => {
  const renderPage = () => render(<RoomDesigner />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the view and tool indicator', () => {
    renderPage()
    expect(screen.getByText(/View: 2D/i)).toBeInTheDocument()
    expect(screen.getByText(/Tool: select/i)).toBeInTheDocument()
  })

  it('renders the Properties panel heading', () => {
    renderPage()
    expect(screen.getByText('Properties')).toBeInTheDocument()
  })

  it('renders the canvas area with canvas element', () => {
    renderPage()
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders tool buttons with titles', () => {
    renderPage()
    expect(screen.getByTitle('Select')).toBeInTheDocument()
    expect(screen.getByTitle('Wall')).toBeInTheDocument()
    expect(screen.getByTitle('Cabinet')).toBeInTheDocument()
    expect(screen.getByTitle('Measure')).toBeInTheDocument()
  })

  it('shows "Click an object to select" when nothing selected', () => {
    renderPage()
    expect(screen.getByText('Click an object to select')).toBeInTheDocument()
  })
})
