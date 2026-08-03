import type { MetadataRoute } from 'next';

// Static export needs this emitted at build time rather than served dynamically.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduTask — Quản lý Công việc & Nghỉ phép',
    short_name: 'EduTask',
    description:
      'Hệ thống quản lý giao việc, đơn xin nghỉ phép và phân công dạy thay cho trường học.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#4f46e5',
    lang: 'vi',
    dir: 'ltr',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate maskable entries: Android crops these to the launcher shape, so
      // they carry extra padding the plain icons must not have.
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
