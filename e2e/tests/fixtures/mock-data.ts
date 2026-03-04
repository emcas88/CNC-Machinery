// ---------------------------------------------------------------------------
// Mock Data Factories
// CNC Cabinet Manufacturing App – E2E Test Mock Data
// ---------------------------------------------------------------------------

let counter = 0;
const nextId = () => ++counter;
const nextStr = (prefix: string) => `${prefix}-${nextId()}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'super_admin' | 'designer' | 'cnc_operator' | 'shop_floor';
export type JobStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type LibraryType = 'frameless' | 'face_frame' | 'wardrobe';
export type MaterialType = 'sheet' | 'edge_band' | 'solid';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface MockUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at: string;
}

export interface MockJob {
  id: string;
  name: string;
  client_name: string;
  status: JobStatus;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockRoom {
  id: string;
  job_id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  created_at: string;
  updated_at: string;
}

export interface MockProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  library_type: LibraryType;
  width: number;
  height: number;
  depth: number;
  created_at: string;
  updated_at: string;
}

export interface MockPart {
  id: string;
  product_id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  material_id: string;
  quantity: number;
  grain_direction: 'none' | 'horizontal' | 'vertical';
  created_at: string;
  updated_at: string;
}

export interface MockMaterial {
  id: string;
  name: string;
  type: MaterialType;
  thickness: number;
  width: number;
  height: number;
  cost_per_unit: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockMachine {
  id: string;
  name: string;
  type: string;
  max_x: number;
  max_y: number;
  max_z: number;
  spindle_speed: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockTool {
  id: string;
  name: string;
  type: string;
  diameter: number;
  flute_count: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockHardware {
  id: string;
  name: string;
  category: string;
  cost: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockConstructionMethod {
  id: string;
  name: string;
  type: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockQuote {
  id: string;
  job_id: string;
  total: number;
  status: QuoteStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface MockLabel {
  id: string;
  template_name: string;
  width: number;
  height: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockPostProcessor {
  id: string;
  name: string;
  machine_id: string;
  file_extension: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MockCutListItem {
  id: string;
  job_id: string;
  part_id: string;
  part_name: string;
  material_name: string;
  width: number;
  height: number;
  depth: number;
  quantity: number;
  room_name: string;
  product_name: string;
}

export interface MockBOMItem {
  id: string;
  job_id: string;
  name: string;
  type: 'part' | 'hardware' | 'material';
  quantity: number;
  unit_cost: number;
  total_cost: number;
  description: string;
}

export interface MockOptimizationResult {
  id: string;
  job_id: string;
  material_id: string;
  sheet_count: number;
  waste_percentage: number;
  efficiency: number;
  sheets: MockOptimizationSheet[];
  created_at: string;
}

export interface MockOptimizationSheet {
  sheet_number: number;
  width: number;
  height: number;
  parts_placed: number;
  waste_area: number;
  efficiency: number;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

const isoNow = () => new Date().toISOString();
const isoAgo = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

// --- User -------------------------------------------------------------------

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const n = nextId();
  return {
    id: `user-${n}`,
    email: `user${n}@cnc-cabinet.local`,
    first_name: `FirstName${n}`,
    last_name: `LastName${n}`,
    role: 'designer',
    created_at: isoAgo(30),
    ...overrides,
  };
}

export const mockSuperAdmin: MockUser = createMockUser({
  id: 'user-test-001',
  email: 'test@cnc-cabinet.local',
  first_name: 'Test',
  last_name: 'User',
  role: 'super_admin',
});

// --- Job --------------------------------------------------------------------

export function createMockJob(overrides: Partial<MockJob> = {}): MockJob {
  const n = nextId();
  return {
    id: `job-${n}`,
    name: `Kitchen Renovation ${n}`,
    client_name: `Client ${n}`,
    status: 'draft',
    description: `Cabinet job for client ${n}`,
    created_at: isoAgo(7),
    updated_at: isoAgo(1),
    ...overrides,
  };
}

export function createMockJobs(count: number): MockJob[] {
  return Array.from({ length: count }, () => createMockJob());
}

// --- Room -------------------------------------------------------------------

export function createMockRoom(jobId: string, overrides: Partial<MockRoom> = {}): MockRoom {
  const n = nextId();
  return {
    id: `room-${n}`,
    job_id: jobId,
    name: `Room ${n}`,
    width: 3000 + n * 100,
    height: 2400,
    depth: 600,
    created_at: isoAgo(6),
    updated_at: isoAgo(1),
    ...overrides,
  };
}

// --- Product ----------------------------------------------------------------

export function createMockProduct(overrides: Partial<MockProduct> = {}): MockProduct {
  const n = nextId();
  return {
    id: `product-${n}`,
    name: `Base Cabinet ${n}`,
    category: 'Base',
    description: `Standard base cabinet ${n}`,
    library_type: 'frameless',
    width: 600,
    height: 720,
    depth: 560,
    created_at: isoAgo(14),
    updated_at: isoAgo(2),
    ...overrides,
  };
}

export function createMockProducts(count: number): MockProduct[] {
  return Array.from({ length: count }, () => createMockProduct());
}

// --- Part -------------------------------------------------------------------

export function createMockPart(productId: string, materialId: string, overrides: Partial<MockPart> = {}): MockPart {
  const n = nextId();
  return {
    id: `part-${n}`,
    product_id: productId,
    name: `Panel ${n}`,
    width: 560,
    height: 720,
    depth: 18,
    material_id: materialId,
    quantity: 1,
    grain_direction: 'vertical',
    created_at: isoAgo(10),
    updated_at: isoAgo(1),
    ...overrides,
  };
}

// --- Material ---------------------------------------------------------------

export function createMockMaterial(overrides: Partial<MockMaterial> = {}): MockMaterial {
  const n = nextId();
  return {
    id: `material-${n}`,
    name: `White Melamine ${n}`,
    type: 'sheet',
    thickness: 18,
    width: 2440,
    height: 1220,
    cost_per_unit: 45.99 + n,
    description: `Standard white melamine sheet ${n}`,
    created_at: isoAgo(60),
    updated_at: isoAgo(5),
    ...overrides,
  };
}

export function createMockMaterials(count: number): MockMaterial[] {
  return Array.from({ length: count }, () => createMockMaterial());
}

// --- Machine ----------------------------------------------------------------

export function createMockMachine(overrides: Partial<MockMachine> = {}): MockMachine {
  const n = nextId();
  return {
    id: `machine-${n}`,
    name: `CNC Router ${n}`,
    type: 'router',
    max_x: 2500,
    max_y: 1300,
    max_z: 200,
    spindle_speed: 18000,
    description: `5-axis CNC router ${n}`,
    created_at: isoAgo(90),
    updated_at: isoAgo(30),
    ...overrides,
  };
}

export function createMockMachines(count: number): MockMachine[] {
  return Array.from({ length: count }, () => createMockMachine());
}

// --- Tool -------------------------------------------------------------------

export function createMockTool(overrides: Partial<MockTool> = {}): MockTool {
  const n = nextId();
  return {
    id: `tool-${n}`,
    name: `End Mill ${n}mm`,
    type: 'end_mill',
    diameter: 6 + (n % 12),
    flute_count: 2,
    description: `Carbide end mill ${n}`,
    created_at: isoAgo(45),
    updated_at: isoAgo(10),
    ...overrides,
  };
}

export function createMockTools(count: number): MockTool[] {
  return Array.from({ length: count }, () => createMockTool());
}

// --- Hardware ---------------------------------------------------------------

export function createMockHardware(overrides: Partial<MockHardware> = {}): MockHardware {
  const n = nextId();
  return {
    id: `hardware-${n}`,
    name: `Hinge ${n}`,
    category: 'hinges',
    cost: 2.50 + n * 0.25,
    description: `Soft-close cabinet hinge ${n}`,
    created_at: isoAgo(30),
    updated_at: isoAgo(5),
    ...overrides,
  };
}

export function createMockHardwareList(count: number): MockHardware[] {
  return Array.from({ length: count }, () => createMockHardware());
}

// --- ConstructionMethod -----------------------------------------------------

export function createMockConstructionMethod(overrides: Partial<MockConstructionMethod> = {}): MockConstructionMethod {
  const n = nextId();
  return {
    id: `construction-method-${n}`,
    name: `Dado Joint ${n}`,
    type: 'dado',
    description: `Standard dado joint for cabinet assembly ${n}`,
    created_at: isoAgo(60),
    updated_at: isoAgo(20),
    ...overrides,
  };
}

// --- Quote ------------------------------------------------------------------

export function createMockQuote(jobId: string, overrides: Partial<MockQuote> = {}): MockQuote {
  const n = nextId();
  return {
    id: `quote-${n}`,
    job_id: jobId,
    total: 1500 + n * 250,
    status: 'draft',
    notes: `Quote for job ${jobId}`,
    created_at: isoAgo(3),
    updated_at: isoAgo(1),
    ...overrides,
  };
}

// --- Label ------------------------------------------------------------------

export function createMockLabel(overrides: Partial<MockLabel> = {}): MockLabel {
  const n = nextId();
  return {
    id: `label-${n}`,
    template_name: `Cabinet Label ${n}`,
    width: 100,
    height: 60,
    description: `Standard cabinet part label ${n}`,
    created_at: isoAgo(15),
    updated_at: isoAgo(3),
    ...overrides,
  };
}

// --- PostProcessor ----------------------------------------------------------

export function createMockPostProcessor(machineId: string, overrides: Partial<MockPostProcessor> = {}): MockPostProcessor {
  const n = nextId();
  return {
    id: `post-processor-${n}`,
    name: `Biesse Rover Post ${n}`,
    machine_id: machineId,
    file_extension: 'nc',
    description: `Post-processor for Biesse Rover CNC ${n}`,
    created_at: isoAgo(30),
    updated_at: isoAgo(10),
    ...overrides,
  };
}

// --- CutList ----------------------------------------------------------------

export function createMockCutListItem(jobId: string, overrides: Partial<MockCutListItem> = {}): MockCutListItem {
  const n = nextId();
  return {
    id: `cutlist-item-${n}`,
    job_id: jobId,
    part_id: `part-${n}`,
    part_name: `Panel ${n}`,
    material_name: `White Melamine 18mm`,
    width: 560,
    height: 720,
    depth: 18,
    quantity: 2,
    room_name: `Kitchen`,
    product_name: `Base Cabinet`,
    ...overrides,
  };
}

export function createMockCutList(jobId: string, count: number): MockCutListItem[] {
  return Array.from({ length: count }, () => createMockCutListItem(jobId));
}

// --- BOM --------------------------------------------------------------------

export function createMockBOMItem(jobId: string, overrides: Partial<MockBOMItem> = {}): MockBOMItem {
  const n = nextId();
  return {
    id: `bom-item-${n}`,
    job_id: jobId,
    name: `Item ${n}`,
    type: 'part',
    quantity: 4,
    unit_cost: 12.50 + n,
    total_cost: (12.50 + n) * 4,
    description: `BOM item ${n}`,
    ...overrides,
  };
}

export function createMockBOM(jobId: string, count: number): MockBOMItem[] {
  return Array.from({ length: count }, () => createMockBOMItem(jobId));
}

// --- Optimization -----------------------------------------------------------

export function createMockOptimizationResult(jobId: string, materialId: string, overrides: Partial<MockOptimizationResult> = {}): MockOptimizationResult {
  const n = nextId();
  const sheetCount = 3 + (n % 5);
  return {
    id: `optimization-${n}`,
    job_id: jobId,
    material_id: materialId,
    sheet_count: sheetCount,
    waste_percentage: 12.5 + n,
    efficiency: 87.5 - n,
    sheets: Array.from({ length: sheetCount }, (_, i) => ({
      sheet_number: i + 1,
      width: 2440,
      height: 1220,
      parts_placed: 8 - i,
      waste_area: 120000 + i * 5000,
      efficiency: 92 - i * 2,
    })),
    created_at: isoNow(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Convenience: pre-built sets for common test scenarios
// ---------------------------------------------------------------------------

export const mockJobsList = createMockJobs(5);
export const mockProductsList = createMockProducts(6);
export const mockMaterialsList = createMockMaterials(4);
export const mockMachinesList = createMockMachines(2);
export const mockToolsList = createMockTools(8);
