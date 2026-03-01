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

/** Euclidean distance between two points */
export const distance = (a: Point, b: Point): number =>
  Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)

/** Midpoint of two points */
export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

/** Check if two rectangles overlap */
export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y

/** Check if a point is inside a rectangle */
export const pointInRect = (p: Point, r: Rect): boolean =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height

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

/** Angle between two points in degrees */
export const angleDeg = (from: Point, to: Point): number =>
  (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI

/** Rotate a point around an origin by degrees */
export const rotatePoint = (point: Point, origin: Point, degrees: number): Point => {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

/** Snap value to nearest grid size */
export const snapToGrid = (value: number, gridSize: number): number =>
  Math.round(value / gridSize) * gridSize

/** Area of a rectangle */
export const rectArea = (r: Rect): number => r.width * r.height
