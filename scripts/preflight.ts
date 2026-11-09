import { spawnSync } from 'node:child_process';

const checks = [
  { name: 'npm registry access', command: 'npm', args: ['ping', '--fetch-retries=0', '--fetch-timeout=10000', '--cache', '.local/npm-cache', '--loglevel=silent'] },
  { name: 'Docker daemon access', command: 'docker', args: ['info', '--format', '{{.ServerVersion}}'] },
  { name: 'Docker Compose', command: 'docker', args: ['compose', 'version'] },
];
for (const check of checks) {
  const result = spawnSync(check.command, check.args, { stdio: 'ignore', timeout: 15000 });
  const pass = result.status === 0;
  console.log(`${pass ? 'PASS' : 'BLOCKED'}: ${check.name}`);
  if (!pass) process.exitCode = 1;
}
console.log('This preflight does not create containers, wallets, keys, or credentials.');
