import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { serviceClient } from '../src/server/core/transport.ts';
import { isRecord } from '../src/server/core/validation.ts';

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected service object');
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Expected service string');
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Expected service list');
  return value.map((entry: unknown) => string(entry));
}
const wallet = serviceClient({ url: 'http://127.0.0.1:7006' });
const issuer = serviceClient({ url: 'http://127.0.0.1:7005' });
const verifier = serviceClient({ url: 'http://127.0.0.1:7004' });
let step = 'create wallet';
try {
  const created = await wallet({ path: '/wallet', method: 'POST', body: {}, decode: record });
  const walletId = string(created['walletId']);
  step = 'generate holder key';
  await wallet({ path: `/wallet/${walletId}/keys/generate`, method: 'POST', body: { backend: 'jwk', keyType: 'secp256r1' }, decode: record });
  step = 'create offer';
  const offer = await issuer({ path: '/issuer2/credential-offers', method: 'POST', body: { profileId: 'training', authMethod: 'PRE_AUTHORIZED' }, decode: record });
  step = 'receive credential';
  const received = await wallet({ path: `/wallet/${walletId}/credentials/receive`, method: 'POST', body: { offerUrl: string(offer['credentialOffer']) }, decode: record, timeoutMs: 30000 });
  const credentialIds = strings(received['credentialIds']);
  if (credentialIds.length !== 1) throw new Error('Expected one received credential');
  step = 'create verifier request';
  const request = await verifier({ path: '/verification-session/create', method: 'POST', body: {
    flow_type: 'cross_device',
    core_flow: {
      dcql_query: { credentials: [{ id: 'training', format: 'dc+sd-jwt', meta: { vct_values: ['urn:diw:training:1'] } }] },
      policies: { vc_policies: [{ policy: 'signature' }] },
    },
  }, decode: record });
  const requestId = string(request['sessionId']);
  step = 'present credential';
  const presented = await wallet({ path: `/wallet/${walletId}/credentials/present`, method: 'POST', body: { requestUrl: string(request['bootstrapAuthorizationRequestUrl']) }, decode: record, timeoutMs: 30000 });
  if (presented['transmission_success'] !== true) throw new Error('Presentation not delivered');
  step = 'poll real verifier';
  let result: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 30; attempt++) {
    result = await verifier({ path: `/verification-session/${requestId}/info`, decode: record });
    if (result['status'] === 'SUCCESSFUL' || result['status'] === 'FAILED') break;
    await delay(500);
  }
  const policies = record(result['policy_results']);
  if (result['status'] !== 'SUCCESSFUL' || policies['overallSuccess'] !== true) throw new Error('Verifier did not confirm success');
  const evidence = {
    checkedAt: new Date().toISOString(), release: '1.2.1', profile: 'training', format: 'dc+sd-jwt',
    vct: 'urn:diw:training:1', algorithm: 'ES256', walletId, credentialIds, requestId,
    status: result['status'], overallSuccess: policies['overallSuccess'], policyResults: policies,
  };
  mkdirSync('.local/evidence', { recursive: true, mode: 0o700 });
  writeFileSync('.local/evidence/integration.json', JSON.stringify(evidence, null, 2), { mode: 0o600 });
  console.log('PASS: real training credential issued, stored, presented, and verified. Evidence saved privately.');
} catch (error) {
  console.error(`Integration proof failed during: ${step}. ${error instanceof Error ? error.message : 'Unexpected error'}`);
  process.exitCode = 1;
}
