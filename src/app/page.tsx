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
  Folder, History, UserPlus, LogOut, Database, MoreVertical, Shield, Key, Layout
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
import { App } from '@capacitor/app';

// Update Service
import { checkUpdates, GitHubRelease } from "@/lib/update";
import versionData from "../../public/version.json";

// Polyfills
import { Buffer } from "buffer";

// Crypto
import { deriveVaultKey, encryptText, decryptText, generateSalt, EncryptedData } from "@/lib/crypto";

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
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [isVaultMenuOpen, setIsVaultMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // E2EE State
  const [activeVaultKey, setActiveVaultKey] = useState<CryptoKey | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplatePicker, setShowTemplateModal] = useState(false);

  // Sharing (Form A)
  const [inboundNotes, setInboundNotes] = useState<any[]>([]);
  const [showShareNoteModal, setShowShareNoteModal] = useState(false);
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");

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

  const loadTemplates = useCallback(async () => {
    const { value } = await Preferences.get({ key: 'templates' });
    if (value) {
      setTemplates(JSON.parse(value));
    } else {
      // Default templates
      const defaults = [
        { id: 'daily', name: 'Daily Note', content: '# Daily Log: ' + new Date().toLocaleDateString() + '\n\n## Tasks\n- [ ] \n\n## Journal\n' },
        { id: 'meeting', name: 'Meeting Notes', content: '# Meeting: \nDate: ' + new Date().toLocaleDateString() + '\nAttendees: \n\n## Agenda\n\n## Notes\n\n## Action Items\n- [ ] ' }
      ];
      setTemplates(defaults);
      await Preferences.set({ key: 'templates', value: JSON.stringify(defaults) });
    }
  }, []);

  const loadAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;
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
      const { value: adminVal } = await Preferences.get({ key: 'is_admin' });
      setIsAdmin(adminVal === 'true');
      const { value: forceVal } = await Preferences.get({ key: 'force_password' });
      if (forceVal === 'true') {
        setForcePasswordChange(true);
        setShowPasswordModal(true);
      }
      try {
        const res = await fetch('/api/vaults', { headers: { 'Authorization': `Bearer ${value}` } });
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
      } catch (e) { setView("list"); }
    } else { setView("auth"); }
    setIsAuthLoading(false);
  }, []);

  const handleRegister = async () => {
    if (!userEmail || !userPassword) return;
    setSyncStatus("syncing");
    setAuthError(null);
    try {
      let apiBase = 'https://markdownapp.pages.dev';
      
      // Only use relative paths if we're in a standard web browser on the same domain
      // Capacitor usually runs on localhost or a custom scheme, so we should use the full URL
      if (typeof window !== 'undefined' && 
          window.location.hostname !== 'localhost' && 
          !window.location.hostname.includes('127.0.0.1')) {
        apiBase = ''; 
      }

      const res = await fetch(`${apiBase}/api/auth/register`, {
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
        
        if (data.forcePasswordChange) {
          setShowPasswordModal(true);
        }

        setVaults(data.vaults || []);
        if (data.vaults?.length > 0) setActiveVaultId(data.vaults[0].id);
        setView("list");
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch (e) { setAuthError("Auth unreachable"); } finally { setSyncStatus("idle"); }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.current || !passwordForm.new || !authToken) return;
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new })
      });
      if (res.ok) {
        setShowPasswordModal(false);
        setForcePasswordChange(false);
        await Preferences.remove({ key: 'force_password' });
        alert("Password updated successfully!");
      } else {
        const data = await res.json() as any;
        alert(data.error || "Failed to update password");
      }
    } catch (e) {
      alert("Error updating password");
    }
  };

  const fetchInboundNotes = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/notes/share', { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setInboundNotes(data);
      }
    } catch (e) {}
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchInboundNotes();
      const interval = setInterval(fetchInboundNotes, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [authToken, fetchInboundNotes]);

  const handleShareNote = async () => {
    if (!shareRecipientEmail || !fileName || !authToken) return;
    try {
      const res = await fetch('/api/notes/share', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: shareRecipientEmail, noteTitle: fileName.split('/').pop(), content })
      });
      if (res.ok) {
        alert("Note shared successfully!");
        setShowShareNoteModal(false);
        setShareRecipientEmail("");
      } else {
        const data = await res.json();
        alert(data.error || "Sharing failed");
      }
    } catch (e) { alert("Error sharing note"); }
  };

  const acceptInboundNote = async (note: any) => {
    if (!activeVaultId) return;
    const targetId = `shared/${note.note_title}-${Date.now()}`;
    await storage.writeNote(targetId, note.content);
    await indexer.updateNote({
      id: targetId,
      title: note.note_title,
      tags: ['shared'],
      lastModified: Date.now(),
      snippet: note.content.substring(0, 100),
      content: note.content.substring(0, 10000)
    });
    
    // Notify server it's accepted (deletes from pending)
    await fetch('/api/notes/share', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: note.id, status: 'accepted' })
    });

    setInboundNotes(prev => prev.filter(n => n.id !== note.id));
    loadNotes();
    navigateToNote(targetId);
  };

  const deleteInboundNote = async (shareId: string) => {
    await fetch('/api/notes/share', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId, status: 'declined' })
    });
    setInboundNotes(prev => prev.filter(n => n.id !== shareId));
  };

  const loadNotes = useCallback(async () => {
    const result = await indexer.getNotes();
    setNotes(result.sort((a, b) => b.lastModified - a.lastModified));
  }, [indexer]);

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
    loadConfig();
    loadTemplates();
    checkForUpdates();
    if (typeof window !== "undefined") {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      (window as any).Buffer = Buffer;
    }

    // Handle incoming file intents
    App.addListener('appUrlOpen', async (data: any) => {
      // In a real app we'd parse the URL and open the file
      console.log('App opened with URL:', data.url);
    });
  }, [loadAuth, loadConfig, loadTemplates, checkForUpdates]);

  // Vault-level initialization
  useEffect(() => {
    if (activeVault?.encryption_enabled && !activeVaultKey) {
      setShowUnlockModal(true);
    } else {
      loadNotes();
    }
  }, [activeVaultId, activeVault, activeVaultKey, loadNotes]);

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
    await indexer.updateNote({ 
      id: fileName, 
      title, 
      tags: [...new Set(tags)], 
      lastModified: Date.now(), 
      snippet,
      content: plainContent.substring(0, 10000)
    });
    loadNotes();
    setIsDirty(false);
    if (r2Config.accessKey) {
      await syncToCloud(fileName, contentToSave);
    }
    try {
      await fetch(`/api/vaults/revisions?id=${activeVaultId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: fileName, content: contentToSave })
      });
    } catch (e) {}
  }, [fileName, content, activeVaultId, authToken, storage, indexer, loadNotes, r2Config, syncToCloud, activeVault, activeVaultKey]);

  // AUTOSAVE every 30s
  useEffect(() => {
    if (!isDirty || !fileName) return;
    const timer = setTimeout(() => saveNote(), 30000);
    return () => clearTimeout(timer);
  }, [content, isDirty, fileName, saveNote]);

  const loadHistory = async () => {
    if (!fileName || !authToken) return;
    try {
      const res = await fetch(`/api/vaults/revisions?noteId=${fileName}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      const data = await res.json() as any[];
      setRevisions(data);
      setShowHistory(true);
    } catch (e) {}
  };

  const handleShareVault = async (email: string) => {
    if (!activeVaultId || !authToken || !email) return;
    try {
      const res = await fetch('/api/vaults/share', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, vaultId: activeVaultId })
      });
      if (res.ok) {
        alert("Vault shared successfully!");
      }
    } catch (e) {
      console.error("Sharing failed");
    }
  };

  const createNewVault = async () => {
    if (typeof window === 'undefined') return;
    const name = window.prompt("Enter vault name:");
    if (!name || !authToken) return;

    try {
      const res = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        loadAuth(); 
      }
    } catch (e) {
      console.error("Vault creation failed");
    }
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
        // Fallback to raw if not valid JSON or encryption data
        return raw;
      }
    }
    return raw;
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
    await Preferences.remove({ key: 'is_admin' });
    await Preferences.remove({ key: 'force_password' });
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

  const insertMarkdownSnippet = useCallback((snippet: string) => {
    if (snippet === '/template') {
      setShowTemplateModal(true);
      setShowSlashMenu(false);
      return;
    }

    if (snippet === '/link') {
      setShowWikiMenu(true);
      setWikiSearch("");
      setShowSlashMenu(false);
      return;
    }

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
    
    // Wiki-link [[ logic
    const lastDoubleOpen = textBefore.lastIndexOf("[[");
    if (lastDoubleOpen !== -1 && !textBefore.substring(lastDoubleOpen).includes("]]")) {
      const query = textBefore.substring(lastDoubleOpen + 2);
      setWikiSearch(query);
      setShowWikiMenu(true);
      setShowSlashMenu(false);
      return;
    }
    setShowWikiMenu(false);

    // Slash command / logic
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
    if (targetLine.includes('[ ]')) {
      newLine = targetLine.replace('[ ]', '[x]');
    } else if (targetLine.toLowerCase().includes('[x]')) {
      newLine = targetLine.replace(/\[[xX]\]/, '[ ]');
    }
    
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && view === "editor") {
      setView("list");
    }
  };

  const handleUnlockVault = async () => {
    if (!vaultPassphrase || !activeVault?.encryption_salt) return;
    setIsEncrypting(true);
    try {
      const key = await deriveVaultKey(vaultPassphrase, activeVault.encryption_salt);
      setActiveVaultKey(key);
      setShowUnlockModal(false);
      setVaultPassphrase("");
      // Reload notes with the new key
      loadNotes();
    } catch (e) {
      alert("Invalid passphrase");
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleAddFolder = () => {
    const name = window.prompt("Enter folder name:");
    if (!name) return;
    const folderId = activeFolder ? `${activeFolder}/${name}` : name;
    setActiveFolder(folderId);
    setView("list");
  };

  const insertTemplate = (templateContent: string) => {
    if (editorRef.current) {
      const view = editorRef.current;
      const { state } = view;
      const selection = state.selection.main;
      
      // Find the slash to replace
      const line = state.doc.lineAt(selection.from);
      const textBefore = line.text.substring(0, selection.from - line.from);
      const slashIndex = textBefore.lastIndexOf("/template");
      const from = slashIndex !== -1 ? line.from + slashIndex : selection.from;

      view.dispatch({ 
        changes: { from, to: selection.to, insert: templateContent }, 
        selection: { anchor: from + templateContent.length } 
      });
      view.focus();
    }
    setShowTemplateModal(false);
  };

  const addTemplate = async () => {
    const name = window.prompt("Template Name:");
    if (!name) return;
    const newTemplate = { id: crypto.randomUUID(), name, content: content };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    await Preferences.set({ key: 'templates', value: JSON.stringify(updated) });
    alert("Template saved from current editor content!");
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete template?")) return;
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    await Preferences.set({ key: 'templates', value: JSON.stringify(updated) });
  };

  const filteredSlashCommands = SLASH_COMMANDS.filter(cmd => 
    cmd.label.toLowerCase().includes(slashSearch.toLowerCase())
  );

  const filteredWikiNotes = useMemo(() => {
    const q = wikiSearch.toLowerCase();
    return notes.filter(n => n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)).slice(0, 10);
  }, [notes, wikiSearch]);

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

  if (!mounted) return <div className="h-screen w-screen bg-zinc-50 dark:bg-zinc-950" />;

  return (
    <main onKeyDown={handleKeyDown} className="h-screen w-screen overflow-hidden flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pt-[env(safe-area-inset-top)]">
      <AnimatePresence mode="wait">
        {view === "auth" ? (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col justify-center p-8">
            <div className="max-w-sm mx-auto w-full space-y-12">
              <div className="text-center space-y-2">
                <h1 className="text-5xl font-black tracking-tighter italic">md.app</h1>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.3em]">{authMode === "login" ? "Sign In" : "Create Account"}</p>
              </div>
              <div className="space-y-4">
                <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="Email" className="w-full p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Password" className="w-full p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500" />
                {authError && <p className="text-center text-xs font-bold text-red-500">{authError}</p>}
                <button onClick={handleRegister} className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black rounded-3xl shadow-xl active:scale-[0.98] transition-transform">
                  {authMode === "login" ? "Sign In" : "Get Started"}
                </button>
                <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(null); }} className="w-full text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {authMode === "login" ? "Need an account? Register" : "Have an account? Sign In"}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.aside animate={{ width: isSidebarOpen ? 280 : 0 }} className="hidden md:flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 overflow-hidden shrink-0">
              <div className="p-6">
                <button onClick={() => setIsVaultMenuOpen(!isVaultMenuOpen)} className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="min-w-0 text-left"><div className="text-[10px] font-black uppercase tracking-tighter">{activeVault?.name}</div><div className="text-[9px] text-zinc-500 font-bold uppercase">{activeVault?.role}</div></div>
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-6">
                <div>
                  <div className="flex items-center justify-between px-2 mb-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Library</h3>
                    <button onClick={handleAddFolder} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors">
                      <Plus size={14} className="text-zinc-400" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <button onClick={() => { setActiveFolder(null); setView("list"); }} className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-sm ${!activeFolder && view === "list" ? "bg-blue-500 text-white shadow-lg" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}><Database size={18} /> All Notes</button>
                    {folders.map(f => (<button key={f} onClick={() => { setActiveFolder(f); setView("list"); }} className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-sm ${activeFolder === f && view === "list" ? "bg-blue-500 text-white shadow-lg" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}><Folder size={18} /> {f.split('/').pop()}</button>))}
                  </div>
                </div>

                {inboundNotes.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-3">Shared with Me</h3>
                    <div className="space-y-1">
                      {inboundNotes.map(note => (
                        <div key={note.id} className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500"><FileText size={14} /></div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-black truncate">{note.note_title}</div>
                              <div className="text-[9px] text-zinc-400 font-bold truncate">from {note.sender_email}</div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => acceptInboundNote(note)} className="flex-1 py-1.5 bg-blue-500 text-white text-[9px] font-black uppercase rounded-lg shadow-sm active:scale-95 transition-all">Accept</button>
                            <button onClick={() => deleteInboundNote(note.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <button onClick={() => setView("settings")} className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-[0.98]"><Settings size={18} /> Settings</button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-[0.98]"><LogOut size={18} /> Logout</button>
              </div>
            </motion.aside>

            <div className="flex-1 flex flex-col relative overflow-hidden bg-white dark:bg-zinc-950">
              {view === "list" ? (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
                  <header className="p-6 pb-2 flex justify-between items-center md:hidden">
                    <h1 className="text-2xl font-black italic">{activeVault?.name}</h1>
                    <button onClick={() => setView("settings")} className="p-2 text-zinc-400"><Settings size={24} /></button>
                  </header>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:block p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><List size={20} /></button>
                      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search everything..." className="flex-1 px-5 py-3 bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {activeFolder && <div className="flex items-center gap-2 px-2"><button onClick={() => setActiveFolder(null)} className="text-[10px] font-black text-blue-500 uppercase">Root</button><ChevronLeft size={10} className="rotate-180 text-zinc-300" /><span className="text-[10px] font-black text-zinc-400 uppercase truncate">{activeFolder}</span></div>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-3">
                    <button onClick={() => { setFileName(`${activeFolder ? activeFolder+'/' : ''}note-${Date.now()}`); setContent(""); setView("editor"); }} className="w-full p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex items-center justify-center gap-2 text-zinc-400 font-bold uppercase text-xs tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all"><Plus size={18} /> New Entry</button>
                    {filteredNotes.map(note => (
                      <div key={note.id} onClick={async () => { setFileName(note.id); setContent(""); setView("editor"); const c = await loadNoteContent(note.id); setContent(c); }} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col gap-1 active:scale-[0.99] transition-all hover:shadow-md cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400 group-hover:text-blue-500 transition-colors"><FileText size={20} /></div>
                          <span className="font-bold flex-1 truncate text-sm">{note.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id, e); }} className="p-2 text-zinc-200 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                        </div>
                        {note.snippet && <p className="text-xs text-zinc-500 line-clamp-1 pl-12">{note.snippet}</p>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : view === "editor" ? (
                <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
                  <header className="flex items-center justify-between px-2 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
                    <div className="flex items-center min-w-0"><button onClick={() => setView("list")} className="p-2 shrink-0"><ChevronLeft size={24} /></button><input value={fileName.split('/').pop()} title={fileName} readOnly className="min-w-0 bg-transparent font-bold text-sm outline-none px-1 cursor-default" /></div>
                    <div className="flex gap-0.5 items-center shrink-0 pr-2">
                      <div className="px-2">{syncStatus === "syncing" && <Cloud className="animate-pulse text-blue-500" size={18} />}{syncStatus === "success" && <Cloud className="text-green-500" size={18} />}{syncStatus === "error" && <CloudOff className="text-red-500" size={18} />}</div>
                      <button onClick={() => setShowShareNoteModal(true)} className="p-2 text-zinc-400 hover:text-blue-500"><Share size={20} /></button>
                      <button onClick={loadHistory} className="p-2 text-zinc-400 hover:text-blue-500"><History size={20} /></button>
                      <button onClick={() => saveNote()} className={`p-2 transition-colors ${isDirty ? "text-blue-600" : "text-zinc-300"}`}><Save size={20} /></button>
                      <button onClick={() => setEditMode(editMode === "edit" ? "preview" : "edit")} className={`ml-2 p-2 rounded-xl transition-all ${editMode === "preview" ? "bg-blue-500 text-white shadow-lg" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>{editMode === "edit" ? <Eye size={20} /> : <Edit3 size={20} />}</button>
                    </div>
                  </header>
                  <div className="flex-1 flex overflow-hidden relative">
                    <div className="flex-1 relative overflow-hidden">
                      {editMode === "edit" ? (
                        <div className="h-full relative">
                          <CodeMirror value={content} height="100%" theme={isDarkMode ? 'dark' : 'light'} extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]} onChange={handleEditorValueChange} onCreateEditor={(view) => { editorRef.current = view; }} className="h-full text-base" />
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
                                  {filteredSlashCommands.length === 0 && <div className="p-4 text-center text-xs text-zinc-400 font-bold uppercase italic tracking-widest">No match</div>}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {showWikiMenu && (
                              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-12 left-8 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                                <div className="p-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400">Link to Note</div>
                                <div className="max-h-64 overflow-y-auto p-1">
                                  {filteredWikiNotes.map((note) => (
                                    <button key={note.id} onClick={() => insertWikiLink(note.id)} className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-blue-500 hover:text-white transition-colors group">
                                      <div className="p-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg group-hover:bg-white/20"><FileText size={16} /></div>
                                      <div className="text-xs font-bold truncate">{note.title}</div>
                                    </button>
                                  ))}
                                  {filteredWikiNotes.length === 0 && <div className="p-4 text-center text-xs text-zinc-400 font-bold uppercase italic tracking-widest">No notes found</div>}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : <div className="h-full w-full p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none shadow-inner"><ReactMarkdown 
  remarkPlugins={[remarkGfm]} 
  components={{ 
    li: ({node, children, ...props}) => {
      // Check if this list item is a task list item
      const isTask = node?.children?.some((c: any) => c.type === 'element' && (c as any).tagName === 'input' && (c as any).properties?.type === 'checkbox');
      if (isTask) {
        return (
          <li className="flex items-start gap-2 list-none -ml-6" data-line={(node as any)?.position?.start.line}>
            {children}
          </li>
        );
      }
      return <li {...props}>{children}</li>;
    },
    input: ({node, ...props}) => {
      if (props.type === 'checkbox') {
        const line = (node as any)?.position?.start.line;
        return (
          <input 
            {...props} 
            disabled={false}
            className="mt-1.5 w-4 h-4 rounded border-zinc-300 text-blue-600 cursor-pointer shrink-0" 
            onClick={(e) => {
              e.stopPropagation();
              if (line) toggleCheckboxItem(line);
            }}
            onChange={() => {}} // Dummy to prevent React warning
          />
        );
      }
      return <input {...props} />;
    },
    // Custom Wiki-link renderer for text segments
    p: ({children}) => {
      const processWikiLinks = (child: any): any => {
        if (typeof child !== 'string') return child;
        
        const parts = child.split(/(\[\[.*?\]\])/g);
        return parts.map((part, i) => {
          if (part.startsWith('[[') && part.endsWith(']]')) {
            const noteId = part.slice(2, -2);
            return (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigateToNote(noteId);
                }}
                className="text-blue-500 hover:underline font-bold bg-blue-50 dark:bg-blue-900/20 px-1 rounded mx-0.5 inline-block"
              >
                {noteId.split('/').pop()}
              </button>
            );
          }
          return part;
        });
      };

      return <p>{React.Children.map(children, processWikiLinks)}</p>;
    }
  }}
>
  {content}
</ReactMarkdown></div>}
                    </div>
                    <AnimatePresence>{showHistory && <motion.div initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} className="absolute inset-y-0 right-0 w-72 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 z-20 flex flex-col shadow-2xl"><div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center"><h3 className="text-xs font-black uppercase tracking-widest">History</h3><button onClick={() => setShowHistory(false)}><X size={16} /></button></div><div className="flex-1 overflow-y-auto p-2 space-y-1">{revisions.map(rev => (<button key={rev.id} onClick={() => { if(confirm("Restore this version?")) { setContent(rev.content); setIsDirty(true); setShowHistory(false); } }} className="w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors"><div className="text-[10px] font-black text-blue-500 uppercase mb-1">#{rev.hash}</div><div className="text-[10px] text-zinc-500 font-bold">{new Date(rev.created_at * 1000).toLocaleString()}</div><div className="text-[9px] text-zinc-400 truncate mt-1">by {rev.author}</div></button>))}</div></motion.div>}</AnimatePresence>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col p-8 space-y-8 overflow-y-auto max-w-2xl mx-auto w-full">
                  <header><h1 className="text-3xl font-black tracking-tight italic">Settings</h1></header>
                  <section className="space-y-6">
                    <div className="space-y-4">
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Account</h2>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between"><div className="text-sm font-bold truncate">{userEmail}</div><div className="flex gap-2"><button onClick={() => setShowPasswordModal(true)} className="p-2 text-zinc-400 hover:text-blue-500"><Key size={20} /></button></div></div>
                      {isAdmin && (
                        <button onClick={() => window.location.replace("/admin")} className="w-full flex items-center justify-between p-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl">
                          <span>Admin Portal</span>
                          <Shield size={16} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Security</h2>
                        {activeVault?.encryption_enabled ? (
                          <span className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase">
                            <Shield size={12} /> E2EE Enabled
                          </span>
                        ) : (
                          <button onClick={handleEnableEncryption} className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1 hover:underline">
                            <Lock size={12} /> Enable E2EE
                          </button>
                        )}
                      </div>
                      {activeVault?.encryption_enabled && (
                        <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">
                          Content in this vault is encrypted on your device. Only you have the key.
                        </p>
                      )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Templates</h2>
                        <button onClick={addTemplate} className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1"><Plus size={12} /> Save Current as Template</button>
                      </div>
                      <div className="space-y-2">
                        {templates.map(t => (
                          <div key={t.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex items-center justify-between group">
                            <div className="text-sm font-bold">{t.name}</div>
                            <button onClick={() => deleteTemplate(t.id)} className="p-2 text-zinc-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                          </div>
                        ))}
                        {templates.length === 0 && <p className="text-xs text-zinc-400 italic">No templates configured.</p>}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Collaborate</h2>
                      <div className="space-y-3"><input id="shareEmail" placeholder="team@example.com" className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" /><button onClick={() => { const el = document.getElementById('shareEmail') as HTMLInputElement; handleShareVault(el.value); el.value = ''; }} className="w-full py-4 bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"><UserPlus size={18} /> Invite Member</button></div>
                    </div>
                  </section>
                </motion.div>
              )}
            </div>

            <AnimatePresence>
              {showPasswordModal && (
                <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-zinc-100 dark:border-zinc-800">
                      <h2 className="text-2xl font-black tracking-tight italic">{forcePasswordChange ? "Security Reset" : "Change Password"}</h2>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{forcePasswordChange ? "Admin has required a reset" : "Update your security"}</p>
                    </div>
                    <div className="p-8 space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Current Password</label>
                        <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})} className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">New Password</label>
                        <input type="password" value={passwordForm.new} onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})} className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="flex gap-4 pt-4">
                        {!forcePasswordChange && <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-4 text-zinc-500 font-black uppercase text-xs tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-2xl transition-all">Cancel</button>}
                        <button onClick={handlePasswordChange} className="flex-2 px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl active:scale-[0.98] transition-all">Update</button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showTemplatePicker && (
                <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                      <h2 className="text-2xl font-black tracking-tight italic">Choose Template</h2>
                      <button onClick={() => setShowTemplateModal(false)}><X size={20} /></button>
                    </div>
                    <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                      {templates.map(t => (
                        <button key={t.id} onClick={() => insertTemplate(t.content)} className="w-full p-4 text-left bg-zinc-50 dark:bg-zinc-800 hover:bg-blue-500 hover:text-white rounded-2xl font-bold transition-all flex items-center justify-between group">
                          {t.name}
                          <Layout size={16} className="text-zinc-400 group-hover:text-white" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showShareNoteModal && (
                <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                      <h2 className="text-2xl font-black tracking-tight italic">Share Note</h2>
                      <button onClick={() => setShowShareNoteModal(false)}><X size={20} /></button>
                    </div>
                    <div className="p-8 space-y-4">
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Send a copy of "{fileName.split('/').pop()}" to another user.</p>
                      <input 
                        type="email" 
                        value={shareRecipientEmail} 
                        onChange={(e) => setShareRecipientEmail(e.target.value)} 
                        placeholder="recipient@example.com" 
                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                      <button onClick={handleShareNote} className="w-full py-4 bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl active:scale-[0.98] transition-all">Send Note</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {showUnlockModal && (
                <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="p-10 text-center space-y-6">
                      <div className="mx-auto w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500">
                        <Lock size={40} />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-3xl font-black tracking-tight italic">Vault Locked</h2>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                          This vault is protected with End-to-End Encryption.<br/>Enter your passphrase to decrypt your notes.
                        </p>
                      </div>
                      <div className="space-y-4">
                        <input 
                          type="password" 
                          value={vaultPassphrase} 
                          onChange={(e) => setVaultPassphrase(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && handleUnlockVault()}
                          placeholder="Passphrase" 
                          className="w-full p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center text-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
                        />
                        <button 
                          onClick={handleUnlockVault} 
                          disabled={isEncrypting}
                          className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase text-xs tracking-widest rounded-3xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          {isEncrypting ? "Decrypting..." : "Unlock Vault"}
                        </button>
                        <button 
                          onClick={() => { setActiveVaultId(vaults[0]?.id || null); setShowUnlockModal(false); }}
                          className="w-full py-2 text-zinc-400 font-black uppercase text-[9px] tracking-widest"
                        >
                          Cancel & Switch Vault
                        </button>
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
