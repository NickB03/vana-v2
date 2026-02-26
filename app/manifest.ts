import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vana',
    short_name: 'Vana',
    description:
      'An AI-powered answer engine with a generative UI for research and exploration.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/images/vana-icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  }
}
