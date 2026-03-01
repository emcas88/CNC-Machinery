export enum ToolType {
  END_MILL = 'end_mill',
  BALL_NOSE = 'ball_nose',
  V_BIT = 'v_bit',
  DRILL_BIT = 'drill_bit',
  BORING_BIT = 'boring_bit',
  SAW_BLADE = 'saw_blade',
  ROUTER_BIT = 'router_bit',
  COMPRESSION = 'compression',
  SPIRAL_UPCUT = 'spiral_upcut',
  SPIRAL_DOWNCUT = 'spiral_downcut',
  DIAMOND_DRAG = 'diamond_drag',
}

export interface Tool {
  id: string
  name: string
  type: ToolType
  diameter: number
  fluteCount?: number
  fluteLength?: number
  overallLength?: number
  cuttingAngle?: number
  maxFeedRate?: number
  maxSpindleSpeed?: number
  stepdown?: number
  stepover?: number
  material?: string
  coating?: string
  brand?: string
  partNumber?: string
  notes?: string
  createdAt: string
}

export interface CreateTool {
  name: string
  type: ToolType
  diameter: number
  fluteCount?: number
  fluteLength?: number
  overallLength?: number
  cuttingAngle?: number
  maxFeedRate?: number
  maxSpindleSpeed?: number
  stepdown?: number
  stepover?: number
  material?: string
  coating?: string
  brand?: string
  partNumber?: string
  notes?: string
}
