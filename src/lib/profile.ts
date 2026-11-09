export interface PublicKeyView { kty: 'EC'; crv: 'P-256'; x: string; y: string }
export interface IdentityProfile {
  walletId: string;
  keys: { id: string; type: string }[];
  credentialId: string | null;
  issuerDid: string | null;
  issuerPublicKey: PublicKeyView | null;
  holderPublicKey: PublicKeyView | null;
  holderThumbprint: string | null;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error('Invalid profile');
  return value;
}
export function publicKey(value: unknown): PublicKeyView {
  const key = object(value);
  if ('d' in key) throw new Error('Private key is not a public profile');
  if (key['kty'] !== 'EC' || key['crv'] !== 'P-256' || typeof key['x'] !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key['x']) || typeof key['y'] !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key['y'])) throw new Error('Unsupported public key');
  // Explicit whitelist: never forward private JWK members or arbitrary upstream fields.
  return { kty: 'EC', crv: 'P-256', x: key['x'], y: key['y'] };
}
export function parseProfile(value: unknown): IdentityProfile {
  const row = object(value);
  function text(key: string): string {
    const entry = row[key];
    if (typeof entry !== 'string' || !entry || entry.length > 2048) throw new Error('Invalid profile field');
    return entry;
  }
  function optionalText(key: string): string | null { return row[key] === null ? null : text(key); }
  const keys = row['keys'];
  if (!Array.isArray(keys) || keys.length > 100) throw new Error('Invalid wallet keys');
  return { walletId: text('walletId'), keys: keys.map((entry: unknown) => {
    const key = object(entry);
    if (typeof key['id'] !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(key['id']) || key['type'] !== 'secp256r1') throw new Error('Invalid wallet key');
    return { id: key['id'], type: key['type'] };
  }), credentialId: optionalText('credentialId'), issuerDid: optionalText('issuerDid'),
    issuerPublicKey: row['issuerPublicKey'] === null ? null : publicKey(row['issuerPublicKey']),
    holderPublicKey: row['holderPublicKey'] === null ? null : publicKey(row['holderPublicKey']), holderThumbprint: optionalText('holderThumbprint') };
}
