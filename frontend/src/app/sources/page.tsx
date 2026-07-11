"use client";

import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Image,
  Mic,
  FolderUp,
  Trash2,
} from "lucide-react";
import { getDocuments, deleteDocument } from "@/lib/api";

interface Document {
  id: string;
  filename: string;
  upload_date: string;
  page_count: number;
  chunk_count: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" as const },
  }),
};

export default function SourcesPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const docs = await getDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

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
            Upload and manage your documents
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-10"
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Upload New Document
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
                  whileHover={isPdf ? {
                    borderColor: "rgba(108,92,231,0.4)",
                    background: "var(--bg-card-hover)",
                  } : {}}
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
                  {isPdf && (
                    <Upload
                      size={14}
                      style={{ color: "var(--text-muted)", marginTop: 4 }}
                    />
                  )}
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

        {/* Uploaded Documents Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Uploaded Documents ({documents.length})
          </h2>
          {loading ? (
            <p style={{ color: "var(--text-secondary)" }}>Loading documents...</p>
          ) : documents.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No documents uploaded yet. Upload one above!</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {documents.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  className="card p-5"
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(79,172,254,0.12)" }}
                    >
                      <FileText size={22} style={{ color: "#4facfe" }} />
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10"
                    >
                      <Trash2 size={16} style={{ color: "#e84393" }} />
                    </button>
                  </div>

                  <h3 className="text-sm font-semibold text-white truncate">
                    {doc.filename}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                    >
                      {doc.page_count} pages
                    </span>
                    <span
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                    >
                      {doc.chunk_count} chunks
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
