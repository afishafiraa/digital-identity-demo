import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.local/walt-config');
function config(service: string, name: string, value: unknown): void {
  const dir = join(root, service);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `${name}.conf`);
  // Never rotate an existing issuer's keys as a side effect of rerunning setup.
  if (!existsSync(file)) writeFileSync(file, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  chmodSync(file, 0o600);
}

for (const [service, port] of [['issuer', 7005], ['wallet', 7006], ['verifier', 7004]] as const) {
  config(service, 'web', { webHost: '0.0.0.0', webPort: port });
  config(service, '_features', { enabledFeatures: service === 'wallet' ? ['wallet2-persistence'] : [], disabledFeatures: [] });
  config(service, 'network-fetch-guard', { allowLoopback: false, allowPrivateNetworks: true, trustedHostSuffixes: [] });
}
config('wallet', 'wallet-service', { publicBaseUrl: 'http://wallet:7006' });
config('wallet', 'wallet2-persistence', { jdbcUrl: 'jdbc:sqlite:data/wallet2.db', driverClassName: 'org.sqlite.JDBC', maximumPoolSize: 1, minimumIdle: 1 });
config('verifier', 'verifier-service', {
  urlPrefix: 'http://verifier:7004/verification-session', urlHost: 'openid4vp://authorize',
  clientMetadata: { client_name: 'Harbor Works' },
});

if (!existsSync(join(root, 'issuer', 'issuer2-profiles.conf'))) {
  const signing = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const issuerKey = { type: 'jwk', jwk: signing.privateKey.export({ format: 'jwk' }) };
  const issuerDid = `did:jwk:${Buffer.from(JSON.stringify(signing.publicKey.export({ format: 'jwk' }))).toString('base64url')}`;
  config('issuer', 'issuer2-profiles', { profiles: {
    training: {
      name: 'Training Certificate', credentialConfigurationId: 'training', issuerKey, issuerDid,
      credentialData: { holder_name: 'Alex Morgan', course: 'Cloud Foundations', completion_date: '2026-10-15', issuer_name: 'Northstar Learning' },
      mapping: { id: '<uuid>', iat: '<timestamp-seconds>', nbf: '<timestamp-seconds>', exp: '<timestamp-in-seconds:365d>' },
    },
  } });
}
if (!existsSync(join(root, 'issuer', 'issuer-service.conf'))) {
  const token = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  config('issuer', 'issuer-service', { baseUrl: 'http://issuer:7005', enforcePushedAuthorizationRequests: false, ciTokenKey: JSON.stringify({ type: 'jwk', jwk: token.privateKey.export({ format: 'jwk' }) }) });
}
config('issuer', 'credential-issuer-metadata', {
  issuerDisplay: [{ name: 'Northstar Learning', locale: 'en' }],
  credentialConfigurations: { training: {
    format: 'dc+sd-jwt', scope: 'training', vct: 'urn:diw:training:1',
    credential_signing_alg_values_supported: ['ES256'], cryptographic_binding_methods_supported: ['jwk'],
    proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['ES256'] } },
    credential_metadata: { display: [{ name: 'Training Certificate', locale: 'en' }] },
  } },
});
console.log('Local service configuration prepared. Private keys remain in ignored .local storage.');
