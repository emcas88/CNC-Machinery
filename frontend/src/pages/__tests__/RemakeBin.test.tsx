import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { RemakeBin } from '@/pages/RemakeBin'

describe('RemakeBin', () => {
  it('renders without crashing', () => {
    render(<RemakeBin />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Remake Bin" heading', () => {
    render(<RemakeBin />)
    expect(screen.getByText('Remake Bin')).toBeInTheDocument()
  })

  it('shows the count of pending parts in the header', () => {
    render(<RemakeBin />)
    expect(screen.getByText(/parts pending recut/)).toBeInTheDocument()
  })

  it('renders the "Add Part" button', () => {
    render(<RemakeBin />)
    expect(screen.getByRole('button', { name: /add part/i })).toBeInTheDocument()
  })

  it('renders remake parts with their codes and names', () => {
    render(<RemakeBin />)
    expect(screen.getByText('A-003')).toBeInTheDocument()
    expect(screen.getByText('Top Panel')).toBeInTheDocument()
    expect(screen.getByText('Drawer Front')).toBeInTheDocument()
  })

  it('renders the reason for each remake', () => {
    render(<RemakeBin />)
    expect(screen.getByText('Reason: Damaged')).toBeInTheDocument()
    expect(screen.getByText('Reason: Wrong dimension')).toBeInTheDocument()
  })

  it('renders "Pending" and "Cut" status badges', () => {
    render(<RemakeBin />)
    const pending = screen.getAllByText('Pending')
    const cut = screen.getAllByText('Cut')
    expect(pending.length).toBeGreaterThan(0)
    expect(cut.length).toBeGreaterThan(0)
  })

  it('renders "Mark Cut" buttons for pending parts', () => {
    render(<RemakeBin />)
    const markCutBtns = screen.getAllByRole('button', { name: /mark cut/i })
    expect(markCutBtns.length).toBeGreaterThan(0)
  })

  it('marks a part as cut when "Mark Cut" button is clicked', () => {
    render(<RemakeBin />)
    const markCutBtn = screen.getAllByRole('button', { name: /mark cut/i })[0]
    fireEvent.click(markCutBtn)
    // One more "Cut" badge should appear
    const cut = screen.getAllByText('Cut')
    expect(cut.length).toBeGreaterThan(1)
  })

  it('renders "Print Label" buttons for each part', () => {
    render(<RemakeBin />)
    const printBtns = screen.getAllByRole('button', { name: /print label/i })
    expect(printBtns.length).toBeGreaterThan(0)
  })

  it('renders the total and pending counts in the footer', () => {
    render(<RemakeBin />)
    expect(screen.getByText(/total.*pending/i)).toBeInTheDocument()
  })
})
