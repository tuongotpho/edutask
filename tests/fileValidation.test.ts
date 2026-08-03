import { describe, it, expect } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  formatFileSize,
  isAcceptedType,
  sanitizeFileName,
  validateUpload,
} from '@/Edu-task/lib/fileValidation';

const file = (name: string, size: number, type: string) => ({ name, size, type });

describe('formatFileSize', () => {
  it('scales the unit to the size', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('does not produce NaN for bad input', () => {
    expect(formatFileSize(Number.NaN)).toBe('—');
    expect(formatFileSize(-1)).toBe('—');
  });
});

describe('isAcceptedType', () => {
  it('accepts any image and PDF', () => {
    expect(isAcceptedType('image/png')).toBe(true);
    expect(isAcceptedType('image/jpeg')).toBe(true);
    expect(isAcceptedType('image/heic')).toBe(true);
    expect(isAcceptedType('application/pdf')).toBe(true);
  });

  it('rejects executables, archives and empty types', () => {
    expect(isAcceptedType('application/x-msdownload')).toBe(false);
    expect(isAcceptedType('application/zip')).toBe(false);
    expect(isAcceptedType('')).toBe(false);
  });
});

describe('validateUpload', () => {
  it('accepts a normal medical certificate scan', () => {
    expect(validateUpload(file('giay-kham-benh.pdf', 250_000, 'application/pdf'))).toBeNull();
  });

  it('rejects a disallowed type and names the file', () => {
    const error = validateUpload(file('virus.exe', 100, 'application/x-msdownload'));
    expect(error).toContain('virus.exe');
    expect(error).toContain('không được hỗ trợ');
  });

  it('rejects a file over the limit', () => {
    const error = validateUpload(file('scan.pdf', MAX_UPLOAD_BYTES + 1, 'application/pdf'));
    expect(error).toContain('vượt giới hạn');
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateUpload(file('scan.pdf', MAX_UPLOAD_BYTES, 'application/pdf'))).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateUpload(file('rong.pdf', 0, 'application/pdf'))).toContain('rỗng');
  });
});

describe('sanitizeFileName', () => {
  it('keeps Vietnamese characters intact', () => {
    expect(sanitizeFileName('đơn xin nghỉ.pdf')).toBe('đơn_xin_nghỉ.pdf');
  });

  it('strips characters that would break a storage path', () => {
    expect(sanitizeFileName('a/b\\c?d%e*f:g|h"i<j>k#l[m]n.pdf')).not.toMatch(/[/\\?%*:|"<>#[\]]/);
  });

  it('collapses whitespace into underscores', () => {
    expect(sanitizeFileName('giay   kham   benh.pdf')).toBe('giay_kham_benh.pdf');
  });

  it('keeps the tail of an over-long name so the extension survives', () => {
    const long = 'x'.repeat(300) + '.pdf';
    const result = sanitizeFileName(long);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('never returns an empty string', () => {
    expect(sanitizeFileName('   ')).toBe('file');
  });
});
