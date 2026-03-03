/**
 * gcode_service_frontend.test.ts
 *
 * Comprehensive Vitest tests for the G-code frontend service module.
 * Covers:
 *   - gcodeService.generate()
 *   - gcodeService.simulate()
 *   - gcodeService.safetyCheck()
 *   - gcodeService.spoilboardResurface()
 *   - gcodeService.exportFile()
 *   - formatDuration()
 *   - formatDistance()
 *   - tokenizeLine()
 *   - extractErrorMessage() behaviour (via thrown errors)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError } from 'axios';

// ── Module under test ────────────────────────────────────────────────────────
import gcodeService, {
  formatDuration,
  formatDistance,
  tokenizeLine,
  type GCodeBlock,
  type GenerateResponse,
  type SimulationOutput,
  type SafetyCheckOutput,
  type SpoilboardResurfaceResponse,
} from '../services/gcode';

// ─────────────────────────────────────────────────────────────────────────────
// Mock axios globally
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('axios');
const mockedAxios = axios as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  isAxiosError: typeof axios.isAxiosError;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = '11111111-1111-1111-1111-111111111111';
const MACHINE_ID = '22222222-2222-2222-2222-222222222222';

function makeBlock(label: string): GCodeBlock {
  return { label, lines: ['G21', 'G90'], part_id: null, operation_id: null };
}

function makeGenerateResponse(): GenerateResponse {
  return {
    sheet_id: SHEET_ID,
    gcode: 'G21\nG90\nG17\nM30',
    blocks: [makeBlock('Program Header'), makeBlock('Program End')],
    tool_changes: 1,
    estimated_cut_time_seconds: 120.0,
    total_distance_mm: 5000.0,
    warnings: [],
  };
}

function makeSimulationOutput(): SimulationOutput {
  return {
    estimated_cut_time_seconds: 180.0,
    total_distance_mm: 8000.0,
    rapid_distance_mm: 3000.0,
    cut_distance_mm: 5000.0,
    tool_changes: 1,
    pass_count: 3,
    warnings: [],
  };
}

function makeSafetyOutput(passed = true): SafetyCheckOutput {
  return {
    passed,
    violations: passed ? [] : ['Part off-sheet'],
    warnings: [],
  };
}

function makeResurfaceResponse(): SpoilboardResurfaceResponse {
  return {
    gcode: 'G21\nM30',
    estimated_cut_time_seconds: 300.0,
    total_distance_mm: 25000.0,
    warnings: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// gcodeService.generate()
// ─────────────────────────────────────────────────────────────────────────────

describe('gcodeService.generate()', () => {
  it('calls POST /gcode/generate with the request body', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeGenerateResponse() });

    await gcodeService.generate({ sheet_id: SHEET_ID });

    expect(mockedAxios.post).toHaveBeenCalledOnce();
    const [url, body] = mockedAxios.post.mock.calls[0];
    expect(url).toContain('/gcode/generate');
    expect(body).toEqual({ sheet_id: SHEET_ID });
  });

  it('returns the generate response data on success', async () => {
    const mockData = makeGenerateResponse();
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: mockData });

    const result = await gcodeService.generate({ sheet_id: SHEET_ID });

    expect(result.sheet_id).toBe(SHEET_ID);
    expect(result.gcode).toContain('G21');
    expect(result.tool_changes).toBe(1);
  });

  it('passes optional config overrides to the request', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeGenerateResponse() });

    await gcodeService.generate({ sheet_id: SHEET_ID, config: { safe_z: 25 } });

    const [, body] = mockedAxios.post.mock.calls[0];
    expect(body.config).toEqual({ safe_z: 25 });
  });

  it('throws the backend error message on AxiosError', async () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Network Error',
      response: { data: { error: 'Sheet not found' } },
    } as unknown as AxiosError;
    mockedAxios.post = vi.fn().mockRejectedValueOnce(axiosErr);
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(true);

    await expect(gcodeService.generate({ sheet_id: SHEET_ID }))
      .rejects.toBe('Sheet not found');
  });

  it('falls back to axios.message when response.data.error is absent', async () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Request failed with status 500',
      response: { data: {} },
    } as unknown as AxiosError;
    mockedAxios.post = vi.fn().mockRejectedValueOnce(axiosErr);
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(true);

    await expect(gcodeService.generate({ sheet_id: SHEET_ID }))
      .rejects.toBe('Request failed with status 500');
  });

  it('throws a generic error message for non-Axios errors', async () => {
    mockedAxios.post = vi.fn().mockRejectedValueOnce(new Error('JS Error'));
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(false);

    await expect(gcodeService.generate({ sheet_id: SHEET_ID }))
      .rejects.toBe('JS Error');
  });

  it('returns blocks array with correct length', async () => {
    const mockData = makeGenerateResponse();
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: mockData });

    const result = await gcodeService.generate({ sheet_id: SHEET_ID });
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].label).toBe('Program Header');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// gcodeService.simulate()
// ─────────────────────────────────────────────────────────────────────────────

describe('gcodeService.simulate()', () => {
  it('calls POST /gcode/simulate', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeSimulationOutput() });

    await gcodeService.simulate({ sheet_id: SHEET_ID });

    const [url] = mockedAxios.post.mock.calls[0];
    expect(url).toContain('/gcode/simulate');
  });

  it('returns simulation output on success', async () => {
    const mockData = makeSimulationOutput();
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: mockData });

    const result = await gcodeService.simulate({ sheet_id: SHEET_ID });

    expect(result.total_distance_mm).toBe(8000.0);
    expect(result.pass_count).toBe(3);
    expect(result.rapid_distance_mm).toBe(3000.0);
    expect(result.cut_distance_mm).toBe(5000.0);
  });

  it('passes config overrides to the request', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeSimulationOutput() });

    await gcodeService.simulate({ sheet_id: SHEET_ID, config: { clearance_z: 3 } });

    const [, body] = mockedAxios.post.mock.calls[0];
    expect(body.config.clearance_z).toBe(3);
  });

  it('throws error message on failure', async () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Timeout',
      response: { data: { error: 'Simulation timed out' } },
    } as unknown as AxiosError;
    mockedAxios.post = vi.fn().mockRejectedValueOnce(axiosErr);
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(true);

    await expect(gcodeService.simulate({ sheet_id: SHEET_ID }))
      .rejects.toBe('Simulation timed out');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// gcodeService.safetyCheck()
// ─────────────────────────────────────────────────────────────────────────────

describe('gcodeService.safetyCheck()', () => {
  it('calls POST /gcode/safety-check', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeSafetyOutput() });

    await gcodeService.safetyCheck({ sheet_id: SHEET_ID });

    const [url] = mockedAxios.post.mock.calls[0];
    expect(url).toContain('/gcode/safety-check');
  });

  it('returns passed=true when check passes', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeSafetyOutput(true) });

    const result = await gcodeService.safetyCheck({ sheet_id: SHEET_ID });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns passed=false with violations when check fails', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeSafetyOutput(false) });

    const result = await gcodeService.safetyCheck({ sheet_id: SHEET_ID });

    expect(result.passed).toBe(false);
    expect(result.violations).toContain('Part off-sheet');
  });

  it('passes config overrides', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeSafetyOutput() });

    await gcodeService.safetyCheck({ sheet_id: SHEET_ID, config: { spoilboard_tolerance: 0.5 } });

    const [, body] = mockedAxios.post.mock.calls[0];
    expect(body.config.spoilboard_tolerance).toBe(0.5);
  });

  it('throws error message on network failure', async () => {
    mockedAxios.post = vi.fn().mockRejectedValueOnce(new Error('Network down'));
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(false);

    await expect(gcodeService.safetyCheck({ sheet_id: SHEET_ID }))
      .rejects.toBe('Network down');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// gcodeService.spoilboardResurface()
// ─────────────────────────────────────────────────────────────────────────────

describe('gcodeService.spoilboardResurface()', () => {
  const request = {
    machine_id: MACHINE_ID,
    tool_diameter: 50,
    rpm: 12000,
    feed_rate: 8000,
    plunge_rate: 2000,
    cut_depth: 0.5,
  };

  it('calls POST /gcode/spoilboard-resurface', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeResurfaceResponse() });

    await gcodeService.spoilboardResurface(request);

    const [url] = mockedAxios.post.mock.calls[0];
    expect(url).toContain('/gcode/spoilboard-resurface');
  });

  it('returns resurface response on success', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeResurfaceResponse() });

    const result = await gcodeService.spoilboardResurface(request);

    expect(result.gcode).toContain('M30');
    expect(result.estimated_cut_time_seconds).toBe(300.0);
    expect(result.total_distance_mm).toBe(25000.0);
    expect(result.warnings).toHaveLength(0);
  });

  it('includes all request fields in the POST body', async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: makeResurfaceResponse() });

    await gcodeService.spoilboardResurface(request);

    const [, body] = mockedAxios.post.mock.calls[0];
    expect(body.machine_id).toBe(MACHINE_ID);
    expect(body.tool_diameter).toBe(50);
    expect(body.cut_depth).toBe(0.5);
  });

  it('throws error message on server error', async () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Server Error',
      response: { data: { error: 'Machine not found' } },
    } as unknown as AxiosError;
    mockedAxios.post = vi.fn().mockRejectedValueOnce(axiosErr);
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(true);

    await expect(gcodeService.spoilboardResurface(request))
      .rejects.toBe('Machine not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// gcodeService.exportFile()
// ─────────────────────────────────────────────────────────────────────────────

describe('gcodeService.exportFile()', () => {
  // Mock DOM APIs used by exportFile
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let appendChildMock: ReturnType<typeof vi.fn>;
  let removeChildMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;
  let createElementMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLMock = vi.fn();
    clickMock = vi.fn();
    appendChildMock = vi.fn();
    removeChildMock = vi.fn();
    createElementMock = vi.fn().mockReturnValue({
      href: '',
      download: '',
      click: clickMock,
    });

    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;
    document.body.appendChild = appendChildMock;
    document.body.removeChild = removeChildMock;
    document.createElement = createElementMock;
  });

  it('calls GET /gcode/export/{sheetId} with blob responseType', async () => {
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: new Blob(['G21\nM30']),
      headers: { 'content-disposition': 'attachment; filename="prog.nc"' },
    });

    await gcodeService.exportFile(SHEET_ID);

    const [url, options] = mockedAxios.get.mock.calls[0];
    expect(url).toContain(`/gcode/export/${SHEET_ID}`);
    expect(options.responseType).toBe('blob');
  });

  it('creates a download anchor and clicks it', async () => {
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: new Blob(['G21\nM30']),
      headers: { 'content-disposition': 'attachment; filename="prog.nc"' },
    });

    await gcodeService.exportFile(SHEET_ID);

    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(clickMock).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledOnce();
  });

  it('uses filename from Content-Disposition header when not provided', async () => {
    const anchor = { href: '', download: '', click: clickMock };
    createElementMock.mockReturnValue(anchor);
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: new Blob(['G21\nM30']),
      headers: { 'content-disposition': 'attachment; filename="my_program.nc"' },
    });

    await gcodeService.exportFile(SHEET_ID);

    expect(anchor.download).toBe('my_program.nc');
  });

  it('uses explicit filename parameter when provided', async () => {
    const anchor = { href: '', download: '', click: clickMock };
    createElementMock.mockReturnValue(anchor);
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: new Blob(['G21\nM30']),
      headers: { 'content-disposition': 'attachment; filename="prog.nc"' },
    });

    await gcodeService.exportFile(SHEET_ID, 'custom_name.nc');

    expect(anchor.download).toBe('custom_name.nc');
  });

  it('falls back to sheet_{id}.nc when no Content-Disposition header', async () => {
    const anchor = { href: '', download: '', click: clickMock };
    createElementMock.mockReturnValue(anchor);
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: new Blob(['G21\nM30']),
      headers: {},
    });

    await gcodeService.exportFile(SHEET_ID);

    expect(anchor.download).toBe(`sheet_${SHEET_ID}.nc`);
  });

  it('throws error message on download failure', async () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Download failed',
      response: { data: { error: 'Export error' } },
    } as unknown as AxiosError;
    mockedAxios.get = vi.fn().mockRejectedValueOnce(axiosErr);
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(true);

    await expect(gcodeService.exportFile(SHEET_ID)).rejects.toBe('Export error');
  });

  it('appends anchor to document.body before clicking', async () => {
    const anchor = { href: '', download: '', click: clickMock };
    createElementMock.mockReturnValue(anchor);
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: new Blob(['G21\nM30']),
      headers: {},
    });

    await gcodeService.exportFile(SHEET_ID);

    expect(appendChildMock).toHaveBeenCalledWith(anchor);
    expect(removeChildMock).toHaveBeenCalledWith(anchor);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatDuration()
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDuration()', () => {
  it('returns "—" for negative values', () => {
    expect(formatDuration(-1)).toBe('—');
  });

  it('returns "—" for Infinity', () => {
    expect(formatDuration(Infinity)).toBe('—');
  });

  it('returns "—" for NaN', () => {
    expect(formatDuration(NaN)).toBe('—');
  });

  it('formats 0 seconds as "0s"', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats 45 seconds as "45s"', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats 60 seconds as "1m 0s"', () => {
    expect(formatDuration(60)).toBe('1m 0s');
  });

  it('formats 90 seconds as "1m 30s"', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('formats 3600 seconds as "1h 0m 0s"', () => {
    expect(formatDuration(3600)).toBe('1h 0m 0s');
  });

  it('formats 3665 seconds as "1h 1m 5s"', () => {
    expect(formatDuration(3665)).toBe('1h 1m 5s');
  });

  it('formats 7322 seconds (2h 2m 2s)', () => {
    expect(formatDuration(7322)).toBe('2h 2m 2s');
  });

  it('rounds fractional seconds to nearest integer', () => {
    expect(formatDuration(45.6)).toBe('46s');
    expect(formatDuration(45.4)).toBe('45s');
  });

  it('does not include minutes part when minutes=0 and hours=0', () => {
    const result = formatDuration(30);
    expect(result).toBe('30s');
    expect(result).not.toContain('m');
    expect(result).not.toContain('h');
  });

  it('includes minutes when hours > 0 even if minutes = 0', () => {
    const result = formatDuration(3600); // exactly 1 hour
    expect(result).toContain('0m');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatDistance()
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDistance()', () => {
  it('returns "—" for negative values', () => {
    expect(formatDistance(-1)).toBe('—');
  });

  it('returns "—" for Infinity', () => {
    expect(formatDistance(Infinity)).toBe('—');
  });

  it('returns "—" for NaN', () => {
    expect(formatDistance(NaN)).toBe('—');
  });

  it('formats 0 mm as "0 mm"', () => {
    expect(formatDistance(0)).toBe('0 mm');
  });

  it('formats 500 mm as "500 mm"', () => {
    expect(formatDistance(500)).toBe('500 mm');
  });

  it('formats 999 mm as "999 mm" (still mm)', () => {
    expect(formatDistance(999)).toBe('999 mm');
  });

  it('formats 1000 mm as "1.00 m"', () => {
    expect(formatDistance(1000)).toBe('1.00 m');
  });

  it('formats 1500 mm as "1.50 m"', () => {
    expect(formatDistance(1500)).toBe('1.50 m');
  });

  it('formats 25000 mm as "25.00 m"', () => {
    expect(formatDistance(25000)).toBe('25.00 m');
  });

  it('uses two decimal places for metres', () => {
    const result = formatDistance(1234.5);
    expect(result).toBe('1.23 m');
  });

  it('rounds mm to integer', () => {
    expect(formatDistance(500.6)).toBe('501 mm');
    expect(formatDistance(500.4)).toBe('500 mm');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tokenizeLine()
// ─────────────────────────────────────────────────────────────────────────────

describe('tokenizeLine()', () => {
  it('tokenises a comment line as a single gcode-comment token', () => {
    const tokens = tokenizeLine('; This is a comment');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].className).toBe('gcode-comment');
    expect(tokens[0].text).toBe('; This is a comment');
  });

  it('returns a gcode-blank token for an empty line', () => {
    const tokens = tokenizeLine('');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].className).toBe('gcode-blank');
  });

  it('returns a gcode-blank token for a whitespace-only line', () => {
    const tokens = tokenizeLine('   ');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].className).toBe('gcode-blank');
  });

  it('tokenises a G-word with gcode-g-word class', () => {
    const tokens = tokenizeLine('G21');
    const gToken = tokens.find((t) => t.text === 'G21');
    expect(gToken?.className).toBe('gcode-g-word');
  });

  it('tokenises an M-word with gcode-m-word class', () => {
    const tokens = tokenizeLine('M30');
    const mToken = tokens.find((t) => t.text === 'M30');
    expect(mToken?.className).toBe('gcode-m-word');
  });

  it('tokenises a coordinate word (X) with gcode-coord class', () => {
    const tokens = tokenizeLine('G0 X100 Y200');
    const xToken = tokens.find((t) => t.text === 'X100');
    expect(xToken?.className).toBe('gcode-coord');
    const yToken = tokens.find((t) => t.text === 'Y200');
    expect(yToken?.className).toBe('gcode-coord');
  });

  it('tokenises a Z coordinate with gcode-coord class', () => {
    const tokens = tokenizeLine('G1 Z-6');
    const zToken = tokens.find((t) => t.text === 'Z-6');
    expect(zToken?.className).toBe('gcode-coord');
  });

  it('tokenises I/J arc parameters with gcode-coord class', () => {
    const tokens = tokenizeLine('G3 X10 Y10 I5 J0 F6000');
    const iToken = tokens.find((t) => t.text === 'I5');
    expect(iToken?.className).toBe('gcode-coord');
    const jToken = tokens.find((t) => t.text === 'J0');
    expect(jToken?.className).toBe('gcode-coord');
  });

  it('tokenises F-word with gcode-feed class', () => {
    const tokens = tokenizeLine('G1 X100 Y0 F6000');
    const fToken = tokens.find((t) => t.text === 'F6000');
    expect(fToken?.className).toBe('gcode-feed');
  });

  it('tokenises S-word with gcode-spindle class', () => {
    const tokens = tokenizeLine('S18000 M3');
    const sToken = tokens.find((t) => t.text === 'S18000');
    expect(sToken?.className).toBe('gcode-spindle');
  });

  it('tokenises T-word with gcode-tool class', () => {
    const tokens = tokenizeLine('T1 M6');
    const tToken = tokens.find((t) => t.text === 'T1');
    expect(tToken?.className).toBe('gcode-tool');
  });

  it('tokenises N-word (line number) with gcode-line-number class', () => {
    const tokens = tokenizeLine('N10 G21');
    const nToken = tokens.find((t) => t.text === 'N10');
    expect(nToken?.className).toBe('gcode-line-number');
  });

  it('preserves whitespace tokens with empty className', () => {
    const tokens = tokenizeLine('G0 X100');
    const spaceToken = tokens.find((t) => /^\s+$/.test(t.text));
    expect(spaceToken?.className).toBe('');
  });

  it('unknown words receive empty className', () => {
    const tokens = tokenizeLine('UNKNOWN_WORD');
    expect(tokens[0].className).toBe('');
  });

  it('a complex line tokenises all parts correctly', () => {
    const tokens = tokenizeLine('N10 G1 X150 Y200 Z-6 F6000');
    const classes = tokens.filter((t) => t.className !== '').map((t) => t.className);
    expect(classes).toContain('gcode-line-number');
    expect(classes).toContain('gcode-g-word');
    expect(classes).toContain('gcode-coord'); // X, Y, Z
    expect(classes).toContain('gcode-feed');
  });

  it('handles G81 canned cycle correctly as gcode-g-word', () => {
    const tokens = tokenizeLine('G81 X100 Y100 Z-5 R5 F1500');
    const gToken = tokens.find((t) => t.text === 'G81');
    expect(gToken?.className).toBe('gcode-g-word');
  });

  it('handles negative coordinate values correctly', () => {
    const tokens = tokenizeLine('G1 Z-18.3 F1500');
    const zToken = tokens.find((t) => t.text === 'Z-18.3');
    expect(zToken?.className).toBe('gcode-coord');
  });

  it('handles multi-character G codes like G00, G01', () => {
    const tokens = tokenizeLine('G00 X0 Y0');
    const gToken = tokens.find((t) => t.text === 'G00');
    expect(gToken?.className).toBe('gcode-g-word');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error extraction edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Error handling (extractErrorMessage)', () => {
  it('returns "Unknown error" for non-Error, non-Axios throws', async () => {
    mockedAxios.post = vi.fn().mockRejectedValueOnce('raw string error');
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(false);

    await expect(gcodeService.generate({ sheet_id: SHEET_ID }))
      .rejects.toBe('Unknown error');
  });

  it('returns error.message for plain Error objects', async () => {
    mockedAxios.post = vi.fn().mockRejectedValueOnce(new Error('plain error'));
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(false);

    await expect(gcodeService.generate({ sheet_id: SHEET_ID }))
      .rejects.toBe('plain error');
  });

  it('uses axios.message when response is undefined (network error)', async () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Network Error',
      response: undefined,
    } as unknown as AxiosError;
    mockedAxios.post = vi.fn().mockRejectedValueOnce(axiosErr);
    (axios.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(true);

    await expect(gcodeService.generate({ sheet_id: SHEET_ID }))
      .rejects.toBe('Network Error');
  });
});
