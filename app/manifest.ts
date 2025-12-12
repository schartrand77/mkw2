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
    orientation: 'portrait-primary',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'en',
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
      { src: '/screenshots/featured.png', sizes: '2877x1475', type: 'image/png', label: 'Featured models' },
      { src: '/screenshots/modelviewer.png', sizes: '2875x1496', type: 'image/png', label: 'Model viewer' },
      { src: '/screenshots/uploads.png', sizes: '2872x1494', type: 'image/png', label: 'Upload workflow' },
    ],
    shortcuts: [
      { name: 'Upload a model', url: '/upload', description: 'Jump straight into the upload workflow.' },
      { name: 'View cart', url: '/cart', description: 'Review and check out your current cart.' },
      { name: 'Discover models', url: '/discover', description: 'Browse featured and community models.' },
    ],
  }
}
