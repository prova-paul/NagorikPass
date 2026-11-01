export type Point = [x: number, y: number]

/** A round axis maximum split into `lines` whole-number steps, so gridlines fall on readable values. */
export function niceMax(value: number, lines: number) {
  const step = Math.max(1, Math.ceil(value / lines))
  const magnitude = 10 ** Math.floor(Math.log10(step))
  const niceStep = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= step) ?? step
  return niceStep * lines
}

/**
 * An SVG path through the points as a monotone cubic curve. Unlike a plain spline it never
 * overshoots between two points, so a count can't appear to dip below zero or above its peak.
 */
export function smoothPath(points: Point[]) {
  if (points.length === 0) return ''
  const [[firstX, firstY]] = points
  if (points.length === 1) return `M${firstX},${firstY}`

  const slopes = points.slice(1).map(([x, y], index) => (y - points[index][1]) / (x - points[index][0]))
  // Harmonic mean of the neighbouring slopes, and flat at a peak or a valley.
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0]
    if (index === points.length - 1) return slopes[slopes.length - 1]
    const before = slopes[index - 1]
    const after = slopes[index]
    return before * after <= 0 ? 0 : 2 / (1 / before + 1 / after)
  })

  let path = `M${firstX},${firstY}`
  for (let index = 1; index < points.length; index++) {
    const [x0, y0] = points[index - 1]
    const [x1, y1] = points[index]
    const third = (x1 - x0) / 3
    path += ` C${x0 + third},${y0 + tangents[index - 1] * third} ${x1 - third},${y1 - tangents[index] * third} ${x1},${y1}`
  }
  return path
}
