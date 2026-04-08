"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Shield, Database, Lock, 
  ChevronLeft, Search, Edit2, Trash2, 
  Save, X, Check, AlertCircle, HardDrive,
  UserX, UserCheck, Key
} from "lucide-react";
import { Preferences } from '@capacitor/preferences';
import { apiFetch } from "@/lib/api";
import { Capacitor } from "@capacitor/core";

interface User {
  id: string;
  email: string;
  is_admin: number;
  status: 'active' | 'suspended' | 'deactivated';
  force_password_change: number;
  two_factor_enabled: number;
  storage_quota_mb: number;
  current_usage_bytes: number;
  created_at: number;
  last_login: number | null;
}

export default function AdminPortal() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    email: "",
    password: "",
    is_admin: false,
    status: 'active',
    force_password_change: false,
    two_factor_enabled: false,
    storage_quota_mb: 500
  });

  const handleGoBack = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      window.location.href = "index.html"; 
    } else {
      window.location.replace("/");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { value: token } = await Preferences.get({ key: 'auth_token' });
      if (!token) {
        handleGoBack();
        return;
      }

      const res = await apiFetch("/api/admin/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 401) handleGoBack();
        throw new Error("Failed to fetch users");
      }

      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [handleGoBack]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      password: "",
      is_admin: user.is_admin === 1,
      status: user.status || 'active',
      force_password_change: user.force_password_change === 1,
      two_factor_enabled: user.two_factor_enabled === 1,
      storage_quota_mb: user.storage_quota_mb
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      const { value: token } = await Preferences.get({ key: 'auth_token' });
      const res = await apiFetch("/api/admin/users", {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: editingUser.id,
          ...editForm
        })
      });

      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update user");
      }
    } catch (e) {
      alert("Error saving user");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      const { value: token } = await Preferences.get({ key: 'auth_token' });
      const res = await apiFetch(`/api/admin/users?id=${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (e) {
      alert("Error deleting user");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-white"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={handleGoBack} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-black tracking-tighter italic">Admin Portal</h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Management & Governance</p>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..." 
              className="pl-12 pr-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80 shadow-sm"
            />
          </div>
        </header>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle size={20} />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => (
            <motion.div 
              layoutId={user.id}
              key={user.id} 
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              {user.status === 'suspended' && (
                <div className="absolute inset-0 bg-red-500/5 backdrop-blur-[1px] pointer-events-none z-10" />
              )}
              
              <div className="flex justify-between items-start mb-4 relative z-20">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                  {user.status === 'suspended' ? <UserX size={24} className="text-red-500" /> : <Users size={24} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(user)} className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-1 relative z-20">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg truncate">{user.email}</h3>
                  {user.status === 'suspended' && <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase rounded-full">Suspended</span>}
                </div>
                <p className="text-[10px] text-zinc-400 font-mono truncate">{user.id}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-4 relative z-20">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-tighter">Status</p>
                  <div className="flex items-center gap-1.5">
                    {user.is_admin === 1 ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-purple-500 uppercase">
                        <Shield size={10} /> Admin
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-zinc-400 uppercase">{user.status}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-tighter">Usage</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                    <Database size={10} className="text-zinc-400" /> 
                    {(user.current_usage_bytes / (1024 * 1024)).toFixed(1)} / {user.storage_quota_mb}MB
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-tighter">Security</p>
                  <div className="flex flex-col gap-1">
                    {user.two_factor_enabled === 1 && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-green-500 uppercase">
                        <Lock size={10} /> 2FA
                      </span>
                    )}
                    {user.force_password_change === 1 && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase">
                        <Key size={10} /> Reset Req.
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-tighter">Joined</p>
                  <p className="text-[10px] font-black uppercase">{new Date(user.created_at * 1000).toLocaleDateString()}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {editingUser && (
            <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden my-auto"
              >
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight italic">Manage Account</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Policy & access control</p>
                  </div>
                  <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Email Address</label>
                    <input 
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Account Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['active', 'suspended', 'deactivated'].map((s) => (
                        <button 
                          key={s}
                          onClick={() => setEditForm({...editForm, status: s as any})}
                          className={`py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${editForm.status === s ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent" : "bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 text-zinc-400"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Storage Quota (MB)</label>
                      <input 
                        type="number"
                        value={editForm.storage_quota_mb}
                        onChange={(e) => setEditForm({...editForm, storage_quota_mb: parseInt(e.target.value)})}
                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                      />
                    </div>
                    <div className="flex flex-col justify-end gap-3">
                      <button 
                        onClick={() => setEditForm({...editForm, is_admin: !editForm.is_admin})}
                        className={`p-4 rounded-2xl border text-xs font-black uppercase transition-all flex items-center justify-between ${editForm.is_admin ? "bg-purple-500 border-purple-600 text-white shadow-lg" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"}`}
                      >
                        Admin {editForm.is_admin ? <Shield size={14} /> : <Users size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button 
                      onClick={() => setEditForm({...editForm, force_password_change: !editForm.force_password_change})}
                      className={`w-full p-4 rounded-2xl border text-xs font-black uppercase transition-all flex items-center justify-between ${editForm.force_password_change ? "bg-amber-500 border-amber-600 text-white shadow-lg" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"}`}
                    >
                      Force Password Reset {editForm.force_password_change ? <Key size={14} /> : <Check size={14} />}
                    </button>

                    <button 
                      onClick={() => setEditForm({...editForm, two_factor_enabled: !editForm.two_factor_enabled})}
                      className={`w-full p-4 rounded-2xl border text-xs font-black uppercase transition-all flex items-center justify-between ${editForm.two_factor_enabled ? "bg-green-500 border-green-600 text-white shadow-lg" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"}`}
                    >
                      2FA Security {editForm.two_factor_enabled ? <Check size={14} /> : <Lock size={14} />}
                    </button>
                  </div>
                </div>

                <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex gap-4">
                  <button onClick={() => setEditingUser(null)} className="flex-1 py-4 text-zinc-500 font-black uppercase text-xs tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-2xl transition-all">
                    Cancel
                  </button>
                  <button onClick={handleSave} className="flex-2 px-12 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center gap-2">
                    <Save size={16} /> Save Policy
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
