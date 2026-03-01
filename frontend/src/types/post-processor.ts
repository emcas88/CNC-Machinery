export enum OutputFormat {
  GCODE = 'gcode',
  DXF = 'dxf',
  MPR = 'mpr',
  XILOG = 'xilog',
  HOPS = 'hops',
  WMF = 'wmf',
  CSV = 'csv',
  CUSTOM = 'custom',
}

export interface PostProcessor {
  id: string
  name: string
  machineType: string
  outputFormat: OutputFormat
  template: string
  headerTemplate?: string
  footerTemplate?: string
  toolChangeTemplate?: string
  sheetStartTemplate?: string
  sheetEndTemplate?: string
  variables: PostProcessorVariable[]
  isDefault: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PostProcessorVariable {
  key: string
  label: string
  defaultValue: string
  type: 'string' | 'number' | 'boolean'
}

export interface CreatePostProcessor {
  name: string
  machineType: string
  outputFormat: OutputFormat
  template: string
  headerTemplate?: string
  footerTemplate?: string
  toolChangeTemplate?: string
  sheetStartTemplate?: string
  sheetEndTemplate?: string
  variables?: PostProcessorVariable[]
  isDefault?: boolean
  notes?: string
}
