// Starts Vitest with a normalised working directory.
//
// On Windows, a terminal opened at `d:\...` (VS Code does this) makes Node
// load Vitest twice, once per drive-letter case, and every suite fails with
// "Vitest failed to find the current suite". Restarting Vitest from the
// upper-case path avoids it. On other platforms this just runs Vitest.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const upperDrive = (path) =>
  path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

const require = createRequire(import.meta.url);
const vitestPackage = require.resolve('vitest/package.json');
const vitestCli = vitestPackage.replace(/package\.json$/, 'vitest.mjs');

const { status, error } = spawnSync(
  process.execPath,
  [upperDrive(vitestCli), ...process.argv.slice(2)],
  { cwd: upperDrive(process.cwd()), stdio: 'inherit' },
);

if (error) throw error;
process.exit(status ?? 1);
