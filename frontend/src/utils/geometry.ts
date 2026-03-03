export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Line {
  p1: Point
  p2: Point
}

// ── Unit conversions ────────────────────────────────────────────────

export const mmToInches = (mm: number): number => mm / 25.4
export const inchesToMm = (inches: number): number => inches * 25.4
export const mmToFeet = (mm: number): number => mm / 304.8
export const feetToMm = (feet: number): number => feet * 304.8

// ── Scalar geometry ─────────────────────────────────────────────────

export const calculateArea = (w: number, h: number): number => w * h
export const calculatePerimeter = (w: number, h: number): number => 2 * (w + h)
export const calculateVolume = (w: number, h: number, d: number): number => w * h * d

// ── Math helpers ────────────────────────────────────────────────────

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t

export const degreesToRadians = (deg: number): number => (deg * Math.PI) / 180
export const radiansToDegrees = (rad: number): number => (rad * 180) / Math.PI

// ── Point helpers ───────────────────────────────────────────────────

export const distance = (a: Point, b: Point): number =>
  Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

// ── Rect helpers ────────────────────────────────────────────────────

/** Check if two rectangles overlap (touching edges = not overlapping) */
export const rectOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y

export const rectsOverlap = rectOverlap

/** Point in rect — inclusive min, exclusive max */
export const pointInRect = (p: Point, r: Rect): boolean =>
  p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height

/** Line segment intersection — returns intersection point or null */
export const lineIntersection = (l1: Line, l2: Line): Point | null => {
  const { p1: a, p2: b } = l1
  const { p1: c, p2: d } = l2

  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (denom === 0) return null

  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom
  const u = -((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / denom

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    }
  }
  return null
}

export const angleDeg = (from: Point, to: Point): number =>
  (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI

export const rotatePoint = (point: Point, origin: Point, degrees: number): Point => {
  const rad = degreesToRadians(degrees)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

export const snapToGrid = (value: number, gridSize: number): number =>
  Math.round(value / gridSize) * gridSize

export const rectArea = (r: Rect): number => r.width * r.height
