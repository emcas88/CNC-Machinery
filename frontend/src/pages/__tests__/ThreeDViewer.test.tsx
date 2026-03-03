import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/test/test-utils'
import { ThreeDViewer } from '@/pages/ThreeDViewer'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({ camera: { position: { set: vi.fn() }, lookAt: vi.fn() } }),
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Grid: () => null,
  Environment: () => null,
  Html: ({ children }: any) => <div>{children}</div>,
  Edges: () => null,
}))

describe('ThreeDViewer', () => {
  it('renders without crashing', () => {
    render(<ThreeDViewer />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the view angle buttons (Front, Back, Left, Right, Top, Iso)', () => {
    render(<ThreeDViewer />)
    expect(screen.getByRole('button', { name: /^Front$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Back$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Left$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Right$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Top$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Iso$/i })).toBeInTheDocument()
  })

  it('renders the R3F Canvas mock', () => {
    render(<ThreeDViewer />)
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
  })

  it('renders the Scene Objects panel with cabinet names', () => {
    render(<ThreeDViewer />)
    expect(screen.getByText('Scene Objects')).toBeInTheDocument()
    expect(screen.getByText('Base Cabinet B1')).toBeInTheDocument()
    expect(screen.getByText('Base Cabinet B2')).toBeInTheDocument()
    expect(screen.getByText('Upper Cabinet L1')).toBeInTheDocument()
    expect(screen.getByText('Upper Cabinet L2')).toBeInTheDocument()
    expect(screen.getByText('Tall Pantry T1')).toBeInTheDocument()
  })

  it('renders Wireframe, Shadows, Show Dimensions checkboxes', () => {
    render(<ThreeDViewer />)
    expect(screen.getByText('Wireframe')).toBeInTheDocument()
    expect(screen.getByText('Shadows')).toBeInTheDocument()
    expect(screen.getByText('Show Dimensions')).toBeInTheDocument()
  })

  it('renders Render Settings section', () => {
    render(<ThreeDViewer />)
    expect(screen.getByText('Render Settings')).toBeInTheDocument()
  })

  it('renders Orbit/Pan/Zoom info bar', () => {
    render(<ThreeDViewer />)
    expect(screen.getByText(/Orbit: Left drag/)).toBeInTheDocument()
    expect(screen.getByText(/Pan: Right drag/)).toBeInTheDocument()
    expect(screen.getByText(/Zoom: Scroll/)).toBeInTheDocument()
  })

  it('selecting a cabinet in Scene Objects shows Properties panel', () => {
    render(<ThreeDViewer />)
    fireEvent.click(screen.getByText('Base Cabinet B1'))
    expect(screen.getByText('Properties')).toBeInTheDocument()
    expect(screen.getByText('Base Cabinet B1')).toBeInTheDocument()
  })
})
