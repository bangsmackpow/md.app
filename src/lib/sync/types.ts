export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict';

export interface SyncConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface SyncProvider {
  upload(name: string, content: string, config: SyncConfig): Promise<void>;
  download(name: string, config: SyncConfig): Promise<string>;
  listRemote(config: SyncConfig): Promise<string[]>;
}
