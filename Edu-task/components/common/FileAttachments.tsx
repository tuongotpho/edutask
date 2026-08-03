'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileText, ImageIcon, X, Loader2, Download } from 'lucide-react';
import { AttachmentFile } from '@/Edu-task/types/leave';
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, formatFileSize, validateUpload } from '@/Edu-task/lib/fileValidation';

interface FileAttachmentsProps {
  label: string;
  hint?: string;
  files: AttachmentFile[];
  /** Upload one file and return its stored metadata. */
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<AttachmentFile>;
  onRemove?: (file: AttachmentFile) => void | Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

function FileIcon({ type }: { type: string }) {
  return type.startsWith('image/')
    ? <ImageIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
    : <FileText className="w-4 h-4 text-rose-500 flex-shrink-0" />;
}

/**
 * Pick, upload and list attachments. Uploads run immediately on selection so the
 * caller only ever persists metadata for bytes that already landed in the bucket
 * — a form submit can never reference a half-uploaded file.
 */
export function FileAttachments({
  label,
  hint,
  files,
  onUpload,
  onRemove,
  onError,
  disabled = false,
  readOnly = false,
}: FileAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Record<string, number>>({});

  const busy = Object.keys(uploading).length > 0;

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;

    for (const file of Array.from(selected)) {
      const validationError = validateUpload(file);
      if (validationError) {
        onError(validationError);
        continue;
      }

      setUploading(prev => ({ ...prev, [file.name]: 0 }));
      try {
        await onUpload(file, percent => {
          setUploading(prev => ({ ...prev, [file.name]: percent }));
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : `Tải "${file.name}" thất bại.`);
      } finally {
        setUploading(prev => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    }

    // Allow re-picking the same file after a failure.
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block font-bold text-slate-800">{label}</label>
        <span className="text-[10px] text-slate-400">
          Ảnh hoặc PDF · tối đa {formatFileSize(MAX_UPLOAD_BYTES)}
        </span>
      </div>

      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            disabled={disabled || busy}
            onChange={e => handleFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 hover:border-indigo-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <Loader2 className="w-5 h-5 mx-auto text-indigo-500 mb-1 animate-spin" />
            ) : (
              <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
            )}
            <span className="block text-slate-600 font-medium">
              {busy ? 'Đang tải lên…' : 'Nhấp để chọn file đính kèm'}
            </span>
            {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
          </button>
        </>
      )}

      {/* In-flight uploads */}
      {Object.entries(uploading).map(([name, percent]) => (
        <div key={name} className="mt-2 p-2 rounded-xl bg-indigo-50 border border-indigo-200">
          <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900 mb-1">
            <span className="truncate pr-2">{name}</span>
            <span className="flex-shrink-0">{percent}%</span>
          </div>
          <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ))}

      {/* Stored files */}
      {files.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {files.map(file => (
            <li
              key={file.id}
              className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-[11px]"
            >
              <FileIcon type={file.type} />
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 font-semibold text-slate-800 hover:text-indigo-700 hover:underline truncate"
                title={file.name}
              >
                {file.name}
              </a>
              <span className="text-slate-400 flex-shrink-0">{file.size}</span>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Tải xuống ${file.name}`}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              {!readOnly && onRemove && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(file)}
                  aria-label={`Xóa ${file.name}`}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex-shrink-0 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        readOnly && <p className="mt-2 text-[11px] text-slate-400 italic">Không có file đính kèm.</p>
      )}
    </div>
  );
}
