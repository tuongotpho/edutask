import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles
import { PwaProvider } from '@/Edu-task/components/common/PwaProvider';

export const metadata: Metadata = {
  title: 'EduTask - Quản lý Công việc & Nghỉ phép Trường học',
  description: 'Hệ thống quản lý giao việc, đơn xin nghỉ phép và phân quyền cho trường học.',
  applicationName: 'EduTask',
  // Standalone mode on iOS, which ignores the web manifest for this.
  appleWebApp: {
    capable: true,
    title: 'EduTask',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  // Installed app should fill the device, including the notch area.
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled: staff read dense tables on small screens and locking
  // zoom would be an accessibility regression.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning>
        <PwaProvider />
        {children}
      </body>
    </html>
  );
}
