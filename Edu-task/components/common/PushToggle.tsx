'use client';

import React, { useEffect, useState } from 'react';
import { BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  disablePush,
  enablePush,
  getPushPermission,
  isPushConfigured,
  needsIosInstall,
} from '@/Edu-task/services/pushService';
import { PushPermission } from '@/Edu-task/types/push';

/**
 * The one control for "buzz my phone".
 *
 * Lives inside the notification dropdown because that is where someone goes the
 * moment they wonder why they missed something — the question and the answer in
 * the same place.
 *
 * The states are all rendered honestly rather than collapsed into one button:
 * a browser that cannot do push, an iPhone that has not installed the PWA, and
 * a permission the user actively refused are three different problems with
 * three different fixes, and a single greyed button would explain none of them.
 */
export function PushToggle() {
  const { currentUser, showToast } = useApp();

  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPushPermission().then(result => {
      if (!cancelled) setPermission(result);
    });
    return () => { cancelled = true; };
  }, []);

  // Nothing to offer when the school has not set up a VAPID key: showing a
  // button that always fails would just look broken.
  if (!isPushConfigured()) return null;
  if (permission === null) return null;

  if (permission === 'UNSUPPORTED') {
    return (
      <Shell tone="muted">
        Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome, Edge hoặc Safari bản mới.
      </Shell>
    );
  }

  if (needsIosInstall()) {
    return (
      <Shell tone="info" icon={<Smartphone className="w-3.5 h-3.5 flex-shrink-0" />}>
        Trên iPhone/iPad: bấm <strong>Chia sẻ → Thêm vào Màn hình chính</strong>, rồi mở EduTask từ
        biểu tượng đó mới bật được thông báo. Đây là quy định của Apple với ứng dụng web.
      </Shell>
    );
  }

  if (permission === 'DENIED') {
    return (
      <Shell tone="warn" icon={<BellOff className="w-3.5 h-3.5 flex-shrink-0" />}>
        Bạn đã chặn thông báo cho trang này. Mở biểu tượng ổ khóa trên thanh địa chỉ →
        <strong> Thông báo → Cho phép</strong>, rồi tải lại trang.
      </Shell>
    );
  }

  const isOn = permission === 'GRANTED';

  const handleToggle = async () => {
    if (!currentUser) return;
    setIsBusy(true);
    try {
      if (isOn) {
        await disablePush();
        setPermission('DEFAULT');
        showToast('success', 'Đã tắt thông báo trên thiết bị này.');
      } else {
        const result = await enablePush(currentUser.id);
        if (result.ok) {
          setPermission('GRANTED');
          showToast('success', 'Đã bật. Thông báo sẽ hiện trên màn hình điện thoại kể cả khi không mở app.');
        } else {
          setPermission(await getPushPermission());
          showToast('error', result.error ?? 'Không bật được thông báo.');
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        className={`w-full px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 ${
          isOn
            ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        {isBusy
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : isOn ? <BellOff className="w-3.5 h-3.5" /> : <BellRing className="w-3.5 h-3.5" />}
        <span>
          {isBusy ? 'Đang xử lý…' : isOn ? 'Tắt thông báo trên thiết bị này' : 'Bật thông báo lên điện thoại'}
        </span>
      </button>
      {!isOn && (
        <p className="text-[10px] text-slate-500 mt-1.5 text-center">
          Nhận nhắc việc và đơn cần duyệt ngay cả khi không mở ứng dụng.
        </p>
      )}
    </div>
  );
}

function Shell({
  tone, icon, children,
}: {
  tone: 'muted' | 'info' | 'warn';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    muted: 'bg-slate-50 text-slate-500 border-slate-100',
    info: 'bg-sky-50 text-sky-900 border-sky-100',
    warn: 'bg-amber-50 text-amber-900 border-amber-100',
  };
  return (
    <div className={`px-4 py-2.5 border-b text-[10px] leading-relaxed flex items-start gap-1.5 ${tones[tone]}`}>
      {icon}
      <span>{children}</span>
    </div>
  );
}
