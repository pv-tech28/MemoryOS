"use client";

import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  Mail,
  HardDrive,
  Calendar,
  GitBranch,
  BookOpen,
  MessageSquare,
  StickyNote,
  FolderOpen,
  Upload,
  FileText,
  Image,
  Mic,
  FolderUp,
} from "lucide-react";

const sources = [
  {
    name: "Gmail",
    detail: "siddh.tyagi@gmail.com",
    icon: Mail,
    color: "#ea4335",
    bg: "rgba(234,67,53,0.12)",
    connected: true,
    count: "2,134 emails",
  },
  {
    name: "Google Drive",
    detail: "siddhdrive@gmail.com",
    icon: HardDrive,
    color: "#4285f4",
    bg: "rgba(66,133,244,0.12)",
    connected: true,
    count: "1,089 files",
  },
  {
    name: "Google Calendar",
    detail: "siddhcalendar@gmail.com",
    icon: Calendar,
    color: "#34a853",
    bg: "rgba(52,168,83,0.12)",
    connected: true,
    count: "248 events",
  },
  {
    name: "GitHub",
    detail: "siddhtyagi18",
    icon: GitBranch,
    color: "#f0f0f0",
    bg: "rgba(240,240,240,0.08)",
    connected: true,
    count: "143 repositories",
  },
  {
    name: "Notion",
    detail: "Siddh's Notion",
    icon: BookOpen,
    color: "#ffffff",
    bg: "rgba(255,255,255,0.06)",
    connected: true,
    count: "328 pages",
  },
  {
    name: "WhatsApp Backup",
    detail: "Uploaded backup",
    icon: MessageSquare,
    color: "#25d366",
    bg: "rgba(37,211,102,0.12)",
    connected: true,
    count: "1,256 messages",
  },
  {
    name: "OneNote",
    detail: "siddh@outlook.com",
    icon: StickyNote,
    color: "#7b2d8e",
    bg: "rgba(123,45,142,0.12)",
    connected: false,
    count: null,
  },
  {
    name: "Local Files",
    detail: "Select folder",
    icon: FolderOpen,
    color: "#f0a500",
    bg: "rgba(240,165,0,0.12)",
    connected: false,
    count: null,
  },
];

const uploadZones = [
  {
    icon: FileText,
    title: "Upload PDF / Docs",
    desc: "Drag & drop files here or click to browse",
    color: "#4facfe",
  },
  {
    icon: Image,
    title: "Upload Images",
    desc: "Drag & drop images here or click to browse",
    color: "#e84393",
  },
  {
    icon: Mic,
    title: "Upload Audio",
    desc: "Drag & drop audio files or click to browse",
    color: "#f0a500",
  },
  {
    icon: FolderUp,
    title: "Upload Folder",
    desc: "Upload a folder from your device",
    color: "#00d68f",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" as const },
  }),
};

export default function SourcesPage() {
  return (
    <AppLayout>
      <div className="p-8 max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white">Sources</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Connect and manage all your data sources
          </p>
        </motion.div>

        {/* Source Cards Grid */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          {sources.map((source, i) => {
            const Icon = source.icon;
            return (
              <motion.div
                key={source.name}
                className="card p-5"
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: source.bg }}
                  >
                    <Icon size={22} style={{ color: source.color }} />
                  </div>
                  {source.connected ? (
                    <span className="badge-connected">Connected</span>
                  ) : (
                    <span className="badge-not-connected">Not connected</span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-white">
                  {source.name}
                </h3>
                <p
                  className="text-[11px] mt-0.5 truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {source.detail}
                </p>

                {source.count && (
                  <p
                    className="text-[11px] mt-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {source.count}
                  </p>
                )}

                <button
                  className="w-full mt-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
                  style={
                    source.connected
                      ? {
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                        }
                      : {
                          background: "var(--accent)",
                          color: "#fff",
                          boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
                        }
                  }
                >
                  {source.connected ? "Manage" : "Connect"}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Upload New Source
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {uploadZones.map((zone, i) => {
              const ZoneIcon = zone.icon;
              const isPdf = zone.title.includes("PDF");
              const cardContent = (
                <motion.div
                  className="rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer text-center transition-all hover:scale-[1.02] h-full"
                  style={{
                    border: "2px dashed var(--border)",
                    background: "var(--bg-card)",
                    minHeight: 160,
                  }}
                  whileHover={{
                    borderColor: "rgba(108,92,231,0.4)",
                    background: "var(--bg-card-hover)",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${zone.color}15`,
                    }}
                  >
                    <ZoneIcon size={22} style={{ color: zone.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {zone.title}
                    </p>
                    <p
                      className="text-[10px] mt-1 leading-snug"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {zone.desc}
                    </p>
                  </div>
                  <Upload
                    size={14}
                    style={{ color: "var(--text-muted)", marginTop: 4 }}
                  />
                </motion.div>
              );

              return isPdf ? (
                <Link href="/upload" key={zone.title} className="block h-full">
                  {cardContent}
                </Link>
              ) : (
                <div key={zone.title} className="h-full">
                  {cardContent}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
