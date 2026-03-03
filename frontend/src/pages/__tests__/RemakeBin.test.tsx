import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { RemakeBin } from '@/pages/RemakeBin'

describe('RemakeBin', () => {
  const renderPage = () => render(<RemakeBin />)

  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "Remake Bin" heading', () => {
    renderPage()
    expect(screen.getByText('Remake Bin')).toBeInTheDocument()
  })

  it('renders the subtitle "Track parts flagged for remaking"', () => {
    renderPage()
    expect(screen.getByText('Track parts flagged for remaking')).toBeInTheDocument()
  })

  it('renders the "Flag Part" button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /flag part/i })).toBeInTheDocument()
  })

  it('renders filter tabs (All, Pending, In Progress, Completed)', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^pending$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /in progress/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^completed$/i })).toBeInTheDocument()
  })

  it('renders remake parts with names and job numbers', () => {
    renderPage()
    expect(screen.getByText('Upper Cabinet Door LH')).toBeInTheDocument()
    expect(screen.getByText('Drawer Front 600mm')).toBeInTheDocument()
    expect(screen.getByText('Shelf Panel 1200mm')).toBeInTheDocument()
    expect(screen.getByText('Base Cabinet Carcass')).toBeInTheDocument()
    expect(screen.getByText(/JOB-2024-089/)).toBeInTheDocument()
  })

  it('renders the reason for each remake', () => {
    renderPage()
    expect(screen.getByText(/Reason: Grain direction wrong/i)).toBeInTheDocument()
    expect(screen.getByText(/Reason: Incorrect dimensions/i)).toBeInTheDocument()
  })

  it('renders status badges (Pending, In Progress, Completed)', () => {
    renderPage()
    const pending = screen.getAllByText('Pending')
    const inProgress = screen.getAllByText('In Progress')
    const completed = screen.getAllByText('Completed')
    expect(pending.length).toBeGreaterThan(0)
    expect(inProgress.length).toBeGreaterThan(0)
    expect(completed.length).toBeGreaterThan(0)
  })

  it('renders Edit and Update Status buttons for items', () => {
    renderPage()
    expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /update status/i }).length).toBeGreaterThan(0)
  })
})
