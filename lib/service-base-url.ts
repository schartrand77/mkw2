import { existsSync } from 'node:fs'

type NormalizeServiceBaseUrlOptions = {
  dockerRuntime?: boolean
}

function isDockerRuntime() {
  return process.env.MAKERWORKS_DOCKER_RUNTIME === '1' || process.env.DOCKER_CONTAINER === '1' || existsSync('/.dockerenv')
}

export function normalizeServiceBaseUrl(raw?: string | null, defaultProtocol = 'http://', options: NormalizeServiceBaseUrlOptions = {}) {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${defaultProtocol}${trimmed.replace(/^\/+/, '')}`

  try {
    const url = new URL(withProtocol)
    url.hash = ''
    url.search = ''
    const dockerRuntime = options.dockerRuntime ?? isDockerRuntime()
    if (dockerRuntime && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')) {
      url.hostname = 'host.docker.internal'
    }
    return url.toString().replace(/\/+$/, '')
  } catch {
    return withProtocol.replace(/\/+$/, '')
  }
}
