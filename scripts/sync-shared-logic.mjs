import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Copies the app's pure domain logic into `functions/src/shared/`.
 *
 * The scheduled reminder function must decide "does this schedule fire today?"
 * and "what is coming due?" using EXACTLY the rules the browser uses. Writing a
 * second implementation in the functions package would guarantee the two drift,
 * and the failure mode is the worst kind: a reminder that the app says is due
 * tomorrow but the server sends today, with nobody able to say which is right.
 *
 * So the files are copied, never hand-maintained. The copy is regenerated on
 * every functions build and gitignored, which makes drift structurally
 * impossible rather than merely discouraged.
 *
 * Only files that are genuinely pure are listed. Anything touching React,
 * `firebase/*` client SDKs or the DOM must stay out — the functions runtime has
 * none of it.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'functions', 'src', 'shared');

/** Pure logic the functions need. Keep this list minimal and deliberate. */
const LIB_FILES = [
  'schedule.ts',
  'taskStatus.ts',
  'reminderSchedule.ts',
  'planProgress.ts',
];

/** Types are pure by construction, so the whole folder comes across. */
const TYPES_DIR = path.join(root, 'Edu-task', 'types');

function rewriteImports(source, fromDir) {
  // `@/Edu-task/lib/schedule` → a path relative to this file's new home.
  return source.replace(/from '@\/Edu-task\/([^']+)'/g, (_match, rest) => {
    const absolute = path.join(target, rest);
    let relative = path.relative(fromDir, absolute).replace(/\\/g, '/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    return `from '${relative}'`;
  });
}

rmSync(target, { recursive: true, force: true });
mkdirSync(path.join(target, 'lib'), { recursive: true });
mkdirSync(path.join(target, 'types'), { recursive: true });

const header = '// GENERATED — copied from the app by scripts/sync-shared-logic.mjs. Do not edit.\n';

for (const file of LIB_FILES) {
  const source = readFileSync(path.join(root, 'Edu-task', 'lib', file), 'utf8');
  const rewritten = rewriteImports(source, path.join(target, 'lib'));
  writeFileSync(path.join(target, 'lib', file), header + rewritten, 'utf8');
}

for (const file of readdirSync(TYPES_DIR).filter(name => name.endsWith('.ts'))) {
  const source = readFileSync(path.join(TYPES_DIR, file), 'utf8');
  const rewritten = rewriteImports(source, path.join(target, 'types'));
  writeFileSync(path.join(target, 'types', file), header + rewritten, 'utf8');
}

console.log(
  `[sync] copied ${LIB_FILES.length} lib files and ${readdirSync(TYPES_DIR).length} type files ` +
  'into functions/src/shared'
);
