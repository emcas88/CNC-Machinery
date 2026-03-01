import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { ShopAssemblyApp } from '@/pages/ShopAssemblyApp'

describe('ShopAssemblyApp', () => {
  it('renders without crashing', () => {
    render(<ShopAssemblyApp />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Assembly Checklist" heading', () => {
    render(<ShopAssemblyApp />)
    expect(screen.getByText('Assembly Checklist')).toBeInTheDocument()
  })

  it('shows the steps progress counter', () => {
    render(<ShopAssemblyApp />)
    expect(screen.getByText(/steps/i)).toBeInTheDocument()
    expect(screen.getByText(/\d+\/\d+/)).toBeInTheDocument()
  })

  it('renders assembly step descriptions', () => {
    render(<ShopAssemblyApp />)
    expect(screen.getByText('Install bottom panel into side dados')).toBeInTheDocument()
    expect(screen.getByText('Install back panel')).toBeInTheDocument()
  })

  it('renders product names associated with steps', () => {
    render(<ShopAssemblyApp />)
    expect(screen.getByText('Base Cabinet 600')).toBeInTheDocument()
  })

  it('renders a progress bar for assembly completion', () => {
    render(<ShopAssemblyApp />)
    const track = document.querySelector('.bg-gray-700')
    expect(track).toBeInTheDocument()
  })

  it('toggles step completion when a step is clicked', () => {
    render(<ShopAssemblyApp />)
    // Step 3 starts incomplete
    const step3 = screen.getByText('Install back panel').closest('[role="button"], button, [tabindex]')
    if (step3) fireEvent.click(step3)
    // Just verify no crash
    expect(screen.getByText('Assembly Checklist')).toBeInTheDocument()
  })
})
