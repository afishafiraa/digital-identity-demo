export interface StoredCredentialView {
  id: string;
  issuer: string;
  issuerId: string;
  holderName: string;
  course: string;
  completionDate: string;
  addedAt: string | null;
  issuedAt: string | null;
  notBefore: string | null;
  expiresAt: string | null;
}

export function parseCredentials(value: unknown): StoredCredentialView[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Unexpected wallet response');
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) throw new Error('Invalid credential');
    const record = entry;
    function text(key: keyof StoredCredentialView): string {
      const field: unknown = Reflect.get(record, key);
      if (typeof field !== 'string' || !field || field.length > (key === 'issuerId' ? 2048 : 256)) throw new Error('Invalid credential field');
      return field;
    }
    function date(key: keyof StoredCredentialView): string | null {
      const field: unknown = Reflect.get(record, key);
      if (field === null) return null;
      if (typeof field !== 'string' || !Number.isFinite(Date.parse(field))) throw new Error('Invalid credential date');
      return field;
    }
    const id = text('id');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || ids.has(id)) throw new Error('Invalid credential ID');
    ids.add(id);
    return { id, issuer: text('issuer'), issuerId: text('issuerId'), holderName: text('holderName'), course: text('course'),
      completionDate: text('completionDate'), addedAt: date('addedAt'), issuedAt: date('issuedAt'),
      notBefore: date('notBefore'), expiresAt: date('expiresAt') };
  });
}
