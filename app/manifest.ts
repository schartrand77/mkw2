import type { MetadataRoute } from 'next'
import { BRAND_FULL_NAME, BRAND_NAME } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_FULL_NAME,
    short_name: BRAND_NAME,
    description: '3D printing model hosting & cost estimation',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'en',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
