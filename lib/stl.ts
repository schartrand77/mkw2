// Minimal STL volume calculator (binary + ASCII)
// Returns volume in mm^3 using signed tetrahedron volumes

export function computeStlVolumeMm3(buf: Buffer): number | null {
  // Try binary first
  if (buf.length >= 84) {
    const triCount = buf.readUInt32LE(80)
    const expectedLen = 84 + triCount * 50
    if (expectedLen === buf.length) {
      let volume = 0
      for (let i = 84; i < buf.length; i += 50) {
        const ax = buf.readFloatLE(i + 12)
        const ay = buf.readFloatLE(i + 16)
        const az = buf.readFloatLE(i + 20)
        const bx = buf.readFloatLE(i + 24)
        const by = buf.readFloatLE(i + 28)
        const bz = buf.readFloatLE(i + 32)
        const cx = buf.readFloatLE(i + 36)
        const cy = buf.readFloatLE(i + 40)
        const cz = buf.readFloatLE(i + 44)
        volume += signedTetraVolume(ax, ay, az, bx, by, bz, cx, cy, cz)
      }
      return Math.abs(volume)
    }
  }
  // ASCII fallback (very naive)
  try {
    const text = buf.toString('utf8')
    if (!text.trim().startsWith('solid')) return null
    const re = /vertex\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+vertex\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+vertex\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+([\d.+-eE]+)/g
    let m: RegExpExecArray | null
    let volume = 0
    while ((m = re.exec(text)) !== null) {
      const ax = parseFloat(m[1]); const ay = parseFloat(m[2]); const az = parseFloat(m[3])
      const bx = parseFloat(m[4]); const by = parseFloat(m[5]); const bz = parseFloat(m[6])
      const cx = parseFloat(m[7]); const cy = parseFloat(m[8]); const cz = parseFloat(m[9])
      volume += signedTetraVolume(ax, ay, az, bx, by, bz, cx, cy, cz)
    }
    return Math.abs(volume)
  } catch {
    return null
  }
}

function resolveSupportAngleDegrees(): number {
  const raw = process.env.SUPPORT_OVERHANG_ANGLE_DEG
  const parsed = raw != null ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed > 0 && parsed < 89) return parsed
  return 45
}

// Compute volume (mm^3), bounding-box size (mm), and support area ratio for STL
export function computeStlStatsMm(buf: Buffer): {
  volumeMm3: number | null
  sizeXmm?: number
  sizeYmm?: number
  sizeZmm?: number
  supportAreaRatio?: number
} {
  let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY
  const acc = (x: number, y: number, z: number) => {
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z
  }
  const supportAngle = resolveSupportAngleDegrees()
  const supportCos = Math.cos((supportAngle * Math.PI) / 180)
  let totalArea = 0
  let supportArea = 0
  const trackSupportArea = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az
    const acx = cx - ax
    const acy = cy - ay
    const acz = cz - az
    const crossX = aby * acz - abz * acy
    const crossY = abz * acx - abx * acz
    const crossZ = abx * acy - aby * acx
    const doubleArea = Math.hypot(crossX, crossY, crossZ)
    if (!Number.isFinite(doubleArea) || doubleArea <= 0) return
    const area = doubleArea / 2
    totalArea += area
    const nz = crossZ / doubleArea
    if (nz < -supportCos) {
      supportArea += area
    }
  }
  // Try binary
  if (buf.length >= 84) {
    const triCount = buf.readUInt32LE(80)
    const expectedLen = 84 + triCount * 50
    if (expectedLen === buf.length) {
      let volume = 0
      for (let i = 84; i < buf.length; i += 50) {
        const ax = buf.readFloatLE(i + 12)
        const ay = buf.readFloatLE(i + 16)
        const az = buf.readFloatLE(i + 20)
        const bx = buf.readFloatLE(i + 24)
        const by = buf.readFloatLE(i + 28)
        const bz = buf.readFloatLE(i + 32)
        const cx = buf.readFloatLE(i + 36)
        const cy = buf.readFloatLE(i + 40)
        const cz = buf.readFloatLE(i + 44)
        acc(ax, ay, az); acc(bx, by, bz); acc(cx, cy, cz)
        trackSupportArea(ax, ay, az, bx, by, bz, cx, cy, cz)
        volume += signedTetraVolume(ax, ay, az, bx, by, bz, cx, cy, cz)
      }
      const vol = Math.abs(volume)
      const sx = (maxX - minX), sy = (maxY - minY), sz = (maxZ - minZ)
      const supportAreaRatio = totalArea > 0 ? Math.max(0, Math.min(1, supportArea / totalArea)) : undefined
      return { volumeMm3: vol, sizeXmm: sx, sizeYmm: sy, sizeZmm: sz, supportAreaRatio }
    }
  }
  // ASCII fallback
  try {
    const text = buf.toString('utf8')
    if (!text.trim().startsWith('solid')) return { volumeMm3: null }
    const re = /vertex\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+vertex\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+vertex\s+([\d.+-eE]+)\s+([\d.+-eE]+)\s+([\d.+-eE]+)/g
    let m: RegExpExecArray | null
    let volume = 0
    while ((m = re.exec(text)) !== null) {
      const ax = parseFloat(m[1]); const ay = parseFloat(m[2]); const az = parseFloat(m[3])
      const bx = parseFloat(m[4]); const by = parseFloat(m[5]); const bz = parseFloat(m[6])
      const cx = parseFloat(m[7]); const cy = parseFloat(m[8]); const cz = parseFloat(m[9])
      acc(ax, ay, az); acc(bx, by, bz); acc(cx, cy, cz)
      trackSupportArea(ax, ay, az, bx, by, bz, cx, cy, cz)
      volume += signedTetraVolume(ax, ay, az, bx, by, bz, cx, cy, cz)
    }
    const vol = Math.abs(volume)
    const sx = (maxX - minX), sy = (maxY - minY), sz = (maxZ - minZ)
    const supportAreaRatio = totalArea > 0 ? Math.max(0, Math.min(1, supportArea / totalArea)) : undefined
    return {
      volumeMm3: vol,
      sizeXmm: isFinite(sx) ? sx : undefined,
      sizeYmm: isFinite(sy) ? sy : undefined,
      sizeZmm: isFinite(sz) ? sz : undefined,
      supportAreaRatio,
    }
  } catch {
    return { volumeMm3: null }
  }
}

function signedTetraVolume(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) {
  // (1/6) * dot(a, cross(b, c))
  const v = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  return v
}
