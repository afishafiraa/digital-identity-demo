import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = '.next/standalone';
if (!existsSync(root)) throw new Error('Build the app before checking the standalone artifact');
const forbidden = new Set(['.env.local', 'coordination.sqlite', 'wallet2.db', 'issuer2-profiles.conf']);
function inspect(path: string): void {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (forbidden.has(entry.name)) throw new Error('Private runtime material found in standalone output');
    if (path === root && ['.local', 'research', 'test', 'pocs'].includes(entry.name)) throw new Error('Private or non-runtime project files found in standalone output');
    if (entry.isDirectory()) inspect(join(path, entry.name));
  }
}
inspect(root);
console.log('PASS: standalone artifact excludes private research, runtime databases, environment files, and issuer profile keys.');
