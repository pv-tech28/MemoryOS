"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  FileText,
  Mail,
  CalendarDays,
  HardDrive,
  Search,
  Grid3X3,
  List,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getDocuments, deleteDocument, type DocumentInfo } from "@/lib/api";

export default function FilesPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getDocuments();
        setDocuments(data.documents || []);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const getFileIcon = (doc: DocumentInfo) => {
    const source = (doc as any).source || "upload";
    if (source === "gmail") return Mail;
    if (source === "drive") return HardDrive;
    if (source === "calendar") return CalendarDays;
    return FileText;
  };

  const getFileColor = (doc: DocumentInfo) => {
    const source = (doc as any).source || "upload";
    if (source === "gmail") return "#ea4335";
    if (source === "drive") return "#4285f4";
    if (source === "calendar") return "#34a853";
    return "#e84393";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const getFileType = (doc: DocumentInfo) => {
    const source = (doc as any).source || "upload";
    if (source === "gmail") return "Email";
    if (source === "drive") return "Drive";
    if (source === "calendar") return "Event";
    return "PDF";
  };

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
          {loading ? (
            <div className="px-6 py-8 text-center">
              <p style={{ color: "var(--text-secondary)" }}>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p style={{ color: "var(--text-muted)" }}>No documents uploaded yet. Go to Sources to add files!</p>
            </div>
          ) : (
            documents.map((doc, i) => {
              const Icon = getFileIcon(doc);
              return (
                <motion.div
                  key={doc.id}
                  className="grid grid-cols-[1fr_100px_100px_140px_100px] px-6 py-4 items-center cursor-pointer transition-colors"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  whileHover={{ background: "var(--bg-card)" }}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} style={{ color: getFileColor(doc) }} />
                    <span className="text-sm font-medium text-white">{doc.filename}</span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{getFileType(doc)}</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatFileSize(doc.file_size)}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(doc.uploaded_at)}</span>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
