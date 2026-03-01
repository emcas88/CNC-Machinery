import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ProgressBar } from '@/components/shop/ProgressBar'

describe('ProgressBar', () => {
  it('renders with correct width percentage style', () => {
    const { container } = render(<ProgressBar value={50} />)
    const bar = container.querySelector('[style*="width"]')!
    expect(bar.getAttribute('style')).toBe('width: 50%;')
  })

  it('clamps value above 100 to 100%', () => {
    const { container } = render(<ProgressBar value={150} />)
    const bar = container.querySelector('[style*="width"]')!
    expect(bar.getAttribute('style')).toBe('width: 100%;')
  })

  it('clamps negative values to 0%', () => {
    const { container } = render(<ProgressBar value={-10} />)
    const bar = container.querySelector('[style*="width"]')!
    expect(bar.getAttribute('style')).toBe('width: 0%;')
  })

  it('shows the percentage text when showPercent=true', () => {
    render(<ProgressBar value={75} showPercent />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('hides the percentage text when showPercent=false', () => {
    render(<ProgressBar value={75} showPercent={false} />)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('shows the label text when provided', () => {
    render(<ProgressBar value={60} label="Sheet Yield" />)
    expect(screen.getByText('Sheet Yield')).toBeInTheDocument()
  })

  it('displays "value / max" text when max is not 100', () => {
    render(<ProgressBar value={3} max={10} />)
    expect(screen.getByText('3 / 10')).toBeInTheDocument()
  })

  it('does not show "value / max" text when max is exactly 100', () => {
    render(<ProgressBar value={50} max={100} />)
    expect(screen.queryByText('50 / 100')).not.toBeInTheDocument()
  })

  it('applies h-1.5 height class for size="sm"', () => {
    const { container } = render(<ProgressBar value={50} size="sm" />)
    const track = container.querySelector('.bg-gray-700')!
    expect(track).toHaveClass('h-1.5')
  })

  it('applies h-2.5 height class for size="md" (default)', () => {
    const { container } = render(<ProgressBar value={50} />)
    const track = container.querySelector('.bg-gray-700')!
    expect(track).toHaveClass('h-2.5')
  })

  it('applies h-4 height class for size="lg"', () => {
    const { container } = render(<ProgressBar value={50} size="lg" />)
    const track = container.querySelector('.bg-gray-700')!
    expect(track).toHaveClass('h-4')
  })

  it('uses green color class when value >= 80%', () => {
    const { container } = render(<ProgressBar value={80} />)
    const bar = container.querySelector('[style*="width"]')!
    expect(bar.className).toMatch(/bg-green/)
  })

  it('uses cyan color class when value is between 40% and 79%', () => {
    const { container } = render(<ProgressBar value={60} />)
    const bar = container.querySelector('[style*="width"]')!
    expect(bar.className).toMatch(/bg-cyan/)
  })

  it('uses yellow color class when value < 40%', () => {
    const { container } = render(<ProgressBar value={20} />)
    const bar = container.querySelector('[style*="width"]')!
    expect(bar.className).toMatch(/bg-yellow/)
  })
})
