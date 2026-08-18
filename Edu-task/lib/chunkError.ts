/**
 * Telling "the code did not download" apart from "the code ran and threw".
 *
 * This decides what ChunkErrorBoundary does with an error it catches, and the
 * two mistakes are not symmetrical:
 *
 *  - Treating a real bug as a download failure shows "kiểm tra kết nối mạng" for
 *    a null-pointer, sending someone to check their wifi over a code defect and
 *    burying the stack trace that would have fixed it.
 *  - Treating a download failure as a real bug re-throws it, and the tab goes
 *    blank again — the exact behaviour the boundary exists to remove.
 *
 * So the test stays narrow and explicit: only the shapes webpack and the browser
 * actually produce for a failed module fetch count. Anything unrecognised is
 * assumed to be a genuine error and re-thrown, because a visible crash is easier
 * to diagnose than a wrong explanation.
 */

/** Error names browsers and webpack use for a module that never arrived. */
const CHUNK_ERROR_NAMES = new Set(['ChunkLoadError']);

/**
 * Message shapes for the same thing. `Failed to fetch` is included because a
 * `import()` rejected by the network surfaces as a bare TypeError with that
 * message and no useful name.
 */
const CHUNK_ERROR_MESSAGES = [
  /Loading chunk \S+ failed/i,
  /Loading CSS chunk/i,
  /error loading dynamically imported module/i,
  /Failed to fetch dynamically imported module/i,
  /^Failed to fetch$/i,
  /^NetworkError when attempting to fetch resource/i,
];

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const { name, message } = error as { name?: unknown; message?: unknown };

  if (typeof name === 'string' && CHUNK_ERROR_NAMES.has(name)) return true;
  if (typeof message !== 'string') return false;

  return CHUNK_ERROR_MESSAGES.some(pattern => pattern.test(message));
}
