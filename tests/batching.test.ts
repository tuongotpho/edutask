import { describe, expect, it, vi } from 'vitest';
import { chunk, runInBatches } from '@/Edu-task/lib/batching';

/**
 * Chia lô khi gửi thông báo đẩy.
 *
 * Nhu cầu có thật: `sendEachForMulticast` của FCM TỪ CHỐI danh sách quá 500
 * token — nó ném lỗi chứ không cắt bớt. `sendToTokens` từng đưa cả trường vào
 * một lời gọi, rồi khối catch (vốn sinh ra để chặn việc gửi lặp) nuốt gọn lỗi,
 * nên một trường đủ lớn nhận được sự im lặng kèm một dòng log.
 *
 * Bài test này cố ý KHÔNG import mã trong `functions/`: gói đó có node_modules
 * riêng và bị loại khỏi tsconfig gốc, nên import từ đây sẽ kéo nó vào chương
 * trình TypeScript — chạy ngon trên máy lập trình viên và vỡ trên CI.
 */

const FCM_LIMIT = 500;

describe('chunk', () => {
  it('cắt đúng kích thước, phần dư nằm ở lô cuối', () => {
    expect(chunk(Array.from({ length: 1250 }, (_, i) => i), FCM_LIMIT).map(b => b.length))
      .toEqual([500, 500, 250]);
  });

  it('đúng ngưỡng thì vẫn một lô', () => {
    expect(chunk(Array.from({ length: FCM_LIMIT }, (_, i) => i), FCM_LIMIT)).toHaveLength(1);
  });

  it('mảng rỗng cho ra không lô nào', () => {
    expect(chunk([], FCM_LIMIT)).toEqual([]);
  });

  it('không nhận kích thước lô vô nghĩa', () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow(RangeError);
  });
});

describe('runInBatches', () => {
  /** Đóng vai FCM: thực thi đúng ngưỡng 500, báo mọi token đều tới nơi. */
  function fakeSend(batch: number[]): Promise<number> {
    if (batch.length > FCM_LIMIT) {
      return Promise.reject(new Error(`tokens list must not contain more than ${FCM_LIMIT} items`));
    }
    return Promise.resolve(batch.length);
  }

  it('chia lô khi vượt 500 thiết bị, thay vì hỏng im lặng', async () => {
    const run = vi.fn(fakeSend);
    const tokens = Array.from({ length: 1250 }, (_, i) => i);

    const delivered = await runInBatches(tokens, FCM_LIMIT, run);

    expect(run.mock.calls.map(([b]) => b.length)).toEqual([500, 500, 250]);
    // Điểm mấu chốt: tới được tất cả, không phải con số không.
    expect(delivered).toBe(1250);
  });

  it('trường nhỏ thì chỉ một lô', async () => {
    const run = vi.fn(fakeSend);
    const delivered = await runInBatches(Array.from({ length: 120 }, (_, i) => i), FCM_LIMIT, run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(delivered).toBe(120);
  });

  it('một lô hỏng không kéo đổ các lô còn lại', async () => {
    const run = vi.fn()
      .mockRejectedValueOnce(new Error('mạng chập chờn'))
      .mockImplementation(fakeSend);
    const errors: unknown[] = [];

    const delivered = await runInBatches(
      Array.from({ length: 1000 }, (_, i) => i),
      FCM_LIMIT,
      run,
      err => errors.push(err)
    );

    expect(run).toHaveBeenCalledTimes(2);
    expect(delivered).toBe(500);
    expect(errors).toHaveLength(1);
  });

  it('báo lỗi kèm đúng lô đã hỏng, để log truy được', async () => {
    const seen: number[] = [];
    await runInBatches(
      Array.from({ length: 700 }, (_, i) => i),
      FCM_LIMIT,
      () => Promise.reject(new Error('hỏng')),
      (_err, batch) => seen.push(batch.length)
    );
    expect(seen).toEqual([500, 200]);
  });

  it('không có thiết bị nào thì không gọi gì cả', async () => {
    const run = vi.fn(fakeSend);
    const delivered = await runInBatches([], FCM_LIMIT, run);

    expect(run).not.toHaveBeenCalled();
    expect(delivered).toBe(0);
  });

  it('chạy tuần tự, không bắn song song', async () => {
    let dangChay = 0;
    let dinhNhau = false;
    const run = async (batch: number[]) => {
      dangChay += 1;
      if (dangChay > 1) dinhNhau = true;
      await new Promise(r => setTimeout(r, 5));
      dangChay -= 1;
      return batch.length;
    };

    await runInBatches(Array.from({ length: 1500 }, (_, i) => i), FCM_LIMIT, run);

    expect(dinhNhau).toBe(false);
  });
});
