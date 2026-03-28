"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Edit3, Eye, Save, Plus, ChevronLeft, ChevronDown,
  FileText, Trash2, CheckSquare, Heading, 
  Type, Settings, Share, X, Cloud, CloudOff,
  List, ListOrdered, Minus, Code, Bold, Italic, Link as LinkIcon, Image as ImageIcon,
  Folder, History, UserPlus, LogOut
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
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ViewState>("auth");
  const [editMode, setEditMode] = useState<"edit" | "preview">("edit");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<GitHubRelease | null>(null);
  const [isAuthGated, setIsAuthGated] = useState(false);
  
  // Auth & Vault State
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [isVaultMenuOpen, setIsVaultMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSearch, setSlashSearch] = useState("");
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

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

  const folders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      if (n.id.includes('/')) {
        set.add(n.id.split('/')[0]);
      }
    });
    return Array.from(set).sort();
  }, [notes]);

  const filteredCommands = useMemo(() => {
    if (!slashSearch) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(cmd => 
      cmd.label.toLowerCase().includes(slashSearch.toLowerCase()) ||
      cmd.id.toLowerCase().includes(slashSearch.toLowerCase())
    );
  }, [slashSearch]);

  const filteredNotes = useMemo(() => {
    let list = notes;
    if (activeFolder) {
      list = list.filter(n => n.id.startsWith(`${activeFolder}/`));
    } else {
      list = list.filter(n => !n.id.includes('/'));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.snippet.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [notes, searchQuery, activeFolder]);

  const editorRef = React.useRef<any>(null);

  const loadAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setIsAuthLoading(true);
    const { value } = await Preferences.get({ key: 'auth_token' });
    const params = new URLSearchParams(window.location.search);
    const authParam = params.has('auth');
    setIsAuthGated(authParam);
    
    if (!value && !authParam) {
      const path = window.location.pathname;
      if (path === '/' || path === '' || path.includes('index.html')) {
        window.location.replace('/landing');
        return;
      }
    }

    if (value) {
      setAuthToken(value);
      try {
        const res = await fetch('/api/vaults', {
          headers: { 'Authorization': `Bearer ${value}` }
        });
        if (res.ok) {
          const data = await res.json() as Vault[];
          setVaults(data);
          if (data.length > 0) setActiveVaultId(data[0].id);
          setView("list");
        } else {
          await Preferences.remove({ key: 'auth_token' });
          setAuthToken(null);
          setView("auth");
        }
      } catch (e) {
        setView("list");
      }
    } else {
      setView("auth");
    }
    setIsAuthLoading(false);
  }, []);

  const handleRegister = async () => {
    if (!userEmail || !userPassword) return;
    setSyncStatus("syncing");
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim(), password: userPassword, mode: authMode })
      });
      const data = await res.json() as any;
      if (res.ok && data.token) {
        await Preferences.set({ key: 'auth_token', value: data.token });
        setAuthToken(data.token);
        setVaults(data.vaults || []);
        if (data.vaults?.length > 0) setActiveVaultId(data.vaults[0].id);
        setView("list");
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch (e) {
      setAuthError("Auth server unreachable");
    } finally {
      setSyncStatus("idle");
    }
  };

  const loadNotes = useCallback(async () => {
    const result = await indexer.getNotes();
    if (result.length === 0) {
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

  const loadConfig = useCallback(async () => {
    const { value } = await Preferences.get({ key: 'r2_config' });
    if (value) setR2Config(JSON.parse(value));
  }, []);

  const checkForUpdates = useCallback(async () => {
    try {
      const release = await checkUpdates(versionData.version);
      if (release) setUpdateInfo(release);
    } catch (e) {}
  }, []);

  useEffect(() => {
    setMounted(true);
    loadAuth();
    loadNotes();
    loadConfig();
    checkForUpdates();
    if (typeof window !== "undefined") {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      (window as any).Buffer = Buffer;
    }
  }, [loadAuth, loadNotes, loadConfig, checkForUpdates]);

  const insertMarkdown = useCallback((snippet: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const { state } = view;
      const selection = state.selection.main;
      const line = state.doc.lineAt(selection.from);
      const textBefore = line.text.substring(0, selection.from - line.from);
      const slashIndex = textBefore.lastIndexOf("/");
      const from = slashIndex !== -1 ? line.from + slashIndex : selection.from;
      view.dispatch({
        changes: { from, to: selection.to, insert: snippet },
        selection: { anchor: from + snippet.length }
      });
      view.focus();
    }
    setShowSlashMenu(false);
    setSlashSearch("");
    setSelectedSlashIndex(0);
  }, []);

  const handleEditorChange = useCallback((value: string, viewUpdate: any) => {
    setContent(value);
    const { state } = viewUpdate;
    const selection = state.selection.main;
    if (!selection.empty) return;
    const line = state.doc.lineAt(selection.from);
    const textBefore = line.text.substring(0, selection.from - line.from);
    const lastSlash = textBefore.lastIndexOf("/");
    if (lastSlash !== -1) {
      const query = textBefore.substring(lastSlash + 1);
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

  useEffect(() => {
    if (!showSlashMenu) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault(); e.stopPropagation();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault(); e.stopPropagation();
        if (filteredCommands[selectedSlashIndex]) insertMarkdown(filteredCommands[selectedSlashIndex].snippet);
      } else if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        setShowSlashMenu(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [showSlashMenu, filteredCommands, selectedSlashIndex, insertMarkdown]);

  const saveNote = useCallback(async (overrideContent?: string) => {
    if (!fileName || !activeVaultId || !authToken) return;
    const contentToSave = overrideContent !== undefined ? overrideContent : content;
    await storage.writeNote(fileName, contentToSave);
    const h1Line = contentToSave.split('\n').find(l => l.startsWith('# '));
    const title = h1Line ? h1Line.replace('# ', '').trim() : fileName;
    const tags = Array.from(contentToSave.matchAll(/#(\w+)/g)).map(m => m[1]);
    const snippet = contentToSave.replace(/^# .*\n?/, '').substring(0, 100).trim();
    await indexer.updateNote({ id: fileName, title, tags: [...new Set(tags)], lastModified: Date.now(), snippet });
    loadNotes();
    if (r2Config.accessKey) {
      try { await sync.upload(fileName, contentToSave, r2Config); } catch (e) { console.error("Sync failed"); }
    }
    try {
      await fetch(`/api/vaults/revisions?id=${activeVaultId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: fileName, content: contentToSave })
      });
    } catch (e) {}
  }, [fileName, content, activeVaultId, authToken, storage, indexer, loadNotes, r2Config, sync]);

  const toggleCheckbox = useCallback((lineIndex: number) => {
    const lines = content.split('\n');
    const targetLine = lines[lineIndex - 1];
    if (!targetLine) return;
    let newLine = targetLine;
    if (targetLine.includes('[ ]')) newLine = targetLine.replace('[ ]', '[x]');
    else if (targetLine.includes('[x]')) newLine = targetLine.replace('[x]', '[ ]');
    if (newLine !== targetLine) {
      lines[lineIndex - 1] = newLine;
      const newContent = lines.join('\n');
      setContent(newContent);
      saveNote(newContent);
    }
  }, [content, saveNote]);

  const openNote = async (id: string) => {
    const contents = await storage.readNote(id);
    setFileName(id);
    setContent(contents);
    setView("editor");
  };

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${id}?`)) return;
    await storage.deleteNote(id);
    await indexer.deleteNote(id);
    loadNotes();
  };

  const handleLogout = async () => {
    await Preferences.remove({ key: 'auth_token' });
    setAuthToken(null);
    setView("auth");
  };

  const saveSettings = async () => {
    if (!activeVaultId || !authToken) return;
    let endpoint = r2Config.endpoint.trim();
    if (endpoint && !endpoint.startsWith('http')) endpoint = `https://${endpoint}`;
    const bucketTrim = r2Config.bucket.trim();
    if (endpoint.endsWith(`/${bucketTrim}`)) endpoint = endpoint.substring(0, endpoint.length - bucketTrim.length - 1);
    const configToSave = { name: activeVault?.name || "My Notes", r2_endpoint: endpoint, r2_access_key: r2Config.accessKey.trim(), r2_secret_key: r2Config.secretKey.trim(), r2_bucket: bucketTrim };
    setSyncStatus("syncing");
    try {
      const res = await fetch(`/api/vaults?id=${activeVaultId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave)
      });
      if (res.ok) {
        setVaults(prev => prev.map(v => v.id === activeVaultId ? { ...v, ...configToSave } : v));
        setView("list");
      }
    } catch (e) { console.error("Save settings failed"); } finally { setSyncStatus("idle"); }
  };

  const manualSyncAll = useCallback(async () => {
    if (!r2Config.accessKey || !r2Config.endpoint) return;
    setSyncStatus("syncing");
    try {
      const localNotes = await indexer.getNotes();
      for (const note of localNotes) {
        const c = await storage.readNote(note.id);
        await sync.upload(note.id, c, r2Config);
      }
      const remoteKeys = await sync.listRemote(r2Config);
      for (const key of remoteKeys) {
        const id = key.replace('.md', '');
        const rc = await sync.download(key, r2Config);
        await storage.writeNote(id, rc);
      }
      await loadNotes();
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) { setSyncStatus("error"); }
  }, [indexer, storage, sync, r2Config, loadNotes]);

  if (!mounted) return <div className="h-screen w-screen bg-zinc-50 dark:bg-zinc-950" />;

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pt-[env(safe-area-inset-top)]">
      <AnimatePresence mode="wait">
        {view === "auth" && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col justify-center p-8 space-y-12">
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-black tracking-tighter italic">md.app</h1>
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.3em]">{authMode === "login" ? "Sign In" : "Create Account"}</p>
            </div>
            {!isAuthGated && typeof window !== 'undefined' && !authToken && window.location.pathname === '/' ? null : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="name@example.com" className="w-full p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-base outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Your Password" className="w-full p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-base outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                {authError && <p className="text-center text-xs font-bold text-red-500">{authError}</p>}
                <button onClick={handleRegister} disabled={syncStatus === "syncing"} className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black rounded-3xl shadow-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-3 disabled:opacity-50">
                  {syncStatus === "syncing" ? "Connecting..." : (authMode === "login" ? "Sign In" : "Get Started")}
                  <ChevronLeft size={20} className="rotate-180" />
                </button>
                <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(null); }} className="w-full text-center text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-800 transition-colors">
                  {authMode === "login" ? "Need an account? Register" : "Have an account? Sign In"}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {view === "list" && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <header className="p-6 pb-2 flex justify-between items-start">
              <div className="relative">
                <button onClick={() => setIsVaultMenuOpen(!isVaultMenuOpen)} className="flex items-center gap-2 group text-left">
                  <div>
                    <h1 className="text-3xl font-black tracking-tighter italic flex items-center gap-2">
                      {activeVault?.name || "md.app"}
                      <ChevronDown size={20} className={`text-zinc-300 transition-transform ${isVaultMenuOpen ? "rotate-180" : ""}`} />
                    </h1>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{activeVault?.role === 'owner' ? 'Personal Vault' : 'Shared Vault'}</p>
                  </div>
                </button>
                <AnimatePresence>
                  {isVaultMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsVaultMenuOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden p-2 space-y-1">
                        {vaults.map(v => (
                          <button key={v.id} onClick={() => { setActiveVaultId(v.id); setIsVaultMenuOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-xl text-left ${activeVaultId === v.id ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                            <div className="min-w-0"><div className="text-sm font-bold truncate">{v.name}</div><div className="text-[10px] opacity-60 uppercase font-bold tracking-widest">{v.role}</div></div>
                            {activeVaultId === v.id && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => setView("settings")} className="p-3 bg-zinc-200 dark:bg-zinc-800 rounded-full relative"><Settings size={20} />{updateInfo && <span className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-zinc-50 dark:border-zinc-950 rounded-full"></span>}</button>
            </header>
            <div className="px-6 py-2">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes..." className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {updateInfo && <button onClick={() => Browser.open({ url: updateInfo.html_url })} className="w-full p-4 bg-blue-500 text-white rounded-2xl flex items-center justify-between gap-3 shadow-lg active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3"><Cloud size={20} className="animate-bounce" /><div className="text-left font-bold text-xs uppercase">Update Available</div></div><ChevronLeft size={16} className="rotate-180" /></button>}
              <button onClick={() => { setFileName(`note-${Date.now()}`); setContent(""); setView("editor"); }} className="w-full p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl flex items-center justify-center gap-2 text-zinc-400 font-bold uppercase text-xs tracking-widest"><Plus size={18} /> New Entry</button>
              {filteredNotes.map(note => (
                <div key={note.id} onClick={() => openNote(note.id)} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500"><FileText size={20} /></div>
                    <span className="font-bold flex-1 truncate text-sm">{note.title}</span>
                    <button onClick={(e) => deleteNote(note.id, e)} className="p-2 text-zinc-300 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                  {note.snippet && <p className="text-xs text-zinc-500 line-clamp-2 pl-12">{note.snippet}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {view === "settings" && (
          <motion.div key="settings" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
            <header className="flex items-center gap-4"><button onClick={() => setView("list")} className="p-2"><ChevronLeft size={24} /></button><h1 className="text-2xl font-black tracking-tight">Settings</h1></header>
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2"><h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cloud Sync (S3)</h2><button onClick={manualSyncAll} className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">Sync All</button></div>
              <div className="space-y-3">
                <input value={r2Config.endpoint} onChange={(e) => setR2Config({...r2Config, endpoint: e.target.value})} placeholder="S3 Endpoint URL" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <input value={r2Config.accessKey} onChange={(e) => setR2Config({...r2Config, accessKey: e.target.value})} placeholder="Access Key" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <input type="password" value={r2Config.secretKey} onChange={(e) => setR2Config({...r2Config, secretKey: e.target.value})} placeholder="Secret Key" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <input value={r2Config.bucket} onChange={(e) => setR2Config({...r2Config, bucket: e.target.value})} placeholder="Bucket Name" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm" />
                <button onClick={saveSettings} className="w-full py-4 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-2xl active:scale-[0.98] transition-transform">Save Credentials</button>
              </div>
            </section>
            <button onClick={handleLogout} className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-2xl flex items-center justify-center gap-2"><LogOut size={18} /> Sign Out</button>
          </motion.div>
        )}

        {view === "editor" && (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-2 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center min-w-0"><button onClick={() => { setView("list"); setShowSlashMenu(false); }} className="p-2 shrink-0"><ChevronLeft size={24} /></button><input value={fileName} onChange={(e) => setFileName(e.target.value)} className="min-w-0 bg-transparent font-bold text-sm outline-none px-1" /></div>
              <div className="flex gap-0.5 items-center shrink-0">
                <div className="px-2 flex items-center justify-center">{syncStatus === "syncing" && <Cloud className="animate-pulse text-blue-500" size={18} />}{syncStatus === "success" && <Cloud className="text-green-500" size={18} />}{syncStatus === "error" && <CloudOff className="text-red-500" size={18} />}</div>
                <button onClick={() => saveNote()} className="p-2 text-blue-600"><Save size={18} /></button>
                <button onClick={() => setEditMode(editMode === "edit" ? "preview" : "edit")} className={`p-2 rounded-lg ${editMode === "preview" ? "bg-blue-500 text-white" : "text-zinc-400"}`}>{editMode === "edit" ? <Eye size={18} /> : <Edit3 size={18} />}</button>
              </div>
            </header>
            <div className="flex-1 relative overflow-hidden">
              {editMode === "edit" ? <CodeMirror value={content} height="100%" theme={isDarkMode ? 'dark' : 'light'} extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]} onChange={handleEditorChange} onCreateEditor={(view) => { editorRef.current = view; }} basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, autocompletion: true }} className="h-full text-base" /> : <div className="h-full w-full p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ input: ({node, ...props}) => props.type === 'checkbox' ? <input {...props} className="w-4 h-4 rounded border-zinc-300 text-blue-600 cursor-pointer" readOnly={false} onChange={() => { const line = (node as any)?.position?.start.line; if (line) toggleCheckbox(line); }} /> : <input {...props} /> }}>{content}</ReactMarkdown></div>}
            </div>
            <AnimatePresence>{showSlashMenu && <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl z-50 flex flex-col max-h-[60vh]"><div className="flex justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-800"><div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commands</span>{slashSearch && <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold text-zinc-500">/{slashSearch}</span>}</div><button onClick={() => setShowSlashMenu(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><X size={16}/></button></div><div className="flex-1 overflow-y-auto p-2"><div className="space-y-1">{SLASH_COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(slashSearch.toLowerCase())).map((cmd, index) => <button key={cmd.id} onClick={() => insertMarkdown(cmd.snippet)} className={`w-full flex items-center gap-3 p-3 rounded-xl ${index === selectedSlashIndex ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50"}`}><div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800">{cmd.icon}</div><div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{cmd.label}</div><div className="text-[10px] text-zinc-500 truncate">{cmd.description}</div></div></button>)}</div></div></motion.div>}</AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
