export interface NoteFile {
  name: string;
  lastModified: number;
}

export interface StorageProvider {
  listNotes(): Promise<NoteFile[]>;
  readNote(name: string): Promise<string>;
  writeNote(name: string, content: string): Promise<void>;
  deleteNote(name: string): Promise<void>;
  ensureDirectory(): Promise<void>;
}
