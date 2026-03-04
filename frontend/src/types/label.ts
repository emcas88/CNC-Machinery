export interface LabelTemplate {
  id: string
  name: string
  width: number
  height: number
  fields: LabelField[]
  showBarcode: boolean
  barcodeField?: string
  logoUrl?: string
  backgroundColor?: string
  fontFamily?: string
  notes?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface LabelField {
  id: string
  type: LabelFieldType
  label?: string
  dataKey: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontWeight?: 'normal' | 'bold'
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  visible: boolean
}

export type CreateLabelTemplateDto = Omit<LabelTemplate, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateLabelTemplateDto = Partial<CreateLabelTemplateDto>
export interface PrintLabelsDto {
  templateId: string
  partIds: string[]
  copies?: number
}

export enum LabelFieldType {
  TEXT = 'text',
  BARCODE = 'barcode',
  QR_CODE = 'qr_code',
  IMAGE = 'image',
  DIMENSION = 'dimension',
  LINE = 'line',
  RECTANGLE = 'rectangle',
}
