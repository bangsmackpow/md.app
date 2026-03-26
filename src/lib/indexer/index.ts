import { IndexProvider } from './types';
import { JsonIndexProvider } from './json';

export * from './types';

export function getIndexProvider(): IndexProvider {
  // For now we only have one, but we could add SQLiteIndexProvider here later.
  return new JsonIndexProvider();
}
