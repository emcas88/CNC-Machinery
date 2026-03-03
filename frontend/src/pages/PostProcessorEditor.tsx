import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postProcessorService } from '@/services/post-processors';
import type {
  PostProcessor,
  CreatePostProcessor,
  PostProcessorVariable,
} from '@/types';
import { OutputFormat } from '@/types';

const OUTPUT_FORMATS = Object.values(OutputFormat);

const DEFAULT_PROCESSOR: CreatePostProcessor = {
  name: '',
  machineType: '',
  outputFormat: OutputFormat.GCODE,
  template: '',
  headerTemplate: '',
  footerTemplate: '',
  toolChangeTemplate: '',
  sheetStartTemplate: '',
  sheetEndTemplate: '',
  variables: [],
  isDefault: false,
  notes: '',
};

const DEFAULT_VARIABLE: PostProcessorVariable = {
  key: '',
  label: '',
  defaultValue: '',
  type: 'string',
};

export default function PostProcessorEditor() {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreatePostProcessor>({ ...DEFAULT_PROCESSOR });
  const [variables, setVariables] = useState<PostProcessorVariable[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [testPartId, setTestPartId] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Queries ──
  const {
    data: processors = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['post-processors'],
    queryFn: postProcessorService.getProcessors,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: CreatePostProcessor) => postProcessorService.createProcessor(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['post-processors'] });
      setSelectedId(created.id);
      setIsCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePostProcessor> }) =>
      postProcessorService.updateProcessor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-processors'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => postProcessorService.deleteProcessor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-processors'] });
      setSelectedId(null);
      setFormData({ ...DEFAULT_PROCESSOR });
      setVariables([]);
      setShowDeleteConfirm(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ id, partId }: { id: string; partId: string }) =>
      postProcessorService.testProcessor(id, partId),
    onSuccess: (result) => {
      setTestOutput(result.output);
    },
  });

  // ── Handlers ──
  const selectProcessor = useCallback(
    (processor: PostProcessor) => {
      setSelectedId(processor.id);
      setIsCreating(false);
      setFormData({
        name: processor.name,
        machineType: processor.machineType,
        outputFormat: processor.outputFormat,
        template: processor.template,
        headerTemplate: processor.headerTemplate || '',
        footerTemplate: processor.footerTemplate || '',
        toolChangeTemplate: processor.toolChangeTemplate || '',
        sheetStartTemplate: processor.sheetStartTemplate || '',
        sheetEndTemplate: processor.sheetEndTemplate || '',
        variables: processor.variables,
        isDefault: processor.isDefault,
        notes: processor.notes || '',
      });
      setVariables([...processor.variables]);
      setTestOutput('');
      setShowDeleteConfirm(false);
    },
    [],
  );

  const handleNewProcessor = () => {
    setSelectedId(null);
    setIsCreating(true);
    setFormData({ ...DEFAULT_PROCESSOR });
    setVariables([]);
    setTestOutput('');
    setShowDeleteConfirm(false);
  };

  const handleFieldChange = (field: keyof CreatePostProcessor, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const payload: CreatePostProcessor = { ...formData, variables };
    if (isCreating) {
      createMutation.mutate(payload);
    } else if (selectedId) {
      updateMutation.mutate({ id: selectedId, data: payload });
    }
  };

  const handleDelete = () => {
    if (selectedId) {
      deleteMutation.mutate(selectedId);
    }
  };

  const handleTest = () => {
    if (selectedId && testPartId) {
      testMutation.mutate({ id: selectedId, partId: testPartId });
    }
  };

  const handleExport = () => {
    const processor = processors.find((p) => p.id === selectedId);
    if (!processor) return;
    const blob = new Blob([JSON.stringify(processor, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${processor.name.replace(/\s+/g, '_')}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Variable Handlers ──
  const addVariable = () => {
    setVariables((prev) => [...prev, { ...DEFAULT_VARIABLE }]);
  };

  const updateVariable = (index: number, field: keyof PostProcessorVariable, value: string) => {
    setVariables((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  };

  const removeVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Filter processors ──
  const filteredProcessors = processors.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.machineType.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading post processors…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load post processors</p>
          <p className="text-red-300 text-sm">{(error as Error)?.message || 'Unknown error'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['post-processors'] })}
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Post Processors</h2>
            <button
              onClick={handleNewProcessor}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded transition-colors"
              aria-label="New post processor"
            >
              + New PP
            </button>
          </div>
          <input
            type="text"
            placeholder="Search processors…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredProcessors.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {processors.length === 0 ? 'No processors yet' : 'No matching processors'}
            </div>
          ) : (
            filteredProcessors.map((proc) => (
              <button
                key={proc.id}
                onClick={() => selectProcessor(proc)}
                className={`w-full text-left p-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
                  selectedId === proc.id ? 'bg-gray-700 border-l-2 border-l-cyan-400' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{proc.name}</span>
                  {proc.isDefault && (
                    <span className="px-1.5 py-0.5 bg-cyan-900 text-cyan-300 text-xs rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {proc.machineType} · {proc.outputFormat.toUpperCase()}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <main className="flex-1 overflow-y-auto">
        {!selectedId && !isCreating ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Select a processor or create a new one</p>
              <button
                onClick={handleNewProcessor}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
              >
                + New Post Processor
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">
                {isCreating ? 'New Post Processor' : 'Edit Post Processor'}
              </h1>
              <div className="flex gap-2">
                {!isCreating && selectedId && (
                  <>
                    <button
                      onClick={handleExport}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 bg-red-900/50 hover:bg-red-800 text-red-400 text-sm rounded transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.name || !formData.machineType}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                >
                  {isSaving ? 'Saving…' : isCreating ? 'Create Processor' : 'Save Processor'}
                </button>
              </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
              <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-300 mb-3">
                  Are you sure you want to delete this processor? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded"
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Mutation errors */}
            {(createMutation.isError || updateMutation.isError || deleteMutation.isError) && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                {(createMutation.error as Error)?.message ||
                  (updateMutation.error as Error)?.message ||
                  (deleteMutation.error as Error)?.message ||
                  'An error occurred'}
              </div>
            )}

            {/* ── Basic Fields ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Processor name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Machine Type *</label>
                <input
                  type="text"
                  value={formData.machineType}
                  onChange={(e) => handleFieldChange('machineType', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. CNC Router"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Output Format</label>
                <select
                  value={formData.outputFormat}
                  onChange={(e) => handleFieldChange('outputFormat', e.target.value as OutputFormat)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  {OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault || false}
                    onChange={(e) => handleFieldChange('isDefault', e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  Set as Default
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            {/* ── Template Editors ── */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Main Template *</label>
                <textarea
                  value={formData.template}
                  onChange={(e) => handleFieldChange('template', e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-600 rounded text-green-400 text-sm font-mono focus:outline-none focus:border-cyan-500 resize-y"
                  placeholder="G-code template…"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Header Template</label>
                  <textarea
                    value={formData.headerTemplate || ''}
                    onChange={(e) => handleFieldChange('headerTemplate', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-600 rounded text-green-400 text-sm font-mono focus:outline-none focus:border-cyan-500 resize-y"
                    placeholder="Header template…"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Footer Template</label>
                  <textarea
                    value={formData.footerTemplate || ''}
                    onChange={(e) => handleFieldChange('footerTemplate', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-600 rounded text-green-400 text-sm font-mono focus:outline-none focus:border-cyan-500 resize-y"
                    placeholder="Footer template…"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tool Change Template</label>
                  <textarea
                    value={formData.toolChangeTemplate || ''}
                    onChange={(e) => handleFieldChange('toolChangeTemplate', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-600 rounded text-green-400 text-sm font-mono focus:outline-none focus:border-cyan-500 resize-y"
                    placeholder="Tool change template…"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sheet Start Template</label>
                  <textarea
                    value={formData.sheetStartTemplate || ''}
                    onChange={(e) => handleFieldChange('sheetStartTemplate', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-600 rounded text-green-400 text-sm font-mono focus:outline-none focus:border-cyan-500 resize-y"
                    placeholder="Sheet start template…"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sheet End Template</label>
                <textarea
                  value={formData.sheetEndTemplate || ''}
                  onChange={(e) => handleFieldChange('sheetEndTemplate', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-600 rounded text-green-400 text-sm font-mono focus:outline-none focus:border-cyan-500 resize-y"
                  placeholder="Sheet end template…"
                />
              </div>
            </div>

            {/* ── Variables Editor ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Variables</h3>
                <button
                  onClick={addVariable}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                >
                  + Add Variable
                </button>
              </div>
              {variables.length === 0 ? (
                <p className="text-gray-500 text-sm">No variables defined</p>
              ) : (
                <div className="space-y-2">
                  {variables.map((variable, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                      <input
                        type="text"
                        value={variable.key}
                        onChange={(e) => updateVariable(index, 'key', e.target.value)}
                        placeholder="Key"
                        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={variable.label}
                        onChange={(e) => updateVariable(index, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={variable.defaultValue}
                        onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                        placeholder="Default"
                        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                      <select
                        value={variable.type}
                        onChange={(e) => updateVariable(index, 'type', e.target.value)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                      <button
                        onClick={() => removeVariable(index)}
                        className="px-2 py-1 bg-red-900/50 hover:bg-red-800 text-red-400 text-xs rounded transition-colors"
                        aria-label={`Remove variable ${index}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Test Output ── */}
            {!isCreating && selectedId && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Test Output</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={testPartId}
                    onChange={(e) => setTestPartId(e.target.value)}
                    placeholder="Part ID for testing"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testMutation.isPending || !testPartId}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  >
                    {testMutation.isPending ? 'Testing…' : 'Test Output'}
                  </button>
                </div>
                {testMutation.isError && (
                  <div className="mb-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                    {(testMutation.error as Error)?.message || 'Test failed'}
                  </div>
                )}
                {testOutput && (
                  <pre className="p-4 bg-gray-950 border border-gray-600 rounded text-green-400 text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto">
                    {testOutput}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
