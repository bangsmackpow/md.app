import { Preferences } from '@capacitor/preferences';
import { IndexProvider, NoteMetadata } from './types';

export class JsonIndexProvider implements IndexProvider {
  private storageKey = 'md-app-index';

  setVault(vaultId: string): void {
    this.storageKey = `md-app-index:${vaultId}`;
  }

  async getNotes(): Promise<NoteMetadata[]> {
    const { value } = await Preferences.get({ key: this.storageKey });
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch (e) {
      return [];
    }
  }

  async updateNote(metadata: NoteMetadata): Promise<void> {
    const notes = await this.getNotes();
    const existingIndex = notes.findIndex(n => n.id === metadata.id);
    if (existingIndex > -1) {
      notes[existingIndex] = metadata;
    } else {
      notes.push(metadata);
    }
    await this.saveIndex(notes);
  }

  async deleteNote(id: string): Promise<void> {
    const notes = await this.getNotes();
    const filtered = notes.filter(n => n.id !== id);
    await this.saveIndex(filtered);
  }

  async rebuildIndex(notes: { name: string; content: string; lastModified: number }[]): Promise<void> {
    const metadata: NoteMetadata[] = notes.map(n => this.parseNote(n.name, n.content, n.lastModified));
    await this.saveIndex(metadata);
  }

  private async saveIndex(notes: NoteMetadata[]): Promise<void> {
    await Preferences.set({ key: this.storageKey, value: JSON.stringify(notes) });
  }

  private parseNote(name: string, content: string, lastModified: number): NoteMetadata {
    const id = name.replace('.md', '');
    const lines = content.split('\n');
    const h1Line = lines.find(l => l.startsWith('# '));
    const title = h1Line ? h1Line.replace('# ', '').trim() : id;
    
    // Simple tag extraction #tag
    const tags = Array.from(content.matchAll(/#(\w+)/g)).map(m => m[1]);
    
    const snippet = content.replace(/^# .*\n?/, '').substring(0, 100).trim();

    return {
      id,
      title,
      tags: [...new Set(tags)],
      lastModified,
      snippet,
      content: content.substring(0, 10000) // Index up to 10kb
    };
  }
}
