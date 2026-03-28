"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Edit3, Eye, Save, Plus, ChevronLeft, 
  FileText, Trash2, CheckSquare, Heading, 
  Type, Settings, Share, X, Cloud, CloudOff,
  List, ListOrdered, Minus, Code, Bold, Italic, Link as LinkIcon, Image as ImageIcon
} from "lucide-react";

// Storage & Indexing & Sync
import { getStorageProvider } from "@/lib/storage";
import { getIndexProvider, NoteMetadata } from "@/lib/indexer";
import { getSyncProvider, SyncStatus, SyncConfig } from "@/lib/sync";

// Editor
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

// Native Plugins
import { Preferences } from '@capacitor/preferences';
import { Share as CapShare } from '@capacitor/share';
import { Browser } from '@capacitor/browser';

// Update Service
import { checkUpdates, GitHubRelease } from "@/lib/update";
import versionData from "../../public/version.json";

// Polyfills
import { Buffer } from "buffer";
type ViewState = "list" | "editor" | "settings" | "auth";

interface SlashCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  snippet: string;
  description: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
// ... (rest of commands)

  { id: 'task', label: 'Checklist', icon: <CheckSquare size={18} className="text-blue-500" />, snippet: '- [ ] ', description: 'Add a task item' },
  { id: 'h1', label: 'Heading 1', icon: <Heading size={18} className="text-purple-500" />, snippet: '# ', description: 'Large section heading' },
  { id: 'h2', label: 'Heading 2', icon: <Heading size={18} className="text-purple-400" />, snippet: '## ', description: 'Medium section heading' },
  { id: 'h3', label: 'Heading 3', icon: <Heading size={18} className="text-purple-300" />, snippet: '### ', description: 'Small section heading' },
  { id: 'bullet', label: 'Bullet List', icon: <List size={18} className="text-zinc-500" />, snippet: '- ', description: 'Create a simple bullet list' },
  { id: 'number', label: 'Numbered List', icon: <ListOrdered size={18} className="text-zinc-500" />, snippet: '1. ', description: 'Create a numbered list' },
  { id: 'quote', label: 'Quote', icon: <Type size={18} className="text-zinc-400" />, snippet: '> ', description: 'Insert a blockquote' },
  { id: 'code', label: 'Code Block', icon: <Code size={18} className="text-amber-500" />, snippet: '```\n\n```', description: 'Insert a code block' },
  { id: 'hr', label: 'Divider', icon: <Minus size={18} className="text-zinc-300" />, snippet: '---\n', description: 'Horizontal rule' },
  { id: 'bold', label: 'Bold', icon: <Bold size={18} className="font-bold" />, snippet: '**text**', description: 'Make text bold' },
  { id: 'italic', label: 'Italic', icon: <Italic size={18} className="italic" />, snippet: '*text*', description: 'Make text italic' },
  { id: 'link', label: 'Link', icon: <LinkIcon size={18} className="text-blue-400" />, snippet: '[title](url)', description: 'Insert a link' },
  { id: 'image', label: 'Image', icon: <ImageIcon size={18} className="text-green-500" />, snippet: '![alt](url)', description: 'Insert an image' },
];

interface Vault {
  id: string;
  name: string;
  r2_endpoint?: string;
  r2_access_key?: string;
  r2_secret_key?: string;
  r2_bucket?: string;
  role: 'owner' | 'editor' | 'viewer';
}

export default function MdApp() {
  const [view, setView] = useState<ViewState>("list");
  const [editMode, setEditMode] = useState<"edit" | "preview">("edit");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<GitHubRelease | null>(null);
  
  // Auth & Vault State
  const [userEmail, setUserEmail] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [r2Config, setR2Config] = useState<SyncConfig>({
    endpoint: "",
    accessKey: "",
    secretKey: "",
    bucket: ""
  });

  const activeVault = useMemo(() => vaults.find(v => v.id === activeVaultId), [vaults, activeVaultId]);

  // Update sync config whenever active vault changes
  useEffect(() => {
    if (activeVault && activeVault.r2_endpoint) {
      setR2Config({
        endpoint: activeVault.r2_endpoint,
        accessKey: activeVault.r2_access_key || "",
        secretKey: activeVault.r2_secret_key || "",
        bucket: activeVault.r2_bucket || ""
      });
    }
  }, [activeVault]);

  const storage = useMemo(() => getStorageProvider(), []);
  const indexer = useMemo(() => getIndexProvider(), []);
  const sync = useMemo(() => getSyncProvider(), []);

  // ... (filteredCommands remain same)

  const filteredNotes = useMemo(() => {
    let list = notes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.snippet.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [notes, searchQuery]);

  const loadAuth = useCallback(async () => {
    const { value } = await Preferences.get({ key: 'auth_token' });
    if (value) {
      setAuthToken(value);
      // Fetch vaults from backend
      try {
        const res = await fetch('/api/vaults', {
          headers: { 'Authorization': `Bearer ${value}` }
        });
        const data = await res.json() as Vault[];
        setVaults(data);
        if (data.length > 0) {
          setActiveVaultId(data[0].id);
        }
        setView("list");
      } catch (e) {
        console.error("Failed to load vaults", e);
        setView("list"); // Fallback to local
      }
    } else {
      setView("auth");
    }
    setIsAuthLoading(false);
  }, []);

  const handleRegister = async () => {
    if (!userEmail || !userEmail.includes("@")) {
      alert("Please enter a valid email.");
      return;
    }
    
    setSyncStatus("syncing");
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim() })
      });
      
      const data = await res.json() as any;
      if (data.token) {
        await Preferences.set({ key: 'auth_token', value: data.token });
        setAuthToken(data.token);
        setVaults(data.vaults || []);
        if (data.vaults?.length > 0) setActiveVaultId(data.vaults[0].id);
        alert("Welcome to md.app!");
        setView("list");
      } else {
        alert(data.error || "Authentication failed.");
      }
    } catch (e) {
      alert("API unreachable. Ensure your Pages Functions are deployed.");
    } finally {
      setSyncStatus("idle");
    }
  };

  const handleLogout = async () => {
    await Preferences.remove({ key: 'auth_token' });
    setAuthToken(null);
    setView("auth");
  };

  const loadConfig = useCallback(async () => {
    const { value } = await Preferences.get({ key: 'r2_config' });
    if (value) setR2Config(JSON.parse(value));
  }, []);

  const saveSettings = async () => {
    // Clean and Trim values
    let endpoint = r2Config.endpoint.trim();
    
    // Ensure protocol
    if (endpoint && !endpoint.startsWith('http')) {
      endpoint = `https://${endpoint}`;
    }

    // Strip bucket name from endpoint if present (AWS SDK appends it)
    const bucketTrim = r2Config.bucket.trim();
    if (endpoint.endsWith(`/${bucketTrim}`)) {
      endpoint = endpoint.substring(0, endpoint.length - bucketTrim.length - 1);
    }

    const trimmedConfig = {
      endpoint,
      accessKey: r2Config.accessKey.trim(),
      secretKey: r2Config.secretKey.trim(),
      bucket: bucketTrim
    };
    setR2Config(trimmedConfig);
    await Preferences.set({ key: 'r2_config', value: JSON.stringify(trimmedConfig) });
    alert("Settings Saved & Cleaned!");
    setView("list");
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        if (config.endpoint && config.accessKey && config.secretKey && config.bucket) {
          // Trim imported values
          const trimmed = {
            endpoint: config.endpoint.trim(),
            accessKey: config.accessKey.trim(),
            secretKey: config.secretKey.trim(),
            bucket: config.bucket.trim()
          };
          setR2Config(trimmed);
          alert("S3 Credentials Imported! Don't forget to Save.");
        } else {
          alert("Invalid config format. Check README.md");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const loadNotes = useCallback(async () => {
    const result = await indexer.getNotes();
    if (result.length === 0) {
      // First time or index lost? Try to rebuild.
      const files = await storage.listNotes();
      if (files.length > 0) {
        const fullNotes = await Promise.all(files.map(async f => ({
          name: f.name,
          content: await storage.readNote(f.name),
          lastModified: f.lastModified
        })));
        await indexer.rebuildIndex(fullNotes);
        const rebuiltResult = await indexer.getNotes();
        setNotes(rebuiltResult.sort((a, b) => b.lastModified - a.lastModified));
        return;
      }
    }
    setNotes(result.sort((a, b) => b.lastModified - a.lastModified));
  }, [storage, indexer]);

  const checkForUpdates = useCallback(async () => {
    console.log("Manually checking for updates...");
    const release = await checkUpdates(versionData.version);
    if (release) {
      setUpdateInfo(release);
      alert(`Update found!\nLocal: ${versionData.version}\nRemote: ${release.tag_name}`);
    } else {
      alert(`No update needed.\nLocal: ${versionData.version}\n(Checked GitHub successfully)`);
    }
  }, []);

  const manualSyncAll = useCallback(async () => {
    if (!r2Config.accessKey || !r2Config.endpoint) {
      alert("Please configure S3 credentials first.");
      return;
    }
    setSyncStatus("syncing");
    
    // Detect current origin for CORS help
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    
    try {
      // 1. Upload Local to Remote
      const localNotes = await indexer.getNotes();
      let uploadCount = 0;
      for (const note of localNotes) {
        const content = await storage.readNote(note.id);
        await sync.upload(note.id, content, r2Config);
        uploadCount++;
      }

      // 2. Download Remote to Local
      const remoteKeys = await sync.listRemote(r2Config);
      let downloadCount = 0;
      for (const key of remoteKeys) {
        const id = key.replace('.md', '');
        const remoteContent = await sync.download(key, r2Config);
        await storage.writeNote(id, remoteContent);
        downloadCount++;
      }

      // 3. Rebuild index after downloads
      await loadNotes();
      
      setSyncStatus("success");
      alert(`Sync Complete!\nUploaded: ${uploadCount}\nDownloaded: ${downloadCount}`);
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err: any) {
      console.error("Manual Sync Error:", err);
      setSyncStatus("error");
      
      if (err.message.includes("fetch") || err.name === "TypeError") {
        alert(`Sync Failed (CORS/Network Error)\n\nYOUR APP ORIGIN: ${currentOrigin}\n\nAction: In Cloudflare R2 Settings, ensure your CORS policy allows "${currentOrigin}"`);
      } else {
        alert(`Sync failed: ${err.name} - ${err.message}\nCheck Credentials.`);
      }
    }
  }, [indexer, storage, sync, r2Config, loadNotes]);

  useEffect(() => {
    loadNotes();
    loadConfig();
    checkForUpdates();
    setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    // Polyfill Buffer for S3 Client
    if (typeof window !== "undefined") {
      (window as any).Buffer = Buffer;
    }
  }, [loadNotes, loadConfig, checkForUpdates]);

  const syncToCloud = useCallback(async (name: string, body: string) => {
    if (!r2Config.accessKey || !r2Config.endpoint) return;
    setSyncStatus("syncing");

    try {
      await sync.upload(name, body, r2Config);
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) {
      console.error("S3 Sync Error:", err);
      setSyncStatus("error");
    }
  }, [r2Config, sync]);

  const openNote = async (id: string) => {
    const contents = await storage.readNote(id);
    setFileName(id);
    setContent(contents);
    setView("editor");
  };

  const saveNote = useCallback(async (overrideContent?: string) => {
    if (!fileName) return;
    const contentToSave = overrideContent !== undefined ? overrideContent : content;
    await storage.writeNote(fileName, contentToSave);
    
    // Update Index
    const h1Line = contentToSave.split('\n').find(l => l.startsWith('# '));
    const title = h1Line ? h1Line.replace('# ', '').trim() : fileName;
    const tags = Array.from(contentToSave.matchAll(/#(\w+)/g)).map(m => m[1]);
    const snippet = contentToSave.replace(/^# .*\n?/, '').substring(0, 100).trim();

    await indexer.updateNote({
      id: fileName,
      title,
      tags: [...new Set(tags)],
      lastModified: Date.now(),
      snippet
    });

    loadNotes();
    syncToCloud(fileName, contentToSave);
  }, [fileName, content, storage, indexer, loadNotes, syncToCloud]);

  const toggleCheckbox = useCallback((lineIndex: number) => {
    const lines = content.split('\n');
    const targetLine = lines[lineIndex - 1];
    if (!targetLine) return;

    let newLine = targetLine;
    if (targetLine.includes('[ ]')) {
      newLine = targetLine.replace('[ ]', '[x]');
    } else if (targetLine.includes('[x]')) {
      newLine = targetLine.replace('[x]', '[ ]');
    }

    if (newLine !== targetLine) {
      lines[lineIndex - 1] = newLine;
      const newContent = lines.join('\n');
      setContent(newContent);
      saveNote(newContent);
    }
  }, [content, saveNote]);

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${id}?`)) return;
    await storage.deleteNote(id);
    await indexer.deleteNote(id);
    loadNotes();
  };

  const handleShare = async () => {
    await CapShare.share({ title: fileName || "Note", text: content });
  };

  const insertMarkdown = useCallback((snippet: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const { state } = view;
      const selection = state.selection.main;
      
      const line = state.doc.lineAt(selection.from);
      const textBefore = line.text.substring(0, selection.from - line.from);
      const slashIndex = textBefore.lastIndexOf("/");
      
      if (slashIndex !== -1) {
        const from = line.from + slashIndex;
        view.dispatch({
          changes: { from, to: selection.to, insert: snippet },
          selection: { anchor: from + snippet.length }
        });
      } else {
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: snippet },
          selection: { anchor: selection.from + snippet.length }
        });
      }
      view.focus();
    }
    setShowSlashMenu(false);
    setSlashSearch("");
    setSelectedSlashIndex(0);
  }, []);

  const handleEditorChange = useCallback((value: string, viewUpdate: any) => {
    setContent(value);
    
    // Logic to detect "/"
    const { state } = viewUpdate;
    const selection = state.selection.main;
    if (!selection.empty) return;

    const line = state.doc.lineAt(selection.from);
    const textBefore = line.text.substring(0, selection.from - line.from);
    
    const lastSlash = textBefore.lastIndexOf("/");
    if (lastSlash !== -1) {
      const query = textBefore.substring(lastSlash + 1);
      // Trigger if slash is at start or preceded by space, and no spaces in query
      const charBeforeSlash = lastSlash > 0 ? textBefore[lastSlash - 1] : " ";
      
      if ((charBeforeSlash === " " || charBeforeSlash === "\n" || charBeforeSlash === "\t") && !query.includes(" ")) {
        setSlashSearch(query);
        setShowSlashMenu(true);
        setSelectedSlashIndex(0);
        return;
      }
    }
    
    setShowSlashMenu(false);
    setSlashSearch("");
  }, []);

  // Global key listener for Slash Menu navigation
  useEffect(() => {
    if (!showSlashMenu) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredCommands[selectedSlashIndex]) {
          insertMarkdown(filteredCommands[selectedSlashIndex].snippet);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowSlashMenu(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [showSlashMenu, filteredCommands, selectedSlashIndex, insertMarkdown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && view === "editor") {
      setView("list");
    }
  };

  return (
    <main onKeyDown={handleKeyDown} className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pt-[env(safe-area-inset-top)]">
      <AnimatePresence mode="wait">
        {view === "auth" && (
          <motion.div 
            key="auth" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className="flex-1 flex flex-col justify-center p-8 space-y-12"
          >
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-black tracking-tighter italic">md.app</h1>
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.3em]">Built Networks</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2">Register with Email</label>
                <input 
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-base shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              
              <button 
                onClick={handleRegister}
                disabled={syncStatus === "syncing"}
                className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black rounded-3xl shadow-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {syncStatus === "syncing" ? "Connecting..." : "Get Started"}
                <ChevronLeft size={20} className="rotate-180" />
              </button>
            </div>

            <div className="text-center">
              <p className="text-[10px] text-zinc-400 font-medium leading-relaxed max-w-[200px] mx-auto">
                By continuing, you agree to our terms of service and data ownership policy.
              </p>
            </div>
          </motion.div>
        )}

        {view === "list" && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <header className="p-6 pb-2 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-black tracking-tighter italic">md.app</h1>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Built Networks</p>
              </div>
              <button onClick={() => setView("settings")} className="p-3 bg-zinc-200 dark:bg-zinc-800 rounded-full active:scale-90 transition-transform relative">
                <Settings size={20} />
                {updateInfo && <span className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-zinc-50 dark:border-zinc-950 rounded-full"></span>}
              </button>
            </header>

            <div className="px-6 py-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
                  <Plus size={16} className="rotate-45" /> {/* Use as search icon or similar */}
                </div>
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes, tags, or content..."
                  className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-4 flex items-center text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {updateInfo && (
                <button 
                  onClick={() => Browser.open({ url: updateInfo.html_url })}
                  className="w-full p-4 bg-blue-500 text-white rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <Cloud size={20} className="animate-bounce" />
                    <div className="text-left">
                      <div className="text-xs font-black uppercase tracking-widest leading-none mb-1">Update Available</div>
                      <div className="text-[10px] font-bold opacity-80">Version {updateInfo.tag_name} is now ready</div>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="rotate-180" />
                </button>
              )}
              
              {!searchQuery && (
                <button onClick={() => { setFileName(`note-${Date.now()}`); setContent(""); setView("editor"); }} className="w-full p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl flex items-center justify-center gap-2 text-zinc-400 font-bold uppercase text-xs tracking-widest">
                  <Plus size={18} /> New Entry
                </button>
              )}

              {filteredNotes.map(note => (
                <div key={note.id} onClick={() => openNote(note.id)} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500"><FileText size={20} /></div>
                    <span className="font-bold flex-1 truncate text-sm">{note.title}</span>
                    <button onClick={(e) => deleteNote(note.id, e)} className="p-2 text-zinc-300 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                  {note.snippet && <p className="text-xs text-zinc-500 line-clamp-2 pl-12">{note.snippet}</p>}
                  {note.tags.length > 0 && (
                    <div className="flex gap-2 pl-12 mt-1">
                      {note.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {filteredNotes.length === 0 && searchQuery && (
                <div className="p-12 text-center text-zinc-400 italic text-sm">
                  No notes found matching "{searchQuery}"
                </div>
              )}
              <div className="pt-8 pb-12 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-800">Version {versionData.version}</p>
              </div>
            </div>
          </motion.div>
        )}

        {view === "settings" && (
          <motion.div key="settings" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
            <header className="flex items-center gap-4">
              <button onClick={() => setView("list")} className="p-2"><ChevronLeft size={24} /></button>
              <h1 className="text-2xl font-black tracking-tight">Settings</h1>
            </header>
            
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cloud Sync (S3)</h2>
                <div className="flex gap-2">
                  <button onClick={manualSyncAll} className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg active:scale-95 transition-transform">
                    Sync All
                  </button>
                  <label className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg cursor-pointer active:scale-95 transition-transform">
                    Import JSON
                    <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                <input value={r2Config.endpoint} onChange={(e) => setR2Config({...r2Config, endpoint: e.target.value})} placeholder="S3 Endpoint URL" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <input value={r2Config.accessKey} onChange={(e) => setR2Config({...r2Config, accessKey: e.target.value})} placeholder="Access Key" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <input type="password" value={r2Config.secretKey} onChange={(e) => setR2Config({...r2Config, secretKey: e.target.value})} placeholder="Secret Key" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <input value={r2Config.bucket} onChange={(e) => setR2Config({...r2Config, bucket: e.target.value})} placeholder="Bucket Name" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <button onClick={saveSettings} className="w-full py-4 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-2xl shadow-xl shadow-zinc-900/20 dark:shadow-white/5 active:scale-[0.98] transition-transform">Save Credentials</button>
              </div>
            </section>

            <section className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 px-2">About</h2>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold tracking-tight">Version {versionData.version}</div>
                    <div className="text-[10px] text-zinc-500">Built on {versionData.buildDate}</div>
                  </div>
                  {updateInfo ? (
                     <button onClick={() => Browser.open({ url: updateInfo.html_url })} className="text-[10px] font-bold text-blue-500 underline">Update Available</button>
                  ) : (
                     <div className="text-[10px] font-bold text-green-500 flex items-center gap-1"><Cloud size={10} /> Up to date</div>
                  )}
                </div>
                <button onClick={checkForUpdates} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-xl active:scale-[0.98] transition-transform">
                  Check for Updates
                </button>
              </div>
            </section>
          </motion.div>
        )}

        {view === "editor" && (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-2 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center min-w-0">
                <button onClick={() => { setView("list"); setShowSlashMenu(false); }} className="p-2 shrink-0"><ChevronLeft size={24} /></button>
                <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="min-w-0 bg-transparent font-bold text-sm outline-none px-1" />
              </div>
              
              <div className="flex gap-0.5 items-center shrink-0">
                <div className="px-2 flex items-center justify-center">
                  {syncStatus === "syncing" && <Cloud className="animate-pulse text-blue-500" size={18} />}
                  {syncStatus === "success" && <Cloud className="text-green-500" size={18} />}
                  {syncStatus === "error" && <CloudOff className="text-red-500" size={18} />}
                </div>
                <button onClick={handleShare} className="p-2 text-zinc-400 active:scale-90"><Share size={18} /></button>
                <button onClick={() => saveNote()} className="p-2 text-blue-600 active:scale-90"><Save size={18} /></button>
                <button 
                  onClick={() => setEditMode(editMode === "edit" ? "preview" : "edit")} 
                  className={`p-2 rounded-lg transition-colors ${editMode === "preview" ? "bg-blue-500 text-white" : "text-zinc-400"}`}
                >
                  {editMode === "edit" ? <Eye size={18} /> : <Edit3 size={18} />}
                </button>
              </div>
            </header>

            <motion.div 
              className="flex-1 relative overflow-hidden touch-none"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.x > 100 && editMode === "preview") setEditMode("edit");
                if (info.offset.x < -100 && editMode === "edit") setEditMode("preview");
              }}
            >
              <AnimatePresence mode="wait">
                {editMode === "edit" ? (
                  <motion.div 
                    key="edit-view"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="h-full w-full"
                  >
                    <CodeMirror
                      value={content}
                      height="100%"
                      theme={isDarkMode ? 'dark' : 'light'}
                      extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
                      onChange={handleEditorChange}
                      onCreateEditor={(view) => { editorRef.current = view; }}
                      basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        autocompletion: true,
                      }}
                      className="h-full text-base"
                    />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="preview-view"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    className="h-full w-full p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none"
                  >
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        input: ({node, ...props}) => {
                          if (props.type === 'checkbox') {
                            return (
                              <input 
                                {...props} 
                                className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                                readOnly={false}
                                onChange={() => {
                                  const line = (node as any)?.position?.start.line;
                                  if (line) toggleCheckbox(line);
                                }}
                              />
                            );
                          }
                          return <input {...props} />;
                        }
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <AnimatePresence>
              {showSlashMenu && (
                <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl z-50 flex flex-col max-h-[60vh]">
                  <div className="flex justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commands</span>
                      {slashSearch && <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold text-zinc-500">/{slashSearch}</span>}
                    </div>
                    <button onClick={() => setShowSlashMenu(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><X size={16}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {filteredCommands.length > 0 ? (
                      <div className="space-y-1">
                        {filteredCommands.map((cmd, index) => (
                          <button
                            key={cmd.id}
                            onClick={() => insertMarkdown(cmd.snippet)}
                            onMouseEnter={() => setSelectedSlashIndex(index)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                              index === selectedSlashIndex 
                                ? "bg-zinc-100 dark:bg-zinc-800" 
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800">
                              {cmd.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate">{cmd.label}</div>
                              <div className="text-[10px] text-zinc-500 truncate">{cmd.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-zinc-400 text-xs font-medium italic">
                        No commands found for &quot;{slashSearch}&quot;
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center pb-8">
                    <span className="text-[10px] text-zinc-400 font-medium">↑↓ to navigate · Enter to select</span>
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