export type ThemeMode = 'light' | 'dark' | 'oled'

export const THEME_STORAGE_KEY = 'mwv2:theme'
export const THEME_CLASSES = ['theme-light', 'theme-dark', 'theme-oled'] as const

export function coerceThemeMode(value: unknown): ThemeMode | null {
  return value === 'light' || value === 'dark' || value === 'oled' ? value : null
}

export function resolveInitialThemeMode(storage?: Pick<Storage, 'getItem'>): ThemeMode {
  try {
    const source = storage || (typeof window !== 'undefined' ? window.localStorage : null)
    return coerceThemeMode(source?.getItem(THEME_STORAGE_KEY)) || 'dark'
  } catch {
    return 'dark'
  }
}
