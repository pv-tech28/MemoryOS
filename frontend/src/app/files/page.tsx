"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  FileText,
  Image,
  FileAudio,
  FolderOpen,
  Search,
  Grid3X3,
  List,
  Download,
  Eye,
} from "lucide-react";

const files = [
  { name: "SilentGuard_Report.pdf", type: "PDF", size: "2.4 MB", date: "15 Jan 2024", icon: FileText, color: "#ea4335" },
  { name: "AI_Integration_Plan.docx", type: "DOCX", size: "1.1 MB", date: "13 Jan 2024", icon: FileText, color: "#4285f4" },
  { name: "Meeting_Notes_Jan12.md", type: "Markdown", size: "24 KB", date: "12 Jan 2024", icon: FileText, color: "#f0f0f0" },
  { name: "Hackathon_Presentation.pptx", type: "PPTX", size: "8.7 MB", date: "18 Jan 2024", icon: FileText, color: "#f0a500" },
  { name: "Team_Photo.jpg", type: "Image", size: "3.2 MB", date: "18 Jan 2024", icon: Image, color: "#e84393" },
  { name: "Prof_Meeting_Recording.mp3", type: "Audio", size: "14.5 MB", date: "12 Jan 2024", icon: FileAudio, color: "#00d68f" },
  { name: "Project_Resources/", type: "Folder", size: "48 files", date: "10 Jan 2024", icon: FolderOpen, color: "#6c5ce7" },
  { name: "Budget_Sheet.csv", type: "CSV", size: "156 KB", date: "9 Jan 2024", icon: FileText, color: "#34a853" },
];

export default function FilesPage() {
  return (
    <AppLayout>
      <div className="p-8 max-w-[1200px] mx-auto">
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white">Files</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Browse and manage all your uploaded files
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <Search size={14} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search files..."
                className="bg-transparent text-xs outline-none text-white placeholder:text-[var(--text-muted)] w-40"
              />
            </div>
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-subtle)", border: "1px solid rgba(108,92,231,0.3)", color: "var(--accent)" }}
            >
              <List size={16} />
            </button>
          </div>
        </motion.div>

        {/* File List */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          {/* Table Header */}
          <div
            className="grid grid-cols-[1fr_100px_100px_140px_100px] px-6 py-3 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}
          >
            <span>Name</span>
            <span>Type</span>
            <span>Size</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>

          {/* File Rows */}
          {files.map((file, i) => {
            const Icon = file.icon;
            return (
              <motion.div
                key={i}
                className="grid grid-cols-[1fr_100px_100px_140px_100px] px-6 py-4 items-center cursor-pointer transition-colors"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                whileHover={{ background: "var(--bg-card)" }}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} style={{ color: file.color }} />
                  <span className="text-sm font-medium text-white">{file.name}</span>
                </div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{file.type}</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{file.size}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{file.date}</span>
                <div className="flex items-center justify-end gap-2">
                  <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                  >
                    <Download size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
