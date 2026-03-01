import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ShopLabelApp } from '@/pages/ShopLabelApp'

describe('ShopLabelApp', () => {
  it('renders without crashing', () => {
    render(<ShopLabelApp />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Label Printing" heading', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText('Label Printing')).toBeInTheDocument()
  })

  it('renders the subtitle "Nested Sheet Label App"', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText('Nested Sheet Label App')).toBeInTheDocument()
  })

  it('renders the "Print All" button', () => {
    render(<ShopLabelApp />)
    expect(screen.getByRole('button', { name: /print all/i })).toBeInTheDocument()
  })

  it('renders label entries with code and part name', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText(/A-001 — LHS Side Panel/)).toBeInTheDocument()
    expect(screen.getByText(/A-002 — RHS Side Panel/)).toBeInTheDocument()
  })

  it('renders label sheet and position info', () => {
    render(<ShopLabelApp />)
    expect(screen.getByText(/Sheet 1 · X:10 Y:10/)).toBeInTheDocument()
  })

  it('renders "Printed" badge for already printed labels', () => {
    render(<ShopLabelApp />)
    const printedBadges = screen.getAllByText('Printed')
    expect(printedBadges.length).toBeGreaterThan(0)
  })

  it('renders "Queue" badge for pending labels', () => {
    render(<ShopLabelApp />)
    const queueBadges = screen.getAllByText('Queue')
    expect(queueBadges.length).toBeGreaterThan(0)
  })
})
