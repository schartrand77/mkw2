import type { MetadataRoute } from 'next'
import { BRAND_FULL_NAME, BRAND_NAME } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_FULL_NAME,
    short_name: BRAND_NAME,
    id: '/',
    description: '3D printing model hosting & cost estimation',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    dir: 'ltr',
    background_color: '#1f2026',
    theme_color: '#1f2026',
    lang: 'en',
    prefer_related_applications: false,
    categories: ['productivity', 'shopping', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/favicon.png', sizes: 'any', type: 'image/png', purpose: 'any' },
    ],
    screenshots: [
      { src: '/screenshots/mwhome.png', sizes: '1422x720', type: 'image/png', label: 'Home dashboard' },
      { src: '/screenshots/mwdiscover.png', sizes: '1411x719', type: 'image/png', label: 'Discover models' },
      { src: '/screenshots/mwmodeldetail.png', sizes: '1418x723', type: 'image/png', label: 'Model details' },
      { src: '/screenshots/mwadmin.png', sizes: '1419x719', type: 'image/png', label: 'Admin workspace' },
    ],
    shortcuts: [
      { name: 'Upload a model', url: '/upload', description: 'Jump straight into the upload workflow.' },
      { name: 'View cart', url: '/cart', description: 'Review and check out your current cart.' },
      { name: 'Discover models', url: '/discover', description: 'Browse featured and community models.' },
    ],
  }
}
