import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { DoorProfileEditor } from '../DoorProfileEditor'

describe('DoorProfileEditor', () => {
  it('renders page heading', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText('Door Profile Editor')).toBeInTheDocument()
  })

  it('renders Profiles sidebar', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText('Profiles')).toBeInTheDocument()
  })

  it('renders profile options', () => {
    render(<DoorProfileEditor />)
    expect(screen.getAllByText('Shaker').length).toBeGreaterThan(0)
    expect(screen.getByText('Flat Panel')).toBeInTheDocument()
    expect(screen.getByText('Raised Panel')).toBeInTheDocument()
    expect(screen.getByText('Full Slab')).toBeInTheDocument()
  })

  it('renders parameter controls', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText('Rail Width (mm)')).toBeInTheDocument()
    expect(screen.getByText('Stile Width (mm)')).toBeInTheDocument()
    expect(screen.getByText('Panel Reveal (mm)')).toBeInTheDocument()
  })

  it('renders Preview area', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('renders Save Profile and Apply to All Doors buttons', () => {
    render(<DoorProfileEditor />)
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /apply to all doors/i })).toBeInTheDocument()
  })
})
