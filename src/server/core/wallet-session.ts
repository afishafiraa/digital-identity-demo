import type { SessionStore } from './session.ts';
import type { WalletGateway } from './wallet-gateway.ts';

export type WalletSession = { state: 'active' } | { state: 'provisioning' };
export async function provisionWallet(store: SessionStore, token: string, gateway: WalletGateway): Promise<WalletSession> {
  const binding = store.allocateWallet(token);
  if (binding.phase === 'ready' && binding.walletId) {
    await gateway.inspect(binding.walletId, binding.storeId);
    return { state: 'active' };
  }
  if (binding.phase === 'creating') {
    const found = await gateway.find(binding.storeId);
    if (!found) return { state: 'provisioning' };
    store.completeWallet(token, found);
    return { state: 'active' };
  }
  await gateway.ensureStores(binding.storeId);
  if (!store.claimWalletCreation(token)) return { state: 'provisioning' };
  // Once dispatched, a failed/ambiguous create is reconciled rather than retried.
  const walletId = await gateway.create(binding.storeId);
  await gateway.inspect(walletId, binding.storeId);
  store.completeWallet(token, walletId);
  return { state: 'active' };
}
