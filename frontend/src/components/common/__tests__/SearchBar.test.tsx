import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { SearchBar } from '@/components/common/SearchBar'

describe('SearchBar', () => {
  it('renders with placeholder text', () => {
    render(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('renders a custom placeholder', () => {
    render(<SearchBar value="" onChange={vi.fn()} placeholder="Find something" />)
    expect(screen.getByPlaceholderText('Find something')).toBeInTheDocument()
  })

  it('displays the current value', () => {
    render(<SearchBar value="hello" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('calls onChange when user types', () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new text' } })
    expect(onChange).toHaveBeenCalledWith('new text')
  })

  it('shows clear button when value is not empty', () => {
    render(<SearchBar value="abc" onChange={vi.fn()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('does not show clear button when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onChange with empty string when clear is clicked', () => {
    const onChange = vi.fn()
    render(<SearchBar value="test" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('calls onClear callback when clear button is clicked', () => {
    const onChange = vi.fn()
    const onClear = vi.fn()
    render(<SearchBar value="test" onChange={onChange} onClear={onClear} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
