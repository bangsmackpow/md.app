"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Edit3, Eye, Save, Plus, ChevronLeft, 
  FileText, Trash2, CheckSquare, Heading, Type 
} from "lucide-react";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

type ViewState = "list" | "editor";

export default function MdApp() {
  const [view, setView] = useState<ViewState>("list");
  const [editMode, setEditMode] = useState<"edit" | "preview">("edit");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  
  // Slash Menu States
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const result = await Filesystem.readdir({
        path: 'md-app',
        directory: Directory.Documents,
      });
      setNotes(result.files.map(f => f.name).filter(n => n.endsWith('.md')));
    } catch (e) {
      await Filesystem.mkdir({ path: 'md-app', directory: Directory.Documents, recursive: true });
      setNotes([]);
    }
  };

  const openNote = async (name: string) => {
    const contents = await Filesystem.readFile({
      path: `md-app/${name}`,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    setFileName(name.replace('.md', ''));
    setContent(contents.data as string);
    setView("editor");
  };

  const saveNote = async () => {
    if (!fileName) return alert("Enter a filename");
    await Filesystem.writeFile({
      path: `md-app/${fileName}.md`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });
    loadNotes();
    alert("Saved successfully");
  };

  const deleteNote = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${name}?`)) return;
    await Filesystem.deleteFile({
      path: `md-app/${name}`,
      directory: Directory.Documents
    });
    loadNotes();
  };

  const insertMarkdown = (snippet: string) => {
    const before = content.substring(0, cursorPos - 1);
    const after = content.substring(cursorPos);
    setContent(before + snippet + after);
    setShowSlashMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "/") {
      setCursorPos(e.currentTarget.selectionStart + 1);
      setShowSlashMenu(true);
    } else if (e.key === "Escape") {
      setShowSlashMenu(false);
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pt-[env(safe-area-inset-top)]">
      
      <AnimatePresence mode="wait">
        {view === "list" ? (
          /* --- LIST VIEW (The Manager) --- */
          <motion.div 
            key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <header className="p-6 pb-2">
              <h1 className="text-3xl font-black tracking-tighter">My Notes</h1>
              <p className="text-zinc-500 text-sm">Built Networks Storage</p>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button 
                onClick={() => { setFileName(`note-${Date.now()}`); setContent(""); setView("editor"); }}
                className="w-full p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-500 active:scale-95 transition-transform"
              >
                <Plus size={20} /> New Note
              </button>

              {notes.map(note => (
                <div 
                  key={note} onClick={() => openNote(note)}
                  className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                >
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><FileText size={20} /></div>
                  <span className="font-bold flex-1 truncate">{note}</span>
                  <button onClick={(e) => deleteNote(note, e)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* --- EDITOR VIEW --- */
          <motion.div 
            key="editor" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
            className="flex-1 flex flex-col relative"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { setView("list"); setShowSlashMenu(false); }} className="p-2 -ml-2"><ChevronLeft size={24} /></button>
              <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1 mx-2 bg-transparent font-bold text-center focus:outline-none" />
              <div className="flex gap-1">
                <button onClick={saveNote} className="p-2 text-blue-600"><Save size={20} /></button>
                <button onClick={() => setEditMode(editMode === "edit" ? "preview" : "edit")} className="p-2">
                  {editMode === "edit" ? <Eye size={20} /> : <Edit3 size={20} />}
                </button>
              </div>
            </header>

            <div className="flex-1 relative">
              {editMode === "edit" ? (
                <textarea
                  value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={handleKeyDown}
                  className="w-full h-full p-6 text-base leading-relaxed bg-transparent focus:outline-none resize-none font-mono"
                  placeholder="Type / for commands..." autoFocus
                />
              ) : (
                <div className="h-full w-full p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none"><ReactMarkdown>{content}</ReactMarkdown></div>
              )}
            </div>

            {/* --- SLASH MENU (Bottom Sheet) --- */}
            <AnimatePresence>
              {showSlashMenu && (
                <motion.div 
                  initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                  className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl z-50 p-4 pb-8"
                >
                  <div className="flex justify-between items-center mb-4 px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quick Format</span>
                    <button onClick={() => setShowSlashMenu(false)} className="text-xs text-zinc-500">Close</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => insertMarkdown("- [ ] ")} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                      <CheckSquare className="text-blue-500" /> <span className="text-xs font-bold">Task</span>
                    </button>
                    <button onClick={() => insertMarkdown("### ")} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                      <Heading className="text-purple-500" /> <span className="text-xs font-bold">Header</span>
                    </button>
                    <button onClick={() => insertMarkdown("> ")} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                      <Type className="text-zinc-500" /> <span className="text-xs font-bold">Quote</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}