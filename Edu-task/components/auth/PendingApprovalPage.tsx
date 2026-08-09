'use client';

import React from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { Clock, ShieldAlert, LogOut, RefreshCw, XCircle } from 'lucide-react';

export function PendingApprovalPage() {
  const { currentUser, logout } = useApp();

  const isRejected = currentUser?.status === 'REJECTED';

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full blur-3xl pointer-events-none ${
        isRejected ? 'bg-rose-500/10' : 'bg-amber-500/10'
      }`} />

      <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-md rounded-[5px] border border-slate-700/60 p-8 shadow-2xl text-center space-y-6 relative z-10">
        
        {/* Status Icon Badge */}
        <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border ${
          isRejected
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          {isRejected ? (
            <XCircle className="w-8 h-8" />
          ) : (
            <Clock className="w-8 h-8 animate-pulse" />
          )}
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {isRejected ? 'Tài Khoản Bị Từ Chối Truy Cập' : 'Tài Khoản Đang Chờ Phê Duyệt'}
          </h2>
          <p className={`text-xs font-semibold ${isRejected ? 'text-rose-400' : 'text-amber-400'}`}>
            Trạng thái: {currentUser?.status || 'PENDING_APPROVAL'}
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
            <ShieldAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isRejected ? 'text-rose-400' : 'text-amber-400'}`} />
            <span>
              {isRejected ? (
                <>
                  Tài khoản của bạn đã bị <strong className="text-white">Quản trị viên / Ban Giám Hiệu</strong> từ chối cấp quyền truy cập vào hệ thống. Vui lòng liên hệ Admin nếu có sự nhầm lẫn.
                </>
              ) : (
                <>
                  Tài khoản của bạn đã được ghi nhận vào hệ thống nhà trường. Vui lòng liên hệ{' '}
                  <strong className="text-white">Quản trị viên / Ban Giám Hiệu</strong>{' '}
                  để được duyệt tài khoản &amp; phân công Tổ chuyên môn.
                </>
              )}
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
