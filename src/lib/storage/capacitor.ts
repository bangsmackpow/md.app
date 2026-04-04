import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { StorageProvider, NoteFile } from './provider';
import { Capacitor } from '@capacitor/core';

export class CapacitorStorageProvider implements StorageProvider {
  private baseDir = 'md-app';

  setVault(vaultId: string): void {
    this.baseDir = `md-app/${vaultId}`;
  }
  
  // On Android, use External Storage to survive app uninstallation.
  // On iOS, Documents is the standard persistent location.
  private getDirectory(): Directory {
    return Capacitor.getPlatform() === 'android' ? Directory.External : Directory.Documents;
  }

  async listNotes(): Promise<NoteFile[]> {
    try {
      const result = await Filesystem.readdir({
        path: this.baseDir,
        directory: this.getDirectory(),
      });
      return result.files.filter(f => f.name.endsWith('.md')).map(f => ({
        name: f.name,
        lastModified: (f as any).mtime || Date.now(),
      }));
    } catch (e) {
      await this.ensureDirectory();
      return [];
    }
  }

  async readNote(name: string): Promise<string> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const contents = await Filesystem.readFile({
      path: `${this.baseDir}/${fileName}`,
      directory: this.getDirectory(),
      encoding: Encoding.UTF8,
    });
    return contents.data as string;
  }

  async writeNote(name: string, content: string): Promise<void> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    await Filesystem.writeFile({
      path: `${this.baseDir}/${fileName}`,
      data: content,
      directory: this.getDirectory(),
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  async deleteNote(name: string): Promise<void> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    await Filesystem.deleteFile({
      path: `${this.baseDir}/${fileName}`,
      directory: this.getDirectory(),
    });
  }

  async ensureDirectory(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: this.baseDir,
        directory: this.getDirectory(),
        recursive: true,
      });
    } catch (e) {
      // Directory likely already exists
    }
  }
}
