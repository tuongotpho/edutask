import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'EduTask - Quản lý Công việc & Nghỉ phép Trường học',
  description: 'Hệ thống quản lý giao việc, đơn xin nghỉ phép và phân quyền cho trường học.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
