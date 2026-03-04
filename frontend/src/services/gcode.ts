/**
 * G-code API Service
 *
 * Typed client for all backend G-code endpoints.
 * Matches the exact request/response shapes defined in gcode_api.rs.
 */

import axios, { AxiosError } from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration DTO (mirrors GCodeConfigDto in Rust)
// ─────────────────────────────────────────────────────────────────────────────

/** Optional overrides for the G-code generator configuration. */
export interface GCodeConfigDto {
  /** Z height for rapid traversals between operations (mm). Default: 15 */
  safe_z?: number;
  /** Z height used before plunging (mm). Default: 5 */
  clearance_z?: number;
  /** Extra depth tolerance protecting the spoilboard (mm). Default: 0.3 */
  spoilboard_tolerance?: number;
  /** Pocket stepover as a fraction of tool diameter (0–1). Default: 0.6 */
  pocket_stepover_ratio?: number;
  /** Arc radius for profile lead-in/lead-out moves (mm). Default: 5 */
  lead_in_radius?: number;
  /** Holding tab width for cutout operations (mm). Default: 8 */
  tab_width?: number;
  /** Holding tab height from sheet bottom (mm). Default: 3 */
  tab_height?: number;
  /** Number of holding tabs per cutout perimeter. Default: 4 */
  default_tab_count?: number;
  /** Include descriptive semicolon comments in the G-code. Default: true */
  include_comments?: boolean;
  /** Line number increment (0 = no line numbers). Default: 10 */
  line_number_increment?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared response types
// ─────────────────────────────────────────────────────────────────────────────

/** A logical block of G-code lines corresponding to one operation or section. */
export interface GCodeBlock {
  label: string;
  lines: string[];
  part_id: string | null;
  operation_id: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateRequest {
  sheet_id: string;
  config?: GCodeConfigDto;
}

export interface GenerateResponse {
  sheet_id: string;
  /** Complete raw G-code program as a single string. */
  gcode: string;
  /** Structured blocks for navigation and syntax highlighting. */
  blocks: GCodeBlock[];
  tool_changes: number;
  estimated_cut_time_seconds: number;
  total_distance_mm: number;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulate
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulateRequest {
  sheet_id: string;
  config?: GCodeConfigDto;
}

export interface SimulationOutput {
  estimated_cut_time_seconds: number;
  total_distance_mm: number;
  rapid_distance_mm: number;
  cut_distance_mm: number;
  tool_changes: number;
  pass_count: number;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety check
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyCheckRequest {
  sheet_id: string;
  config?: GCodeConfigDto;
}

export interface SafetyCheckOutput {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Spoilboard resurface
// ─────────────────────────────────────────────────────────────────────────────

export interface SpoilboardResurfaceRequest {
  machine_id: string;
  /** Facing cutter diameter in mm. */
  tool_diameter: number;
  rpm: number;
  feed_rate: number;
  plunge_rate: number;
  /** Depth of resurfacing cut in mm (typically 0.3–1.0). */
  cut_depth: number;
  config?: GCodeConfigDto;
}

export interface SpoilboardResurfaceResponse {
  gcode: string;
  estimated_cut_time_seconds: number;
  total_distance_mm: number;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

/** Structured error returned by the backend. */
export interface ApiErrorResponse {
  error: string;
}

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<ApiErrorResponse>;
    return axiosErr.response?.data?.error ?? axiosErr.message;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

// ─────────────────────────────────────────────────────────────────────────────
// Service implementation
// ─────────────────────────────────────────────────────────────────────────────

/** Client for all G-code backend endpoints. */
const gcodeService = {
  /**
   * Generate complete G-code for a nested sheet.
   *
   * @param request - Sheet ID and optional config overrides.
   * @returns Generated G-code, structured blocks, and toolpath statistics.
   * @throws `string` error message on failure.
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const { data } = await axios.post<GenerateResponse>(
        `${API_BASE}/gcode/generate`,
        request,
      );
      return data;
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },

  /**
   * Simulate the toolpath and return time/distance statistics without
   * generating the full G-code.
   *
   * @param request - Sheet ID and optional config overrides.
   * @returns Toolpath statistics.
   * @throws `string` error message on failure.
   */
  async simulate(request: SimulateRequest): Promise<SimulationOutput> {
    try {
      const { data } = await axios.post<SimulationOutput>(
        `${API_BASE}/gcode/simulate`,
        request,
      );
      return data;
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },

  /**
   * Run safety checks on a sheet's machining operations.
   *
   * @param request - Sheet ID and optional config overrides.
   * @returns Violations and warnings (no G-code generated).
   * @throws `string` error message on failure.
   */
  async safetyCheck(request: SafetyCheckRequest): Promise<SafetyCheckOutput> {
    try {
      const { data } = await axios.post<SafetyCheckOutput>(
        `${API_BASE}/gcode/safety-check`,
        request,
      );
      return data;
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },

  /**
   * Generate a spoilboard resurfacing program for a machine.
   *
   * @param request - Machine ID, tool specs, and cut depth.
   * @returns Resurfacing G-code and statistics.
   * @throws `string` error message on failure.
   */
  async spoilboardResurface(
    request: SpoilboardResurfaceRequest,
  ): Promise<SpoilboardResurfaceResponse> {
    try {
      const { data } = await axios.post<SpoilboardResurfaceResponse>(
        `${API_BASE}/gcode/spoilboard-resurface`,
        request,
      );
      return data;
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },

  /**
   * Download the G-code for a sheet as a `.nc` file.
   *
   * Triggers a browser file download by creating a temporary anchor element.
   *
   * @param sheetId - UUID of the sheet to export.
   * @param filename - Optional override filename (defaults to the program name
   *   returned by the backend).
   */
  async exportFile(sheetId: string, filename?: string): Promise<void> {
    try {
      const response = await axios.get<Blob>(
        `${API_BASE}/gcode/export/${sheetId}`,
        { responseType: 'blob' },
      );

      // Extract filename from Content-Disposition header if not explicitly
      // provided by the caller.
      const disposition = response.headers['content-disposition'] as string | undefined;
      let downloadName = filename;
      if (!downloadName && disposition) {
        const match = disposition.match(/filename="?([^";\r\n]+)"?/i);
        if (match) downloadName = match[1];
      }
      downloadName = downloadName ?? `sheet_${sheetId}.nc`;

      // Trigger browser download.
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      throw extractErrorMessage(err);
    }
  },
};

export { gcodeService };
export default gcodeService;

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers (used by GCodeViewer)
// ─────────────────────────────────────────────────────────────────────────────

/** Convert seconds into a human-readable `Xh Ym Zs` string. */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/** Format a distance in mm, switching to metres when ≥ 1000 mm. */
export function formatDistance(mm: number): string {
  if (!isFinite(mm) || mm < 0) return '—';
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  return `${mm.toFixed(0)} mm`;
}

/**
 * Apply simple G-code syntax highlighting by returning CSS class names
 * for each token on a line.
 *
 * Returns an array of `{ text, className }` tokens.
 */
export interface GCodeToken {
  text: string;
  className: string;
}

export function tokenizeLine(line: string): GCodeToken[] {
  if (line.startsWith(';')) {
    return [{ text: line, className: 'gcode-comment' }];
  }
  if (line.trim() === '') {
    return [{ text: line, className: 'gcode-blank' }];
  }

  const tokens: GCodeToken[] = [];
  // Split on spaces but keep the delimiter.
  const words = line.split(/(\s+)/);
  for (const word of words) {
    if (/^\s+$/.test(word)) {
      tokens.push({ text: word, className: '' });
      continue;
    }
    const upper = word.toUpperCase();
    if (/^N\d+/.test(upper)) {
      tokens.push({ text: word, className: 'gcode-line-number' });
    } else if (/^G\d/.test(upper)) {
      tokens.push({ text: word, className: 'gcode-g-word' });
    } else if (/^M\d/.test(upper)) {
      tokens.push({ text: word, className: 'gcode-m-word' });
    } else if (/^[XYZIJKR][-\d.]/.test(upper)) {
      tokens.push({ text: word, className: 'gcode-coord' });
    } else if (/^F[\d.]/.test(upper)) {
      tokens.push({ text: word, className: 'gcode-feed' });
    } else if (/^S[\d.]/.test(upper)) {
      tokens.push({ text: word, className: 'gcode-spindle' });
    } else if (/^T\d/.test(upper)) {
      tokens.push({ text: word, className: 'gcode-tool' });
    } else {
      tokens.push({ text: word, className: '' });
    }
  }
  return tokens;
}
