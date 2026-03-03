import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { ShopCutlistApp } from '@/pages/ShopCutlistApp'

describe('ShopCutlistApp', () => {
  it('renders without crashing', () => {
    render(<ShopCutlistApp />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Shop Cutlist" heading', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByText('Shop Cutlist')).toBeInTheDocument()
  })

  it('shows the cut progress counter (e.g., "0/6 parts cut")', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByText(/parts cut/i)).toBeInTheDocument()
    expect(screen.getByText(/\d+\/\d+/)).toBeInTheDocument()
  })

  it('renders part names from the mock data', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByText('Upper Carcass Side')).toBeInTheDocument()
    expect(screen.getByText('Upper Carcass Top/Bottom')).toBeInTheDocument()
    expect(screen.getByText('Base Carcass Side')).toBeInTheDocument()
    expect(screen.getByText('Shelf')).toBeInTheDocument()
  })

  it('renders part dimensions and material info', () => {
    render(<ShopCutlistApp />)
    expect(screen.getAllByText('18mm Birch Ply').length).toBeGreaterThan(0)
    const dims = screen.getAllByText(/700\s*[×x]\s*320/)
    expect(dims.length).toBeGreaterThan(0)
  })

  it('renders a progress bar for cut completion', () => {
    render(<ShopCutlistApp />)
    const track = document.querySelector('.bg-gray-700')
    expect(track).toBeInTheDocument()
  })

  it('renders Print Cutlist button', () => {
    render(<ShopCutlistApp />)
    expect(screen.getByRole('button', { name: /print cutlist/i })).toBeInTheDocument()
  })

  it('toggling cut marks the part as cut', () => {
    render(<ShopCutlistApp />)
    // Find the cut toggle for first part (Upper Carcass Side row - starts uncut)
    const firstRow = screen.getByText('Upper Carcass Side').closest('tr')
    const cutButton = firstRow?.querySelector('button')
    expect(cutButton).toBeInTheDocument()
    // Initial: 2 parts cut (Upper Back Panel, Base Carcass Bottom). Click adds 1 → 3/6
    fireEvent.click(cutButton!)
    expect(screen.getByText(/3\/6/)).toBeInTheDocument()
  })
})
