import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '@/Edu-task/lib/chunkError';

/**
 * Phân biệt "không tải được mã" với "mã chạy rồi lỗi".
 *
 * ChunkErrorBoundary hỏi hàm này để quyết định: hiện màn hình "thử lại", hay ném
 * tiếp cho lỗi lộ ra như nó vốn là. Hai kiểu sai lệch nhau về hậu quả, nên cả
 * hai chiều đều phải được ghim:
 *
 *  - Nhận nhầm lỗi thật thành lỗi mạng → người dùng đi kiểm tra wifi vì một lỗi
 *    lập trình, còn stack trace thì bị nuốt.
 *  - Nhận nhầm lỗi mạng thành lỗi thật → tab lại trắng, đúng thứ boundary sinh
 *    ra để dẹp.
 */

function errorWith(name: string, message: string): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe('nhận diện lỗi không tải được chunk', () => {
  it('nhận ChunkLoadError của webpack theo tên', () => {
    expect(isChunkLoadError(errorWith('ChunkLoadError', 'Loading chunk 537 failed.'))).toBe(true);
  });

  it('nhận theo nội dung dù tên đã bị mất', () => {
    expect(isChunkLoadError(errorWith('Error', 'Loading chunk 193 failed.'))).toBe(true);
  });

  it('nhận lỗi chunk CSS', () => {
    expect(isChunkLoadError(errorWith('Error', 'Loading CSS chunk 12 failed.'))).toBe(true);
  });

  it('nhận lỗi import động của trình duyệt', () => {
    expect(
      isChunkLoadError(errorWith('TypeError', 'Failed to fetch dynamically imported module: /x.js'))
    ).toBe(true);
    expect(
      isChunkLoadError(errorWith('TypeError', 'error loading dynamically imported module'))
    ).toBe(true);
  });

  it('nhận TypeError trần của fetch hỏng', () => {
    expect(isChunkLoadError(errorWith('TypeError', 'Failed to fetch'))).toBe(true);
  });
});

describe('KHÔNG được nhận nhầm lỗi thật', () => {
  it('bỏ qua lỗi lập trình thường gặp', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isChunkLoadError(new RangeError('Maximum call stack size exceeded'))).toBe(false);
    expect(isChunkLoadError(errorWith('Error', 'Không lưu được lên máy chủ.'))).toBe(false);
  });

  it('bỏ qua lỗi Firestore — đó là chuyện của lớp dữ liệu, không phải của tab', () => {
    expect(
      isChunkLoadError(errorWith('FirebaseError', 'Missing or insufficient permissions.'))
    ).toBe(false);
  });

  it('không bị đánh lừa bởi chữ "fetch" nằm giữa câu', () => {
    // Chỉ khớp khi ĐÚNG là "Failed to fetch", không phải mọi câu có chữ đó.
    expect(isChunkLoadError(errorWith('Error', 'Failed to fetch user profile from cache'))).toBe(false);
  });

  it('chịu được giá trị rác mà không văng', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError('Loading chunk 1 failed')).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
    expect(isChunkLoadError({ name: 123, message: 456 })).toBe(false);
  });
});
