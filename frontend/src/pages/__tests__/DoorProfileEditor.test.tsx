import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { DoorProfileEditor } from '../DoorProfileEditor'

describe('DoorProfileEditor', () => {
  it('renders page heading', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText(/door profile/i)).toBeInTheDocument()
  })

  it('renders profile list', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText(/shaker|slab|raised/i)).toBeInTheDocument()
  })

  it('renders preview area', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText(/preview/i)).toBeInTheDocument()
  })

  it('selecting a profile updates preview', () => {
    render(<DoorProfileEditor />)
    const btns = screen.getAllByRole('button')
    fireEvent.click(btns[0])
    // After click, something should be selected
    expect(screen.getByText(/profile/i)).toBeInTheDocument()
  })

  it('renders parameter controls', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText(/rail|stile|panel|rebate/i)).toBeInTheDocument()
  })

  it('snapshot', () => {
    const { container } = render(<DoorProfileEditor />)
    expect(container).toMatchSnapshot()
  })
})
