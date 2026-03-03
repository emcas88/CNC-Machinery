import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ShopAssemblyApp } from '@/pages/ShopAssemblyApp'

describe('ShopAssemblyApp', () => {
  const renderPage = () => render(<ShopAssemblyApp />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Shop Assembly" heading', () => {
    renderPage()
    expect(screen.getByText('Shop Assembly')).toBeInTheDocument()
  })

  it('renders the subtitle "Assembly queue for shop floor"', () => {
    renderPage()
    expect(screen.getByText('Assembly queue for shop floor')).toBeInTheDocument()
  })

  it('renders assembly task items', () => {
    renderPage()
    expect(screen.getByText('Upper Cabinet L1')).toBeInTheDocument()
    expect(screen.getByText('Base Cabinet B2')).toBeInTheDocument()
    expect(screen.getByText('Pantry Unit P1')).toBeInTheDocument()
    expect(screen.getByText('Island Cabinet IC1')).toBeInTheDocument()
  })

  it('renders job numbers and assignees', () => {
    renderPage()
    expect(screen.getAllByText(/JOB-2024-089/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Tom R\./).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Mike T\./).length).toBeGreaterThan(0)
  })

  it('renders Update buttons for each task', () => {
    renderPage()
    const updateButtons = screen.getAllByRole('button', { name: /update/i })
    expect(updateButtons.length).toBeGreaterThan(0)
  })
})
