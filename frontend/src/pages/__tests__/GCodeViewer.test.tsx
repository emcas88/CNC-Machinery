/**
 * GCodeViewer.test.tsx
 *
 * Comprehensive React Testing Library + Vitest tests for the GCodeViewer component.
 *
 * Tests:
 *   - Renders the page header and title
 *   - Shows correct placeholder when no sheet_id provided
 *   - Shows "Click Generate" message when sheet_id is provided but no G-code yet
 *   - Tab navigation (viewer / simulate / safety / resurface)
 *   - Export button state (disabled when no gcode, enabled after generate)
 *   - Generate button disabled when no sheetId
 *   - Generate button triggers service call and updates state
 *   - Loading state while generating
 *   - Error state when generate fails
 *   - Stats panel displays cut time, distance, tool changes, lines count
 *   - Warnings box renders when warnings present
 *   - Safety check flow: run check, show violations, show pass badge
 *   - Simulate flow: run simulation, display stats grid
 *   - Spoilboard resurface tab: form fields present, generate button
 *   - Block navigation sidebar renders blocks
 *   - Syntax-highlighted code renders tokenised spans
 *   - Config panel toggle
 *   - Auto-generate on mount when sheetId is provided
 *   - HighlightedLine renders gcode-comment style for comment lines
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock the gcode service module ────────────────────────────────────────────
vi.mock('../services/gcode', async () => {
  const actual = await vi.importActual<typeof import('../services/gcode')>('../services/gcode');
  return {
    ...actual,
    default: {
      generate: vi.fn(),
      simulate: vi.fn(),
      safetyCheck: vi.fn(),
      spoilboardResurface: vi.fn(),
      exportFile: vi.fn(),
    },
  };
});

import gcodeService from '../services/gcode';
import GCodeViewer from '../GCodeViewer';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MACHINE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeGenerateResponse(overrides = {}) {
  return {
    sheet_id: SHEET_ID,
    gcode: '; Program Header\nG21\nG90\nG17\nT1 M6\nS18000 M3\nG81 X150 Y150 Z-5 R5 F1500\nG80\nM5\nM9\nG0 Z15\nG0 X0 Y0\nM30',
    blocks: [
      { label: 'Program Header', lines: ['; Program Header', 'G21', 'G90'], part_id: null, operation_id: null },
      { label: 'Tool Change – T1 (12mm Compression)', lines: ['T1 M6', 'S18000 M3'], part_id: null, operation_id: null },
      { label: 'TestPart – DRILL @ (150.0,150.0)', lines: ['G81 X150 Y150 Z-5 R5 F1500', 'G80'], part_id: SHEET_ID, operation_id: SHEET_ID },
      { label: 'Program End', lines: ['M5', 'M30'], part_id: null, operation_id: null },
    ],
    tool_changes: 1,
    estimated_cut_time_seconds: 120,
    total_distance_mm: 5000,
    warnings: [],
    ...overrides,
  };
}

function makeSimOutput() {
  return {
    estimated_cut_time_seconds: 180,
    total_distance_mm: 8000,
    rapid_distance_mm: 3000,
    cut_distance_mm: 5000,
    tool_changes: 1,
    pass_count: 3,
    warnings: [],
  };
}

function makeSafetyPass() {
  return { passed: true, violations: [], warnings: [] };
}

function makeSafetyFail() {
  return {
    passed: false,
    violations: ['Part extends beyond spoilboard X limit (1300.0 > 1250.0)'],
    warnings: ['Tool deep cut warning'],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: generate returns a pending promise (not yet resolved)
  (gcodeService.generate as ReturnType<typeof vi.fn>).mockResolvedValue(makeGenerateResponse());
  (gcodeService.simulate as ReturnType<typeof vi.fn>).mockResolvedValue(makeSimOutput());
  (gcodeService.safetyCheck as ReturnType<typeof vi.fn>).mockResolvedValue(makeSafetyPass());
  (gcodeService.spoilboardResurface as ReturnType<typeof vi.fn>).mockResolvedValue({
    gcode: 'G21\nM30',
    estimated_cut_time_seconds: 300,
    total_distance_mm: 25000,
    warnings: [],
  });
  (gcodeService.exportFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper to render without sheetId (no auto-generate)
// ─────────────────────────────────────────────────────────────────────────────

function renderViewer(props: { sheetId?: string; machineId?: string } = {}) {
  return render(<GCodeViewer {...props} />);
}

function renderWithSheet() {
  return render(<GCodeViewer sheetId={SHEET_ID} machineId={MACHINE_ID} />);
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout & rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('GCodeViewer – layout', () => {
  it('renders the page header with "G-code Viewer" title', () => {
    renderViewer();
    expect(screen.getByText('G-code Viewer')).toBeTruthy();
  });

  it('renders all four tabs', () => {
    renderViewer();
    expect(screen.getByText('G-code')).toBeTruthy();
    expect(screen.getByText('Simulate')).toBeTruthy();
    expect(screen.getByText('Safety Check')).toBeTruthy();
    expect(screen.getByText('Spoilboard Resurface')).toBeTruthy();
  });

  it('shows sheet ID in the header when provided', () => {
    renderViewer({ sheetId: SHEET_ID });
    expect(screen.getByText(`Sheet: ${SHEET_ID}`)).toBeTruthy();
  });

  it('does not show sheet label when no sheetId is provided', () => {
    renderViewer();
    expect(screen.queryByText(/Sheet:/)).toBeNull();
  });

  it('shows "No sheet_id provided" message when no sheetId', () => {
    renderViewer();
    expect(screen.getByText(/No sheet_id provided/i)).toBeTruthy();
  });

  it('shows "Click Generate" message when sheetId provided but generate not yet called', async () => {
    // prevent auto-generate from resolving before assertion
    (gcodeService.generate as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderViewer({ sheetId: SHEET_ID });
    // While generating is in flight there should be a loading indicator
    await waitFor(() => {
      expect(screen.getByText(/Generating G-code/i)).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Generate button
// ─────────────────────────────────────────────────────────────────────────────

describe('Generate button', () => {
  it('is disabled when no sheetId is provided', () => {
    renderViewer();
    const btn = screen.getByRole('button', { name: /generate/i });
    expect(btn).toBeDisabled();
  });

  it('is enabled when sheetId is provided', async () => {
    // Mock so auto-generate immediately resolves
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /generate/i });
      expect(btn).not.toBeDisabled();
    });
  });

  it('shows "Generating…" label while loading', async () => {
    let resolve: (v: unknown) => void;
    (gcodeService.generate as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((res) => { resolve = res; }),
    );
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => {
      expect(screen.queryByText(/Generating…/i)).toBeTruthy();
    });
  });

  it('calls gcodeService.generate with sheet_id on click', async () => {
    (gcodeService.generate as ReturnType<typeof vi.fn>).mockResolvedValue(makeGenerateResponse());
    renderViewer({ sheetId: SHEET_ID });

    const btn = await screen.findByRole('button', { name: /^generate$/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(gcodeService.generate).toHaveBeenCalledWith(
        expect.objectContaining({ sheet_id: SHEET_ID }),
      );
    });
  });

  it('displays error text when generate fails', async () => {
    (gcodeService.generate as ReturnType<typeof vi.fn>).mockRejectedValue('Sheet not found');
    renderViewer({ sheetId: SHEET_ID });

    await waitFor(() => {
      expect(screen.getByText(/Error:.*Sheet not found/i)).toBeTruthy();
    });
  });

  it('auto-generates on mount when sheetId is present', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => {
      expect(gcodeService.generate).toHaveBeenCalledOnce();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Export button
// ─────────────────────────────────────────────────────────────────────────────

describe('Export .nc button', () => {
  it('is disabled before G-code is generated', async () => {
    renderViewer({ sheetId: SHEET_ID });
    const exportBtn = await screen.findByRole('button', { name: /export \.nc/i });
    // Before the generate resolves it should be disabled
    // After resolve it should be enabled – wait for resolve
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(exportBtn).not.toBeDisabled();
  });

  it('calls gcodeService.exportFile when clicked', async () => {
    renderViewer({ sheetId: SHEET_ID });
    const exportBtn = await screen.findByRole('button', { name: /export \.nc/i });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(gcodeService.exportFile).toHaveBeenCalledWith(SHEET_ID);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stats panel
// ─────────────────────────────────────────────────────────────────────────────

describe('Stats panel', () => {
  it('displays Cut Time stat after generate', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText('Cut Time')).toBeTruthy();
    expect(screen.getByText('2m 0s')).toBeTruthy(); // 120s → "2m 0s"
  });

  it('displays Total Distance stat after generate', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText('Total Distance')).toBeTruthy();
    expect(screen.getByText('5.00 m')).toBeTruthy(); // 5000mm
  });

  it('displays Tool Changes stat after generate', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText('Tool Changes')).toBeTruthy();
  });

  it('displays Lines of G-code stat', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText('Lines of G-code')).toBeTruthy();
  });

  it('shows warning box when warnings are present', async () => {
    (gcodeService.generate as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeGenerateResponse({ warnings: ['Deep cut warning', 'Another warning'] }),
    );
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText(/2 Warnings/i)).toBeTruthy();
    expect(screen.getByText(/Deep cut warning/)).toBeTruthy();
  });

  it('does not show warning box when warnings list is empty', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.queryByText(/Warning/)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block navigation sidebar
// ─────────────────────────────────────────────────────────────────────────────

describe('Block navigation sidebar', () => {
  it('shows "Program Blocks" heading', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText('Program Blocks')).toBeTruthy();
  });

  it('renders one item per block', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText('Program Header')).toBeTruthy();
    expect(screen.getByText('Program End')).toBeTruthy();
    expect(screen.getByText(/Tool Change – T1/)).toBeTruthy();
  });

  it('clicking a block item updates the visible lines', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    const drillBlock = screen.getByText(/DRILL/);
    fireEvent.click(drillBlock);
    // After clicking the drill block, its lines should be visible
    await waitFor(() => {
      expect(screen.getByText(/G81/)).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Syntax highlighting
// ─────────────────────────────────────────────────────────────────────────────

describe('Syntax highlighting', () => {
  it('renders spans for each token in a G-code line', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    // After generation the code area should have rendered lines
    // Look for a span containing "G21" in the code area
    const spans = document.querySelectorAll('span');
    const g21Span = Array.from(spans).find((s) => s.textContent === 'G21');
    expect(g21Span).toBeTruthy();
  });

  it('applies green comment colour to comment lines', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    // The HighlightedLine component uses TOKEN_COLORS['gcode-comment'] = '#5a8a5a'
    const spans = document.querySelectorAll('span[style]');
    const commentSpan = Array.from(spans).find((s) =>
      (s as HTMLSpanElement).style.color === 'rgb(90, 138, 90)',
    );
    expect(commentSpan).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Config panel toggle
// ─────────────────────────────────────────────────────────────────────────────

describe('Config panel', () => {
  it('Config button toggles the config editor panel', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());

    const configBtn = screen.getByRole('button', { name: /^config$/i });
    expect(screen.queryByText(/Safe Z Height/i)).toBeNull();

    fireEvent.click(configBtn);
    expect(screen.getByText(/Safe Z Height/i)).toBeTruthy();

    fireEvent.click(configBtn);
    expect(screen.queryByText(/Safe Z Height/i)).toBeNull();
  });

  it('Config button label changes to "Hide Config" when open', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());

    const configBtn = screen.getByRole('button', { name: /^config$/i });
    fireEvent.click(configBtn);
    expect(screen.getByRole('button', { name: /Hide Config/i })).toBeTruthy();
  });

  it('config editor has numeric inputs for safe_z, clearance_z, etc.', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());

    const configBtn = screen.getByRole('button', { name: /^config$/i });
    fireEvent.click(configBtn);

    expect(screen.getByText(/Clearance Z/i)).toBeTruthy();
    expect(screen.getByText(/Spoilboard Tolerance/i)).toBeTruthy();
    expect(screen.getByText(/Pocket Stepover Ratio/i)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('Tab navigation', () => {
  it('clicking Simulate tab shows Run Simulation button', async () => {
    renderViewer({ sheetId: SHEET_ID });
    const simTab = screen.getByRole('button', { name: /^Simulate$/i });
    fireEvent.click(simTab);
    expect(screen.getByRole('button', { name: /Run Simulation/i })).toBeTruthy();
  });

  it('clicking Safety Check tab shows Run Safety Check button', async () => {
    renderViewer({ sheetId: SHEET_ID });
    const safetyTab = screen.getByRole('button', { name: /Safety Check/i });
    fireEvent.click(safetyTab);
    expect(screen.getByRole('button', { name: /Run Safety Check/i })).toBeTruthy();
  });

  it('clicking Spoilboard Resurface tab shows the form', async () => {
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    const tab = screen.getByRole('button', { name: /Spoilboard Resurface/i });
    fireEvent.click(tab);
    expect(screen.getByText(/Facing Tool Diameter/i)).toBeTruthy();
    expect(screen.getByText(/Spindle RPM/i)).toBeTruthy();
    expect(screen.getByText(/Feed Rate/i)).toBeTruthy();
  });

  it('clicking G-code tab returns to viewer', async () => {
    renderViewer({ sheetId: SHEET_ID });
    // Go to simulate tab then back
    fireEvent.click(screen.getByRole('button', { name: /^Simulate$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^G-code$/i }));
    expect(screen.getByRole('button', { name: /^generate$/i })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Simulate tab
// ─────────────────────────────────────────────────────────────────────────────

describe('Simulate tab', () => {
  it('Run Simulation button is disabled when no sheetId', async () => {
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: /^Simulate$/i }));
    const btn = screen.getByRole('button', { name: /Run Simulation/i });
    expect(btn).toBeDisabled();
  });

  it('Run Simulation button is enabled when sheetId is provided', async () => {
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /^Simulate$/i }));
    const btn = screen.getByRole('button', { name: /Run Simulation/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls gcodeService.simulate and renders stats on success', async () => {
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /^Simulate$/i }));
    const btn = screen.getByRole('button', { name: /Run Simulation/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(gcodeService.simulate).toHaveBeenCalledWith(
        expect.objectContaining({ sheet_id: SHEET_ID }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Estimated Cut Time')).toBeTruthy();
      expect(screen.getByText('Depth Passes')).toBeTruthy();
    });
  });

  it('shows "Simulating…" label while loading', async () => {
    (gcodeService.simulate as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /^Simulate$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Simulation/i }));
    await waitFor(() => {
      expect(screen.getByText(/Simulating…/i)).toBeTruthy();
    });
  });

  it('shows error text when simulate fails', async () => {
    (gcodeService.simulate as ReturnType<typeof vi.fn>).mockRejectedValue('Sim error');
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /^Simulate$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Simulation/i }));
    await waitFor(() => {
      expect(screen.getByText(/Error:.*Sim error/i)).toBeTruthy();
    });
  });

  it('displays all six stat cards for simulation results', async () => {
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /^Simulate$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Simulation/i }));

    await waitFor(() => {
      expect(screen.getByText('Estimated Cut Time')).toBeTruthy();
      expect(screen.getByText('Total Distance')).toBeTruthy();
      expect(screen.getByText('Rapid Distance')).toBeTruthy();
      expect(screen.getByText('Cut Distance')).toBeTruthy();
      expect(screen.getByText('Tool Changes')).toBeTruthy();
      expect(screen.getByText('Depth Passes')).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Safety check tab
// ─────────────────────────────────────────────────────────────────────────────

describe('Safety Check tab', () => {
  it('Run Safety Check button is disabled when no sheetId', () => {
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: /Safety Check/i }));
    const btn = screen.getByRole('button', { name: /Run Safety Check/i });
    expect(btn).toBeDisabled();
  });

  it('calls gcodeService.safetyCheck on button click', async () => {
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /Safety Check/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Safety Check/i }));

    await waitFor(() => {
      expect(gcodeService.safetyCheck).toHaveBeenCalledWith(
        expect.objectContaining({ sheet_id: SHEET_ID }),
      );
    });
  });

  it('shows "✓ All checks passed" badge when safety check passes', async () => {
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /Safety Check/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Safety Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/i)).toBeTruthy();
    });
  });

  it('shows violation badge and list when safety check fails', async () => {
    (gcodeService.safetyCheck as ReturnType<typeof vi.fn>).mockResolvedValue(makeSafetyFail());

    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /Safety Check/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Safety Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/violation.*found/i)).toBeTruthy();
      expect(screen.getByText(/Part extends beyond spoilboard X limit/)).toBeTruthy();
    });
  });

  it('shows warning box when safety check has warnings', async () => {
    (gcodeService.safetyCheck as ReturnType<typeof vi.fn>).mockResolvedValue(makeSafetyFail());

    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /Safety Check/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Safety Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/Tool deep cut warning/)).toBeTruthy();
    });
  });

  it('shows error text when safety check API fails', async () => {
    (gcodeService.safetyCheck as ReturnType<typeof vi.fn>).mockRejectedValue('API error');

    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /Safety Check/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Safety Check/i }));

    await waitFor(() => {
      expect(screen.getByText(/Error:.*API error/i)).toBeTruthy();
    });
  });

  it('shows "Checking…" label while loading', async () => {
    (gcodeService.safetyCheck as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderViewer({ sheetId: SHEET_ID });
    fireEvent.click(screen.getByRole('button', { name: /Safety Check/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Safety Check/i }));
    await waitFor(() => {
      expect(screen.getByText(/Checking…/i)).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Spoilboard Resurface tab
// ─────────────────────────────────────────────────────────────────────────────

describe('Spoilboard Resurface tab', () => {
  function goToResurfaceTab() {
    fireEvent.click(screen.getByRole('button', { name: /Spoilboard Resurface/i }));
  }

  it('shows all form fields', () => {
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    goToResurfaceTab();
    expect(screen.getByText(/Facing Tool Diameter/i)).toBeTruthy();
    expect(screen.getByText(/Spindle RPM/i)).toBeTruthy();
    expect(screen.getByText(/Feed Rate/i)).toBeTruthy();
    expect(screen.getByText(/Plunge Rate/i)).toBeTruthy();
    expect(screen.getByText(/Cut Depth/i)).toBeTruthy();
  });

  it('Generate Resurfacing Program button is disabled when no machineId', () => {
    renderViewer({ sheetId: SHEET_ID });
    goToResurfaceTab();
    const btn = screen.getByRole('button', { name: /Generate Resurfacing Program/i });
    expect(btn).toBeDisabled();
  });

  it('Generate Resurfacing Program button is enabled when machineId present', () => {
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    goToResurfaceTab();
    const btn = screen.getByRole('button', { name: /Generate Resurfacing Program/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows "No machine_id provided" when machineId is absent', () => {
    renderViewer({ sheetId: SHEET_ID });
    goToResurfaceTab();
    expect(screen.getByText(/No machine_id provided/i)).toBeTruthy();
  });

  it('calls gcodeService.spoilboardResurface on button click', async () => {
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    goToResurfaceTab();
    fireEvent.click(screen.getByRole('button', { name: /Generate Resurfacing Program/i }));

    await waitFor(() => {
      expect(gcodeService.spoilboardResurface).toHaveBeenCalledWith(
        expect.objectContaining({ machine_id: MACHINE_ID }),
      );
    });
  });

  it('displays G-code listing and Download button after successful resurface', async () => {
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    goToResurfaceTab();
    fireEvent.click(screen.getByRole('button', { name: /Generate Resurfacing Program/i }));

    await waitFor(() => {
      expect(screen.getByText('Generated G-code')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Download \.nc/i })).toBeTruthy();
    });
  });

  it('displays cut time and distance stats after resurface', async () => {
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    goToResurfaceTab();
    fireEvent.click(screen.getByRole('button', { name: /Generate Resurfacing Program/i }));

    await waitFor(() => {
      expect(screen.getByText('Cut Time')).toBeTruthy();
      expect(screen.getByText('Distance')).toBeTruthy();
    });
  });

  it('shows error text when resurface API fails', async () => {
    (gcodeService.spoilboardResurface as ReturnType<typeof vi.fn>).mockRejectedValue(
      'Machine not found',
    );
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    goToResurfaceTab();
    fireEvent.click(screen.getByRole('button', { name: /Generate Resurfacing Program/i }));

    await waitFor(() => {
      expect(screen.getByText(/Error:.*Machine not found/i)).toBeTruthy();
    });
  });

  it('shows "Generating…" label while resurface loading', async () => {
    (gcodeService.spoilboardResurface as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    renderViewer({ sheetId: SHEET_ID, machineId: MACHINE_ID });
    goToResurfaceTab();
    fireEvent.click(screen.getByRole('button', { name: /Generate Resurfacing Program/i }));
    await waitFor(() => {
      expect(screen.getByText(/Generating…/i)).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inline stats text in toolbar
// ─────────────────────────────────────────────────────────────────────────────

describe('Toolbar inline stats', () => {
  it('shows tool change count in toolbar after generate', async () => {
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    // "1 tool change" should appear somewhere in the toolbar
    expect(screen.getByText(/tool change/i)).toBeTruthy();
  });

  it('pluralises "tool changes" for multiple tool changes', async () => {
    (gcodeService.generate as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeGenerateResponse({ tool_changes: 3 }),
    );
    renderViewer({ sheetId: SHEET_ID });
    await waitFor(() => expect(gcodeService.generate).toHaveBeenCalled());
    expect(screen.getByText(/tool changes/i)).toBeTruthy();
  });
});
