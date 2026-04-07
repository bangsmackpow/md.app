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
  Folder, History, UserPlus, LogOut, Database, MoreVertical, Shield, Key, Layout, Lock
} from "lucide-react";

// Storage & Indexing & Sync
import { getStorageProvider } from "@/lib/storage";
import { getIndexProvider, NoteMetadata } from "@/lib/indexer";
import { getSyncProvider, SyncStatus, SyncConfig } from "@/lib/sync";

// Editor
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { keymap } from "@codemirror/view";

// Native Plugins
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Share as CapShare } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

// Update Service
import { checkUpdates, GitHubRelease } from "@/lib/update";
import versionData from "../../public/version.json";

// Polyfills
import { Buffer } from "buffer";

// Crypto
import { deriveVaultKey, encryptText, decryptText, generateSalt, EncryptedData } from "@/lib/crypto";
import { apiFetch } from "@/lib/api";

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
  { id: 'bullet', label: 'Bullet List', icon: <List size={18} className="text-zinc-500" />, snippet: '- ', description: 'Create a simple bullet list' },
  { id: 'code', label: 'Code Block', icon: <Code size={18} className="text-amber-500" />, snippet: '```\n\n```', description: 'Insert a code block' },
  { id: 'bold', label: 'Bold', icon: <Bold size={18} className="font-bold" />, snippet: '**text**', description: 'Make text bold' },
  { id: 'link', label: 'Link', icon: <LinkIcon size={18} className="text-blue-400" />, snippet: '[title](url)', description: 'Insert a link' },
  { id: 'note-link', label: 'Note Link', icon: <FileText size={18} className="text-blue-500" />, snippet: '/link', description: 'Link to another note' },
  { id: 'template', label: 'Template', icon: <Layout size={18} className="text-emerald-500" />, snippet: '/template', description: 'Insert a saved template' },
];

interface Vault {
  id: string;
  name: string;
  r2_endpoint?: string;
  r2_access_key?: string;
  r2_secret_key?: string;
  r2_bucket?: string;
  role: 'owner' | 'editor' | 'viewer';
  encryption_enabled?: number;
  encryption_salt?: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "" });
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [isVaultMenuOpen, setIsVaultMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  // E2EE State
  const [activeVaultKey, setActiveVaultKey] = useState<CryptoKey | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplatePicker, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Sharing
  const [inboundNotes, setInboundNotes] = useState<any[]>([]);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [shareMode, setShareMode] = useState<"copy" | "live" | null>(null);
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [liveShareId, setLiveShareId] = useState<string | null>(null);
  const [isLiveHost, setIsLiveHost] = useState(false);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSearch, setSlashSearch] = useState("");
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  const activeVault = useMemo(() => vaults.find(v => v.id === activeVaultId), [vaults, activeVaultId]);

  const r2Config = useMemo(() => {
    if (activeVault && activeVault.r2_endpoint) {
      return {
        endpoint: activeVault.r2_endpoint,
        accessKey: activeVault.r2_access_key || "",
        secretKey: activeVault.r2_secret_key || "",
        bucket: activeVault.r2_bucket || ""
      };
    }
    return { endpoint: "", accessKey: "", secretKey: "", bucket: "" };
  }, [activeVault]);

  const storage = useMemo(() => getStorageProvider(), []);
  const indexer = useMemo(() => getIndexProvider(), []);
  const sync = useMemo(() => getSyncProvider(), []);

  const folders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      if (n.id.includes('/')) {
        const parts = n.id.split('/');
        if (activeFolder) {
          if (n.id.startsWith(`${activeFolder}/`)) {
            const sub = n.id.replace(`${activeFolder}/`, '').split('/')[0];
            if (sub && !sub.includes('.')) set.add(`${activeFolder}/${sub}`);
          }
        } else {
          set.add(parts[0]);
        }
      }
    });
    return Array.from(set).sort();
  }, [notes, activeFolder]);

  const filteredNotes = useMemo(() => {
    let list = notes;
    if (!searchQuery) {
      if (activeFolder) {
        list = list.filter(n => n.id.startsWith(`${activeFolder}/`));
      } else {
        list = list.filter(n => !n.id.includes('/'));
      }
    } else {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.snippet.toLowerCase().includes(q) ||
        (n.content && n.content.toLowerCase().includes(q))
      );
    }
    return list;
  }, [notes, searchQuery, activeFolder]);

  const editorRef = React.useRef<any>(null);

  const loadNotes = useCallback(async () => {
    const result = await indexer.getNotes();
    setNotes(result.sort((a, b) => b.lastModified - a.lastModified));
  }, [indexer]);

  const apiFetchCallback = useCallback(async (path: string, options: any = {}) => {
    return apiFetch(path, options);
  }, []);

  const fullSyncFromCloud = useCallback(async (vaultId: string, token: string) => {
    setSyncStatus("syncing");
    try {
      const res = await apiFetchCallback(`/api/notes/sync?vaultId=${vaultId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to list cloud notes");
      
      const objects = await res.json() as any[];
      console.log(`Cloud sync: Found ${objects.length} objects in vault ${vaultId}`);

      for (const obj of objects) {
        const fileName = obj.key.replace(`${vaultId}/`, '');
        if (!fileName || fileName === '.keep') continue;

        const noteRes = await apiFetchCallback(`/api/notes/sync?vaultId=${vaultId}&fileName=${encodeURIComponent(fileName)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (noteRes.ok) {
          const cloudContent = await noteRes.text();
          await storage.writeNote(fileName, cloudContent);
          
          const h1Line = cloudContent.split('\n').find(l => l.startsWith('# '));
          const title = h1Line ? h1Line.replace('# ', '').trim() : fileName.replace('.md', '');
          const tags = Array.from(cloudContent.matchAll(/#(\w+)/g)).map(m => m[1]);
          const snippet = cloudContent.replace(/^# .*\n?/, '').substring(0, 100).trim();
          
          await indexer.updateNote({
            id: fileName.replace('.md', ''),
            title,
            tags: [...new Set(tags)],
            lastModified: new Date(obj.uploaded).getTime(),
            snippet,
            content: cloudContent.substring(0, 10000)
          });
        }
      }
      loadNotes();
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e) {
      console.error("Full sync failed:", e);
      setSyncStatus("error");
    }
  }, [apiFetchCallback, storage, indexer, loadNotes]);

  const migrateLegacyData = async (vaultId: string, token: string) => {
    if (typeof window === 'undefined') return;
    const legacyIndexRaw = localStorage.getItem('md-app-index');
    if (!legacyIndexRaw) return;

    setIsMigrating(true);
    setSyncStatus("syncing");
    try {
      const legacyNotes = JSON.parse(legacyIndexRaw) as NoteMetadata[];
      const legacyStorage = getStorageProvider(); 

      for (const note of legacyNotes) {
        try {
          const content = await legacyStorage.readNote(note.id);
          await storage.writeNote(note.id, content);
          await indexer.updateNote({ ...note, content: content.substring(0, 10000) });
          
          await fetch(`/api/notes/sync?vaultId=${vaultId}&fileName=${encodeURIComponent(note.id)}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: content
          });

          localStorage.removeItem(`md-app-note:${note.id}.md`);
          localStorage.removeItem(`md-app-note:${note.id}`);
        } catch (err) {
          console.error(`Failed to migrate note ${note.id}`, err);
        }
      }

      localStorage.removeItem('md-app-index');
      alert("Legacy notes migrated!");
      loadNotes();
    } catch (e) {
      console.error("Migration fatal error:", e);
    } finally {
      setIsMigrating(false);
      setSyncStatus("idle");
    }
  };

  const loadAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const { value } = await Preferences.get({ key: 'auth_token' });
    const params = new URLSearchParams(window.location.search);
    const authParam = params.has('auth');
    setIsAuthGated(authParam);
    
    if (!value && !authParam) {
      const path = window.location.pathname;
      const isRoot = path === '/' || path === '' || path.includes('index.html');
      if (isRoot) {
        if (Capacitor.isNativePlatform()) {
          setView("auth");
        } else {
          window.location.replace('/landing');
        }
        return;
      }
    }

    if (value) {
      setAuthToken(value);
      const { value: adminVal } = await Preferences.get({ key: 'is_admin' });
      setIsAdmin(adminVal === 'true');
      const { value: forceVal } = await Preferences.get({ key: 'force_password' });
      if (forceVal === 'true') {
        setForcePasswordChange(true);
        setShowPasswordModal(true);
      }
      try {
        const res = await apiFetchCallback('/api/vaults', { headers: { 'Authorization': `Bearer ${value}` } });
        if (res.ok) {
          const data = await res.json() as Vault[];
          setVaults(data);
          if (data.length > 0) {
            setActiveVaultId(data[0].id);
            migrateLegacyData(data[0].id, value);
            fullSyncFromCloud(data[0].id, value);
          }
          setView("list");
        } else {
          await Preferences.remove({ key: 'auth_token' });
          setAuthToken(null);
          setView("auth");
        }
      } catch (e) { setView("list"); }
    } else { setView("auth"); }
    setIsAuthLoading(false);
  }, [apiFetchCallback, fullSyncFromCloud]);

  const loadTemplates = useCallback(async () => {
    const { value } = await Preferences.get({ key: 'templates' });
    if (value) {
      setTemplates(JSON.parse(value));
    } else {
      const defaults = [
        { id: 'daily', name: 'Daily Note', content: '# Daily Log: ' + new Date().toLocaleDateString() + '\n\n## Tasks\n- [ ] \n\n## Journal\n' },
        { id: 'meeting', name: 'Meeting Notes', content: '# Meeting: \nDate: ' + new Date().toLocaleDateString() + '\nAttendees: \n\n## Agenda\n\n## Notes\n\n## Action Items\n- [ ] ' },
        { id: 'grocery', name: 'Grocery List', content: '# Grocery List: ' + new Date().toLocaleDateString() + '\n\n## Produce\n- [ ] \n\n## Dairy & Eggs\n- [ ] \n\n## Meat & Seafood\n- [ ] \n\n## Pantry\n- [ ] \n\n## Household\n- [ ] ' }
      ];
      setTemplates(defaults);
      await Preferences.set({ key: 'templates', value: JSON.stringify(defaults) });
    }
  }, []);

  const handleRegister = async () => {
    if (!userEmail || !userPassword) return;
    setSyncStatus("syncing");
    setAuthError(null);
    try {
      const res = await apiFetch(`/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim(), password: userPassword, mode: authMode })
      });
      const data = await res.json() as any;
      if (res.ok && data.token) {
        await Preferences.set({ key: 'auth_token', value: data.token });
        await Preferences.set({ key: 'is_admin', value: data.isAdmin ? 'true' : 'false' });
        await Preferences.set({ key: 'force_password', value: data.forcePasswordChange ? 'true' : 'false' });
        setAuthToken(data.token);
        setIsAdmin(!!data.isAdmin);
        setForcePasswordChange(!!data.forcePasswordChange);
        if (data.forcePasswordChange) setShowPasswordModal(true);
        setVaults(data.vaults || []);
        if (data.vaults?.length > 0) {
          setActiveVaultId(data.vaults[0].id);
          migrateLegacyData(data.vaults[0].id, data.token);
        }
        setView("list");
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch (e: any) { setAuthError(`Auth unreachable: ${e.message}`); } finally { setSyncStatus("idle"); }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.current || !passwordForm.new || !authToken) return;
    try {
      const res = await apiFetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new })
      });
      if (res.ok) {
        setShowPasswordModal(false);
        setForcePasswordChange(false);
        await Preferences.remove({ key: 'force_password' });
        alert("Password updated!");
      }
    } catch (e) { alert("Error updating password"); }
  };

  const fetchInboundNotes = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch('/api/notes/share', { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setInboundNotes(data);
      }
    } catch (e) {}
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchInboundNotes();
      const interval = setInterval(fetchInboundNotes, 60000);
      return () => clearInterval(interval);
    }
  }, [authToken, fetchInboundNotes]);

  const syncToCloud = useCallback(async (name: string, body: string) => {
    if (r2Config.accessKey && r2Config.endpoint) {
      setSyncStatus("syncing");
      try {
        await sync.upload(name, body, r2Config);
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 3000);
      } catch (err) { setSyncStatus("error"); }
    }
    if (authToken && activeVaultId) {
      setSyncStatus("syncing");
      try {
        await fetch(`/api/notes/sync?vaultId=${activeVaultId}&fileName=${encodeURIComponent(name)}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${authToken}` },
          body: body
        });
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 3000);
      } catch (err) { setSyncStatus("error"); }
    }
  }, [r2Config, sync, authToken, activeVaultId]);

  const saveNote = useCallback(async (overrideContent?: string) => {
    if (!fileName || !activeVaultId || !authToken) return;
    const plainContent = overrideContent !== undefined ? overrideContent : content;
    let contentToSave = plainContent;
    if (activeVault?.encryption_enabled && activeVaultKey) {
      const encrypted = await encryptText(plainContent, activeVaultKey);
      contentToSave = JSON.stringify(encrypted);
    }
    await storage.writeNote(fileName, contentToSave);
    const h1Line = plainContent.split('\n').find(l => l.startsWith('# '));
    const title = h1Line ? h1Line.replace('# ', '').trim() : fileName;
    const tags = Array.from(plainContent.matchAll(/#(\w+)/g)).map(m => m[1]);
    const snippet = plainContent.replace(/^# .*\n?/, '').substring(0, 100).trim();
    await indexer.updateNote({ id: fileName, title, tags: [...new Set(tags)], lastModified: Date.now(), snippet, content: plainContent.substring(0, 10000) });
    loadNotes();
    setIsDirty(false);
    await syncToCloud(fileName, contentToSave);
    try {
      await fetch(`/api/vaults/revisions?id=${activeVaultId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: fileName, content: contentToSave })
      });
    } catch (e) {}
  }, [fileName, content, activeVaultId, authToken, storage, indexer, loadNotes, r2Config, syncToCloud, activeVault, activeVaultKey]);

  useEffect(() => {
    if (!isDirty || !fileName) return;
    const timer = setTimeout(() => saveNote(), 30000);
    return () => clearTimeout(timer);
  }, [content, isDirty, fileName, saveNote]);

  const loadConfig = useCallback(async () => {
    const { value } = await Preferences.get({ key: 'r2_config' });
    if (value) {
      // Logic to handle R2 config if needed locally beyond vault state
    }
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
    loadConfig();
    loadTemplates();
    checkForUpdates();
    if (typeof window !== "undefined") {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      (window as any).Buffer = Buffer;
    }
    App.addListener('appUrlOpen', async (data: any) => { console.log('App opened with URL:', data.url); });
  }, [loadAuth, loadConfig, loadTemplates, checkForUpdates]);

  useEffect(() => {
    if (activeVaultId) {
      storage.setVault(activeVaultId);
      indexer.setVault(activeVaultId);
    }
    if (activeVault?.encryption_enabled && !activeVaultKey) {
      setShowUnlockModal(true);
    } else {
      loadNotes();
    }
  }, [activeVaultId, activeVault, activeVaultKey, loadNotes, storage, indexer]);

  const insertMarkdownSnippet = useCallback((snippet: string) => {
    if (snippet === '/template') { setShowTemplateModal(true); setShowSlashMenu(false); return; }
    if (snippet === '/link') { setShowWikiMenu(true); setWikiSearch(""); setShowSlashMenu(false); return; }
    if (editorRef.current) {
      const view = editorRef.current;
      const { state } = view;
      const selection = state.selection.main;
      const line = state.doc.lineAt(selection.from);
      const textBefore = line.text.substring(0, selection.from - line.from);
      const slashIndex = textBefore.lastIndexOf("/");
      const from = slashIndex !== -1 ? line.from + slashIndex : selection.from;
      view.dispatch({ changes: { from, to: selection.to, insert: snippet }, selection: { anchor: from + snippet.length } });
      view.focus();
    }
    setShowSlashMenu(false);
    setSlashSearch("");
  }, []);

  const [showWikiMenu, setShowWikiMenu] = useState(false);
  const [wikiSearch, setWikiSearch] = useState("");

  const handleEditorValueChange = useCallback((value: string, viewUpdate: any) => {
    setContent(value);
    setIsDirty(true);
    const { state } = viewUpdate;
    const selection = state.selection.main;
    if (!selection.empty) return;
    const line = state.doc.lineAt(selection.from);
    const textBefore = line.text.substring(0, selection.from - line.from);
    const lastDoubleOpen = textBefore.lastIndexOf("[[");
    if (lastDoubleOpen !== -1 && !textBefore.substring(lastDoubleOpen).includes("]]")) {
      setWikiSearch(textBefore.substring(lastDoubleOpen + 2));
      setShowWikiMenu(true);
      setShowSlashMenu(false);
      return;
    }
    setShowWikiMenu(false);
    const lastSlash = textBefore.lastIndexOf("/");
    if (lastSlash !== -1) {
      const query = textBefore.substring(lastSlash + 1);
      const charBeforeSlash = lastSlash > 0 ? textBefore[lastSlash - 1] : " ";
      if ((charBeforeSlash === " " || charBeforeSlash === "\n") && !query.includes(" ")) {
        setSlashSearch(query);
        setShowSlashMenu(true);
        setSelectedSlashIndex(0);
        return;
      }
    }
    setShowSlashMenu(false);
  }, []);

  const toggleCheckboxItem = useCallback((lineIndex: number) => {
    const lines = content.split('\n');
    const targetLine = lines[lineIndex - 1];
    if (targetLine === undefined) return;
    let newLine = targetLine;
    if (/^\s*([-*]|\d+\.)\s*\[\s*\]/.test(targetLine)) newLine = targetLine.replace(/\[\s*\]/, '[x]');
    else if (/^\s*([-*]|\d+\.)\s*\[[xX]\]/.test(targetLine)) newLine = targetLine.replace(/\[[xX]\]/, '[ ]');
    if (newLine !== targetLine) {
      const newLines = [...lines];
      newLines[lineIndex - 1] = newLine;
      const newContent = newLines.join('\n');
      setContent(newContent);
      saveNote(newContent);
    }
  }, [content, saveNote]);

  const navigateToNote = async (noteId: string) => {
    setFileName(noteId);
    setContent("");
    setEditMode("preview");
    setView("editor");
    const c = await storage.readNote(noteId);
    setContent(c);
  };

  const handleUnlockVault = async () => {
    if (!vaultPassphrase || !activeVault?.encryption_salt) return;
    setIsEncrypting(true);
    try {
      const key = await deriveVaultKey(vaultPassphrase, activeVault.encryption_salt);
      setActiveVaultKey(key);
      setShowUnlockModal(false);
      setVaultPassphrase("");
      loadNotes();
    } catch (e) { alert("Invalid passphrase"); } finally { setIsEncrypting(false); }
  };

  const loadNoteContent = async (id: string) => {
    const raw = await storage.readNote(id);
    if (activeVault?.encryption_enabled && activeVaultKey) {
      try {
        const encrypted = JSON.parse(raw) as EncryptedData;
        if (encrypted.iv && encrypted.ciphertext) {
          return await decryptText(encrypted, activeVaultKey);
        }
      } catch (e) {
        return raw;
      }
    }
    return raw;
  };

  const handleEnableEncryption = async () => {
    const pass = window.prompt("Enter a strong passphrase for this vault. (WARNING: Lost passphrases cannot be recovered!)");
    if (!pass) return;
    
    setIsEncrypting(true);
    try {
      const salt = generateSalt();
      const key = await deriveVaultKey(pass, salt);
      
      const res = await fetch(`/api/vaults?id=${activeVaultId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...activeVault, 
          encryption_enabled: 1, 
          encryption_salt: salt 
        })
      });

      if (res.ok) {
        setActiveVaultKey(key);
        setVaults(prev => prev.map(v => v.id === activeVaultId ? { ...v, encryption_enabled: 1, encryption_salt: salt } : v));
        alert("Encryption enabled! Your next save will be encrypted.");
      }
    } catch (e) {
      alert("Failed to enable encryption");
    } finally {
      setIsEncrypting(false);
    }
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

  const exportVault = async () => {
    if (!activeVaultId) return;
    try {
      const allNotes = await indexer.getNotes();
      const exportData: any[] = [];
      for (const note of allNotes) {
        const c = await storage.readNote(note.id);
        exportData.push({ ...note, content: c });
      }
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-${activeVaultId}.json`;
      a.click();
    } catch (e) { alert("Export failed"); }
  };

  const importVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeVaultId) return;
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = JSON.parse(event.target?.result as string) as any[];
        for (const item of data) {
          await storage.writeNote(item.id, item.content);
          await indexer.updateNote(item);
        }
        loadNotes();
        alert(`Imported ${data.length} notes!`);
      };
      reader.readAsText(file);
    } catch (e) { alert("Import failed"); }
  };

  const handleShareVault = async (email: string) => {
    if (!activeVaultId || !authToken || !email) return;
    try {
      await fetch('/api/vaults/share', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, vaultId: activeVaultId })
      });
      alert("Shared!");
    } catch (e) {}
  };

  const startLiveShare = async () => {
    if (!authToken || !fileName) return;
    try {
      const res = await apiFetch('/api/notes/live', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notePath: fileName, content })
      });
      const data = await res.json();
      if (res.ok) {
        setLiveShareId(data.shareId);
        setIsLiveHost(true);
        setShowShareOptions(false);
      }
    } catch (e) {}
  };

  const handleShareNote = async () => {
    if (!shareRecipientEmail || !fileName || !authToken) return;
    try {
      await apiFetch('/api/notes/share', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: shareRecipientEmail, noteTitle: fileName.split('/').pop(), content })
      });
      setShowShareOptions(false);
      setShareRecipientEmail("");
    } catch (e) {}
  };

  const joinLiveShare = async () => {
    const id = window.prompt("ID:");
    if (!id) return;
    try {
      const res = await apiFetch(`/api/notes/live?id=${id}`);
      const data = await res.json();
      if (res.ok) { setFileName(data.note_path); setContent(data.content); setLiveShareId(data.id); setIsLiveHost(false); setView("editor"); }
    } catch (e) {}
  };

  const acceptInboundNote = async (note: any) => {
    if (!activeVaultId) return;
    const targetId = `shared/${note.note_title}-${Date.now()}`;
    await storage.writeNote(targetId, note.content);
    await indexer.updateNote({ id: targetId, title: note.note_title, tags: ['shared'], lastModified: Date.now(), snippet: note.content.substring(0, 100), content: note.content.substring(0, 10000) });
    await apiFetch('/api/notes/share', { method: 'PUT', headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ shareId: note.id, status: 'accepted' }) });
    setInboundNotes(prev => prev.filter(n => n.id !== note.id));
    loadNotes();
    navigateToNote(targetId);
  };

  const deleteInboundNote = async (shareId: string) => {
    await apiFetch('/api/notes/share', { method: 'PUT', headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ shareId, status: 'declined' }) });
    setInboundNotes(prev => prev.filter(n => n.id !== shareId));
  };

  const filteredSlashCommands = SLASH_COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(slashSearch.toLowerCase()));
  const filteredWikiNotes = useMemo(() => notes.filter(n => n.title.toLowerCase().includes(wikiSearch.toLowerCase())).slice(0, 10), [notes, wikiSearch]);

  const insertWikiLink = (noteId: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const { state } = view;
      const selection = state.selection.main;
      const line = state.doc.lineAt(selection.from);
      const textBefore = line.text.substring(0, selection.from - line.from);
      const openIndex = textBefore.lastIndexOf("[[");
      const from = openIndex !== -1 ? line.from + openIndex : selection.from;
      const snippet = `[[${noteId}]]`;
      view.dispatch({ changes: { from, to: selection.to, insert: snippet }, selection: { anchor: from + snippet.length } });
      view.focus();
    }
    setShowWikiMenu(false);
  };

  const insertTemplate = (templateContent: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const { state } = view;
      const selection = state.selection.main;
      const line = state.doc.lineAt(selection.from);
      const textBefore = line.text.substring(0, selection.from - line.from);
      const slashIndex = textBefore.lastIndexOf("/template");
      const from = slashIndex !== -1 ? line.from + slashIndex : selection.from;
      view.dispatch({ changes: { from, to: selection.to, insert: templateContent }, selection: { anchor: from + templateContent.length } });
      view.focus();
    }
    setShowTemplateModal(false);
  };

  const forceSyncAll = async () => {
    const allNotes = await indexer.getNotes();
    for (const note of allNotes) { const c = await storage.readNote(note.id); await syncToCloud(note.id, c); }
  };

  if (!mounted) return <div className="h-screen w-screen bg-zinc-50 dark:bg-zinc-950" />;

  return (
    <main className="h-screen w-screen overflow-hidden flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pt-[env(safe-area-inset-top)]">
      <AnimatePresence mode="wait">
        {view === "auth" ? (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col justify-center p-8">
            <div className="max-w-sm mx-auto w-full space-y-12">
              <div className="text-center space-y-2">
                <h1 className="text-5xl font-black tracking-tighter italic">md.app</h1>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.3em]">{authMode === "login" ? "Sign In" : "Create Account"}</p>
              </div>
              <div className="space-y-4">
                <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="Email" className="w-full p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none" />
                <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Password" className="w-full p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none" />
                {authError && <p className="text-center text-xs font-bold text-red-500">{authError}</p>}
                <button onClick={handleRegister} className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black rounded-3xl">
                  {authMode === "login" ? "Sign In" : "Get Started"}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Sidebar Overlay for Mobile */}
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSidebarOpen(false)}
                  className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm z-[40] md:hidden"
                />
              )}
            </AnimatePresence>

            <motion.aside 
              animate={{ 
                width: isSidebarOpen ? 280 : 0,
                x: isSidebarOpen ? 0 : -280
              }} 
              initial={false}
              className={`fixed md:relative inset-y-0 left-0 z-[50] md:z-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden shrink-0 shadow-2xl md:shadow-none`}
            >
              <div className="p-6">
                <button onClick={() => setIsVaultMenuOpen(!isVaultMenuOpen)} className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="min-w-0 text-left"><div className="text-[10px] font-black uppercase tracking-tighter">{activeVault?.name}</div></div>
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-6">
                <div className="space-y-1">
                  <button onClick={() => { setActiveFolder(null); setView("list"); }} className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-sm ${!activeFolder && view === "list" ? "bg-blue-500 text-white" : "text-zinc-500"}`}><Database size={18} /> All Notes</button>
                  {folders.map(f => (<button key={f} onClick={() => { setActiveFolder(f); setView("list"); }} className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-sm ${activeFolder === f && view === "list" ? "bg-blue-500 text-white" : "text-zinc-500"}`}><Folder size={18} /> {f.split('/').pop()}</button>))}
                </div>
              </div>
              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setView("settings")} className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"><Settings size={18} /> Settings</button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><LogOut size={18} /> Logout</button>
              </div>
            </motion.aside>

            <div className="flex-1 flex flex-col relative overflow-hidden bg-white dark:bg-zinc-950">
              {view === "list" ? (
                <motion.div key="list" className="flex-1 flex flex-col">
                  {/* Mobile Header */}
                  <header className="p-6 pb-2 flex justify-between items-center md:hidden">
                    <h1 className="text-2xl font-black italic">{activeVault?.name}</h1>
                    <button onClick={() => setView("settings")} className="p-2 text-zinc-400"><Settings size={24} /></button>
                  </header>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                        <List size={20} />
                      </button>
                      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search everything..." className="flex-1 px-5 py-3 bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-3">
                    <button onClick={() => { setFileName(`note-${Date.now()}`); setContent(""); setView("editor"); }} className="w-full p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex items-center justify-center gap-2 text-zinc-400 font-bold uppercase text-xs tracking-widest"><Plus size={18} /> New Entry</button>
                    {filteredNotes.map(note => (
                      <div key={note.id} onClick={async () => { setFileName(note.id); setContent(""); setView("editor"); const c = await loadNoteContent(note.id); setContent(c); }} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col gap-1 active:scale-[0.99] transition-all hover:shadow-md cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400 group-hover:text-blue-500 transition-colors"><FileText size={20} /></div>
                          <span className="font-bold flex-1 truncate text-sm">{note.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id, e); }} className="p-2 text-zinc-200 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : view === "editor" ? (
                <motion.div key="editor" className="flex-1 flex flex-col overflow-hidden">
                  <header className="flex items-center justify-between px-2 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
                    <div className="flex items-center min-w-0"><button onClick={() => setView("list")} className="p-2 shrink-0"><ChevronLeft size={24} /></button><span className="min-w-0 bg-transparent font-bold text-sm px-1 truncate cursor-default">{fileName.split('/').pop()}</span></div>
                    <div className="flex gap-0.5 items-center shrink-0 pr-2">
                      <button onClick={() => setShowShareOptions(true)} className="p-2 text-zinc-400 hover:text-blue-500"><Share size={20} /></button>
                      <button onClick={() => saveNote()} className={`p-2 transition-colors ${isDirty ? "text-blue-600" : "text-zinc-300"}`}><Save size={20} /></button>
                      <button onClick={() => setEditMode(editMode === "edit" ? "preview" : "edit")} className={`ml-2 p-2 rounded-xl transition-all ${editMode === "preview" ? "bg-blue-500 text-white shadow-lg" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>{editMode === "edit" ? <Eye size={20} /> : <Edit3 size={20} />}</button>
                    </div>
                  </header>
                  <div className="flex-1 flex overflow-hidden relative">
                    <div className="flex-1 relative overflow-hidden">
                      {editMode === "edit" ? (
                        <div className="h-full relative">
                          <CodeMirror 
                            value={content} 
                            height="100%" 
                            theme={isDarkMode ? 'dark' : 'light'} 
                            extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]} 
                            onChange={handleEditorValueChange} 
                            onCreateEditor={(view) => { editorRef.current = view; }} 
                            className="h-full text-base" 
                          />
                          <AnimatePresence>
                            {showSlashMenu && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-12 left-8 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                                <div className="p-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400">Commands</div>
                                <div className="max-h-64 overflow-y-auto p-1">
                                  {filteredSlashCommands.map((cmd, idx) => (
                                    <button key={cmd.id} onClick={() => insertMarkdownSnippet(cmd.snippet)} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${idx === selectedSlashIndex ? "bg-blue-500 text-white shadow-lg" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                                      <div className={`p-1.5 rounded-lg ${idx === selectedSlashIndex ? "bg-white/20" : "bg-zinc-50 dark:bg-zinc-800"}`}>{cmd.icon}</div>
                                      <div><div className="text-xs font-bold">{cmd.label}</div><div className={`text-[9px] ${idx === selectedSlashIndex ? "text-white/70" : "text-zinc-400"}`}>{cmd.description}</div></div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : <div className="h-full w-full p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none shadow-inner"><ReactMarkdown 
  remarkPlugins={[remarkGfm]} 
  components={{ 
    li: ({node, children, ...props}) => {
      const isTask = (node as any)?.checked !== null && (node as any)?.checked !== undefined;
      if (isTask) return <li className="flex items-start gap-2 list-none" style={{ marginLeft: '-1.5rem' }}>{children}</li>;
      return <li {...props}>{children}</li>;
    },
    input: ({node, ...props}) => {
      if (props.type === 'checkbox') {
        const line = (node as any)?.position?.start.line;
        return (
          <input 
            type="checkbox"
            checked={props.checked}
            className="mt-1.5 w-4 h-4 rounded border-zinc-300 text-blue-600 cursor-pointer shrink-0" 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (line) toggleCheckboxItem(line); }}
            readOnly
          />
        );
      }
      return <input {...props} />;
    }
  }}
>
  {content}
</ReactMarkdown></div>}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="settings" className="flex-1 flex flex-col p-8 space-y-8 overflow-y-auto max-w-2xl mx-auto w-full">
                  <header><h1 className="text-3xl font-black tracking-tight italic">Settings</h1></header>
                  <section className="space-y-6">
                    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Security</h2>
                        {activeVault?.encryption_enabled ? (
                          <span className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase"><Shield size={12} /> E2EE Enabled</span>
                        ) : (
                          <button onClick={handleEnableEncryption} className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1 hover:underline"><Lock size={12} /> Enable E2EE</button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data Management</h2>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={exportVault} className="py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center justify-center gap-2"><Database size={14} /> Backup</button>
                        <label className="py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <Plus size={14} /> Restore
                          <input type="file" className="hidden" onChange={importVault} accept=".json" />
                        </label>
                      </div>
                      <button onClick={forceSyncAll} className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Cloud size={16} /> Sync All Notes to Cloud
                      </button>
                    </div>
                  </section>
                </motion.div>
              )}
            </div>
            <AnimatePresence>
              {showUnlockModal && (
                <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="p-10 text-center space-y-6">
                      <div className="mx-auto w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500"><Lock size={40} /></div>
                      <h2 className="text-3xl font-black tracking-tight italic">Vault Locked</h2>
                      <div className="space-y-4">
                        <input type="password" value={vaultPassphrase} onChange={(e) => setVaultPassphrase(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUnlockVault()} placeholder="Passphrase" className="w-full p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center text-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                        <button onClick={handleUnlockVault} disabled={isEncrypting} className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase text-xs tracking-widest rounded-3xl shadow-xl active:scale-[0.98] transition-all">{isEncrypting ? "Decrypting..." : "Unlock Vault"}</button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
