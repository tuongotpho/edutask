'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { ROLE_LABELS, RoleType } from '@/Edu-task/types/user';
import { 
  Building2, 
  Bell, 
  Search, 
  UserCheck, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles,
  ChevronDown,
  User as UserIcon,
  LogOut,
  Calendar,
  FileText
} from 'lucide-react';

export function Navbar({ onSearch }: { onSearch?: (term: string) => void }) {
  const { 
    currentUser, 
    activeRole, 
    users, 
    switchUser, 
    switchActiveRole, 
    notifications, 
    resetSystemData,
    logout 
  } = useApp();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left Brand & School Name */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-sm tracking-tight text-lg">
            E
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 tracking-tight text-base">EduTask</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                THPT Chuyên Nguyễn Trãi
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Hệ thống Quản lý Công việc & Đơn từ Nội bộ</p>
          </div>
        </div>

        {/* Middle Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Tìm đơn xin nghỉ, công việc, giáo viên..."
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Right Actions: Role Switcher, User Selector, Notifications */}
        <div className="flex items-center space-x-2 sm:space-x-3">

          {/* Quick Active Role Dropdown (RBAC tester) */}
          {currentUser && currentUser.roles.length > 1 && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowRoleDropdown(!showRoleDropdown);
                  setShowUserDropdown(false);
                  setShowNotifDropdown(false);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-900 text-xs font-semibold transition-colors"
                title="Đổi vai trò thao tác hiện tại"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                <span className="max-w-[120px] truncate">{ROLE_LABELS[activeRole]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Chọn vai trò thao tác (RBAC)
                  </div>
                  {currentUser.roles.map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        switchActiveRole(r);
                        setShowRoleDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        r === activeRole ? 'font-bold text-indigo-600 bg-indigo-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{ROLE_LABELS[r]}</span>
                      {r === activeRole && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifDropdown(!showNotifDropdown);
                setShowRoleDropdown(false);
                setShowUserDropdown(false);
              }}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative transition-colors"
              title="Thông báo"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">Thông báo mới</span>
                  <span className="text-[10px] text-slate-500">{notifications.length} thông báo</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">Không có thông báo mới</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors">
                        <div className="text-xs font-semibold text-slate-900 mb-0.5">{n.title}</div>
                        <div className="text-xs text-slate-600 line-clamp-2">{n.message}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{n.createdAt}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Selector Dropdown */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowRoleDropdown(false);
                  setShowNotifDropdown(false);
                }}
                className="flex items-center space-x-2 pl-2 pr-2.5 py-1 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                  {currentUser.fullName.split(' ').slice(-1)[0][0]}
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-semibold text-slate-900 leading-none">{currentUser.fullName}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{currentUser.departmentName}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{currentUser.fullName}</p>
                    <p className="text-xs text-slate-500">{currentUser.email}</p>
                    <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                      Tổ: {currentUser.departmentName}
                    </div>
                  </div>

                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Đổi tài khoản kiểm thử (Demo Teacher)
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {users.map(u => (
                        <button
                          key={u.id}
                          onClick={() => {
                            switchUser(u.id);
                            setShowUserDropdown(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-slate-100 transition-colors ${
                            u.id === currentUser.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="leading-tight">{u.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{ROLE_LABELS[u.roles[0]]} - {u.departmentName}</div>
                          </div>
                          {u.id === currentUser.id && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-2 pt-1 border-t border-slate-100 mt-1 space-y-1">
                    <button
                      onClick={() => {
                        logout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center space-x-2 font-bold"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-slate-800">Đăng Xuất Tài Khoản</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm('Khôi phục dữ liệu mẫu ban đầu của hệ thống?')) {
                          resetSystemData();
                          setShowUserDropdown(false);
                        }
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-medium"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                      <span>Reset Dữ Liệu Demo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
