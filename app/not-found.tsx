import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-extrabold mb-2">404</h1>
      <p className="text-slate-400 text-sm mb-4">Trang không tồn tại.</p>
      <Link href="/" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">
        Về Trang Chủ
      </Link>
    </div>
  );
}
