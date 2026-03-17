"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Edit3, Eye, Save, Plus, ChevronLeft, 
  FileText, Trash2, CheckSquare, Heading, 
  Type, Settings, Share, X, Cloud, CloudOff
} from "lucide-react";

// Native Plugins
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share as CapShare } from '@capacitor/share';

// S3 Cloud Sync
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Buffer } from "buffer";

type ViewState = "list" | "editor" | "settings";

export default function MdApp() {
  const [view, setView] = useState<ViewState>("list");
  const [editMode, setEditMode] = useState<"edit" | "preview">("edit");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  
  const [r2Config, setR2Config] = useState({
    endpoint: "",
    accessKey: "",
    secretKey: "",
    bucket: ""
  });

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  useEffect(() => {
    loadNotes();
    loadConfig();
    // Polyfill Buffer for S3 Client
    if (typeof window !== "undefined") {
      (window as any).Buffer = Buffer;
    }
  }, []);

  const loadConfig = async () => {
    const { value } = await Preferences.get({ key: 'r2_config' });
    if (value) setR2Config(JSON.parse(value));
  };

  const saveSettings = async () => {
    await Preferences.set({ key: 'r2_config', value: JSON.stringify(r2Config) });
    alert("Settings Saved Locally");
    setView("list");
  };

  const loadNotes = async () => {
    try {
      const result = await Filesystem.readdir({ path: 'md-app', directory: Directory.Documents });
      setNotes(result.files.map(f => f.name).filter(n => n.endsWith('.md')));
    } catch (e) {
      await Filesystem.mkdir({ path: 'md-app', directory: Directory.Documents, recursive: true });
      setNotes([]);
    }
  };

  const syncToCloud = async (name: string, body: string) => {
    if (!r2Config.accessKey || !r2Config.endpoint) return;
    setSyncStatus("syncing");

    const s3Client = new S3Client({
      region: "auto",
      endpoint: r2Config.endpoint,
      credentials: {
        accessKeyId: r2Config.accessKey,
        secretAccessKey: r2Config.secretKey,
      },
    });

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: r2Config.bucket,
        Key: `${name}.md`,
        Body: body,
        ContentType: "text/markdown",
      }));
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setSyncStatus("error");
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
    if (!fileName) return;
    await Filesystem.writeFile({
      path: `md-app/${fileName}.md`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });
    loadNotes();
    syncToCloud(fileName, content);
  };

  const deleteNote = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${name}?`)) return;
    await Filesystem.deleteFile({ path: `md-app/${name}`, directory: Directory.Documents });
    loadNotes();
  };

  const handleShare = async () => {
    await CapShare.share({ title: fileName || "Note", text: content });
  };

  const insertMarkdown = (snippet: string) => {
    const before = content.substring(0, cursorPos);
    const after = content.substring(cursorPos);
    setContent(before + snippet + after);
    setShowSlashMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "/") {
      e.preventDefault(); 
      setCursorPos(e.currentTarget.selectionStart);
      setShowSlashMenu(true);
    } else if (e.key === "Escape") {
      setShowSlashMenu(false);
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pt-[env(safe-area-inset-top)]">
      <AnimatePresence mode="wait">
        {view === "list" && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <header className="p-6 pb-2 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-black tracking-tighter italic">md.app</h1>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Built Networks</p>
              </div>
              <button onClick={() => setView("settings")} className="p-3 bg-zinc-200 dark:bg-zinc-800 rounded-full active:scale-90 transition-transform">
                <Settings size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <button onClick={() => { setFileName(`note-${Date.now()}`); setContent(""); setView("editor"); }} className="w-full p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl flex items-center justify-center gap-2 text-zinc-400 font-bold uppercase text-xs tracking-widest">
                <Plus size={18} /> New Entry
              </button>
              {notes.map(note => (
                <div key={note} onClick={() => openNote(note)} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 active:scale-[0.98] transition-transform">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500"><FileText size={20} /></div>
                  <span className="font-bold flex-1 truncate text-sm">{note}</span>
                  <button onClick={(e) => deleteNote(note, e)} className="p-2 text-zinc-300 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {view === "settings" && (
          <motion.div key="settings" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="flex-1 flex flex-col p-6 space-y-6">
            <header className="flex items-center gap-4">
              <button onClick={() => setView("list")} className="p-2"><ChevronLeft size={24} /></button>
              <h1 className="text-2xl font-black tracking-tight">Cloud Sync</h1>
            </header>
            <div className="space-y-3">
              <input value={r2Config.endpoint} onChange={(e) => setR2Config({...r2Config, endpoint: e.target.value})} placeholder="S3 Endpoint URL" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
              <input value={r2Config.accessKey} onChange={(e) => setR2Config({...r2Config, accessKey: e.target.value})} placeholder="Access Key" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
              <input type="password" value={r2Config.secretKey} onChange={(e) => setR2Config({...r2Config, secretKey: e.target.value})} placeholder="Secret Key" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
              <input value={r2Config.bucket} onChange={(e) => setR2Config({...r2Config, bucket: e.target.value})} placeholder="Bucket Name" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
              <button onClick={saveSettings} className="w-full py-4 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-2xl">Update Credentials</button>
            </div>
          </motion.div>
        )}

        {view === "editor" && (
          <motion.div key="editor" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex-1 flex flex-col">
            <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { setView("list"); setShowSlashMenu(false); }} className="p-2"><ChevronLeft size={24} /></button>
              <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1 mx-2 bg-transparent font-bold text-center text-sm outline-none" />
              <div className="flex gap-2 items-center">
                {syncStatus === "syncing" && <Cloud className="animate-pulse text-blue-500" size={18} />}
                {syncStatus === "success" && <Cloud className="text-green-500" size={18} />}
                {syncStatus === "error" && <CloudOff className="text-red-500" size={18} />}
                <button onClick={handleShare} className="p-2 text-zinc-400"><Share size={20} /></button>
                <button onClick={saveNote} className="p-2 text-blue-600"><Save size={20} /></button>
                <button onClick={() => setEditMode(editMode === "edit" ? "preview" : "edit")} className="p-2 text-zinc-400">{editMode === "edit" ? <Eye size={20} /> : <Edit3 size={20} />}</button>
              </div>
            </header>
            <div className="flex-1 relative">
              {editMode === "edit" ? (
                <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={handleKeyDown} className="w-full h-full p-6 text-base leading-relaxed bg-transparent focus:outline-none resize-none font-mono" placeholder="Start writing..." autoFocus />
              ) : (
                <div className="h-full w-full p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none"><ReactMarkdown>{content}</ReactMarkdown></div>
              )}
            </div>
            <AnimatePresence>
              {showSlashMenu && (
                <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl p-6 pb-12 z-50">
                  <div className="flex justify-between items-center mb-6 px-2"><span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Formatting</span><button onClick={() => setShowSlashMenu(false)}><X size={18}/></button></div>
                  <div className="grid grid-cols-3 gap-4">
                    <button onClick={() => insertMarkdown("- [ ] ")} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl"><CheckSquare className="text-blue-500" /> <span className="text-[10px] font-bold">Task</span></button>
                    <button onClick={() => insertMarkdown("### ")} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl"><Heading className="text-purple-500" /> <span className="text-[10px] font-bold">Header</span></button>
                    <button onClick={() => insertMarkdown("> ")} className="flex flex-col items-center gap-2 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl"><Type className="text-zinc-500" /> <span className="text-[10px] font-bold">Quote</span></button>
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