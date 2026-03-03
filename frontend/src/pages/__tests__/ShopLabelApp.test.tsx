import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ShopLabelApp } from '@/pages/ShopLabelApp'

describe('ShopLabelApp', () => {
  it('renders without crashing', () => {
    render(<ShopLabelApp />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Shop Labels" heading', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText('Shop Labels')).toBeInTheDocument()
  })

  it('renders the subtitle "Print part identification labels"', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText('Print part identification labels')).toBeInTheDocument()
  })

  it('renders the "Print All" button', () => {
    render(<ShopLabelApp />)
    expect(screen.getByRole('button', { name: /print all/i })).toBeInTheDocument()
  })

  it('renders label cards with part name and job', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText('Upper Carcass Side L')).toBeInTheDocument()
    expect(screen.getByText('Upper Carcass Side R')).toBeInTheDocument()
    expect(screen.getByText('Base Carcass Side L')).toBeInTheDocument()
    expect(screen.getAllByText('JOB-2024-089').length).toBeGreaterThan(0)
  })

  it('renders dimensions and material in label cards', () => {
    render(<ShopLabelApp />)
    const dims = screen.getAllByText(/700\s*[×x]\s*320mm/)
    expect(dims.length).toBeGreaterThan(0)
    expect(screen.getAllByText('18mm Birch Ply').length).toBeGreaterThan(0)
  })

  it('renders barcode in label cards', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText('089-001')).toBeInTheDocument()
    expect(screen.getByText('089-002')).toBeInTheDocument()
  })
})
