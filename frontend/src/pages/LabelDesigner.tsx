import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cutlistsService } from '@/services/cutlists';
import { labelsService } from '@/services/labels';
import { useAppStore } from '@/store/appStore';

/* ── types ── */
interface LabelTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  fields: string[];
}

interface CutlistRow {
  id: string;
  partName: string;
  material: string;
  length: number;
  width: number;
  thickness: number;
  qty: number;
  barcode?: string;
  qrCode?: string;
  cabinetRef?: string;
  edgeBanding?: string;
  grain?: string;
}

interface PrintSettings {
  labelWidth: number;
  labelHeight: number;
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

interface FieldToggle {
  partName: boolean;
  material: boolean;
  dimensions: boolean;
  barcode: boolean;
  qrCode: boolean;
  cabinetRef: boolean;
  edgeBanding: boolean;
  grain: boolean;
}

const FIELD_LABELS: Record<keyof FieldToggle, string> = {
  partName: 'Part Name',
  material: 'Material',
  dimensions: 'Dimensions',
  barcode: 'Barcode',
  qrCode: 'QR Code',
  cabinetRef: 'Cabinet Ref',
  edgeBanding: 'Edge Banding',
  grain: 'Grain Direction',
};

const ITEMS_PER_PAGE = 12;

/* ═══════════════════════════════════════════ */
export default function LabelDesigner() {
  const currentJob = useAppStore((s) => s.currentJob);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [fieldToggles, setFieldToggles] = useState<FieldToggle>({
    partName: true,
    material: true,
    dimensions: true,
    barcode: true,
    qrCode: false,
    cabinetRef: true,
    edgeBanding: false,
    grain: false,
  });
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    labelWidth: 100,
    labelHeight: 50,
    orientation: 'landscape',
    marginTop: 5,
    marginRight: 5,
    marginBottom: 5,
    marginLeft: 5,
  });
  const [currentPage, setCurrentPage] = useState(1);

  /* ── queries ── */
  const {
    data: cutlist = [],
    isLoading: cutlistLoading,
    error: cutlistError,
  } = useQuery<CutlistRow[]>({
    queryKey: ['cutlist', currentJob],
    queryFn: () => cutlistsService.getCutlists(typeof currentJob === 'string' ? currentJob : currentJob?.id ?? ''),
    enabled: !!currentJob,
  });

  const {
    data: templates = [],
    isLoading: templatesLoading,
    error: templatesError,
  } = useQuery<LabelTemplate[]>({
    queryKey: ['labelTemplates'],
    queryFn: () => labelsService.getTemplates(),
  });

  /* ── mutations ── */
  const printMutation = useMutation({
    mutationFn: () =>
      labelsService.printLabels({
        jobId: currentJob,
        templateId: selectedTemplateId,
        fields: Object.entries(fieldToggles)
          .filter(([, v]) => v)
          .map(([k]) => k),
        settings: printSettings,
      }),
    onSuccess: () => {
      window.print();
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      labelsService.generateLabels({
        jobId: currentJob,
        templateId: selectedTemplateId,
        fields: Object.entries(fieldToggles)
          .filter(([, v]) => v)
          .map(([k]) => k),
        settings: printSettings,
        format: 'pdf',
      } as any),
    onSuccess: (data: any) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labels-${currentJob}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  /* ── derived ── */
  const totalPages = Math.ceil(cutlist.length / ITEMS_PER_PAGE);
  const pagedCutlist = useMemo(
    () => cutlist.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [cutlist, currentPage],
  );

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  /* auto-select first template */
  React.useEffect(() => {
    if (templates.length && !selectedTemplateId) setSelectedTemplateId(templates[0].id);
  }, [templates, selectedTemplateId]);

  /* ── handlers ── */
  const toggleField = (field: keyof FieldToggle) => {
    setFieldToggles((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updatePrintSetting = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setPrintSettings((prev) => ({ ...prev, [key]: value }));
  };

  /* ── loading / error ── */
  if (!currentJob)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-400" data-testid="no-job">
        No job selected. Please select a job to design labels.
      </div>
    );

  if (cutlistLoading || templatesLoading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white" data-testid="loading">
        <svg className="animate-spin h-8 w-8 mr-3 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading label data…
      </div>
    );

  if (cutlistError || templatesError)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400" data-testid="error">
        Failed to load data. Please try again.
      </div>
    );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── left: settings ── */}
      <aside className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col overflow-y-auto">
        {/* template selector */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">Template</h3>
          <select
            className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            data-testid="template-select"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {selectedTemplate && (
            <p className="text-xs text-gray-500 mt-1">
              {selectedTemplate.width}mm × {selectedTemplate.height}mm
            </p>
          )}
        </div>

        {/* field toggles */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">Label Fields</h3>
          <div className="space-y-2">
            {(Object.keys(fieldToggles) as (keyof FieldToggle)[]).map((field) => (
              <label key={field} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldToggles[field]}
                  onChange={() => toggleField(field)}
                  className="rounded bg-gray-600 border-gray-500"
                  data-testid={`toggle-${field}`}
                />
                {FIELD_LABELS[field]}
              </label>
            ))}
          </div>
        </div>

        {/* print settings */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">Print Settings</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Width (mm)</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm"
                  value={printSettings.labelWidth}
                  onChange={(e) => updatePrintSetting('labelWidth', parseInt(e.target.value, 10) || 0)}
                  data-testid="input-labelWidth"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Height (mm)</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm"
                  value={printSettings.labelHeight}
                  onChange={(e) => updatePrintSetting('labelHeight', parseInt(e.target.value, 10) || 0)}
                  data-testid="input-labelHeight"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Orientation</label>
              <select
                className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm"
                value={printSettings.orientation}
                onChange={(e) => updatePrintSetting('orientation', e.target.value as 'portrait' | 'landscape')}
                data-testid="input-orientation"
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as (keyof PrintSettings)[]).map((m) => (
                <div key={m}>
                  <label className="block text-xs text-gray-400 mb-1 capitalize">{m.replace('margin', 'M. ')}</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm"
                    value={printSettings[m] as number}
                    onChange={(e) => updatePrintSetting(m, parseInt(e.target.value, 10) || 0)}
                    data-testid={`input-${m}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* action buttons */}
        <div className="p-4 space-y-2">
          <button
            onClick={() => printMutation.mutate()}
            disabled={printMutation.isPending || !cutlist.length}
            className="w-full px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 text-sm"
            data-testid="print-btn"
          >
            {printMutation.isPending ? 'Printing…' : 'Print All Labels'}
          </button>
          <button
            onClick={() => exportPdfMutation.mutate()}
            disabled={exportPdfMutation.isPending || !cutlist.length}
            className="w-full px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 text-sm"
            data-testid="export-pdf-btn"
          >
            {exportPdfMutation.isPending ? 'Exporting…' : 'Export PDF'}
          </button>
          {printMutation.isSuccess && <p className="text-green-400 text-xs" data-testid="print-success">Labels sent to printer.</p>}
          {printMutation.isError && <p className="text-red-400 text-xs" data-testid="print-error">Print failed.</p>}
          {exportPdfMutation.isSuccess && <p className="text-green-400 text-xs" data-testid="export-success">PDF downloaded.</p>}
          {exportPdfMutation.isError && <p className="text-red-400 text-xs" data-testid="export-error">Export failed.</p>}
        </div>
      </aside>

      {/* ── main: label preview ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Label Designer</h1>
            <p className="text-xs text-gray-400 mt-1">{cutlist.length} parts · Page {currentPage} of {totalPages || 1}</p>
          </div>
        </div>

        {cutlist.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500" data-testid="empty-cutlist">
            No parts in cutlist. Generate a cutlist first.
          </div>
        ) : (
          <>
            {/* label grid */}
            <div className="flex-1 overflow-y-auto p-6" data-testid="label-grid">
              <div className="grid grid-cols-3 gap-4">
                {pagedCutlist.map((row) => (
                  <div
                    key={row.id}
                    className="bg-white text-gray-900 rounded-lg p-4 shadow-md border border-gray-300"
                    style={{
                      width: printSettings.labelWidth * 2.5,
                      minHeight: printSettings.labelHeight * 2.5,
                    }}
                    data-testid={`label-${row.id}`}
                  >
                    {fieldToggles.partName && (
                      <div className="font-bold text-sm mb-1">{row.partName}</div>
                    )}
                    {fieldToggles.material && (
                      <div className="text-xs text-gray-600">{row.material}</div>
                    )}
                    {fieldToggles.dimensions && (
                      <div className="text-xs text-gray-500 mt-1">
                        {row.length} × {row.width} × {row.thickness}mm · Qty: {row.qty}
                      </div>
                    )}
                    {fieldToggles.cabinetRef && row.cabinetRef && (
                      <div className="text-xs text-gray-500 mt-1">Ref: {row.cabinetRef}</div>
                    )}
                    {fieldToggles.edgeBanding && row.edgeBanding && (
                      <div className="text-xs text-gray-500 mt-1">Edge: {row.edgeBanding}</div>
                    )}
                    {fieldToggles.grain && row.grain && (
                      <div className="text-xs text-gray-500 mt-1">Grain: {row.grain}</div>
                    )}
                    {fieldToggles.barcode && (
                      <div className="mt-2 bg-gray-100 h-8 flex items-center justify-center text-xs text-gray-400 rounded" data-testid={`barcode-${row.id}`}>
                        ||||| {row.barcode ?? row.id} |||||
                      </div>
                    )}
                    {fieldToggles.qrCode && (
                      <div className="mt-1 w-10 h-10 bg-gray-200 flex items-center justify-center text-[8px] text-gray-400 rounded" data-testid={`qrcode-${row.id}`}>
                        QR
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* pagination */}
            <div className="px-6 py-3 bg-gray-800 border-t border-gray-700 flex items-center justify-between" data-testid="pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 text-sm"
                data-testid="prev-page"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400" data-testid="page-info">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 text-sm"
                data-testid="next-page"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
