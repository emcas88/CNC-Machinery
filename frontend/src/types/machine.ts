export enum MachineType {
  CNC_ROUTER = 'cnc_router',
  PANEL_SAW = 'panel_saw',
  EDGE_BANDER = 'edge_bander',
  BORING_MACHINE = 'boring_machine',
  LASER = 'laser',
  WIDE_FORMAT_PRINTER = 'wide_format_printer',
}

export interface Machine {
  id: string
  name: string
  type: MachineType
  manufacturer?: string
  model?: string
  serialNumber?: string
  tableWidth: number
  tableHeight: number
  maxCutDepth: number
  spindleCount: number
  toolPositions: number
  postProcessorId?: string
  ipAddress?: string
  notes?: string
  isActive: boolean
  atcToolSets: AtcToolSet[]
  createdAt: string
  updatedAt: string
}

export interface AtcToolSet {
  id: string
  machineId: string
  name: string
  slots: ToolSlot[]
}

export interface ToolSlot {
  position: number
  toolId?: string
  toolName?: string
  diameter?: number
  notes?: string
}

export interface CreateMachine {
  name: string
  type: MachineType
  manufacturer?: string
  model?: string
  serialNumber?: string
  tableWidth: number
  tableHeight: number
  maxCutDepth?: number
  spindleCount?: number
  toolPositions?: number
  postProcessorId?: string
  ipAddress?: string
  notes?: string
}
