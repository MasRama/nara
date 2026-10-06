export interface AssetStorageObject {
  data: Uint8Array;
  size: number;
}

export interface AssetStoragePutInput {
  key: string;
  data: Uint8Array;
  contentType: string;
}

/**
 * Minimal binary-object capability used by Features that own asset metadata.
 * Keys are provider-neutral logical identifiers, not filesystem paths or URLs.
 */
export interface AssetStorage {
  put(input: AssetStoragePutInput): Promise<void>;
  get(key: string): Promise<AssetStorageObject | undefined>;
  delete(key: string): Promise<boolean>;
}
