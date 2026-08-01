'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { 
  Building2, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  AlertCircle,
  KeyRound,
  UserPlus,
  LogIn,
  CheckCircle2
} from 'lucide-react';
import { INITIAL_DEPARTMENTS } from '@/Edu-task/lib/storage';

export function LoginPage() {
  const { loginWithFirebase, registerWithFirebase, loginAsDemoUser } = useApp();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [departmentId, setDepartmentId] = useState(INITIAL_DEPARTMENTS[0].id);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
          throw new Error('Vui lòng điền đầy đủ họ tên, email và mật khẩu.');
        }
        const dept = INITIAL_DEPARTMENTS.find(d => d.id === departmentId);
        await registerWithFirebase(
          email.trim(), 
          password, 
          fullName.trim(), 
          dept?.id || INITIAL_DEPARTMENTS[0].id, 
          dept?.name || 'Ban Giám Hiệu'
        );
      } else {
        if (!email.trim() || !password.trim()) {
          throw new Error('Vui lòng nhập Email và Mật khẩu.');
        }
        await loginWithFirebase(email.trim(), password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMsg('Email hoặc mật khẩu không chính xác.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Email này đã được đăng ký tài khoản.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Mật khẩu quá ngắn, vui lòng nhập ít nhất 6 ký tự.');
      } else {
        setErrorMsg(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLoginAdmin = async () => {
    setEmail('admin@gmail.com');
    setPassword('admin123');
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await loginWithFirebase('admin@gmail.com', 'admin123');
    } catch (err: any) {
      // If auth account does not exist in Firebase Auth yet, log in via demo context session
      console.log('Firebase Auth credentials fallback:', err);
      loginAsDemoUser('admin@gmail.com');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLoginTeacher = (targetEmail: string) => {
    loginAsDemoUser(targetEmail);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center font-extrabold text-white text-2xl shadow-lg shadow-indigo-500/30">
            E
          </div>
        </div>
        <h2 className="text-center text-2xl font-extrabold text-white tracking-tight">
          EduTask - Quản lý Nhà trường
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          THPT Chuyên Nguyễn Trãi • Hệ thống Công việc & Đơn từ
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-800/90 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl border border-slate-700/60 sm:px-10">
          
          {/* Tab Switcher: Login / Register */}
          <div className="flex rounded-xl bg-slate-900/60 p-1 mb-6 border border-slate-700/50">
            <button
              type="button"
              onClick={() => { setIsRegistering(false); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                !isRegistering 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              onClick={() => { setIsRegistering(true); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                isRegistering 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Đăng ký GV Mới</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleLoginSubmit}>
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Họ và tên Giáo viên / Cán bộ
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Cô Nguyễn Thị Mai"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Đăng Nhập
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isRegistering ? "teacher@truong.edu.vn" : "admin@gmail.com hoặc email giáo viên"}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tổ chuyên môn / Phòng ban
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {INITIAL_DEPARTMENTS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 border border-transparent rounded-xl shadow-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Đang xử lý...</span>
              ) : (
                <>
                  <span>{isRegistering ? 'Đăng ký tài khoản mới' : 'Xác thực & Đăng nhập'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Login Helper Panel */}
          <div className="mt-6 pt-5 border-t border-slate-700/60">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>Thử nghiệm nhanh tài khoản demo</span>
            </div>

            {/* Primary Admin Quick Login Button */}
            <button
              type="button"
              onClick={handleQuickLoginAdmin}
              className="w-full mb-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <div className="text-left">
                  <div className="font-bold text-amber-200">admin@gmail.com (Quản trị viên / BGH)</div>
                  <div className="text-[10px] text-amber-400/80">Toàn quyền quản trị phân quyền & duyệt đơn</div>
                </div>
              </div>
              <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">Admin</span>
            </button>

            {/* Quick Demo Teachers */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickLoginTeacher('nguyenvanan@truong.edu.vn')}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 text-slate-300 text-left border border-slate-700/50 truncate"
              >
                <div className="font-medium text-white truncate">TS. Nguyễn Văn An</div>
                <div className="text-[9px] text-slate-400">Hiệu Trưởng BGH</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLoginTeacher('lehoangnam@truong.edu.vn')}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 text-slate-300 text-left border border-slate-700/50 truncate"
              >
                <div className="font-medium text-white truncate">Thầy Lê Hoàng Nam</div>
                <div className="text-[9px] text-slate-400">Tổ Trưởng Toán-Tin</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLoginTeacher('phamthithu@truong.edu.vn')}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 text-slate-300 text-left border border-slate-700/50 truncate"
              >
                <div className="font-medium text-white truncate">Cô Phạm Thị Thu</div>
                <div className="text-[9px] text-slate-400">Giáo viên Toán</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLoginTeacher('dominhtuan@truong.edu.vn')}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 text-slate-300 text-left border border-slate-700/50 truncate"
              >
                <div className="font-medium text-white truncate">Thầy Đỗ Minh Tuấn</div>
                <div className="text-[9px] text-slate-400">Giáo viên Tin học</div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
