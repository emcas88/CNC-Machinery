import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DoorProfileEditor, { doorProfilesService } from './DoorProfileEditor';
import type { DoorProfile } from './DoorProfileEditor';

/* ── mocks ── */
vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAppStore = { currentJob: 'job-1', currentRoom: 'room-1', selectedProduct: null, unitSystem: 'metric', theme: 'dark' };
vi.mock('@/store/appStore', () => ({
  useAppStore: (sel?: (s: any) => any) => (sel ? sel(mockAppStore) : mockAppStore),
}));

import { api } from '@/services/api';

const mockProfiles: DoorProfile[] = [
  { id: 'dp1', name: 'Standard Shaker', style: 'shaker', railWidth: 2.5, stileWidth: 2.5, panelThickness: 0.75, profileDepth: 0.375, innerRadius: 0.125 },
  { id: 'dp2', name: 'Raised Panel Classic', style: 'raised_panel', railWidth: 3, stileWidth: 3, panelThickness: 1, profileDepth: 0.5, innerRadius: 0.25 },
];

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as any).mockResolvedValue({ data: mockProfiles });
  (api.post as any).mockResolvedValue({ data: { id: 'dp3', ...mockProfiles[0], name: 'New Profile' } });
  (api.put as any).mockResolvedValue({ data: mockProfiles[0] });
  (api.delete as any).mockResolvedValue({ data: {} });
});

describe('DoorProfileEditor', () => {
  it('shows loading state initially', () => {
    (api.get as any).mockReturnValue(new Promise(() => {}));
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    (api.get as any).mockRejectedValue(new Error('fail'));
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('error')).toBeInTheDocument());
  });

  it('renders profile list after loading', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('profile-list')).toBeInTheDocument();
      expect(screen.getByTestId('profile-item-dp1')).toHaveTextContent('Standard Shaker');
      expect(screen.getByTestId('profile-item-dp2')).toHaveTextContent('Raised Panel Classic');
    });
  });

  it('shows empty state when no profiles', async () => {
    (api.get as any).mockResolvedValue({ data: [] });
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('profiles-empty')).toBeInTheDocument());
  });

  it('shows select prompt when nothing is selected', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('select-prompt')).toBeInTheDocument());
  });

  it('selects a profile and populates form', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    expect(screen.getByTestId('input-name')).toHaveValue('Standard Shaker');
    expect(screen.getByTestId('input-style')).toHaveValue('shaker');
    expect(screen.getByTestId('input-railWidth')).toHaveValue(2.5);
    expect(screen.getByTestId('input-stileWidth')).toHaveValue(2.5);
    expect(screen.getByTestId('input-panelThickness')).toHaveValue(0.75);
    expect(screen.getByTestId('input-profileDepth')).toHaveValue(0.375);
    expect(screen.getByTestId('input-innerRadius')).toHaveValue(0.125);
  });

  it('renders SVG preview', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    expect(screen.getByTestId('svg-preview')).toBeInTheDocument();
  });

  it('SVG preview updates when form values change', async () => {
    const user = userEvent.setup();
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    // change style to slab => panel-rect should disappear
    await user.selectOptions(screen.getByTestId('input-style'), 'slab');
    expect(screen.queryByTestId('panel-rect')).not.toBeInTheDocument();
  });

  it('creates a new profile', async () => {
    const user = userEvent.setup();
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('new-profile-btn'));
    fireEvent.click(screen.getByTestId('new-profile-btn'));
    expect(screen.getByTestId('input-name')).toHaveValue('New Profile');
    const saveBtn = screen.getByTestId('save-btn');
    expect(saveBtn).toHaveTextContent('Create Profile');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/door-profiles', expect.objectContaining({ name: 'New Profile' }));
    });
  });

  it('saves/updates an existing profile', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    fireEvent.change(screen.getByTestId('input-railWidth'), { target: { value: '3.0' } });
    fireEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/door-profiles/dp1', expect.objectContaining({ railWidth: 3 }));
    });
  });

  it('apply to all doors triggers mutation', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('apply-all-btn'));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/door-profiles/dp1/apply', { jobId: 'job-1' });
    });
  });

  it('delete button opens confirmation dialog', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('delete-btn'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
  });

  it('cancel delete closes dialog', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('delete-btn'));
    fireEvent.click(screen.getByTestId('delete-cancel'));
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
  });

  it('confirm delete calls deleteProfile', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('delete-btn'));
    fireEvent.click(screen.getByTestId('delete-confirm'));
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/door-profiles/dp1');
    });
  });

  it('shows success message on create', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('new-profile-btn'));
    fireEvent.click(screen.getByTestId('new-profile-btn'));
    fireEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(screen.getByTestId('create-success')).toBeInTheDocument());
  });

  it('shows success message on update', async () => {
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('profile-item-dp1'));
    fireEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(screen.getByTestId('update-success')).toBeInTheDocument());
  });

  it('shows error message on failed create', async () => {
    (api.post as any).mockRejectedValue(new Error('fail'));
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('new-profile-btn'));
    fireEvent.click(screen.getByTestId('new-profile-btn'));
    fireEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(screen.getByTestId('create-error')).toBeInTheDocument());
  });

  it('changes form fields correctly', async () => {
    const user = userEvent.setup();
    render(<DoorProfileEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('new-profile-btn'));
    fireEvent.click(screen.getByTestId('new-profile-btn'));
    const nameInput = screen.getByTestId('input-name');
    await user.clear(nameInput);
    await user.type(nameInput, 'My Custom');
    expect(nameInput).toHaveValue('My Custom');
  });
});
