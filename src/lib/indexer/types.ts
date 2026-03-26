export interface NoteMetadata {
  id: string; // Filename without extension
  title: string;
  tags: string[];
  lastModified: number;
  snippet: string;
}

export interface IndexProvider {
  getNotes(): Promise<NoteMetadata[]>;
  updateNote(metadata: NoteMetadata): Promise<void>;
  deleteNote(id: string): Promise<void>;
  rebuildIndex(notes: { name: string; content: string; lastModified: number }[]): Promise<void>;
}
