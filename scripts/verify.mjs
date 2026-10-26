import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const nodeBinDir = path.dirname(process.execPath);

process.chdir(projectRoot);
process.env.PATH = `${nodeBinDir}:${process.env.PATH || ''}`;
process.env.HOME = '/tmp';
process.env.CI = 'true';
process.env.NG_CLI_ANALYTICS = 'false';

const mode = process.argv[2] || 'all';

if (mode === 'build' || mode === 'all') {
  console.log('=== Running Angular Production Build ===');
  execFileSync(
    process.execPath,
    [
      path.join(projectRoot, 'node_modules/@angular/cli/bin/ng.js'),
      'build',
      '--output-path=/tmp/luanti-map-explorer-dist'
    ],
    { stdio: 'inherit', cwd: projectRoot, env: process.env }
  );
}

if (mode === 'test' || mode === 'all') {
  console.log('=== Running Vitest Unit Tests ===');
  execFileSync(
    process.execPath,
    [path.join(projectRoot, 'node_modules/vitest/vitest.mjs'), 'run'],
    { stdio: 'inherit', cwd: projectRoot, env: process.env }
  );
}
