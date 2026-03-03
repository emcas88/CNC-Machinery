import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { FlipsideMachining } from '../FlipsideMachining'

vi.mock('@/store', () => ({
  useOptimizerStore: () => ({
    sheets: [],
  }),
}))

describe('FlipsideMachining', () => {
  it('renders page heading', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText('Flipside Machining')).toBeInTheDocument()
  })

  it('renders Sheets sidebar', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText('Sheets')).toBeInTheDocument()
  })

  it('shows "No sheets" when no sheets', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText('No sheets')).toBeInTheDocument()
  })

  it('shows "No sheets available" in main content when no sheets', () => {
    render(<FlipsideMachining />)
    expect(screen.getByText('No sheets available')).toBeInTheDocument()
  })
})
