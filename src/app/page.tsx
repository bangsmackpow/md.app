"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { Edit3, Eye, Save } from "lucide-react";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export default function MarkdownEditor() {
  const [content, setContent] = useState("# Welcome to md.app\nStart typing...");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [fileName, setFileName] = useState("note-1");

  const saveFile = async () => {
    try {
      await Filesystem.writeFile({
        path: `md-app/${fileName}.md`,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
      });
      // In a real app, maybe use a Toast instead of an alert
      alert(`Saved: ${fileName}.md`);
    } catch (e) {
      console.error('Save failed', e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/") {
      // Logic for slash menu will go here
      console.log("Slash menu triggered");
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black tracking-widest uppercase text-zinc-400">Built Networks</span>
          <input 
            value={fileName} 
            onChange={(e) => setFileName(e.target.value)}
            className="bg-transparent text-sm font-bold focus:outline-none border-none p-0 h-4"
          />
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={saveFile}
            className="p-2 rounded-lg bg-blue-600 text-white active:scale-95 transition-transform"
          >
            <Save size={18} />
          </button>
          <button 
            onClick={() => setView(view === "edit" ? "preview" : "edit")}
            className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 active:scale-95 transition-transform"
          >
            {view === "edit" ? <Eye size={18} /> : <Edit3 size={18} />}
          </button>
        </div>
      </header>

      {/* Editor/Preview Area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "edit" ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full w-full"
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoFocus
                className="w-full h-full p-6 text-base leading-relaxed bg-transparent focus:outline-none resize-none font-mono"
                placeholder="Start writing..."
              />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full w-full p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none"
            >
              <ReactMarkdown>{content}</ReactMarkdown>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}