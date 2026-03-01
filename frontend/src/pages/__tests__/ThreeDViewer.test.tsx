import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { ThreeDViewer } from '@/pages/ThreeDViewer'

describe('ThreeDViewer', () => {
  it('renders without crashing', () => {
    render(<ThreeDViewer />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the "3D Viewer" heading', () => {
    render(<ThreeDViewer />)
    expect(screen.getByText('3D Viewer')).toBeInTheDocument()
  })

  it('renders the view angle buttons (Front, Top, Side, Iso)', () => {
    render(<ThreeDViewer />)
    expect(screen.getByRole('button', { name: /front/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /top/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /side/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iso/i })).toBeInTheDocument()
  })

  it('renders the Render Mode selector buttons (Solid, Wireframe, X-Ray)', () => {
    render(<ThreeDViewer />)
    expect(screen.getByRole('button', { name: /solid/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /wireframe/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /x-ray/i })).toBeInTheDocument()
  })

  it('renders the 3D canvas placeholder area', () => {
    render(<ThreeDViewer />)
    expect(screen.getByText(/3D Canvas/i)).toBeInTheDocument()
  })

  it('renders the Parts panel with part list items', () => {
    render(<ThreeDViewer />)
    expect(screen.getByText('Parts')).toBeInTheDocument()
    expect(screen.getByText(/LHS Side/)).toBeInTheDocument()
    expect(screen.getByText(/RHS Side/)).toBeInTheDocument()
  })

  it('renders the Export GLTF and Export OBJ buttons', () => {
    render(<ThreeDViewer />)
    expect(screen.getByRole('button', { name: /export gltf/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export obj/i })).toBeInTheDocument()
  })
})
