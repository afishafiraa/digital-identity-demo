import { readConfig } from '../src/server/core/config.ts';

try {
  const config = readConfig();
  console.log('Configuration valid.');
  console.log(`Credential services configured: ${Object.keys(config.services).length}/3. Validate exchange compatibility with npm run proof:integration.`);
} catch {
  console.error('Configuration invalid. Check environment variable formats in .env.example; values are intentionally omitted.');
  process.exitCode = 1;
}
