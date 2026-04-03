const SUPPORTED_MODEL_EXTENSIONS = [
  '.stl',
  '.obj',
  '.3mf',
  '.amf',
  '.ply',
  '.wrl',
  '.vrml',
  '.glb',
  '.gltf',
  '.usd',
  '.usda',
  '.usdc',
  '.usdz',
  '.zip',
] as const

const MODEL_PREVIEW_CONVERSION_EXTENSIONS = [
  '.3mf',
  '.obj',
  '.amf',
  '.ply',
  '.wrl',
  '.vrml',
  '.glb',
  '.gltf',
  '.usd',
  '.usda',
  '.usdz',
] as const

const MODEL_MIME_BY_EXTENSION: Record<string, string> = {
  '.stl': 'model/stl',
  '.obj': 'model/obj',
  '.3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  '.amf': 'application/amf+xml',
  '.ply': 'application/octet-stream',
  '.wrl': 'model/vrml',
  '.vrml': 'model/vrml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.usd': 'model/vnd.usd',
  '.usda': 'model/vnd.usda',
  '.usdc': 'model/vnd.usdc',
  '.usdz': 'model/vnd.usdz+zip',
  '.zip': 'application/zip',
}

const MODEL_ACCEPT_MIME_ALIASES_BY_EXTENSION: Record<string, string[]> = {
  '.stl': ['application/sla', 'model/stl'],
  '.obj': ['model/obj', 'text/plain'],
  '.3mf': ['application/vnd.ms-package.3dmanufacturing-3dmodel+xml', 'model/3mf'],
  '.amf': ['application/amf+xml'],
  '.ply': ['application/octet-stream'],
  '.wrl': ['model/vrml'],
  '.vrml': ['model/vrml'],
  '.glb': ['model/gltf-binary'],
  '.gltf': ['model/gltf+json'],
  '.usd': ['model/vnd.usd'],
  '.usda': ['model/vnd.usda'],
  '.usdc': ['model/vnd.usdc'],
  '.usdz': ['model/vnd.usdz+zip'],
  '.zip': ['application/zip'],
}

export const MODEL_ARCHIVE_EXTENSIONS: ReadonlySet<string> = new Set(['.zip'])
export const MODEL_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set(
  SUPPORTED_MODEL_EXTENSIONS.filter((ext) => !MODEL_ARCHIVE_EXTENSIONS.has(ext)),
)
export const MODEL_FILE_EXTENSIONS: ReadonlySet<string> = new Set(SUPPORTED_MODEL_EXTENSIONS)
export const MODEL_PREVIEW_CONVERSION_FILE_EXTENSIONS: ReadonlySet<string> = new Set(MODEL_PREVIEW_CONVERSION_EXTENSIONS)
export const MODEL_ACCEPT_ATTRIBUTE = Array.from(new Set([
  ...SUPPORTED_MODEL_EXTENSIONS,
  ...SUPPORTED_MODEL_EXTENSIONS.flatMap((ext) => MODEL_ACCEPT_MIME_ALIASES_BY_EXTENSION[ext] || []),
])).join(',')
export const MODEL_FILE_LABEL = SUPPORTED_MODEL_EXTENSIONS.join(', ')

export function getModelMimeType(ext: string) {
  return MODEL_MIME_BY_EXTENSION[ext.toLowerCase()] || 'application/octet-stream'
}

export function isSupportedModelFile(name: string) {
  const normalized = name.trim().toLowerCase()
  return Array.from(MODEL_FILE_EXTENSIONS).some((ext) => normalized.endsWith(ext))
}

export function needsModelPreviewConversion(ext: string) {
  return MODEL_PREVIEW_CONVERSION_FILE_EXTENSIONS.has(ext.toLowerCase())
}
