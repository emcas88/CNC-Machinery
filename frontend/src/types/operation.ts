export enum OperationType {
  BORE = 'bore',
  ROUTE = 'route',
  DRILL = 'drill',
  SAW = 'saw',
  POCKET = 'pocket',
  CONTOUR = 'contour',
  ENGRAVE = 'engrave',
  DOWEL = 'dowel',
  DADO = 'dado',
  RABBET = 'rabbet',
  MORTISE = 'mortise',
}

export enum OperationSide {
  TOP = 'top',
  BOTTOM = 'bottom',
  FRONT = 'front',
  BACK = 'back',
  LEFT = 'left',
  RIGHT = 'right',
}

export interface Operation {
  id: string
  partId: string
  name: string
  type: OperationType
  side: OperationSide
  x: number
  y: number
  depth: number
  diameter?: number
  width?: number
  height?: number
  toolId?: string
  feedRate?: number
  spindleSpeed?: number
  passes?: number
  notes?: string
  createdAt: string
}
