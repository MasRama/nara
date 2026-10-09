import type { MaintenanceTask } from '../../../shared/database';
import { assetStorageKey } from './assets-routes';
import { deleteUserAsset, findAssetOwnerIds, findUserAssets } from './assets';
import type { UsersServerHost } from './host';

const ORPHANED_ASSETS_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Deleting accounts commits before their avatars are cleaned up, so a crash in
 * between leaves assets nobody owns. Ownership is asked of the host, never read
 * from Auth's tables.
 */
export function createUsersMaintenance(host: Pick<UsersServerHost, 'findAccountById' | 'assetStorage'>): readonly MaintenanceTask[] {
  return [
    {
      name: 'orphaned-assets',
      everyMs: ORPHANED_ASSETS_INTERVAL_MS,
      run: () => {
        let removed = 0;
        for (const ownerId of findAssetOwnerIds()) {
          if (host.findAccountById(ownerId)) continue;
          for (const asset of findUserAssets(ownerId)) {
            if (!deleteUserAsset(asset.id)) continue;
            removed += 1;
            // The row is gone, so the URL is refused; the binary is best-effort.
            const storageKey = assetStorageKey(asset);
            if (storageKey) void host.assetStorage.delete(storageKey).catch(() => false);
          }
        }
        return removed > 0 ? { removed } : undefined;
      },
    },
  ];
}
