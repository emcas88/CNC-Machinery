import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { StatusBadge } from '@/components/common/StatusBadge'

describe('StatusBadge', () => {
  it('renders the correct label for "active" status', () => {
    render(<StatusBadge status="active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders the correct label for "in_production" status', () => {
    render(<StatusBadge status="in_production" />)
    expect(screen.getByText('In Production')).toBeInTheDocument()
  })

  it('renders the correct label for "on_hold" status', () => {
    render(<StatusBadge status="on_hold" />)
    expect(screen.getByText('On Hold')).toBeInTheDocument()
  })

  it('renders an unknown status by capitalizing and replacing underscores', () => {
    render(<StatusBadge status="custom_status" />)
    expect(screen.getByText('Custom Status')).toBeInTheDocument()
  })

  it('applies the correct variant class for "completed"', () => {
    const { container } = render(<StatusBadge status="completed" />)
    const badge = container.querySelector('.badge')!
    expect(badge.className).toMatch(/green/)
  })

  it('applies the correct variant class for "failed"', () => {
    const { container } = render(<StatusBadge status="failed" />)
    const badge = container.querySelector('.badge')!
    expect(badge.className).toMatch(/red/)
  })

  it('applies a fallback style for unknown statuses', () => {
    const { container } = render(<StatusBadge status="something_weird" />)
    const badge = container.querySelector('.badge')!
    expect(badge.className).toMatch(/bg-gray-700/)
  })

  it('merges extra className prop', () => {
    const { container } = render(<StatusBadge status="active" className="extra-class" />)
    const badge = container.querySelector('.badge')!
    expect(badge.className).toContain('extra-class')
  })
})
