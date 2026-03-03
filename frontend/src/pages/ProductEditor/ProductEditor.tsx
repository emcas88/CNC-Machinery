// ============================================================
// ProductEditor — Main Component
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  ProductCategory,
  ConstructionMethod,
  Product,
  EdgeBanding,
  DEFAULT_PRODUCT,
} from './types';
import {
  useProductForm,
  usePartCalculator,
  useMaterials,
  calculateHardware,
} from './hooks';
import { getProduct, createProduct, updateProduct } from './api';
import {
  DimensionsPanel,
  MaterialSelector,
  PartsTable,
  HardwarePanel,
  EdgingConfig,
} from './components';

// ── Constants ──────────────────────────────────────────────────

const CATEGORIES: ProductCategory[] = [
  'BaseUnit',
  'WallUnit',
  'TallUnit',
  'Drawer',
  'Door',
  'Shelf',
];

const CONSTRUCTION_METHODS: { value: ConstructionMethod; label: string; description: string }[] = [
  {
    value: 'frameless',
    label: 'Frameless (Euro)',
    description: 'Full-overlay doors, no face frame. European style.',
  },
  {
    value: 'face-frame',
    label: 'Face Frame',
    description: 'Traditional North American style with solid wood face frame.',
  },
  {
    value: 'inset',
    label: 'Inset',
    description: 'Doors and drawers sit flush inside the cabinet opening.',
  },
];

// ── Inline styles ──────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f3f4f6',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#111827',
  } as React.CSSProperties,

  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: '#111827',
  },

  headerActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },

  main: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '24px 24px 80px',
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: 20,
    alignItems: 'start',
  },

  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },

  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },

  card: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#374151',
    margin: '0 0 12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    display: 'block',
    marginBottom: 4,
  },

  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  inputError: {
    borderColor: '#ef4444',
  },

  textarea: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    resize: 'vertical' as const,
    minHeight: 72,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  fieldWrapper: {
    marginBottom: 12,
  },

  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 3,
  },

  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
  },

  categoryButton: (active: boolean) => ({
    padding: '8px 4px',
    textAlign: 'center' as const,
    borderRadius: 6,
    border: `2px solid ${active ? '#2563eb' : '#e5e7eb'}`,
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1d4ed8' : '#374151',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 150ms',
  }),

  constructionGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },

  constructionButton: (active: boolean) => ({
    padding: '10px 12px',
    borderRadius: 6,
    border: `2px solid ${active ? '#2563eb' : '#e5e7eb'}`,
    background: active ? '#eff6ff' : '#fff',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 150ms',
  }),

  btnPrimary: {
    padding: '9px 20px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 150ms',
  },

  btnSecondary: {
    padding: '9px 16px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 150ms',
  },

  dirtyBadge: {
    padding: '3px 8px',
    background: '#fef3c7',
    color: '#92400e',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
  },

  toast: (isError: boolean) => ({
    position: 'fixed' as const,
    bottom: 24,
    right: 24,
    padding: '12px 18px',
    borderRadius: 8,
    background: isError ? '#fef2f2' : '#f0fdf4',
    color: isError ? '#b91c1c' : '#166534',
    border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
    fontWeight: 600,
    fontSize: 14,
    zIndex: 100,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  }),

  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: 16,
    gap: 2,
  },

  tab: (active: boolean) => ({
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? '#1d4ed8' : '#6b7280',
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
    cursor: 'pointer',
    marginBottom: -1,
  }),
};

// ── Toast notification ─────────────────────────────────────────

function Toast({ message, isError, onDismiss }: { message: string; isError: boolean; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div role="status" aria-live="polite" style={styles.toast(isError)}>
      {message}
    </div>
  );
}

// ── ProductEditor ──────────────────────────────────────────────

interface ProductEditorProps {
  productId?: string;
  onSave?: (product: Product) => void;
  onCancel?: () => void;
}

type ContentTab = 'parts' | 'hardware' | 'edging';

export function ProductEditor({ productId, onSave, onCancel }: ProductEditorProps) {
  const {
    product,
    errors,
    isDirty,
    isSaving,
    saveError,
    updateField,
    updateDimension,
    setIsSaving,
    setSaveError,
    reset,
    validate,
    getFieldError,
  } = useProductForm();

  const { materials, hardware: hardwareCatalog, loading: materialsLoading, error: materialsError } = useMaterials();

  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productLoadError, setProductLoadError] = useState<string | undefined>();
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTab>('parts');
  const [edging, setEdging] = useState<EdgeBanding[]>([]);

  // Load existing product
  useEffect(() => {
    if (!productId) return;
    setLoadingProduct(true);
    setProductLoadError(undefined);
    getProduct(productId)
      .then(p => reset(p))
      .catch(err => setProductLoadError(err instanceof Error ? err.message : 'Failed to load product'))
      .finally(() => setLoadingProduct(false));
  }, [productId, reset]);

  // Parts calculation
  const calcInput = useMemo(
    () => ({
      dimensions: product.dimensions,
      category: product.category,
      constructionMethod: product.constructionMethod,
      carcassMaterialId: product.carcassMaterialId,
      doorMaterialId: product.doorMaterialId,
      drawerMaterialId: product.drawerMaterialId,
      backPanelMaterialId: product.backPanelMaterialId,
      materials,
    }),
    [product, materials]
  );

  const { parts } = usePartCalculator(calcInput);

  // Hardware auto-calculation
  const hardwareRequirements = useMemo(
    () => calculateHardware(product, parts, hardwareCatalog),
    [product, parts, hardwareCatalog]
  );

  // Material name lookup
  const materialNames = useMemo(() => {
    const m: Record<string, string> = {};
    materials.forEach(mat => { m[mat.id] = mat.name; });
    return m;
  }, [materials]);

  // ── Save handler ────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    setSaveError(undefined);

    const payload: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      ...product,
      parts,
      hardware: hardwareRequirements.map(r => ({ hardwareId: r.hardwareId, quantity: r.quantity })),
    };

    try {
      let saved: Product;
      if (product.id) {
        saved = await updateProduct(product.id, payload);
      } else {
        saved = await createProduct(payload);
      }
      reset(saved);
      setToast({ message: `"${saved.name}" saved successfully`, isError: false });
      onSave?.(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setSaveError(msg);
      setToast({ message: msg, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    onCancel?.();
  };

  // ── Render guards ────────────────────────────────────────────
  if (loadingProduct) {
    return (
      <div data-testid="product-editor-loading" style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p role="status">Loading product…</p>
      </div>
    );
  }

  if (productLoadError) {
    return (
      <div data-testid="product-editor-error" style={{ ...styles.page, padding: 32 }}>
        <p role="alert" style={{ color: '#b91c1c' }}>Error: {productLoadError}</p>
        <button style={styles.btnSecondary} onClick={handleCancel}>← Back</button>
      </div>
    );
  }

  return (
    <div data-testid="product-editor" style={styles.page}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>
          {product.id ? `Edit: ${product.name || 'Untitled'}` : 'New Product'}
        </h1>
        <div style={styles.headerActions}>
          {isDirty && <span style={styles.dirtyBadge} data-testid="dirty-badge">Unsaved changes</span>}
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={handleCancel}
            data-testid="btn-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            style={{ ...styles.btnPrimary, opacity: isSaving ? 0.7 : 1 }}
            onClick={handleSave}
            disabled={isSaving}
            data-testid="btn-save"
          >
            {isSaving ? 'Saving…' : product.id ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </header>

      {/* ── Save error banner ── */}
      {saveError && (
        <div
          role="alert"
          data-testid="save-error-banner"
          style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 24px', fontSize: 13, color: '#b91c1c' }}
        >
          {saveError}
        </div>
      )}

      {/* ── Materials error ── */}
      {materialsError && (
        <div
          role="alert"
          data-testid="materials-error"
          style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '10px 24px', fontSize: 13, color: '#92400e' }}
        >
          Could not load materials: {materialsError}
        </div>
      )}

      {/* ── Main layout ── */}
      <main style={styles.main}>
        {/* ── Left Sidebar: Identity + Config ── */}
        <aside style={styles.sidebar}>
          {/* Product Identity */}
          <div style={styles.card}>
            <p style={styles.sectionTitle}>Product Info</p>

            <div style={styles.fieldWrapper}>
              <label htmlFor="product-name" style={styles.label}>Name *</label>
              <input
                id="product-name"
                type="text"
                placeholder="e.g. Base Cabinet 600mm"
                value={product.name}
                aria-invalid={!!getFieldError('name')}
                onChange={e => updateField('name', e.target.value)}
                data-testid="input-name"
                style={{ ...styles.input, ...(getFieldError('name') ? styles.inputError : {}) }}
              />
              {getFieldError('name') && (
                <p role="alert" style={styles.errorText} data-testid="name-error">{getFieldError('name')}</p>
              )}
            </div>

            <div style={styles.fieldWrapper}>
              <label htmlFor="product-description" style={styles.label}>Description</label>
              <textarea
                id="product-description"
                placeholder="Optional notes about this product…"
                value={product.description ?? ''}
                onChange={e => updateField('description', e.target.value)}
                data-testid="input-description"
                style={styles.textarea}
              />
            </div>
          </div>

          {/* Category */}
          <div style={styles.card}>
            <p style={styles.sectionTitle}>Category</p>
            <div style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  role="radio"
                  aria-checked={product.category === cat}
                  onClick={() => updateField('category', cat)}
                  data-testid={`category-${cat}`}
                  style={styles.categoryButton(product.category === cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Construction Method */}
          <div style={styles.card}>
            <p style={styles.sectionTitle}>Construction</p>
            <div style={styles.constructionGrid}>
              {CONSTRUCTION_METHODS.map(method => (
                <button
                  key={method.value}
                  type="button"
                  role="radio"
                  aria-checked={product.constructionMethod === method.value}
                  onClick={() => updateField('constructionMethod', method.value)}
                  data-testid={`construction-${method.value}`}
                  style={styles.constructionButton(product.constructionMethod === method.value)}
                >
                  <div style={{ fontWeight: product.constructionMethod === method.value ? 700 : 600, fontSize: 13, color: product.constructionMethod === method.value ? '#1d4ed8' : '#374151' }}>
                    {method.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{method.description}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Right Content ── */}
        <div style={styles.content}>
          {/* Dimensions */}
          <div style={styles.card}>
            <DimensionsPanel
              category={product.category}
              dimensions={product.dimensions}
              errors={errors}
              onChange={updateDimension}
            />
          </div>

          {/* Materials */}
          <div style={styles.card}>
            <MaterialSelector
              materials={materials}
              loading={materialsLoading}
              carcassMaterialId={product.carcassMaterialId}
              doorMaterialId={product.doorMaterialId}
              drawerMaterialId={product.drawerMaterialId}
              backPanelMaterialId={product.backPanelMaterialId}
              errors={errors}
              onChange={(field, value) => updateField(field, value)}
            />
          </div>

          {/* Tabbed section: Parts / Hardware / Edging */}
          <div style={styles.card}>
            <div style={styles.tabs} role="tablist" aria-label="Product details">
              {(['parts', 'hardware', 'edging'] as ContentTab[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  data-testid={`tab-${tab}`}
                  style={styles.tab(activeTab === tab)}
                >
                  {tab === 'parts' ? `Parts (${parts.reduce((s, p) => s + p.quantity, 0)})` : null}
                  {tab === 'hardware' ? `Hardware (${hardwareRequirements.reduce((s, h) => s + h.quantity, 0)})` : null}
                  {tab === 'edging' ? 'Edge Banding' : null}
                </button>
              ))}
            </div>

            {activeTab === 'parts' && (
              <PartsTable parts={parts} materialNames={materialNames} />
            )}
            {activeTab === 'hardware' && (
              <HardwarePanel requirements={hardwareRequirements} />
            )}
            {activeTab === 'edging' && (
              <EdgingConfig
                parts={parts}
                materials={materials}
                edging={edging}
                onChange={setEdging}
              />
            )}
          </div>
        </div>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          isError={toast.isError}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default ProductEditor;
