"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Plus,
  FileText,
  Loader2,
  ArrowRight,
  Clock,
  BookOpen,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  chatWithDocument,
  getDocuments,
  type DocumentInfo,
  type ChatResponse,
  type SourceReference,
} from "@/lib/api";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  sources?: SourceReference[];
  confidence?: number;
  processingTime?: number;
  documentName?: string;
}

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(
    undefined
  );
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadDocuments = async () => {
    try {
      const result = await getDocuments();
      setDocuments(result.documents);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
      setDocuments([]);
    }
  };

  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || isLoading) return;

    // Add user message
    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response: ChatResponse = await chatWithDocument(
        question,
        selectedDocId
      );

      const aiMsg: ChatMessage = {
        role: "ai",
        content: response.answer,
        sources: response.sources,
        confidence: response.confidence,
        processingTime: response.processing_time,
        documentName: response.document_name,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "ai",
        content:
          err instanceof Error
            ? `❌ ${err.message}`
            : "Something went wrong. Please make sure the backend server is running.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const confidenceColor = (conf: number) => {
    if (conf >= 0.8) return "var(--green)";
    if (conf >= 0.5) return "var(--orange)";
    return "var(--red)";
  };

  return (
    <AppLayout>
      <div className="flex h-screen">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between px-8 py-5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">Ask EVOLVE</h1>

              {/* Document Selector */}
              <select
                className="px-3 py-1.5 rounded-xl text-xs font-medium outline-none cursor-pointer"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
                value={selectedDocId || ""}
                onChange={(e) =>
                  setSelectedDocId(e.target.value || undefined)
                }
              >
                <option value="">All Documents</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              {/* Backend Status */}
              {backendOnline !== null && (
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: backendOnline
                        ? "var(--green)"
                        : "var(--red)",
                    }}
                  />
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {backendOnline ? "Backend Online" : "Backend Offline"}
                  </span>
                </div>
              )}

              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-[1.03]"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
                }}
                onClick={clearChat}
              >
                <Plus size={14} />
                New Chat
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* Empty State */}
            {messages.length === 0 && (
              <motion.div
                className="flex flex-col items-center justify-center h-full gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), #a29bfe)",
                    boxShadow: "0 0 24px rgba(108,92,231,0.4)",
                  }}
                >
                  <Sparkles size={28} className="text-white" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-white">
                    Ask anything about your documents
                  </h2>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {documents.length > 0
                      ? `${documents.length} document${documents.length !== 1 ? "s" : ""} ready to search`
                      : "Upload a PDF first, then ask questions about it"}
                  </p>
                </div>

                {/* Quick Prompts */}
                {documents.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap justify-center max-w-lg">
                    {[
                      "What is this document about?",
                      "Summarize the key points",
                      "What are the main conclusions?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        className="px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-[1.03]"
                        style={{
                          background: "var(--accent-subtle)",
                          color: "var(--accent-hover)",
                          border: "1px solid rgba(108,92,231,0.2)",
                        }}
                        onClick={() => {
                          setInputValue(prompt);
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {documents.length === 0 && backendOnline && (
                  <a
                    href="/upload"
                    className="mt-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:scale-[1.03]"
                    style={{
                      background: "var(--accent)",
                      boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
                    }}
                  >
                    Upload a PDF →
                  </a>
                )}

                {!backendOnline && (
                  <div
                    className="card px-5 py-4 flex items-center gap-3 mt-2"
                    style={{ borderColor: "rgba(255,107,107,0.3)" }}
                  >
                    <AlertCircle size={18} style={{ color: "var(--red)" }} />
                    <div>
                      <p
                        className="text-xs font-semibold"
                        style={{ color: "var(--red)" }}
                      >
                        Backend server is not running
                      </p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Run: cd backend && uvicorn app.main:app --reload --port
                        8000
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Chat Messages */}
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <div
                      className="max-w-md px-5 py-3 rounded-2xl rounded-br-md text-sm"
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        boxShadow: "0 4px 16px rgba(108,92,231,0.3)",
                      }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-2xl">
                      <div className="flex gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--accent), #a29bfe)",
                          }}
                        >
                          <span className="text-xs font-bold text-white">
                            E
                          </span>
                        </div>
                        <div className="flex-1">
                          {/* Answer */}
                          <div
                            className="p-5 rounded-2xl rounded-tl-md text-sm leading-relaxed whitespace-pre-line"
                            style={{
                              background: "var(--bg-card)",
                              border: "1px solid var(--border)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {msg.content}
                          </div>

                          {/* Metadata bar */}
                          {msg.confidence !== undefined && (
                            <div className="flex items-center gap-4 mt-2">
                              <span
                                className="text-[10px] font-medium flex items-center gap-1"
                                style={{
                                  color: confidenceColor(msg.confidence),
                                }}
                              >
                                Confidence: {Math.round(msg.confidence * 100)}%
                              </span>
                              {msg.processingTime && (
                                <span
                                  className="text-[10px] flex items-center gap-1"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <Clock size={9} />
                                  {msg.processingTime.toFixed(1)}s
                                </span>
                              )}
                              {msg.documentName && (
                                <span
                                  className="text-[10px] flex items-center gap-1"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <BookOpen size={9} />
                                  {msg.documentName}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Source Cards */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3">
                              <p
                                className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Sources ({msg.sources.length})
                              </p>
                              <div className="space-y-2">
                                {msg.sources.slice(0, 3).map((src, k) => (
                                  <div
                                    key={k}
                                    className="card px-4 py-3 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <FileText
                                        size={12}
                                        style={{ color: "var(--accent)" }}
                                      />
                                      <span className="text-[11px] font-semibold text-white">
                                        {src.document_name}
                                        {src.page_number
                                          ? ` · Page ${src.page_number}`
                                          : ""}
                                      </span>
                                      <span
                                        className="text-[9px] ml-auto"
                                        style={{
                                          color: confidenceColor(
                                            src.relevance_score
                                          ),
                                        }}
                                      >
                                        {Math.round(
                                          src.relevance_score * 100
                                        )}
                                        % match
                                      </span>
                                    </div>
                                    <p
                                      className="text-[10px] leading-relaxed line-clamp-2"
                                      style={{
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      {src.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              {msg.sources.length > 3 && (
                                <button
                                  className="flex items-center gap-1 mt-2 text-[11px] font-medium"
                                  style={{ color: "var(--accent)" }}
                                >
                                  View all {msg.sources.length} sources{" "}
                                  <ArrowRight size={11} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), #a29bfe)",
                  }}
                >
                  <span className="text-xs font-bold text-white">E</span>
                </div>
                <div
                  className="px-5 py-4 rounded-2xl rounded-tl-md flex items-center gap-2"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Loader2
                    size={16}
                    className="animate-spin"
                    style={{ color: "var(--accent)" }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Thinking...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div
            className="px-8 py-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <input
                type="text"
                placeholder={
                  documents.length > 0
                    ? "Ask a question about your documents..."
                    : "Upload a PDF first to start chatting..."
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] text-white disabled:opacity-50"
              />
              <button
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
                }}
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
