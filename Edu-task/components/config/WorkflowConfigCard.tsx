'use client';

import React, { useState } from 'react';
import { GitBranch, Check, Send, Loader2, ShieldAlert } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LeaveType, LEAVE_TYPE_LABELS } from '@/Edu-task/types/leave';
import { TelegramEvent, TELEGRAM_EVENT_LABELS, isTelegramConfigured } from '@/Edu-task/types/settings';
import { describeWorkflow } from '@/Edu-task/lib/workflow';
import { telegramService } from '@/Edu-task/services/telegramService';
import { CollapsibleCard } from '@/Edu-task/components/common/CollapsibleCard';

/** Admin controls for the approval flow. These now actually take effect. */
export function WorkflowConfigCard() {
  const { workflowConfig, updateWorkflowConfig, showToast } = useApp();

  const [deptOnlyMaxDays, setDeptOnlyMaxDays] = useState(workflowConfig.deptOnlyMaxDays);
  const [alwaysExecutiveTypes, setAlwaysExecutiveTypes] = useState<LeaveType[]>(
    workflowConfig.alwaysExecutiveTypes
  );
  const [isSaving, setIsSaving] = useState(false);

  const draft = { deptOnlyMaxDays, alwaysExecutiveTypes };
  const isDirty =
    deptOnlyMaxDays !== workflowConfig.deptOnlyMaxDays ||
    alwaysExecutiveTypes.length !== workflowConfig.alwaysExecutiveTypes.length ||
    alwaysExecutiveTypes.some(t => !workflowConfig.alwaysExecutiveTypes.includes(t));

  const toggleType = (type: LeaveType) => {
    setAlwaysExecutiveTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (await updateWorkflowConfig(draft)) {
        showToast('success', 'Đã cập nhật luồng duyệt đơn nghỉ.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CollapsibleCard
      title="Cấu Hình Luồng Duyệt Đơn Nghỉ"
      subtitle="Quyết định khi nào đơn cần trình lên Ban Giám Hiệu. Áp dụng cho các đơn tạo sau khi lưu."
      icon={GitBranch}
    >
      <div className="space-y-4">

      {/* Live description of what the current draft means, in plain Vietnamese. */}
      <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 font-medium">
        {describeWorkflow(draft)}
      </div>

      <div className="text-xs space-y-1.5">
        <label className="block font-bold text-slate-700">
          Đơn tối đa bao nhiêu ngày thì chỉ cần Nhóm/Tổ trưởng duyệt?
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={30}
            value={deptOnlyMaxDays}
            onChange={e => setDeptOnlyMaxDays(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <span className="text-slate-500">ngày · nhập <strong>0</strong> để mọi đơn đều phải qua BGH</span>
        </div>
      </div>

      <div className="text-xs space-y-1.5">
        <label className="block font-bold text-slate-700">
          Loại nghỉ luôn phải trình Ban Giám Hiệu (bất kể số ngày)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(type => {
            const checked = alwaysExecutiveTypes.includes(type);
            return (
              <label
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                  checked
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] flex-shrink-0 ${
                  checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {checked && '✓'}
                </span>
                <span className="truncate">{LEAVE_TYPE_LABELS[type].label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
        >
          <Check className="w-4 h-4" />
          <span>{isSaving ? 'Đang lưu…' : 'Lưu Luồng Duyệt'}</span>
        </button>
      </div>
      </div>
    </CollapsibleCard>
  );
}

/**
 * Telegram group notifications. Entirely optional: with nothing configured the
 * app never contacts Telegram.
 */
export function TelegramConfigCard() {
  const { telegramConfig, updateTelegramConfig, showToast } = useApp();

  const [enabled, setEnabled] = useState(telegramConfig.enabled);
  const [botToken, setBotToken] = useState(telegramConfig.botToken);
  const [chatId, setChatId] = useState(telegramConfig.chatId);
  const [events, setEvents] = useState(telegramConfig.events);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const draft = { enabled, botToken, chatId, events };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (await updateTelegramConfig(draft)) {
        showToast('success', isTelegramConfigured(draft)
          ? 'Đã lưu cấu hình Telegram. Hệ thống sẽ gửi thông báo vào nhóm.'
          : 'Đã lưu. Telegram đang TẮT nên hệ thống sẽ không gửi thông báo.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await telegramService.sendTest(draft);
      if (result.ok) {
        showToast('success', 'Đã gửi tin nhắn thử. Kiểm tra nhóm Telegram của bạn.');
      } else {
        showToast('error', `Telegram từ chối: ${result.error}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <CollapsibleCard
      title="Thông Báo Qua Nhóm Telegram"
      subtitle="Tự động đăng thông báo vào nhóm Telegram của trường. Bỏ trống để không gửi gì cả."
      icon={Send}
      iconClassName="text-sky-600"
      // Whether notifications are actually going out is the one thing worth
      // seeing without opening the card.
      badge={
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          telegramConfig.enabled
            ? 'bg-sky-50 text-sky-700 border-sky-200'
            : 'bg-slate-100 text-slate-500 border-slate-200'
        }`}>
          {telegramConfig.enabled ? 'Đang bật' : 'Đang tắt'}
        </span>
      }
    >
      <div className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
        />
        <span className="text-xs font-bold text-slate-700">Bật gửi thông báo Telegram</span>
      </label>

      {/* The token is readable by any signed-in user because this app has no
          server. Say so plainly rather than letting an admin assume otherwise. */}
      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <span>
          Ứng dụng không có máy chủ riêng nên <strong>Bot Token được lưu trên Firestore và mọi tài
          khoản đã đăng nhập đều đọc được</strong>. Hãy dùng một bot chỉ phục vụ nhóm này, đừng
          dùng lại bot có quyền ở nơi khác.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Bot Token</label>
          <input
            type="password"
            value={botToken}
            onChange={e => setBotToken(e.target.value)}
            placeholder="123456789:AAE..."
            className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="text-[10px] text-slate-400 mt-1">Lấy từ @BotFather trên Telegram.</p>
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">Chat ID của nhóm</label>
          <input
            type="text"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            placeholder="-1001234567890"
            className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Thêm bot vào nhóm, rồi lấy ID qua @userinfobot hoặc getUpdates.
          </p>
        </div>
      </div>

      <div className="text-xs space-y-1.5">
        <label className="block font-bold text-slate-700">Gửi thông báo khi:</label>
        <div className="space-y-1.5">
          {(Object.keys(TELEGRAM_EVENT_LABELS) as TelegramEvent[]).map(event => (
            <label
              key={event}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <span className="font-medium text-slate-700">{TELEGRAM_EVENT_LABELS[event]}</span>
              <input
                type="checkbox"
                checked={events[event]}
                onChange={e => setEvents(prev => ({ ...prev, [event]: e.target.checked }))}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={isTesting || !botToken.trim() || !chatId.trim()}
          onClick={handleTest}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all"
        >
          {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>Gửi Thử</span>
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
        >
          <Check className="w-4 h-4" />
          <span>{isSaving ? 'Đang lưu…' : 'Lưu Cấu Hình'}</span>
        </button>
      </div>
      </div>
    </CollapsibleCard>
  );
}
