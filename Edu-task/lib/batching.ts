/**
 * Chạy một việc theo từng lô, tuần tự, và một lô hỏng không kéo đổ phần còn lại.
 *
 * Viết ở đây — thuần, không phụ thuộc gì — vì hai lý do.
 *
 * Thứ nhất, đây là chỗ logic dùng chung của dự án sống, và `sync-shared-logic.mjs`
 * chép nó sang cho Cloud Functions. Thứ hai, nó test được mà không cần dựng
 * firebase-admin: gói `functions/` có node_modules riêng và cố ý bị loại khỏi
 * tsconfig gốc, nên một bài test ở gốc mà import thẳng mã trong `functions/`
 * sẽ kéo cả gói đó vào chương trình TypeScript — chạy ngon trên máy lập trình
 * viên (nơi node_modules của functions tình cờ đã có) và vỡ trên CI ở một bản
 * checkout sạch.
 *
 * Nhu cầu ban đầu là FCM: `sendEachForMulticast` TỪ CHỐI danh sách quá 500
 * token — nó ném lỗi chứ không cắt bớt — nên gửi cả trường trong một lời gọi là
 * không ai nhận được gì, im lặng.
 */

/** Cắt mảng thành các lô không quá `size` phần tử. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new RangeError('size phải >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Chạy `run` trên từng lô rồi cộng kết quả.
 *
 * Tuần tự chứ không song song: việc dùng nó (đẩy thông báo toàn trường) không
 * gấp gáp, còn bắn mọi lô cùng lúc là cách biến một cơn bùng nổ thành bị bóp
 * lưu lượng.
 *
 * Lô nào ném lỗi thì tính 0 và đi tiếp — mất một lô vẫn hơn là mất tất cả vì
 * một lô. Lỗi được đưa ra ngoài qua `onBatchError` thay vì nuốt, để nơi gọi tự
 * quyết ghi log thế nào.
 */
export async function runInBatches<T>(
  items: T[],
  size: number,
  run: (batch: T[]) => Promise<number>,
  onBatchError?: (err: unknown, batch: T[]) => void
): Promise<number> {
  let total = 0;
  for (const batch of chunk(items, size)) {
    try {
      total += await run(batch);
    } catch (err) {
      onBatchError?.(err, batch);
    }
  }
  return total;
}
