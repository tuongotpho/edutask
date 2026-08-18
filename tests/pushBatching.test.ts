import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Chia lô khi gửi thông báo đẩy.
 *
 * `sendEachForMulticast` refuses a list longer than 500 tokens — it throws
 * rather than truncating. `sendToTokens` used to hand it the whole school in one
 * call, and the throw was swallowed by the catch that exists to stop retries, so
 * a large school got silence plus one log line.
 *
 * The fake below reproduces that refusal exactly, which is the only way to prove
 * the batching is real: a version that ignored the limit would fail here the
 * same way production did.
 */

const FCM_LIMIT = 500;

const sendEachForMulticast = vi.fn();

/** Devices the fake Firestore will report; each test sets this. */
let registeredTokens: string[] = [];

vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../functions/src/firebase', () => ({
  getPushMessaging: () => ({ sendEachForMulticast }),
  getDb: () => ({
    collection: () => ({
      where: () => ({ get: async () => ({ docs: registeredTokens.map(t => ({ id: t })) }) }),
      doc: (id: string) => ({ id }),
    }),
    batch: () => ({ delete: vi.fn(), commit: async () => undefined }),
  }),
}));

const { sendToUsers } = await import('../functions/src/push');

/** Stands in for FCM: enforces the cap, reports every token as delivered. */
function acceptBatch({ tokens }: { tokens: string[] }) {
  if (tokens.length > FCM_LIMIT) {
    throw new Error(`tokens list must not contain more than ${FCM_LIMIT} items`);
  }
  return {
    successCount: tokens.length,
    responses: tokens.map(() => ({ success: true })),
  };
}

const PAYLOAD = { title: 'Nhắc việc', body: 'Có việc đến hạn' };

function tokens(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `tok_${i}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  sendEachForMulticast.mockImplementation(acceptBatch);
});

describe('gửi thông báo đẩy cho nhiều người', () => {
  it('gửi một lô duy nhất khi trường còn nhỏ', async () => {
    registeredTokens = tokens(120);

    const delivered = await sendToUsers(['u1'], PAYLOAD);

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(delivered).toBe(120);
  });

  it('chia lô khi vượt 500 thiết bị, thay vì hỏng im lặng', async () => {
    registeredTokens = tokens(1250);

    const delivered = await sendToUsers(['u1'], PAYLOAD);

    // 1250 = 500 + 500 + 250
    const sizes = sendEachForMulticast.mock.calls.map(([msg]) => msg.tokens.length);
    expect(sizes).toEqual([500, 500, 250]);

    // The whole point: every device is reached, not zero.
    expect(delivered).toBe(1250);
  });

  it('đúng 500 thiết bị vẫn chỉ một lô', async () => {
    registeredTokens = tokens(FCM_LIMIT);

    const delivered = await sendToUsers(['u1'], PAYLOAD);

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(delivered).toBe(FCM_LIMIT);
  });

  it('một lô hỏng không kéo đổ các lô còn lại', async () => {
    registeredTokens = tokens(1000);
    sendEachForMulticast
      .mockImplementationOnce(() => { throw new Error('mạng chập chờn'); })
      .mockImplementation(acceptBatch);

    const delivered = await sendToUsers(['u1'], PAYLOAD);

    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(delivered).toBe(500);
  });

  it('không gọi FCM khi không có thiết bị nào', async () => {
    registeredTokens = [];

    const delivered = await sendToUsers(['u1'], PAYLOAD);

    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(delivered).toBe(0);
  });
});
