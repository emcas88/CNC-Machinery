/**
 * GCodeViewer
 *
 * Full-featured G-code viewer page for the CNC cabinet manufacturing app.
 *
 * Features:
 *  - Generates G-code via the real backend API (no mock data)
 *  - Syntax-highlighted G-code editor pane with block navigation
 *  - Toolpath statistics panel (cut time, distance, tool changes)
 *  - Working Export (.nc file download) button
 *  - Simulate toolpath (shows detailed stats without regenerating G-code)
 *  - Safety check (shows violations and warnings)
 *  - Spoilboard resurface program generator (modal)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import gcodeService, {
  formatDistance,
  formatDuration,
  GCodeBlock,
  GCodeConfigDto,
  GenerateResponse,
  SafetyCheckOutput,
  SimulationOutput,
  SpoilboardResurfaceRequest,
  SpoilboardResurfaceResponse,
  tokenizeLine,
} from '../services/gcode';

// ─────────────────────────────────────────────────────────────────────────────
// Types & props
// ─────────────────────────────────────────────────────────────────────────────

interface GCodeViewerProps {
  /** UUID of the sheet to display G-code for. Can be passed as a URL param. */
  sheetId?: string;
  /** UUID of the machine (used for spoilboard resurface). */
  machineId?: string;
}

type Tab = 'viewer' | 'simulate' | 'safety' | 'resurface';

// ─────────────────────────────────────────────────────────────────────────────
// Inline styles (no external CSS dependency required)
// ─────────────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    background: '#0f0f13',
    color: '#e2e2e9',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: '#1a1a24',
    borderBottom: '1px solid #2d2d3d',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#e2e2e9',
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    padding: '0 24px',
    background: '#1a1a24',
    borderBottom: '1px solid #2d2d3d',
  },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '10px 18px',
    border: 'none',
    background: 'transparent',
    color: active ? '#7c6ef7' : '#8888a0',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    borderBottom: active ? '2px solid #7c6ef7' : '2px solid transparent',
    transition: 'color 0.15s',
  }),
  body: {
    display: 'flex',
    flex: 1,
    gap: 0,
    overflow: 'hidden',
  },
  sidebar: {
    width: 280,
    background: '#15151f',
    borderRight: '1px solid #2d2d3d',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarTitle: {
    padding: '12px 16px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: '#6666a0',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid #2d2d3d',
  },
  blockList: {
    flex: 1,
    overflowY: 'auto',
  },
  blockItem: (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 12,
    color: active ? '#b0a8ff' : '#9090b8',
    background: active ? '#1f1f35' : 'transparent',
    borderLeft: active ? '3px solid #7c6ef7' : '3px solid transparent',
    borderBottom: '1px solid #1e1e2e',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: '#15151f',
    borderBottom: '1px solid #2d2d3d',
    flexWrap: 'wrap',
  },
  btn: (variant: 'primary' | 'secondary' | 'danger' = 'secondary'): React.CSSProperties => ({
    padding: '7px 16px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    background:
      variant === 'primary'
        ? '#5b4fcf'
        : variant === 'danger'
        ? '#8b2020'
        : '#2a2a3e',
    color: variant === 'danger' ? '#ffaaaa' : '#e2e2e9',
    transition: 'background 0.15s',
  }),
  codeArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 20px',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 12,
    lineHeight: 1.7,
    background: '#0d0d14',
  },
  codeLine: {
    display: 'flex',
    gap: 12,
  },
  lineNum: {
    minWidth: 40,
    textAlign: 'right',
    color: '#3d3d5c',
    userSelect: 'none',
    flexShrink: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
    padding: 16,
  },
  statCard: {
    background: '#1a1a28',
    border: '1px solid #2a2a40',
    borderRadius: 8,
    padding: '12px 16px',
  },
  statLabel: {
    fontSize: 11,
    color: '#6666a0',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#b0a8ff',
  },
  warningBox: {
    margin: '12px 16px 0',
    background: '#2a1e0a',
    border: '1px solid #5a3a08',
    borderRadius: 6,
    padding: '10px 14px',
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#f0a040',
    marginBottom: 6,
  },
  warningItem: {
    fontSize: 12,
    color: '#d0901e',
    marginBottom: 3,
  },
  violationBox: {
    margin: '12px 16px',
    background: '#2a0a0a',
    border: '1px solid #5a0808',
    borderRadius: 6,
    padding: '10px 14px',
  },
  violationTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ff6060',
    marginBottom: 6,
  },
  violationItem: {
    fontSize: 12,
    color: '#d04040',
    marginBottom: 3,
  },
  passedBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    background: '#0a2a12',
    color: '#40c060',
    border: '1px solid #20602a',
  },
  failedBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    background: '#2a0a0a',
    color: '#ff6060',
    border: '1px solid #6a1010',
  },
  panelPad: {
    padding: '16px',
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#8888a0',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    width: '100%',
    padding: '7px 10px',
    background: '#1a1a28',
    border: '1px solid #3a3a58',
    borderRadius: 6,
    color: '#e2e2e9',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  errorText: {
    color: '#ff6060',
    fontSize: 13,
    padding: '12px 16px',
  },
  loadingText: {
    color: '#8888a0',
    fontSize: 13,
    padding: '24px 16px',
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: '#9090c0',
    padding: '12px 16px 4px',
    borderTop: '1px solid #2a2a3e',
    marginTop: 8,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Syntax-highlighted code line component
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_COLORS: Record<string, string> = {
  'gcode-comment': '#5a8a5a',
  'gcode-g-word': '#7c9ef7',
  'gcode-m-word': '#c07cd0',
  'gcode-coord': '#e0c060',
  'gcode-feed': '#60c0a0',
  'gcode-spindle': '#c08060',
  'gcode-tool': '#d07070',
  'gcode-line-number': '#3d4d7c',
};

const HighlightedLine: React.FC<{ line: string }> = React.memo(({ line }) => {
  const tokens = tokenizeLine(line);
  return (
    <>
      {tokens.map((tok, i) => (
        <span
          key={i}
          style={{ color: TOKEN_COLORS[tok.className] ?? 'inherit' }}
        >
          {tok.text}
        </span>
      ))}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Block navigation sidebar
// ─────────────────────────────────────────────────────────────────────────────

interface BlockNavProps {
  blocks: GCodeBlock[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}

const BlockNav: React.FC<BlockNavProps> = ({ blocks, activeIdx, onSelect }) => (
  <aside style={styles.sidebar}>
    <div style={styles.sidebarTitle}>Program Blocks</div>
    <div style={styles.blockList}>
      {blocks.map((block, idx) => (
        <div
          key={idx}
          style={styles.blockItem(idx === activeIdx)}
          onClick={() => onSelect(idx)}
          title={block.label}
        >
          {block.label}
        </div>
      ))}
    </div>
  </aside>
);

// ─────────────────────────────────────────────────────────────────────────────
// Statistics panel
// ─────────────────────────────────────────────────────────────────────────────

interface StatsData {
  tool_changes: number;
  estimated_cut_time_seconds: number;
  total_distance_mm: number;
  warnings: string[];
}

const StatsPanel: React.FC<{ stats: StatsData; lineCount: number }> = ({
  stats,
  lineCount,
}) => (
  <div>
    <div style={styles.statsGrid}>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Cut Time</div>
        <div style={styles.statValue}>
          {formatDuration(stats.estimated_cut_time_seconds)}
        </div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total Distance</div>
        <div style={styles.statValue}>
          {formatDistance(stats.total_distance_mm)}
        </div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Tool Changes</div>
        <div style={styles.statValue}>{stats.tool_changes}</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Lines of G-code</div>
        <div style={styles.statValue}>{lineCount.toLocaleString()}</div>
      </div>
    </div>
    {stats.warnings.length > 0 && (
      <div style={styles.warningBox}>
        <div style={styles.warningTitle}>
          ⚠ {stats.warnings.length} Warning
          {stats.warnings.length > 1 ? 's' : ''}
        </div>
        {stats.warnings.map((w, i) => (
          <div key={i} style={styles.warningItem}>
            • {w}
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Config editor (collapsible panel)
// ─────────────────────────────────────────────────────────────────────────────

interface ConfigEditorProps {
  config: GCodeConfigDto;
  onChange: (cfg: GCodeConfigDto) => void;
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({ config, onChange }) => {
  const set = (key: keyof GCodeConfigDto, value: string) => {
    const num = parseFloat(value);
    onChange({ ...config, [key]: isNaN(num) ? undefined : num });
  };
  const setBool = (key: keyof GCodeConfigDto, value: boolean) =>
    onChange({ ...config, [key]: value });

  return (
    <div style={styles.panelPad}>
      <div style={{ fontSize: 12, color: '#6666a0', marginBottom: 8 }}>
        Override generator defaults (leave blank for defaults)
      </div>
      {(
        [
          ['safe_z', 'Safe Z Height (mm)', 15],
          ['clearance_z', 'Clearance Z (mm)', 5],
          ['spoilboard_tolerance', 'Spoilboard Tolerance (mm)', 0.3],
          ['pocket_stepover_ratio', 'Pocket Stepover Ratio (0–1)', 0.6],
          ['lead_in_radius', 'Lead-in Arc Radius (mm)', 5],
          ['tab_width', 'Tab Width (mm)', 8],
          ['tab_height', 'Tab Height (mm)', 3],
          ['default_tab_count', 'Default Tab Count', 4],
          ['line_number_increment', 'Line Number Increment (0 = off)', 10],
        ] as [keyof GCodeConfigDto, string, number][]
      ).map(([key, label, placeholder]) => (
        <div key={key}>
          <label style={styles.label}>{label}</label>
          <input
            type="number"
            style={styles.input}
            placeholder={String(placeholder)}
            value={config[key] ?? ''}
            onChange={(e) => set(key, e.target.value)}
          />
        </div>
      ))}
      <label style={styles.label}>
        <input
          type="checkbox"
          checked={config.include_comments ?? true}
          onChange={(e) => setBool('include_comments', e.target.checked)}
          style={{ marginRight: 6 }}
        />
        Include comments in G-code
      </label>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main GCodeViewer component
// ─────────────────────────────────────────────────────────────────────────────

const GCodeViewer: React.FC<GCodeViewerProps> = ({ sheetId: propSheetId, machineId: propMachineId }) => {
  // Read IDs from URL params if not passed as props.
  const urlParams = new URLSearchParams(window.location.search);
  const sheetId = propSheetId ?? urlParams.get('sheet_id') ?? '';
  const machineId = propMachineId ?? urlParams.get('machine_id') ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('viewer');
  const [config, setConfig] = useState<GCodeConfigDto>({});
  const [showConfig, setShowConfig] = useState(false);

  // ── G-code viewer state ────────────────────────────────────────────────────
  const [gcode, setGcode] = useState<GenerateResponse | null>(null);
  const [gcodeLoading, setGcodeLoading] = useState(false);
  const [gcodeError, setGcodeError] = useState<string | null>(null);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const codeRef = useRef<HTMLDivElement>(null);

  // ── Simulate state ─────────────────────────────────────────────────────────
  const [simulation, setSimulation] = useState<SimulationOutput | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  // ── Safety check state ─────────────────────────────────────────────────────
  const [safetyResult, setSafetyResult] = useState<SafetyCheckOutput | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  // ── Spoilboard resurface state ─────────────────────────────────────────────
  const [resurface, setResurface] = useState<SpoilboardResurfaceResponse | null>(null);
  const [resurfaceLoading, setResurfaceLoading] = useState(false);
  const [resurfaceError, setResurfaceError] = useState<string | null>(null);
  const [resurfaceForm, setResurfaceForm] = useState<Omit<SpoilboardResurfaceRequest, 'machine_id' | 'config'>>({
    tool_diameter: 50,
    rpm: 12000,
    feed_rate: 8000,
    plunge_rate: 2000,
    cut_depth: 0.5,
  });

  // ── Computed lines for the visible block ──────────────────────────────────
  const visibleLines = useMemo<string[]>(() => {
    if (!gcode) return [];
    const block = gcode.blocks[activeBlockIdx];
    return block ? block.lines : [];
  }, [gcode, activeBlockIdx]);

  const allLines = useMemo<string[]>(() => {
    if (!gcode) return [];
    return gcode.gcode.split('\n');
  }, [gcode]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!sheetId) {
      setGcodeError('No sheet_id provided.');
      return;
    }
    setGcodeLoading(true);
    setGcodeError(null);
    try {
      const result = await gcodeService.generate({ sheet_id: sheetId, config });
      setGcode(result);
      setActiveBlockIdx(0);
    } catch (err) {
      setGcodeError(String(err));
    } finally {
      setGcodeLoading(false);
    }
  }, [sheetId, config]);

  // Auto-generate on first load if a sheetId is available.
  useEffect(() => {
    if (sheetId) handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  const handleExport = useCallback(async () => {
    if (!sheetId) return;
    try {
      await gcodeService.exportFile(sheetId);
    } catch (err) {
      setGcodeError(String(err));
    }
  }, [sheetId]);

  const handleSimulate = useCallback(async () => {
    if (!sheetId) return;
    setSimLoading(true);
    setSimError(null);
    try {
      const result = await gcodeService.simulate({ sheet_id: sheetId, config });
      setSimulation(result);
    } catch (err) {
      setSimError(String(err));
    } finally {
      setSimLoading(false);
    }
  }, [sheetId, config]);

  const handleSafetyCheck = useCallback(async () => {
    if (!sheetId) return;
    setSafetyLoading(true);
    setSafetyError(null);
    try {
      const result = await gcodeService.safetyCheck({ sheet_id: sheetId, config });
      setSafetyResult(result);
    } catch (err) {
      setSafetyError(String(err));
    } finally {
      setSafetyLoading(false);
    }
  }, [sheetId, config]);

  const handleResurface = useCallback(async () => {
    if (!machineId) {
      setResurfaceError('No machine_id provided.');
      return;
    }
    setResurfaceLoading(true);
    setResurfaceError(null);
    try {
      const result = await gcodeService.spoilboardResurface({
        machine_id: machineId,
        ...resurfaceForm,
        config,
      });
      setResurface(result);
    } catch (err) {
      setResurfaceError(String(err));
    } finally {
      setResurfaceLoading(false);
    }
  }, [machineId, resurfaceForm, config]);

  // Scroll to block when selected in nav.
  const handleBlockSelect = (idx: number) => {
    setActiveBlockIdx(idx);
    codeRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderViewer = () => (
    <div style={styles.body}>
      {/* Block navigation */}
      {gcode && (
        <BlockNav
          blocks={gcode.blocks}
          activeIdx={activeBlockIdx}
          onSelect={handleBlockSelect}
        />
      )}

      {/* Main code pane */}
      <div style={styles.main}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <button
            style={styles.btn('primary')}
            onClick={handleGenerate}
            disabled={gcodeLoading || !sheetId}
          >
            {gcodeLoading ? 'Generating…' : 'Generate'}
          </button>

          <button
            style={styles.btn()}
            onClick={handleExport}
            disabled={!gcode}
          >
            Export .nc
          </button>

          <button
            style={styles.btn()}
            onClick={() => setShowConfig((v) => !v)}
          >
            {showConfig ? 'Hide Config' : 'Config'}
          </button>

          {gcode && (
            <span style={{ fontSize: 12, color: '#6666a0', marginLeft: 8 }}>
              {allLines.length.toLocaleString()} lines ·{' '}
              {gcode.tool_changes} tool change
              {gcode.tool_changes !== 1 ? 's' : ''} ·{' '}
              {formatDuration(gcode.estimated_cut_time_seconds)} ·{' '}
              {formatDistance(gcode.total_distance_mm)}
            </span>
          )}
        </div>

        {/* Config panel */}
        {showConfig && (
          <div
            style={{
              borderBottom: '1px solid #2d2d3d',
              background: '#12121c',
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            <ConfigEditor config={config} onChange={setConfig} />
          </div>
        )}

        {/* Stats bar */}
        {gcode && (
          <StatsPanel
            stats={{
              tool_changes: gcode.tool_changes,
              estimated_cut_time_seconds: gcode.estimated_cut_time_seconds,
              total_distance_mm: gcode.total_distance_mm,
              warnings: gcode.warnings,
            }}
            lineCount={allLines.length}
          />
        )}

        {/* Error */}
        {gcodeError && <div style={styles.errorText}>Error: {gcodeError}</div>}

        {/* Loading */}
        {gcodeLoading && (
          <div style={styles.loadingText}>Generating G-code…</div>
        )}

        {/* G-code listing */}
        {!gcodeLoading && gcode && (
          <div style={styles.codeArea} ref={codeRef}>
            {visibleLines.map((line, i) => (
              <div key={i} style={styles.codeLine}>
                <span style={styles.lineNum}>{i + 1}</span>
                <span>
                  <HighlightedLine line={line} />
                </span>
              </div>
            ))}
          </div>
        )}

        {!gcodeLoading && !gcode && !gcodeError && (
          <div style={styles.loadingText}>
            {sheetId
              ? 'Click Generate to produce G-code.'
              : 'No sheet_id provided. Pass ?sheet_id=… in the URL.'}
          </div>
        )}
      </div>
    </div>
  );

  const renderSimulate = () => (
    <div style={styles.panelPad}>
      <button
        style={styles.btn('primary')}
        onClick={handleSimulate}
        disabled={simLoading || !sheetId}
      >
        {simLoading ? 'Simulating…' : 'Run Simulation'}
      </button>

      {simError && <div style={styles.errorText}>Error: {simError}</div>}

      {simulation && (
        <>
          <div style={styles.statsGrid}>
            {(
              [
                ['Estimated Cut Time', formatDuration(simulation.estimated_cut_time_seconds)],
                ['Total Distance', formatDistance(simulation.total_distance_mm)],
                ['Rapid Distance', formatDistance(simulation.rapid_distance_mm)],
                ['Cut Distance', formatDistance(simulation.cut_distance_mm)],
                ['Tool Changes', String(simulation.tool_changes)],
                ['Depth Passes', String(simulation.pass_count)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} style={styles.statCard}>
                <div style={styles.statLabel}>{label}</div>
                <div style={styles.statValue}>{value}</div>
              </div>
            ))}
          </div>

          {simulation.warnings.length > 0 && (
            <div style={styles.warningBox}>
              <div style={styles.warningTitle}>
                ⚠ {simulation.warnings.length} Warning
                {simulation.warnings.length > 1 ? 's' : ''}
              </div>
              {simulation.warnings.map((w, i) => (
                <div key={i} style={styles.warningItem}>
                  • {w}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderSafety = () => (
    <div style={styles.panelPad}>
      <button
        style={styles.btn('primary')}
        onClick={handleSafetyCheck}
        disabled={safetyLoading || !sheetId}
      >
        {safetyLoading ? 'Checking…' : 'Run Safety Check'}
      </button>

      {safetyError && (
        <div style={styles.errorText}>Error: {safetyError}</div>
      )}

      {safetyResult && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            {safetyResult.passed ? (
              <span style={styles.passedBadge}>✓ All checks passed</span>
            ) : (
              <span style={styles.failedBadge}>
                ✗ {safetyResult.violations.length} violation
                {safetyResult.violations.length > 1 ? 's' : ''} found
              </span>
            )}
          </div>

          {safetyResult.violations.length > 0 && (
            <div style={styles.violationBox}>
              <div style={styles.violationTitle}>Violations</div>
              {safetyResult.violations.map((v, i) => (
                <div key={i} style={styles.violationItem}>
                  • {v}
                </div>
              ))}
            </div>
          )}

          {safetyResult.warnings.length > 0 && (
            <div style={styles.warningBox}>
              <div style={styles.warningTitle}>Warnings</div>
              {safetyResult.warnings.map((w, i) => (
                <div key={i} style={styles.warningItem}>
                  • {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderResurface = () => (
    <div style={styles.panelPad}>
      <div style={{ maxWidth: 480 }}>
        {(
          [
            ['tool_diameter', 'Facing Tool Diameter (mm)', 'number'],
            ['rpm', 'Spindle RPM', 'number'],
            ['feed_rate', 'Feed Rate (mm/min)', 'number'],
            ['plunge_rate', 'Plunge Rate (mm/min)', 'number'],
            ['cut_depth', 'Cut Depth (mm)', 'number'],
          ] as [keyof typeof resurfaceForm, string, string][]
        ).map(([key, label]) => (
          <div key={key}>
            <label style={styles.label}>{label}</label>
            <input
              type="number"
              style={styles.input}
              value={resurfaceForm[key] ?? ''}
              onChange={(e) =>
                setResurfaceForm((f) => ({
                  ...f,
                  [key]: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
        ))}

        <div style={{ marginTop: 16 }}>
          <button
            style={styles.btn('primary')}
            onClick={handleResurface}
            disabled={resurfaceLoading || !machineId}
          >
            {resurfaceLoading ? 'Generating…' : 'Generate Resurfacing Program'}
          </button>
        </div>

        {!machineId && (
          <div style={{ ...styles.errorText, paddingLeft: 0 }}>
            No machine_id provided. Pass ?machine_id=… in the URL.
          </div>
        )}

        {resurfaceError && (
          <div style={styles.errorText}>Error: {resurfaceError}</div>
        )}

        {resurface && (
          <>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Cut Time</div>
                <div style={styles.statValue}>
                  {formatDuration(resurface.estimated_cut_time_seconds)}
                </div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Distance</div>
                <div style={styles.statValue}>
                  {formatDistance(resurface.total_distance_mm)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={styles.sectionHeader}>Generated G-code</div>
              <div
                style={{
                  ...styles.codeArea,
                  maxHeight: 400,
                  border: '1px solid #2d2d3d',
                  borderRadius: 6,
                  marginTop: 8,
                }}
              >
                {resurface.gcode.split('\n').map((line, i) => (
                  <div key={i} style={styles.codeLine}>
                    <span style={styles.lineNum}>{i + 1}</span>
                    <span>
                      <HighlightedLine line={line} />
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  style={styles.btn()}
                  onClick={() => {
                    const blob = new Blob([resurface.gcode], {
                      type: 'text/plain',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'spoilboard_resurface.nc';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download .nc
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── Root render ────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Page header */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>G-code Viewer</h1>
        {sheetId && (
          <span style={{ fontSize: 12, color: '#5555a0' }}>
            Sheet: {sheetId}
          </span>
        )}
      </header>

      {/* Tab bar */}
      <nav style={styles.tabBar}>
        {(
          [
            ['viewer', 'G-code'],
            ['simulate', 'Simulate'],
            ['safety', 'Safety Check'],
            ['resurface', 'Spoilboard Resurface'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            style={styles.tab(activeTab === id)}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'viewer' && renderViewer()}
        {activeTab === 'simulate' && renderSimulate()}
        {activeTab === 'safety' && renderSafety()}
        {activeTab === 'resurface' && renderResurface()}
      </div>
    </div>
  );
};

export default GCodeViewer;
