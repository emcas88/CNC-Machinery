import { describe, it, expect } from 'vitest'
import {
  mmToInches,
  inchesToMm,
  mmToFeet,
  feetToMm,
  calculateArea,
  calculatePerimeter,
  calculateVolume,
  rectOverlap,
  pointInRect,
  snapToGrid,
  clamp,
  lerp,
  degreesToRadians,
  radiansToDegrees,
} from '@/utils/geometry'

describe('mmToInches', () => {
  it('converts 0 mm to 0 inches', () => {
    expect(mmToInches(0)).toBe(0)
  })

  it('converts 25.4 mm to 1 inch', () => {
    expect(mmToInches(25.4)).toBeCloseTo(1, 5)
  })

  it('converts 304.8 mm to 12 inches (1 foot)', () => {
    expect(mmToInches(304.8)).toBeCloseTo(12, 5)
  })

  it('converts 1000 mm to ~39.37 inches', () => {
    expect(mmToInches(1000)).toBeCloseTo(39.3701, 3)
  })
})

describe('inchesToMm', () => {
  it('converts 0 inches to 0 mm', () => {
    expect(inchesToMm(0)).toBe(0)
  })

  it('converts 1 inch to 25.4 mm', () => {
    expect(inchesToMm(1)).toBeCloseTo(25.4, 5)
  })

  it('converts 12 inches to 304.8 mm', () => {
    expect(inchesToMm(12)).toBeCloseTo(304.8, 5)
  })
})

describe('mmToFeet', () => {
  it('converts 0 mm to 0 feet', () => {
    expect(mmToFeet(0)).toBe(0)
  })

  it('converts 304.8 mm to 1 foot', () => {
    expect(mmToFeet(304.8)).toBeCloseTo(1, 5)
  })

  it('converts 1000 mm to ~3.281 feet', () => {
    expect(mmToFeet(1000)).toBeCloseTo(3.2808, 3)
  })
})

describe('feetToMm', () => {
  it('converts 0 feet to 0 mm', () => {
    expect(feetToMm(0)).toBe(0)
  })

  it('converts 1 foot to 304.8 mm', () => {
    expect(feetToMm(1)).toBeCloseTo(304.8, 5)
  })

  it('converts 10 feet to 3048 mm', () => {
    expect(feetToMm(10)).toBeCloseTo(3048, 5)
  })
})

describe('calculateArea', () => {
  it('calculates area of a 100x200 rectangle', () => {
    expect(calculateArea(100, 200)).toBe(20000)
  })

  it('calculates area of a square', () => {
    expect(calculateArea(50, 50)).toBe(2500)
  })

  it('calculates area of 0 width', () => {
    expect(calculateArea(0, 100)).toBe(0)
  })
})

describe('calculatePerimeter', () => {
  it('calculates perimeter of a 100x200 rectangle', () => {
    expect(calculatePerimeter(100, 200)).toBe(600)
  })

  it('calculates perimeter of a square', () => {
    expect(calculatePerimeter(50, 50)).toBe(200)
  })
})

describe('calculateVolume', () => {
  it('calculates volume of a 100x200x18 panel', () => {
    expect(calculateVolume(100, 200, 18)).toBe(360000)
  })

  it('calculates volume of a cube', () => {
    expect(calculateVolume(10, 10, 10)).toBe(1000)
  })
})

describe('rectOverlap', () => {
  it('returns true for overlapping rectangles', () => {
    const r1 = { x: 0, y: 0, width: 100, height: 100 }
    const r2 = { x: 50, y: 50, width: 100, height: 100 }
    expect(rectOverlap(r1, r2)).toBe(true)
  })

  it('returns false for non-overlapping rectangles', () => {
    const r1 = { x: 0, y: 0, width: 100, height: 100 }
    const r2 = { x: 200, y: 200, width: 100, height: 100 }
    expect(rectOverlap(r1, r2)).toBe(false)
  })

  it('returns false for adjacent (touching) rectangles', () => {
    const r1 = { x: 0, y: 0, width: 100, height: 100 }
    const r2 = { x: 100, y: 0, width: 100, height: 100 }
    expect(rectOverlap(r1, r2)).toBe(false)
  })

  it('returns true when one rectangle is inside the other', () => {
    const r1 = { x: 0, y: 0, width: 200, height: 200 }
    const r2 = { x: 50, y: 50, width: 50, height: 50 }
    expect(rectOverlap(r1, r2)).toBe(true)
  })
})

describe('pointInRect', () => {
  it('returns true for a point inside the rectangle', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    expect(pointInRect({ x: 50, y: 50 }, rect)).toBe(true)
  })

  it('returns false for a point outside the rectangle', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    expect(pointInRect({ x: 150, y: 50 }, rect)).toBe(false)
  })

  it('returns true for a point on the edge', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    expect(pointInRect({ x: 0, y: 0 }, rect)).toBe(true)
  })

  it('returns false for a point at the max edge (exclusive)', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    expect(pointInRect({ x: 100, y: 100 }, rect)).toBe(false)
  })
})

describe('snapToGrid', () => {
  it('snaps 0 to 0', () => {
    expect(snapToGrid(0, 10)).toBe(0)
  })

  it('snaps 5 to 10 (rounds up)', () => {
    expect(snapToGrid(5, 10)).toBe(10)
  })

  it('snaps 4 to 0 (rounds down)', () => {
    expect(snapToGrid(4, 10)).toBe(0)
  })

  it('snaps 14 to 10', () => {
    expect(snapToGrid(14, 10)).toBe(10)
  })

  it('snaps 15 to 20', () => {
    expect(snapToGrid(15, 10)).toBe(20)
  })

  it('snaps to grid size 5', () => {
    expect(snapToGrid(7, 5)).toBe(5)
    expect(snapToGrid(8, 5)).toBe(10)
  })
})

describe('clamp', () => {
  it('returns value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min when below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps to max when above range', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('lerp', () => {
  it('returns start at t=0', () => {
    expect(lerp(0, 100, 0)).toBe(0)
  })

  it('returns end at t=1', () => {
    expect(lerp(0, 100, 1)).toBe(100)
  })

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('handles negative values', () => {
    expect(lerp(-100, 100, 0.5)).toBe(0)
  })
})

describe('degreesToRadians', () => {
  it('converts 0 degrees to 0 radians', () => {
    expect(degreesToRadians(0)).toBe(0)
  })

  it('converts 180 degrees to PI radians', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10)
  })

  it('converts 360 degrees to 2*PI radians', () => {
    expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI, 10)
  })

  it('converts 90 degrees to PI/2 radians', () => {
    expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2, 10)
  })
})

describe('radiansToDegrees', () => {
  it('converts 0 radians to 0 degrees', () => {
    expect(radiansToDegrees(0)).toBe(0)
  })

  it('converts PI radians to 180 degrees', () => {
    expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 10)
  })

  it('converts 2*PI radians to 360 degrees', () => {
    expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360, 10)
  })

  it('converts PI/2 radians to 90 degrees', () => {
    expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 10)
  })
})
