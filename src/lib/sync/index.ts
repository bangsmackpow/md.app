import { SyncProvider } from './types';
import { S3SyncProvider } from './s3';

export * from './types';

export function getSyncProvider(): SyncProvider {
  return new S3SyncProvider();
}
