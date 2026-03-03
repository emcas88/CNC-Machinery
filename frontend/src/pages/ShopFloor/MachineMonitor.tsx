// ─── MachineMonitor ───────────────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Per-machine real-time status view with e-stop, tool info, and operation history.

import React, { useState, useCallback } from 'react';
import { MachineStatus, MachineOperation, MachineAlarm, ToolInfo, MachineState } from './types';
import { formatDuration } from './hooks';

// ─── E-Stop Button ────────────────────────────────────────────────────────────

interface EmergencyStopButtonProps {
  onStop: () => void;
  active: boolean;
  disabled?: boolean;
}

export const EmergencyStopButton: React.FC<EmergencyStopButtonProps> = ({
  onStop,
  active,
  disabled = false,
}) => {
  const [confirming, setConfirming] = useState(false);

  const handleClick = useCallback(() => {
    if (active || disabled) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onStop();
  }, [active, confirming, disabled, onStop]);

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        data-testid="emergency-stop-button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={active ? 'Emergency stop active' : 'Emergency stop'}
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          border: `6px solid ${active ? '#7f1d1d' : confirming ? '#b91c1c' : '#ef4444'}`,
          background: active ? '#991b1b' : confirming ? '#dc2626' : '#ef4444',
          color: '#fff',
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: active
            ? '0 0 0 6px #ef444440, 0 0 20px #ef444480'
            : '0 4px 14px rgba(239,68,68,0.4)',
          transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          opacity: disabled ? 0.5 : 1,
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <span style={{ fontSize: 28 }}>⏹</span>
        <span>E-STOP</span>
      </button>
      {confirming && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, textAlign: 'center' }}>
            Confirm emergency stop?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              data-testid="e-stop-confirm"
              onClick={handleClick}
              style={{
                padding: '6px 16px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Stop Now
            </button>
            <button
              data-testid="e-stop-cancel"
              onClick={handleCancel}
              style={{
                padding: '6px 16px',
                background: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {active && (
        <div
          data-testid="e-stop-active-label"
          style={{ color: '#ef4444', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}
        >
          STOPPED
        </div>
      )}
    </div>
  );
};

// ─── ToolStatusPanel ──────────────────────────────────────────────────────────

interface ToolStatusPanelProps {
  tool: ToolInfo;
}

export const ToolStatusPanel: React.FC<ToolStatusPanelProps> = ({ tool }) => {
  const wearColor =
    tool.wearStatus === 'good'
      ? '#22c55e'
      : tool.wearStatus === 'worn'
      ? '#f59e0b'
      : '#ef4444';

  return (
    <div
      data-testid="tool-status-panel"
      style={{
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Current Tool
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginTop: 2 }}>
            {tool.name}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {tool.id} · {tool.material}
          </div>
        </div>
        <span
          data-testid="tool-wear-badge"
          style={{
            padding: '4px 10px',
            borderRadius: 9999,
            background: wearColor + '18',
            color: wearColor,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {tool.wearStatus}
        </span>
      </div>

      {/* Dimensions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>Dia.</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{tool.diameter} mm</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>Length</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{tool.length} mm</div>
        </div>
      </div>

      {/* Remaining life */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#6b7280' }}>
          <span>Tool Life</span>
          <span style={{ fontWeight: 700, color: wearColor }}>{tool.remainingLife}%</span>
        </div>
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              width: `${tool.remainingLife}%`,
              height: '100%',
              background: wearColor,
              borderRadius: 4,
              transition: 'width 0.4s',
            }}
            role="progressbar"
            aria-valuenow={tool.remainingLife}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  );
};

// ─── MetricPanel ──────────────────────────────────────────────────────────────

interface MetricPanelProps {
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  accent?: string;
  testId?: string;
}

export const MetricPanel: React.FC<MetricPanelProps> = ({
  label,
  value,
  unit,
  sublabel,
  accent = '#3b82f6',
  testId,
}) => (
  <div
    data-testid={testId ?? 'metric-panel'}
    style={{
      background: '#f8fafc',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '12px 16px',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1.2, marginTop: 4 }}>
      {value}
      {unit && <span style={{ fontSize: 14, fontWeight: 500, color: '#9ca3af', marginLeft: 3 }}>{unit}</span>}
    </div>
    {sublabel && (
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sublabel}</div>
    )}
  </div>
);

// ─── AlarmList ────────────────────────────────────────────────────────────────

interface AlarmListProps {
  alarms: MachineAlarm[];
  onAcknowledge?: (alarmId: string) => void;
}

export const AlarmList: React.FC<AlarmListProps> = ({ alarms, onAcknowledge }) => {
  const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    info: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    warning: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
    error: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
    critical: { bg: '#7f1d1d', text: '#fef2f2', border: '#dc2626' },
  };

  if (alarms.length === 0) {
    return (
      <div
        data-testid="alarm-list-empty"
        style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '12px 0' }}
      >
        No active alarms
      </div>
    );
  }

  return (
    <div data-testid="alarm-list">
      {alarms.map((alarm) => {
        const { bg, text, border } = SEVERITY_COLORS[alarm.severity] ?? SEVERITY_COLORS.info;
        return (
          <div
            key={alarm.id}
            data-testid="alarm-item"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 8,
              marginBottom: 6,
              opacity: alarm.acknowledged ? 0.5 : 1,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: text + '22',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {alarm.severity}
                </span>
                {alarm.code}
              </div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 3 }}>{alarm.message}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {new Date(alarm.timestamp).toLocaleTimeString()}
              </div>
            </div>
            {!alarm.acknowledged && onAcknowledge && (
              <button
                data-testid="acknowledge-alarm-btn"
                onClick={() => onAcknowledge(alarm.id)}
                style={{
                  padding: '4px 10px',
                  background: '#fff',
                  border: `1px solid ${border}`,
                  borderRadius: 6,
                  fontSize: 11,
                  color: text,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Ack
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── OperationHistoryLog ──────────────────────────────────────────────────────

interface OperationHistoryLogProps {
  history: MachineOperation[];
  maxItems?: number;
}

export const OperationHistoryLog: React.FC<OperationHistoryLogProps> = ({
  history,
  maxItems = 10,
}) => {
  const displayed = history.slice(0, maxItems);

  if (displayed.length === 0) {
    return (
      <div
        data-testid="op-history-empty"
        style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '12px 0' }}
      >
        No operation history
      </div>
    );
  }

  const RESULT_COLORS: Record<string, string> = {
    success: '#22c55e',
    failed: '#ef4444',
    aborted: '#f59e0b',
  };

  return (
    <div data-testid="operation-history-log">
      {displayed.map((op, index) => {
        const color = op.result ? RESULT_COLORS[op.result] : '#9ca3af';
        return (
          <div
            key={op.id}
            data-testid="history-item"
            style={{
              display: 'flex',
              gap: 10,
              padding: '8px 0',
              borderBottom: index < displayed.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}
          >
            {/* Timeline dot */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                paddingTop: 2,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid #fff',
                  outline: `2px solid ${color}30`,
                }}
              />
              {index < displayed.length - 1 && (
                <div style={{ flex: 1, width: 1.5, background: '#e5e7eb', marginTop: 4 }} />
              )}
            </div>

            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                {op.name}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                {new Date(op.startedAt).toLocaleTimeString()}
                {op.completedAt && (
                  <>
                    {' '}→{' '}
                    {new Date(op.completedAt).toLocaleTimeString()}
                  </>
                )}
                {op.result && (
                  <span style={{ marginLeft: 6, fontWeight: 700, color }}>
                    {op.result.toUpperCase()}
                  </span>
                )}
              </div>
              {op.notes && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>
                  {op.notes}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── MachineMonitor (main component) ──────────────────────────────────────────

export interface MachineMonitorProps {
  /** Injected for testing – otherwise fetched via useMachineMonitor */
  machine?: MachineStatus | null;
  loading?: boolean;
  error?: string | null;
  emergencyStopActive?: boolean;
  onEmergencyStop?: () => void;
  onReset?: () => void;
  onAcknowledgeAlarm?: (alarmId: string) => void;
  operatorId?: string;
  className?: string;
}

export const MachineMonitor: React.FC<MachineMonitorProps> = ({
  machine,
  loading = false,
  error = null,
  emergencyStopActive = false,
  onEmergencyStop,
  onReset,
  onAcknowledgeAlarm,
  operatorId = 'Operator',
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'alarms'>('status');

  if (loading) {
    return (
      <div data-testid="machine-monitor-loading" style={monitorStyles.centered}>
        <div style={monitorStyles.spinner} />
        <p style={{ color: '#6b7280', marginTop: 16 }}>Connecting to machine…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="machine-monitor-error" style={monitorStyles.centered}>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>
          Machine Offline
        </div>
        <p style={{ color: '#6b7280', marginTop: 8, maxWidth: 380, textAlign: 'center' }}>
          {error}
        </p>
        {onReset && (
          <button
            data-testid="retry-connection-btn"
            onClick={onReset}
            style={monitorStyles.primaryBtn}
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  if (!machine) {
    return (
      <div data-testid="machine-monitor-empty" style={monitorStyles.centered}>
        <p style={{ color: '#9ca3af' }}>No machine selected</p>
      </div>
    );
  }

  const unacknowledgedAlarms = machine.alarms.filter((a) => !a.acknowledged);
  const STATE_HEADER_BG: Record<MachineState, string> = {
    idle: '#f0fdf4',
    running: '#eff6ff',
    error: '#fef2f2',
    maintenance: '#fffbeb',
    offline: '#f9fafb',
  };
  const STATE_ACCENT: Record<MachineState, string> = {
    idle: '#22c55e',
    running: '#3b82f6',
    error: '#ef4444',
    maintenance: '#f59e0b',
    offline: '#6b7280',
  };

  const headerBg = STATE_HEADER_BG[machine.state];
  const accent = STATE_ACCENT[machine.state];

  return (
    <div
      data-testid="machine-monitor"
      className={className}
      style={monitorStyles.container}
    >
      {/* ── Machine header ── */}
      <div
        style={{
          background: headerBg,
          borderBottom: `3px solid ${accent}`,
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>
              {machine.name}
            </h1>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              {machine.model} · SN: {machine.serialNumber}
            </div>
            {machine.location && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{machine.location}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {/* State indicator */}
            <span
              data-testid="machine-state-badge"
              style={{
                padding: '6px 16px',
                borderRadius: 9999,
                background: accent,
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {machine.state}
            </span>
            {unacknowledgedAlarms.length > 0 && (
              <span
                data-testid="unacknowledged-alarms-count"
                style={{
                  fontSize: 12,
                  color: '#ef4444',
                  fontWeight: 700,
                  background: '#fef2f2',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  border: '1px solid #fecaca',
                }}
              >
                ⚠ {unacknowledgedAlarms.length} alarm{unacknowledgedAlarms.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Current operation */}
        {machine.currentOperation && (
          <div
            data-testid="current-operation"
            style={{
              marginTop: 12,
              padding: '10px 14px',
              background: '#fff',
              borderRadius: 8,
              border: `1px solid ${accent}30`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: accent,
                animation: machine.state === 'running' ? 'shopfloor-pulse 1.4s infinite' : undefined,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
              {machine.currentOperation}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* ── Metrics row ── */}
        {machine.state === 'running' && (
          <div
            data-testid="metrics-row"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}
          >
            <MetricPanel
              label="Feed Rate"
              value={machine.feedRate.toLocaleString()}
              unit="mm/min"
              accent={accent}
              testId="feed-rate-panel"
            />
            <MetricPanel
              label="Spindle RPM"
              value={machine.spindleRpm.toLocaleString()}
              accent={accent}
              testId="spindle-rpm-panel"
            />
            {machine.estimatedTimeRemaining != null && (
              <MetricPanel
                label="Time Remaining"
                value={formatDuration(machine.estimatedTimeRemaining)}
                accent={accent}
                testId="time-remaining-panel"
              />
            )}
            {machine.temperature != null && (
              <MetricPanel
                label="Temp"
                value={machine.temperature}
                unit="°C"
                accent={machine.temperature > 60 ? '#ef4444' : accent}
                testId="temperature-panel"
              />
            )}
            {machine.coolantLevel != null && (
              <MetricPanel
                label="Coolant"
                value={machine.coolantLevel}
                unit="%"
                accent={machine.coolantLevel < 20 ? '#f59e0b' : accent}
                testId="coolant-panel"
              />
            )}
          </div>
        )}

        {/* ── Tool info ── */}
        {machine.currentTool && (
          <div style={{ marginBottom: 20 }}>
            <ToolStatusPanel tool={machine.currentTool} />
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0, marginBottom: 16 }}>
          {(['status', 'alarms', 'history'] as const).map((tab) => (
            <button
              key={tab}
              data-testid={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 18px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === tab ? '2.5px solid #3b82f6' : '2.5px solid transparent',
                color: activeTab === tab ? '#3b82f6' : '#6b7280',
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                textTransform: 'capitalize',
                letterSpacing: 0.2,
              }}
            >
              {tab}
              {tab === 'alarms' && unacknowledgedAlarms.length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: 9999,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {unacknowledgedAlarms.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'status' && (
          <div data-testid="tab-content-status">
            <div style={{ color: '#374151', fontSize: 14 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {machine.runTimeToday > 0 && (
                  <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '8px 12px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Runtime Today
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginTop: 2 }}>
                      {formatDuration(machine.runTimeToday)}
                    </div>
                  </div>
                )}
                {machine.lastMaintenanceDate && (
                  <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '8px 12px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Last Maintenance
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginTop: 2 }}>
                      {new Date(machine.lastMaintenanceDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {machine.nextMaintenanceDate && (
                  <div style={{ background: '#fffbeb', borderRadius: 8, padding: '8px 12px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Next Maintenance
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginTop: 2 }}>
                      {new Date(machine.nextMaintenanceDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alarms' && (
          <div data-testid="tab-content-alarms">
            <AlarmList alarms={machine.alarms} onAcknowledge={onAcknowledgeAlarm} />
          </div>
        )}

        {activeTab === 'history' && (
          <div data-testid="tab-content-history">
            <OperationHistoryLog history={machine.operationHistory} />
          </div>
        )}

        {/* ── E-Stop section ── */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '2px dashed #fecaca',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <EmergencyStopButton
            onStop={onEmergencyStop ?? (() => {})}
            active={emergencyStopActive}
            disabled={machine.state === 'offline'}
          />
          {emergencyStopActive && onReset && (
            <button
              data-testid="machine-reset-btn"
              onClick={onReset}
              style={monitorStyles.primaryBtn}
            >
              Reset Machine
            </button>
          )}
        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes shopfloor-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes shopfloor-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const monitorStyles = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
  } as React.CSSProperties,
  centered: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    fontFamily: "'Inter', system-ui, sans-serif",
  } as React.CSSProperties,
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'shopfloor-spin 0.8s linear infinite',
  } as React.CSSProperties,
  primaryBtn: {
    marginTop: 12,
    padding: '10px 24px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.2,
  } as React.CSSProperties,
};

export default MachineMonitor;
