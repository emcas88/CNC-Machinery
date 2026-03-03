import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CloudRenderView from './CloudRenderView';
import type { RenderJob } from '@/types';

/* ── mocks ── */
vi.mock('@/services/rendering', () => ({
  renderingService: {
    getRenders: vi.fn(),
    submitRender: vi.fn(),
    batchRender: vi.fn(),
    getResult: vi.fn(),
    cancelRender: vi.fn(),
    getStatus: vi.fn(),
  },
}));

const mockAppStore = { currentJob: 'job-1', currentRoom: null, selectedProduct: null, unitSystem: 'metric', theme: 'dark' };
vi.mock('@/store/appStore', () => ({
  useAppStore: (sel?: (s: any) => any) => (sel ? sel(mockAppStore) : mockAppStore),
}));

import { renderingService } from '@/services/rendering';

const baseSettings = { resolution: '1920x1080' as const, quality: 'standard' as const, samples: 128, ambientOcclusion: true, shadows: true, reflections: false };

const mockRenders: RenderJob[] = [
  { id: 'r1', jobId: 'job-1', viewId: 'front', status: 'rendering', progress: 45, settings: baseSettings, createdAt: '2026-03-01T12:00:00Z' },
  { id: 'r2', jobId: 'job-1', viewId: 'back', status: 'completed', progress: 100, resultUrl: 'https://example.com/r2.png', settings: baseSettings, createdAt: '2026-03-01T11:00:00Z', completedAt: '2026-03-01T11:05:00Z' },
  { id: 'r3', jobId: 'job-1', viewId: 'left', status: 'queued', progress: 0, settings: baseSettings, createdAt: '2026-03-01T12:01:00Z' },
  { id: 'r4', jobId: 'job-1', viewId: 'top', status: 'failed', progress: 0, settings: baseSettings, createdAt: '2026-03-01T10:00:00Z' },
];

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAppStore.currentJob = 'job-1';
  (renderingService.getRenders as any).mockResolvedValue(mockRenders);
  (renderingService.submitRender as any).mockResolvedValue({ id: 'r5', jobId: 'job-1', status: 'queued', progress: 0, settings: baseSettings, createdAt: new Date().toISOString() });
  (renderingService.batchRender as any).mockResolvedValue([]);
  (renderingService.cancelRender as any).mockResolvedValue({});
  (renderingService.getResult as any).mockResolvedValue({ imageUrl: 'https://example.com/img.png', downloadUrl: 'https://example.com/download.png' });
});

describe('CloudRenderView', () => {
  it('shows no-job message when no job', () => {
    mockAppStore.currentJob = null as any;
    render(<CloudRenderView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-job')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (renderingService.getRenders as any).mockReturnValue(new Promise(() => {}));
    render(<CloudRenderView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    (renderingService.getRenders as any).mockRejectedValue(new Error('fail'));
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('error')).toBeInTheDocument());
  });

  it('shows empty queue state when no renders', async () => {
    (renderingService.getRenders as any).mockResolvedValue([]);
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('empty-queue')).toBeInTheDocument());
  });

  it('renders active renders section', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('active-renders')).toBeInTheDocument();
      expect(screen.getByTestId('render-r1')).toBeInTheDocument();
      expect(screen.getByTestId('render-r3')).toBeInTheDocument();
    });
  });

  it('shows progress bar for active renders', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => {
      const progress = screen.getByTestId('progress-r1');
      expect(progress).toHaveStyle({ width: '45%' });
    });
  });

  it('renders completed renders in gallery', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('render-gallery')).toBeInTheDocument();
      expect(screen.getByTestId('completed-r2')).toBeInTheDocument();
    });
  });

  it('shows thumbnail for completed render with resultUrl', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('thumb-r2')).toBeInTheDocument();
    });
  });

  it('renders failed renders section', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('failed-renders')).toBeInTheDocument();
      expect(screen.getByTestId('failed-r4')).toBeInTheDocument();
    });
  });

  it('shows no-completed message when none completed', async () => {
    (renderingService.getRenders as any).mockResolvedValue([mockRenders[0], mockRenders[2]]);
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('no-completed')).toBeInTheDocument());
  });

  it('render settings form has correct defaults', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('input-resolution')).toHaveValue('1920x1080');
      expect(screen.getByTestId('input-quality')).toHaveValue('standard');
      expect(screen.getByTestId('input-samples')).toHaveValue(128);
      expect(screen.getByTestId('toggle-ambientOcclusion')).toBeChecked();
      expect(screen.getByTestId('toggle-shadows')).toBeChecked();
      expect(screen.getByTestId('toggle-reflections')).not.toBeChecked();
    });
  });

  it('resolution selector changes value', async () => {
    const user = userEvent.setup();
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('input-resolution'));
    await user.selectOptions(screen.getByTestId('input-resolution'), '3840x2160');
    expect(screen.getByTestId('input-resolution')).toHaveValue('3840x2160');
  });

  it('quality selector changes value', async () => {
    const user = userEvent.setup();
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('input-quality'));
    await user.selectOptions(screen.getByTestId('input-quality'), 'high');
    expect(screen.getByTestId('input-quality')).toHaveValue('high');
  });

  it('toggle reflections on', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('toggle-reflections'));
    fireEvent.click(screen.getByTestId('toggle-reflections'));
    expect(screen.getByTestId('toggle-reflections')).toBeChecked();
  });

  it('start render button calls submitRender', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('start-render-btn'));
    fireEvent.click(screen.getByTestId('start-render-btn'));
    await waitFor(() => {
      expect(renderingService.submitRender).toHaveBeenCalledWith(
        'job-1',
        'default',
        expect.objectContaining({ resolution: '1920x1080', quality: 'standard' }),
      );
    });
  });

  it('shows submit success message', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('start-render-btn'));
    fireEvent.click(screen.getByTestId('start-render-btn'));
    await waitFor(() => expect(screen.getByTestId('submit-success')).toBeInTheDocument());
  });

  it('shows submit error on failure', async () => {
    (renderingService.submitRender as any).mockRejectedValue(new Error('fail'));
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('start-render-btn'));
    fireEvent.click(screen.getByTestId('start-render-btn'));
    await waitFor(() => expect(screen.getByTestId('submit-error')).toBeInTheDocument());
  });

  it('batch render calls batchRender with view ids', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('batch-render-btn'));
    fireEvent.click(screen.getByTestId('batch-render-btn'));
    await waitFor(() => {
      expect(renderingService.batchRender).toHaveBeenCalledWith(
        'job-1',
        ['front', 'back', 'left', 'right'],
        expect.any(Object),
      );
    });
  });

  it('shows batch success message', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('batch-render-btn'));
    fireEvent.click(screen.getByTestId('batch-render-btn'));
    await waitFor(() => expect(screen.getByTestId('batch-success')).toBeInTheDocument());
  });

  it('shows batch error on failure', async () => {
    (renderingService.batchRender as any).mockRejectedValue(new Error('fail'));
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('batch-render-btn'));
    fireEvent.click(screen.getByTestId('batch-render-btn'));
    await waitFor(() => expect(screen.getByTestId('batch-error')).toBeInTheDocument());
  });

  it('cancel button calls cancelRender', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('cancel-r1'));
    fireEvent.click(screen.getByTestId('cancel-r1'));
    await waitFor(() => {
      expect(renderingService.cancelRender).toHaveBeenCalledWith('r1');
    });
  });

  it('download button calls getResult and triggers download', async () => {
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('download-r2'));
    fireEvent.click(screen.getByTestId('download-r2'));
    await waitFor(() => {
      expect(renderingService.getResult).toHaveBeenCalledWith('r2');
    });
  });

  it('batch views input changes value', async () => {
    const user = userEvent.setup();
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('input-batchViews'));
    const input = screen.getByTestId('input-batchViews');
    await user.clear(input);
    await user.type(input, 'top,bottom');
    expect(input).toHaveValue('top,bottom');
  });

  it('view id input changes value', async () => {
    const user = userEvent.setup();
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('input-viewId'));
    const input = screen.getByTestId('input-viewId');
    await user.clear(input);
    await user.type(input, 'custom-view');
    expect(input).toHaveValue('custom-view');
  });

  it('samples input changes value', async () => {
    const user = userEvent.setup();
    render(<CloudRenderView />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('input-samples'));
    const input = screen.getByTestId('input-samples');
    await user.clear(input);
    await user.type(input, '256');
    expect(input).toHaveValue(256);
  });
});
