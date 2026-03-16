"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { Edit3, Eye } from "lucide-react";

export default function MarkdownEditor() {
  const [content, setContent] = useState("# Welcome to md.app\nStart typing...");
  const [view, setView] = useState<"edit" | "preview">("edit");

  // Slash Command logic (Basic Example)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/") {
      // In the next step, we'll add a popup menu here
      console.log("Slash menu triggered");
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden flex flex-col">
      {/* Header / Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
        <span className="text-xs font-bold tracking-widest uppercase text-zinc-400">md.app</span>
        <button 
          onClick={() => setView(view === "edit" ? "preview" : "edit")}
          className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          {view === "edit" ? <Eye size={18} /> : <Edit3 size={18} />}
        </button>
      </div>

      {/* Swipeable Container */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {view === "edit" ? (
            <motion.div
              key="edit"
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="h-full w-full"
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-full p-4 text-base leading-relaxed bg-transparent focus:outline-none resize-none font-mono"
                placeholder="Write markdown..."
              />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="h-full w-full p-6 overflow-y-auto prose dark:prose-invert max-w-none"
            >
              <ReactMarkdown>{content}</ReactMarkdown>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}