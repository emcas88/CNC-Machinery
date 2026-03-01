import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { RoomDesigner } from '@/pages/RoomDesigner'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ roomId: 'room-1' }),
  }
})

describe('RoomDesigner', () => {
  it('renders without crashing', () => {
    render(<RoomDesigner />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the Product Library sidebar', () => {
    render(<RoomDesigner />)
    expect(screen.getByText('Product Library')).toBeInTheDocument()
  })

  it('renders the product library search bar', () => {
    render(<RoomDesigner />)
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })

  it('renders the canvas area with an SVG element', () => {
    render(<RoomDesigner />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('renders the view tabs (Floor Plan, Elevation, 3D View)', () => {
    render(<RoomDesigner />)
    expect(screen.getByText('Floor Plan')).toBeInTheDocument()
    expect(screen.getByText('Elevation')).toBeInTheDocument()
    expect(screen.getByText('3D View')).toBeInTheDocument()
  })

  it('renders the canvas toolbar tools', () => {
    render(<RoomDesigner />)
    expect(screen.getByTitle(/Select/i)).toBeInTheDocument()
  })

  it('renders product library categories', () => {
    render(<RoomDesigner />)
    expect(screen.getByText(/Base Cabinets/i)).toBeInTheDocument()
  })

  it('renders the Snap toggle button', () => {
    render(<RoomDesigner />)
    expect(screen.getByText('Snap')).toBeInTheDocument()
  })
})
