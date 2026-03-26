import { Capacitor } from '@capacitor/core';
import { StorageProvider } from './provider';
import { CapacitorStorageProvider } from './capacitor';
import { WebStorageProvider } from './web';

export * from './provider';

export function getStorageProvider(): StorageProvider {
  if (Capacitor.isNativePlatform()) {
    return new CapacitorStorageProvider();
  }
  return new WebStorageProvider();
}
