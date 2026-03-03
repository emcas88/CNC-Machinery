import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { TabBar } from '@/components/layout/TabBar'

const tabs = [
  { id: 'design', label: 'Design' },
  { id: 'parts', label: 'Parts' },
  { id: 'preview', label: 'Preview', disabled: true },
]

describe('TabBar', () => {
  it('renders all tab labels', () => {
    render(<TabBar tabs={tabs} activeTab="design" onChange={vi.fn()} />)
    expect(screen.getByText('Design')).toBeInTheDocument()
    expect(screen.getByText('Parts')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('applies cyan active styling to the active tab', () => {
    render(<TabBar tabs={tabs} activeTab="design" onChange={vi.fn()} />)
    const activeButton = screen.getByText('Design').closest('button')!
    expect(activeButton.className).toMatch(/text-cyan/)
    expect(activeButton.className).toMatch(/border-cyan/)
  })

  it('does not apply active styling to inactive tabs', () => {
    render(<TabBar tabs={tabs} activeTab="design" onChange={vi.fn()} />)
    const inactiveButton = screen.getByText('Parts').closest('button')!
    expect(inactiveButton.className).not.toMatch(/text-cyan-400/)
  })

  it('calls onChange with the tab id when a tab is clicked', () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} activeTab="design" onChange={onChange} />)
    fireEvent.click(screen.getByText('Parts'))
    expect(onChange).toHaveBeenCalledWith('parts')
  })

  it('does not call onChange when a disabled tab is clicked', () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} activeTab="design" onChange={onChange} />)
    fireEvent.click(screen.getByText('Preview'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies opacity class to disabled tabs', () => {
    render(<TabBar tabs={tabs} activeTab="design" onChange={vi.fn()} />)
    const disabledButton = screen.getByText('Preview').closest('button')!
    expect(disabledButton.className).toMatch(/opacity-40/)
  })

  it('applies smaller text/padding classes when size="sm"', () => {
    render(<TabBar tabs={tabs} activeTab="design" onChange={vi.fn()} size="sm" />)
    const button = screen.getByText('Design').closest('button')!
    expect(button.className).toMatch(/text-xs/)
    expect(button.className).toMatch(/px-3/)
  })

  it('applies default medium text/padding classes when size="md"', () => {
    render(<TabBar tabs={tabs} activeTab="design" onChange={vi.fn()} size="md" />)
    const button = screen.getByText('Design').closest('button')!
    expect(button.className).toMatch(/text-sm/)
    expect(button.className).toMatch(/px-4/)
  })

  it('applies a custom className to the wrapper', () => {
    const { container } = render(
      <TabBar tabs={tabs} activeTab="design" onChange={vi.fn()} className="my-tabbar" />
    )
    expect(container.firstChild).toHaveClass('my-tabbar')
  })

  it('renders a tab with an icon when icon prop is provided', () => {
    const tabsWithIcon = [
      { id: 'home', label: 'Home', icon: <span data-testid="home-icon">🏠</span> },
    ]
    render(<TabBar tabs={tabsWithIcon} activeTab="home" onChange={vi.fn()} />)
    expect(screen.getByTestId('home-icon')).toBeInTheDocument()
  })
})
