"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Mail,
  CalendarDays,
  HardDrive,
  Search,
  Grid3X3,
  Trash2,
  Upload,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getDocuments, deleteDocument, type DocumentInfo } from "@/lib/api";

export default function FilesPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
      setDocuments((docs) => docs.filter((d) => d.id !== docId));
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

  const getFileBadgeStyle = (doc: DocumentInfo) => {
    const source = (doc as any).source || "upload";
    if (source === "gmail") {
      return {
        bg: "rgba(244, 63, 94, 0.1)",
        text: "#fb7185",
        border: "rgba(244, 63, 94, 0.2)",
      };
    }
    if (source === "drive") {
      return {
        bg: "rgba(6, 182, 212, 0.1)",
        text: "#22d3ee",
        border: "rgba(6, 182, 212, 0.2)",
      };
    }
    if (source === "calendar") {
      return {
        bg: "rgba(16, 185, 129, 0.1)",
        text: "#34d399",
        border: "rgba(16, 185, 129, 0.2)",
      };
    }
    return {
      bg: "rgba(139, 92, 246, 0.1)",
      text: "#a78bfa",
      border: "rgba(139, 92, 246, 0.2)",
    };
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
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
    return "Document";
  };

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-8 max-w-[1200px] mx-auto">
        {/* Header Bar */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">Files & Vault</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {documents.length} Indexed
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Browse, search, and interrogate all connected files in your AI memory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all duration-300"
              style={{
                background: "rgba(13, 14, 28, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              }}
            >
              <Search size={14} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search files..."
                className="bg-transparent text-xs outline-none text-white placeholder:text-[var(--text-muted)] w-36 sm:w-48"
              />
            </div>

            {/* Upload Button */}
            <Link
              href="/upload"
              className="btn-prism flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>Upload New</span>
            </Link>
          </div>
        </motion.div>

        {/* Files Glass Table */}
        <motion.div
          className="rounded-2xl overflow-hidden glass-specular"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Table Header */}
          <div
            className="grid grid-cols-[1fr_110px_100px_130px_110px] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-wider select-none"
            style={{
              background: "rgba(10, 11, 24, 0.7)",
              color: "var(--text-muted)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <span>Document Name</span>
            <span>Origin</span>
            <span>File Size</span>
            <span>Indexed Date</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="px-6 py-16 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Loading knowledge vault...
              </p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="px-6 py-16 text-center flex flex-col items-center justify-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(139, 92, 246, 0.1)", color: "#a78bfa" }}
              >
                <FileText size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">No files found</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {searchTerm ? "No documents match your query." : "Upload documents or connect sources to begin indexing."}
                </p>
              </div>
            </div>
          ) : (
            filteredDocs.map((doc, i) => {
              const Icon = getFileIcon(doc);
              const badge = getFileBadgeStyle(doc);

              return (
                <motion.div
                  key={doc.id}
                  className="grid grid-cols-[1fr_110px_100px_130px_110px] px-6 py-4 items-center cursor-pointer transition-all duration-200 group"
                  style={{
                    borderTop: i > 0 ? "1px solid rgba(255, 255, 255, 0.04)" : "none",
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  whileHover={{
                    background: "rgba(22, 22, 45, 0.65)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="text-sm font-medium text-white truncate group-hover:text-cyan-300 transition-colors">
                      {doc.filename}
                    </span>
                  </div>

                  {/* Origin Badge */}
                  <div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
                      style={{
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {getFileType(doc)}
                    </span>
                  </div>

                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    {formatFileSize(doc.file_size)}
                  </span>

                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(doc.uploaded_at)}
                  </span>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-1.5">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/ask?docId=${doc.id}&docName=${encodeURIComponent(doc.filename)}`);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{
                        background: "rgba(139, 92, 246, 0.12)",
                        color: "#a78bfa",
                        border: "1px solid rgba(139, 92, 246, 0.25)",
                      }}
                      title="Interrogate with EVOLVE AI"
                    >
                      <MessageSquare size={13} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleDelete(doc.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:text-rose-400"
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        color: "var(--text-muted)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                      }}
                      title="Delete document"
                    >
                      <Trash2 size={13} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
