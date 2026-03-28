"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight, Shield, Zap, Share2, Database, Globe } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tighter italic">md.app</h1>
        </div>
        <div className="flex gap-4">
          <Link href="/?auth=1" className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-black rounded-full hover:scale-105 active:scale-95 transition-all">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="max-w-3xl">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8"
          >
            Markdown for <span className="text-blue-500">Families</span>, <span className="text-zinc-400">Teams,</span> & <span className="text-zinc-400">Companies.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-500 dark:text-zinc-400 font-medium mb-12 max-w-xl"
          >
            A local-first, premium note-taking experience with end-to-end data ownership. Sync effortlessly via Cloudflare R2.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-4"
          >
            <Link href="/?auth=1" className="px-10 py-5 bg-blue-500 text-white text-lg font-black rounded-3xl hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-3">
              Start your Vault <ChevronRight size={20} />
            </Link>
          </motion.div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-40">
          <FeatureCard 
            icon={<Shield className="text-blue-500" />}
            title="Data Ownership"
            description="Your notes stay in your S3/R2 bucket. No proprietary databases, no lock-in."
          />
          <FeatureCard 
            icon={<Zap className="text-purple-500" />}
            title="Local First"
            description="Lightning fast performance. Edit offline, sync when you're back. Zero lag."
          />
          <FeatureCard 
            icon={<Share2 className="text-green-500" />}
            title="Enterprise Sharing"
            description="Share specific vaults with family or team members with granular permissions."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-20 bg-zinc-100 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-12">
          <div className="space-y-4">
            <h3 className="text-xl font-black italic">md.app</h3>
            <p className="text-zinc-500 text-sm font-bold">Built Networks © 2026</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stack</h4>
              <ul className="text-sm font-bold space-y-2 text-zinc-500">
                <li>Next.js</li>
                <li>Capacitor</li>
                <li>Cloudflare R2</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Legal</h4>
              <ul className="text-sm font-bold space-y-2 text-zinc-500">
                <li>Privacy Policy</li>
                <li>Data Safety</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all">
      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl w-fit mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-black tracking-tight mb-3">{title}</h3>
      <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">{description}</p>
    </div>
  );
}
