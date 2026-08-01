'use client';

import React from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { Clock, ShieldAlert, LogOut, RefreshCw, CheckCircle } from 'lucide-react';

export function PendingApprovalPage() {
  const { currentUser, logout } = useApp();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-md rounded-3xl border border-slate-700/60 p-8 shadow-2xl text-center space-y-6 relative z-10">
        
        {/* Status Icon Badge */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Tài Khoản Đang Chờ Phê Duyệt
          </h2>
          <p className="text-xs text-amber-400 font-semibold">
            Trạng thái: PENDING_APPROVAL
          </p>
        </div>

        {/* User Card */}
        {currentUser && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/60 text-left space-y-1 text-xs">
            <div className="text-slate-400">Tài khoản đăng ký:</div>
            <div className="font-bold text-white text-sm">{currentUser.fullName}</div>
            <div className="text-indigo-300">{currentUser.email}</div>
          </div>
        )}

        {/* Detailed Explanation */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-700/40 text-xs text-slate-300 leading-relaxed text-left space-y-2">
          <div className="flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              Tài khoản của bạn đã được ghi nhận vào hệ thống nhà trường. Vui lòng liên hệ **Quản trị viên / Ban Giám Hiệu** để được duyệt tài khoản & phân công Tổ chuyên môn.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={handleRefresh}
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kiểm tra lại</span>
          </button>
          
          <button
            onClick={logout}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-2 transition-colors border border-slate-600"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Đăng xuất</span>
          </button>
        </div>

      </div>
    </div>
  );
}
