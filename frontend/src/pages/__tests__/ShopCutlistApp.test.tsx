import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { ShopCutlistApp } from '@/pages/ShopCutlistApp'

describe('ShopCutlistApp', () => {
  it('renders without crashing', () => {
    render(<ShopCutlistApp />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Shop Cut List" heading', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByText('Shop Cut List')).toBeInTheDocument()
  })

  it('shows the cut progress counter (e.g., "2/8 cut")', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByText(/cut/i)).toBeInTheDocument()
    expect(screen.getByText(/\d+\/\d+/)).toBeInTheDocument()
  })

  it('renders the search bar for filtering parts', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByPlaceholderText(/search parts/i)).toBeInTheDocument()
  })

  it('renders part names from the mock data', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByText('LHS Side Panel')).toBeInTheDocument()
    expect(screen.getByText('RHS Side Panel')).toBeInTheDocument()
    expect(screen.getByText('Top Panel')).toBeInTheDocument()
  })

  it('renders part dimensions and material info', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByText(/800 × 600 × 18mm · Birch Ply/)).toBeInTheDocument()
  })

  it('renders a progress bar for cut completion', () => {
    render(<ShopCutlistApp />)
    // ProgressBar renders a bar track element
    const track = document.querySelector('.bg-gray-700')
    expect(track).toBeInTheDocument()
  })

  it('filters parts by name when searching', () => {
    render(<ShopCutlistApp />)
    const searchInput = screen.getByPlaceholderText(/search parts/i)
    fireEvent.change(searchInput, { target: { value: 'door' } })
    expect(screen.getByText('Door LHS')).toBeInTheDocument()
    expect(screen.queryByText('LHS Side Panel')).not.toBeInTheDocument()
  })
})
