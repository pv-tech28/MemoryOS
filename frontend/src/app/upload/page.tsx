"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  MessageSquare,
  Clock,
  HardDrive,
  FileUp,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  type DocumentInfo,
  type UploadResponse,
} from "@/lib/api";

type UploadStatus = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const result = await getDocuments();
      setDocuments(result.documents);
    } catch {
      // Backend might not be running yet
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Only PDF files are supported.");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadMessage(`Uploading ${file.name}...`);
    setErrorMessage("");

    try {
      // Upload with progress
      setUploadMessage(`Uploading ${file.name}...`);
      const result: UploadResponse = await uploadDocument(file, (progress) => {
        setUploadProgress(progress);
        if (progress === 100) {
          setUploadStatus("processing");
          setUploadMessage("Processing: Parsing → Chunking → Embedding...");
        }
      });

      setUploadStatus("done");
      setUploadMessage(result.message);

      // Refresh document list
      await loadDocuments();

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
        setUploadProgress(0);
      }, 3000);
    } catch (err) {
      setUploadStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Upload failed. Is the backend running?"
      );
    }
  }, []);

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      await loadDocuments();
    } catch {
      setErrorMessage("Failed to delete document.");
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-[1000px] mx-auto">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white">Upload Documents</h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Upload PDFs to build your memory. Ask questions after processing.
          </p>
        </motion.div>

        {/* Upload Zone */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div
            className="relative rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
            style={{
              border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
              background: isDragging ? "var(--accent-subtle)" : "var(--bg-card)",
              minHeight: 220,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />

            <AnimatePresence mode="wait">
              {uploadStatus === "idle" && (
                <motion.div
                  key="idle"
                  className="flex flex-col items-center gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "var(--accent-subtle)",
                      border: "1px dashed rgba(108,92,231,0.3)",
                    }}
                  >
                    <FileUp
                      size={28}
                      style={{ color: "var(--accent)" }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Drag & drop your PDF here
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      or click to browse • PDF files only
                    </p>
                  </div>
                </motion.div>
              )}

              {(uploadStatus === "uploading" ||
                uploadStatus === "processing") && (
                <motion.div
                  key="uploading"
                  className="flex flex-col items-center gap-4 w-full max-w-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Loader2
                    size={32}
                    className="animate-spin"
                    style={{ color: "var(--accent)" }}
                  />
                  <p className="text-sm font-medium text-white">
                    {uploadMessage}
                  </p>
                  {/* Progress Bar */}
                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--accent)" }}
                      initial={{ width: 0 }}
                      animate={{
                        width:
                          uploadStatus === "processing"
                            ? "100%"
                            : `${uploadProgress}%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {uploadStatus === "processing"
                      ? "AI is analyzing your document..."
                      : `${uploadProgress}% uploaded`}
                  </p>
                </motion.div>
              )}

              {uploadStatus === "done" && (
                <motion.div
                  key="done"
                  className="flex flex-col items-center gap-3"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CheckCircle size={40} style={{ color: "var(--green)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>
                    Upload Complete!
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {uploadMessage}
                  </p>
                </motion.div>
              )}

              {uploadStatus === "error" && (
                <motion.div
                  key="error"
                  className="flex flex-col items-center gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <XCircle size={40} style={{ color: "var(--red)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--red)" }}>
                    Upload Failed
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {errorMessage}
                  </p>
                  <button
                    className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                    style={{ background: "var(--accent)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadStatus("idle");
                      setErrorMessage("");
                    }}
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Uploaded Documents List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Uploaded Documents
            </h2>
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {isLoading ? (
            <div className="card p-10 flex items-center justify-center">
              <Loader2
                size={24}
                className="animate-spin"
                style={{ color: "var(--accent)" }}
              />
              <span
                className="ml-3 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Loading documents...
              </span>
            </div>
          ) : documents.length === 0 ? (
            <div className="card p-10 flex flex-col items-center gap-3">
              <FileText size={32} style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No documents uploaded yet. Upload a PDF to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  className="card p-5 flex items-center gap-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(234,67,53,0.12)" }}
                  >
                    <FileText size={20} style={{ color: "#ea4335" }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <HardDrive size={10} />
                        {formatFileSize(doc.file_size)}
                      </span>
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <FileText size={10} />
                        {doc.page_count} pages
                      </span>
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <MessageSquare size={10} />
                        {doc.chunk_count} chunks
                      </span>
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Clock size={10} />
                        {formatDate(doc.uploaded_at)}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={
                      doc.status === "ready"
                        ? "badge-connected"
                        : "badge-not-connected"
                    }
                  >
                    {doc.status === "ready" ? "Ready" : doc.status}
                  </span>

                  {/* Actions */}
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]"
                    style={{ color: "var(--text-muted)" }}
                    onClick={() => handleDelete(doc.id)}
                    title="Delete document"
                  >
                    <Trash2 size={15} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
