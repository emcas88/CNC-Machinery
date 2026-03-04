// ─── QualityCheckView ─────────────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Post-machining quality inspection form: dimension checks, visual inspection,
// photo placeholder, notes, and final QC report submission.

import React, { useRef, useState } from 'react';
import { QualityCheck, DimensionCheck, QCResult } from './types';

// ─── QCResult helpers ───────────────────────────────────────────────────────────

const QC_COLORS: Record<QCResult, { bg: string; text: string; border: string; label: string }> = {
  pass: { bg: '#f0fdf4', text: '#16a34a', border: '#86efac', label: 'PASS' },
  fail: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'FAIL' },
  pending: { bg: '#f8fafc', text: '#6b7280', border: '#e5e7eb', label: 'PENDING' },
};

// ─── PassFailToggle ───────────────────────────────────────────────────────────

interface PassFailToggleProps {
  result: QCResult;
  onChange: (result: QCResult) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PassFailToggle: React.FC<PassFailToggleProps> = ({
  result,
  onChange,
  disabled = false,
  size = 'md',
}) => {
  const heights = { sm: 28, md: 36, lg: 46 };
  const fontSizes = { sm: 11, md: 13, lg: 15 };
  const h = heights[size];
  const fs = fontSizes[size];

  return (
    <div
      data-testid="pass-fail-toggle"
      style={{
        display: 'inline-flex',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1.5px solid #e5e7eb',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        data-testid="pass-button"
        aria-pressed={result === 'pass'}
        disabled={disabled}
        onClick={() => onChange('pass')}
        style={{
          padding: `0 ${h / 2}px`,
          height: h,
          background: result === 'pass' ? '#16a34a' : '#fff',
          color: result === 'pass' ? '#fff' : '#6b7280',
          border: 'none',
          fontWeight: 700,
          fontSize: fs,
          cursor: disabled ? 'not-allowed' : 'pointer',
          letterSpacing: 0.5,
          transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
          borderRight: '1px solid #e5e7eb',
        }}
      >
        PASS
      </button>
      <button
        data-testid="fail-button"
        aria-pressed={result === 'fail'}
        disabled={disabled}
        onClick={() => onChange('fail')}
        style={{
          padding: `0 ${h / 2}px`,
          height: h,
          background: result === 'fail' ? '#dc2626' : '#fff',
          color: result === 'fail' ? '#fff' : '#6b7280',
          border: 'none',
          fontWeight: 700,
          fontSize: fs,
          cursor: disabled ? 'not-allowed' : 'pointer',
          letterSpacing: 0.5,
          transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        FAIL
      </button>
    </div>
  );
};

// ─── DimensionCheckRow ──────────────────────────────────────────────────────────

interface DimensionCheckRowProps {
  check: DimensionCheck;
  onUpdateResult: (id: string, result: QCResult, measuredValue?: number, notes?: string) => void;
  disabled?: boolean;
  index: number;
}

export const DimensionCheckRow: React.FC<DimensionCheckRowProps> = ({
  check,
  onUpdateResult,
  disabled = false,
  index,
}) => {
  const [measured, setMeasured] = useState<string>(
    check.measuredValue != null ? String(check.measuredValue) : '',
  );
  const [notes, setNotes] = useState(check.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!check.notes);

  const isInTolerance = (val: number) =>
    val >= check.nominalValue + check.tolerance.lower &&
    val <= check.nominalValue + check.tolerance.upper;

  const handleMeasuredChange = (raw: string) => {
    setMeasured(raw);
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      const autoResult: QCResult = isInTolerance(num) ? 'pass' : 'fail';
      onUpdateResult(check.id, autoResult, num, notes || undefined);
    }
  };

  const handleToggleResult = (result: QCResult) => {
    const num = parseFloat(measured);
    onUpdateResult(check.id, result, isNaN(num) ? undefined : num, notes || undefined);
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    const num = parseFloat(measured);
    onUpdateResult(check.id, check.result, isNaN(num) ? undefined : num, val || undefined);
  };

  const { bg, border } = QC_COLORS[check.result];
  const nomStr = `${check.nominalValue}${check.unit}`;
  const tolStr = `+${check.tolerance.upper}/${check.tolerance.lower}${check.unit}`;

  return (
    <div
      data-testid="dimension-check-row"
      data-check-id={check.id}
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Index */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#374151',
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>

        {/* Feature info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{check.featureName}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Nominal: <strong>{nomStr}</strong> · Tolerance: <strong>{tolStr}</strong>
          </div>
        </div>

        {/* Pass/Fail toggle */}
        <PassFailToggle
          result={check.result}
          onChange={handleToggleResult}
          disabled={disabled}
          size="sm"
        />
      </div>

      {/* Measured value input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <label style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
          Measured value
        </label>
        <input
          data-testid="measured-value-input"
          type="number"
          step="0.001"
          value={measured}
          onChange={(e) => handleMeasuredChange(e.target.value)}
          disabled={disabled}
          placeholder={`e.g. ${check.nominalValue}`}
          style={{
            width: 100,
            padding: '5px 10px',
            border: '1.5px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            color: '#111827',
            background: disabled ? '#f3f4f6' : '#fff',
          }}
        />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{check.unit}</span>

        <button
          data-testid="add-note-btn"
          onClick={() => setShowNotes((s) => !s)}
          disabled={disabled}
          style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            background: '#fff',
            fontSize: 11,
            color: '#6b7280',
            cursor: 'pointer',
          }}
        >
          {showNotes ? 'Hide note' : '+ Note'}
        </button>
      </div>

      {/* Notes */}
      {showNotes && (
        <textarea
          data-testid="dimension-note-input"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          disabled={disabled}
          placeholder="Add measurement note…"
          rows={2}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '6px 10px',
            border: '1.5px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            color: '#374151',
            resize: 'vertical',
            background: disabled ? '#f3f4f6' : '#fff',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
};

// ─── PhotoPlaceholder ───────────────────────────────────────────────────────────

interface PhotoPlaceholderProps {
  photoUrls: string[];
  onAddPhoto?: (url: string) => void;
  disabled?: boolean;
}

export const PhotoPlaceholder: React.FC<PhotoPlaceholderProps> = ({
  photoUrls,
  onAddPhoto,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onAddPhoto?.(url);
  };

  return (
    <div data-testid="photo-placeholder" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Part Photos / Scan
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Existing photos */}
        {photoUrls.map((url, i) => (
          <div
            key={i}
            data-testid="photo-thumbnail"
            style={{
              width: 80,
              height: 80,
              borderRadius: 8,
              background: '#f3f4f6',
              border: '1.5px solid #e5e7eb',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <img
              src={url}
              alt={`Part photo ${i + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ))}

        {/* Add photo button */}
        {!disabled && (
          <>
            <button
              data-testid="add-photo-btn"
              onClick={() => inputRef.current?.click()}
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                border: '2px dashed #d1d5db',
                background: '#fafafa',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                color: '#9ca3af',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="#9ca3af" strokeWidth="1.5" />
                <path d="M10 6v8M6 10h8" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              data-testid="photo-file-input"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </>
        )}

        {photoUrls.length === 0 && disabled && (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 8,
              border: '1.5px dashed #e5e7eb',
              background: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d1d5db',
              fontSize: 11,
            }}
          >
            None
          </div>
        )}
      </div>
    </div>
  );
};

// ─── VisualInspectionChecklist ───────────────────────────────────────────────────

interface VisualInspectionChecklistProps {
  visualPassed?: boolean;
  surfacePassed?: boolean;
  onVisualChange: (passed: boolean) => void;
  onSurfaceChange: (passed: boolean) => void;
  disabled?: boolean;
}

export const VisualInspectionChecklist: React.FC<VisualInspectionChecklistProps> = ({
  visualPassed,
  surfacePassed,
  onVisualChange,
  onSurfaceChange,
  disabled = false,
}) => {
  const checks = [
    {
      id: 'visual',
      label: 'Visual Inspection',
      description: 'No visible defects, burrs, chips, or surface damage',
      value: visualPassed,
      onChange: onVisualChange,
    },
    {
      id: 'surface',
      label: 'Surface Finish',
      description: 'Surface finish meets specified Ra requirement',
      value: surfacePassed,
      onChange: onSurfaceChange,
    },
  ];

  return (
    <div data-testid="visual-inspection-checklist" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Visual Checks
      </div>
      {checks.map((c) => (
        <div
          key={c.id}
          data-testid={`visual-check-${c.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            background: c.value === true ? '#f0fdf4' : c.value === false ? '#fef2f2' : '#f9fafb',
            border: `1.5px solid ${c.value === true ? '#86efac' : c.value === false ? '#fecaca' : '#e5e7eb'}`,
            borderRadius: 8,
            marginBottom: 6,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.label}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{c.description}</div>
          </div>
          <PassFailToggle
            result={c.value === true ? 'pass' : c.value === false ? 'fail' : 'pending'}
            onChange={(r) => c.onChange(r === 'pass')}
            disabled={disabled}
            size="sm"
          />
        </div>
      ))}
    </div>
  );
};

// ─── QCResultSummary ──────────────────────────────────────────────────────────

interface QCResultSummaryProps {
  check: QualityCheck;
}

export const QCResultSummary: React.FC<QCResultSummaryProps> = ({ check }) => {
  const { bg, text, border, label } = QC_COLORS[check.overallResult];
  const dims = check.dimensionChecks ?? [];
  const passed = dims.filter((d) => d.result === 'pass').length;
  const failed = dims.filter((d) => d.result === 'fail').length;
  const pending = dims.filter((d) => d.result === 'pending').length;

  return (
    <div
      data-testid="qc-result-summary"
      style={{
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 12,
        padding: '16px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 40,
          fontWeight: 900,
          color: text,
          letterSpacing: 2,
          lineHeight: 1,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
        {passed} passed · {failed} failed · {pending} pending
      </div>
      {check.submittedAt && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          Submitted {new Date(check.submittedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
};

// ─── QualityCheckView (main component) ─────────────────────────────────────────

export interface QualityCheckViewProps {
  check?: QualityCheck | null;
  loading?: boolean;
  error?: string | null;
  submitting?: boolean;
  submitted?: boolean;
  onUpdateDimension?: (
    dimensionId: string,
    result: QCResult,
    measuredValue?: number,
    notes?: string,
  ) => void;
  onSetVisualInspection?: (passed: boolean) => void;
  onSetSurfaceFinish?: (passed: boolean) => void;
  onSetNotes?: (notes: string) => void;
  onSubmit?: () => void;
  onReset?: () => void;
  onAddPhoto?: (url: string) => void;
  operatorId?: string;
  className?: string;
}

export const QualityCheckView: React.FC<QualityCheckViewProps> = ({
  check,
  loading = false,
  error = null,
  submitting = false,
  submitted = false,
  onUpdateDimension,
  onSetVisualInspection,
  onSetSurfaceFinish,
  onSetNotes,
  onSubmit,
  onReset,
  onAddPhoto,
  operatorId = 'Operator',
  className,
}) => {
  const allDimensionsEvaluated =
    check != null &&
    (check.dimensionChecks ?? []).every((d) => d.result !== 'pending') &&
    check.visualInspectionPassed != null &&
    check.surfaceFinishPassed != null;

  if (loading) {
    return (
      <div data-testid="qc-loading" style={qcStyles.centered}>
        <div style={qcStyles.spinner} />
        <p style={{ color: '#6b7280', marginTop: 16 }}>Loading QC form…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="qc-error" style={qcStyles.centered}>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>Error</div>
        <p style={{ color: '#6b7280', marginTop: 8, maxWidth: 380, textAlign: 'center' }}>{error}</p>
      </div>
    );
  }

  if (!check) {
    return (
      <div data-testid="qc-empty" style={qcStyles.centered}>
        <p style={{ color: '#9ca3af' }}>No quality check loaded</p>
      </div>
    );
  }

  return (
    <div
      data-testid="quality-check-view"
      className={className}
      style={qcStyles.container}
    >
      {/* ── Header ── */}
      <header style={qcStyles.header}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            Quality Check
          </h1>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            {check.partNumber} · {check.partName} · Inspector: {operatorId}
          </div>
        </div>
        {submitted && (
          <span
            data-testid="submitted-badge"
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              background: '#f0fdf4',
              color: '#16a34a',
              fontWeight: 700,
              fontSize: 13,
              border: '1.5px solid #86efac',
            }}
          >
            ✓ Submitted
          </span>
        )}
      </header>

      <div style={{ padding: '20px 24px', maxWidth: 720, margin: '0 auto' }}>

        {/* Overall result (if submitted) */}
        {submitted && (
          <div style={{ marginBottom: 20 }}>
            <QCResultSummary check={check} />
          </div>
        )}

        {/* Part photos */}
        <PhotoPlaceholder
          photoUrls={check.photoUrls ?? []}
          onAddPhoto={onAddPhoto}
          disabled={submitted}
        />

        {/* Dimension checks */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Dimensional Verification
            <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', color: '#9ca3af', fontSize: 11 }}>
              ({(check.dimensionChecks ?? []).length} checks)
            </span>
          </div>

          {(check.dimensionChecks ?? []).length === 0 ? (
            <div
              data-testid="no-dimension-checks"
              style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}
            >
              No dimension checks defined
            </div>
          ) : (
            (check.dimensionChecks ?? []).map((dc, i) => (
              <DimensionCheckRow
                key={dc.id}
                check={dc}
                index={i}
                onUpdateResult={onUpdateDimension ?? (() => {})}
                disabled={submitted}
              />
            ))
          )}
        </div>

        {/* Visual inspection */}
        <VisualInspectionChecklist
          visualPassed={check.visualInspectionPassed}
          surfacePassed={check.surfaceFinishPassed}
          onVisualChange={onSetVisualInspection ?? (() => {})}
          onSurfaceChange={onSetSurfaceFinish ?? (() => {})}
          disabled={submitted}
        />

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="qc-notes"
            style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Notes
          </label>
          <textarea
            id="qc-notes"
            data-testid="qc-notes-input"
            value={check.notes}
            onChange={(e) => onSetNotes?.(e.target.value)}
            disabled={submitted}
            placeholder="Any observations, deviations, or remarks…"
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1.5px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
              color: '#374151',
              resize: 'vertical',
              background: submitted ? '#f9fafb' : '#fff',
              boxSizing: 'border-box',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          />
        </div>

        {/* Action buttons */}
        {!submitted ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              data-testid="submit-qc-btn"
              onClick={onSubmit}
              disabled={submitting || !allDimensionsEvaluated}
              style={{
                flex: 1,
                padding: '14px',
                background: !allDimensionsEvaluated ? '#d1d5db' : '#111827',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 700,
                cursor: !allDimensionsEvaluated || submitting ? 'not-allowed' : 'pointer',
                letterSpacing: 0.5,
                transition: 'background 0.18s',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit QC Report'}
            </button>

            {onReset && (
              <button
                data-testid="reset-qc-btn"
                onClick={onReset}
                disabled={submitting}
                style={{
                  padding: '14px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {onReset && (
              <button
                data-testid="new-inspection-btn"
                onClick={onReset}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Start New Inspection
              </button>
            )}
          </div>
        )}

        {/* Incomplete warning */}
        {!submitted && !allDimensionsEvaluated && (check.dimensionChecks ?? []).length > 0 && (
          <div
            data-testid="incomplete-warning"
            style={{
              marginTop: 10,
              padding: '8px 14px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 6,
              fontSize: 12,
              color: '#92400e',
            }}
          >
            Complete all dimension checks and visual inspections before submitting.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const qcStyles = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
  } as React.CSSProperties,
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
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
};

export default QualityCheckView;
