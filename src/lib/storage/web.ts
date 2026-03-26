import { StorageProvider, NoteFile } from './provider';

export class WebStorageProvider implements StorageProvider {
  private prefix = 'md-app-note:';

  async listNotes(): Promise<NoteFile[]> {
    const notes: NoteFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        notes.push({
          name: key.replace(this.prefix, ''),
          lastModified: Date.now(), // Web storage doesn't track this easily, but for local-first we index it later.
        });
      }
    }
    return notes;
  }

  async readNote(name: string): Promise<string> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const key = `${this.prefix}${fileName}`;
    return localStorage.getItem(key) || '';
  }

  async writeNote(name: string, content: string): Promise<void> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const key = `${this.prefix}${fileName}`;
    localStorage.setItem(key, content);
  }

  async deleteNote(name: string): Promise<void> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const key = `${this.prefix}${fileName}`;
    localStorage.removeItem(key);
  }

  async ensureDirectory(): Promise<void> {
    // No-op for localStorage
  }
}
