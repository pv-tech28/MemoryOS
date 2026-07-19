"use client";
// Fixed chat history and memory graph

import AppLayout from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Plus,
  FileText,
  Loader2,
  Clock,
  BookOpen,
  AlertCircle,
  Sparkles,
  Mic,
  Paperclip,
  Search,
  MessageSquare,
  Calendar as CalendarIcon,
  Mail,
  HardDrive,
  TrendingUp,
  Brain,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  chatWithDocument,
  getDocuments,
  checkHealth,
  type DocumentInfo,
  type ChatResponse,
  type SourceReference,
  type RelatedEntity,
} from "@/lib/api";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  sources?: SourceReference[];
  confidence?: number;
  processingTime?: number;
  documentName?: string;
  related_entities?: RelatedEntity[];
  related_graph_nodes?: any[];
  memory_ids?: string[];
  related_documents?: any[];
  related_emails?: any[];
  related_calendar_events?: any[];
  follow_up_suggestions?: string[];
}

interface ChatHistoryItem {
  id: string;
  title: string;
  date: Date;
  messages: ChatMessage[];
}

export default function AskPage() {
  // State for chat
  const [currentChat, setCurrentChat] = useState<ChatHistoryItem | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [knowledgeSource, setKnowledgeSource] = useState<string>("all");
  const [searchChats, setSearchChats] = useState<string>("");
  const [backendOnline, setBackendOnline] = useState(false);

  // Chat history (stored in localStorage)
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);

  // Load chat history and last active chat from localStorage only on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("chatHistory");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const loadedHistory = parsed.map((item: any) => ({
              ...item,
              date: new Date(item.date),
            }));
            setChatHistory(loadedHistory);
            // Restore last active chat if it exists, otherwise use most recent
            if (loadedHistory.length > 0) {
              const savedChatId = localStorage.getItem("lastActiveChatId");
              const lastChat = savedChatId 
                ? loadedHistory.find(c => c.id === savedChatId) 
                : loadedHistory[0];
              if (lastChat) {
                setCurrentChat(lastChat);
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse chat history, resetting:", e);
        localStorage.removeItem("chatHistory");
        localStorage.removeItem("lastActiveChatId");
      }
      setChatHistoryLoaded(true);
    }
  }, []);

  // Save chat history and last active chat to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && chatHistoryLoaded) {
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
      if (currentChat) {
        localStorage.setItem("lastActiveChatId", currentChat.id);
      }
    }
  }, [chatHistory, chatHistoryLoaded, currentChat]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  // Load documents
  useEffect(() => {
    const checkAndLoad = async () => {
      const isOnline = await checkHealth();
      setBackendOnline(isOnline);
      if (isOnline) {
        await loadDocuments();
      }
    };
    checkAndLoad();
    // Poll backend health every 2 seconds
    const interval = setInterval(async () => {
      const isOnline = await checkHealth();
      if (isOnline && !backendOnline) {
        await loadDocuments();
      }
      setBackendOnline(isOnline);
    }, 2000);
    return () => clearInterval(interval);
  }, [backendOnline]);

  const loadDocuments = async () => {
    try {
      const result = await getDocuments();
      setDocuments(result.documents);
    } catch {
      console.error("Failed to load docs");
    }
  };

  // Group chat history by date
  const groupChatHistory = (chats: ChatHistoryItem[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayChats: ChatHistoryItem[] = [];
    const yesterdayChats: ChatHistoryItem[] = [];
    const olderChats: ChatHistoryItem[] = [];

    for (const chat of chats) {
      const date = new Date(chat.date);
      if (date.toDateString() === today.toDateString()) {
        todayChats.push(chat);
      } else if (date.toDateString() === yesterday.toDateString()) {
        yesterdayChats.push(chat);
      } else {
        olderChats.push(chat);
      }
    }

    return { todayChats, yesterdayChats, olderChats };
  };

  const filteredChatHistory = chatHistory.filter((chat) =>
    chat.title.toLowerCase().includes(searchChats.toLowerCase())
  );

  const { todayChats, yesterdayChats, olderChats } =
    groupChatHistory(filteredChatHistory);

  // Follow up suggestions
  const generateFollowUps = () => {
    return [
      "Explain this further",
      "Summarize this",
      "Show related documents",
      "Find related emails",
      "What should I study next?",
    ];
  };

  // Handle send
  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || isLoading) return;

    // Create user message
    const userMsg: ChatMessage = { role: "user", content: question };

    // Update current chat
    if (!currentChat) {
      const newChat: ChatHistoryItem = {
        id: "temp-id", // Temporary ID until backend responds
        title: question.slice(0, 50) + (question.length > 50 ? "..." : ""),
        date: new Date(),
        messages: [userMsg],
      };
      setCurrentChat(newChat);
      setChatHistory((prev) => [newChat, ...prev]);
    } else {
      setCurrentChat((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, userMsg] }
          : prev
      );
    }

    // Clear input
    setInputValue("");
    setIsLoading(true);

    try {
      // Call backend API
      const response: ChatResponse = await chatWithDocument(
        question,
        currentChat?.id === "temp-id" ? undefined : currentChat?.id
      );

      // Create AI message
      const aiMsg: ChatMessage = {
        role: "ai",
        content: response.answer,
        sources: response.sources,
        confidence: response.confidence,
        processingTime: response.processing_time,
        documentName: response.document_name,
        related_entities: response.related_entities,
        related_graph_nodes: response.related_graph_nodes,
        memory_ids: response.memory_ids,
        related_documents: response.related_documents,
        related_emails: response.related_emails,
        related_calendar_events: response.related_calendar_events,
        follow_up_suggestions: generateFollowUps(),
      };

      // Update current chat with real chat_id from backend
      setCurrentChat((prev) =>
        prev
          ? { ...prev, id: response.chat_id, messages: [...prev.messages, aiMsg] }
          : prev
      );

      // Update chat history list using previous state to avoid stale closure
      setChatHistory((prev) =>
        prev.map((chat) =>
          chat.id === "temp-id"
            ? { ...chat, id: response.chat_id, messages: [...chat.messages, userMsg, aiMsg] }
            : chat
        )
      );
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "ai",
        content:
          err instanceof Error
            ? `❌ ${err.message}`
            : "Something went wrong. Please make sure the backend server is running.",
      };

      if (currentChat) {
        setCurrentChat((prev) =>
          prev
            ? { ...prev, messages: [...prev.messages, errorMsg] }
            : prev
        );
      }
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

  const startNewChat = () => {
    setCurrentChat(null);
    setInputValue("");
  };

  const loadChat = (chat: ChatHistoryItem) => {
    setCurrentChat(chat);
  };

  const confidenceColor = (conf: number) => {
    if (conf >= 0.8) return "var(--green)";
    if (conf >= 0.5) return "var(--orange)";
    return "var(--red)";
  };

  const currentMessages = currentChat?.messages || [];
  const lastAiMessage =
    currentMessages.findLast((msg) => msg.role === "ai") || null;

  return (
    <AppLayout>
      <div className="flex h-screen bg-[var(--bg)]">
        {/* LEFT PANEL — Chat History */}
        <div
          className="w-72 flex flex-col border-r border-[var(--border)]"
          style={{ background: "var(--bg)" }}
        >
          <div className="p-4 border-b border-[var(--border)]">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01]"
              style={{
                background: "var(--accent)",
                boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
              }}
              onClick={startNewChat}
            >
              <Plus size={16} />
              New Chat
            </button>
          </div>

          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <Search size={14} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search Chats"
                className="flex-1 bg-transparent text-sm outline-none text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
                value={searchChats}
                onChange={(e) => setSearchChats(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Today Chats */}
            {todayChats.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: "var(--text-muted)" }}>
                  Today
                </h3>
                {todayChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => loadChat(chat)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${currentChat?.id === chat.id ? "bg-[var(--accent-subtle)] border border-[rgba(108,92,231,0.3)]" : "hover:bg-[var(--bg-card)]"}`}
                    style={{ color: currentChat?.id === chat.id ? "var(--accent-hover)" : "var(--text-secondary)" }}
                  >
                    <div className="truncate font-medium">{chat.title}</div>
                  </button>
                ))}
              </div>
            )}
            {/* Yesterday Chats */}
            {yesterdayChats.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: "var(--text-muted)" }}>
                  Yesterday
                </h3>
                {yesterdayChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => loadChat(chat)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${currentChat?.id === chat.id ? "bg-[var(--accent-subtle)] border border-[rgba(108,92,231,0.3)]" : "hover:bg-[var(--bg-card)]"}`}
                    style={{ color: currentChat?.id === chat.id ? "var(--accent-hover)" : "var(--text-secondary)" }}
                  >
                    <div className="truncate font-medium">{chat.title}</div>
                  </button>
                ))}
              </div>
            )}
            {/* Older Chats */}
            {olderChats.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: "var(--text-muted)" }}>
                  Older
                </h3>
                {olderChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => loadChat(chat)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${currentChat?.id === chat.id ? "bg-[var(--accent-subtle)] border border-[rgba(108,92,231,0.3)]" : "hover:bg-[var(--bg-card)]"}`}
                    style={{ color: currentChat?.id === chat.id ? "var(--accent-hover)" : "var(--text-secondary)" }}
                  >
                    <div className="truncate font-medium">{chat.title}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTER PANEL — Conversation */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">Ask EVOLVE</h1>

              {/* Knowledge Selector Dropdown */}
              <select
                className="px-3 py-1.5 rounded-xl text-xs font-medium outline-none cursor-pointer"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
                value={knowledgeSource}
                onChange={(e) => setKnowledgeSource(e.target.value)}
              >
                <option value="all">All Knowledge</option>
                <option value="documents">Documents</option>
                <option value="gmail">Gmail</option>
                <option value="drive">Google Drive</option>
                <option value="calendar">Calendar</option>
                <option value="timeline">Timeline</option>
                <option value="memories">Memories</option>
              </select>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Empty State */}
            {!currentChat && (
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
                    Ask anything about your memory
                  </h2>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Use all your knowledge sources to get smart answers
                  </p>
                </div>
              </motion.div>
            )}

            {/* Chat Messages */}
            <AnimatePresence>
              {currentMessages.map((msg, i) => (
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
                    <div className="max-w-3xl">
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
                          {/* Answer with Markdown */}
                          <div
                            className="p-5 rounded-2xl rounded-tl-md text-sm leading-relaxed"
                            style={{
                              background: "var(--bg-card)",
                              border: "1px solid var(--border)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ ...props }) => <h1 className="text-xl font-bold text-white mb-3" {...props} />,
                                h2: ({ ...props }) => <h2 className="text-lg font-semibold text-white mb-2" {...props} />,
                                h3: ({ ...props }) => <h3 className="text-base font-semibold text-white mb-1.5" {...props} />,
                                p: ({ ...props }) => <p className="mb-3 text-[var(--text-secondary)]" {...props} />,
                                ul: ({ ...props }) => <ul className="list-disc ml-5 mb-3 text-[var(--text-secondary)]" {...props} />,
                                ol: ({ ...props }) => <ol className="list-decimal ml-5 mb-3 text-[var(--text-secondary)]" {...props} />,
                                li: ({ ...props }) => <li className="mb-1" {...props} />,
                                blockquote: ({ ...props }) => (
                                  <blockquote className="border-l-2 border-[var(--accent)] pl-4 italic mb-3" style={{ color: "var(--text-muted)" }} {...props} />
                                ),
                                code: ({ ...props }) => (
                                  <code className="px-1.5 py-0.5 rounded-md text-[12px] bg-[rgba(108,92,231,0.15)] text-[var(--accent-hover)] font-mono" {...props} />
                                ),
                                pre: ({ ...props }) => (
                                  <pre className="p-3 rounded-xl mb-3 overflow-x-auto bg-[rgba(0,0,0,0.3)] border border-[var(--border)]">
                                    <code className="text-[12px] font-mono" style={{ color: "var(--text-secondary)" }} {...props} />
                                  </pre>
                                ),
                                table: ({ ...props }) => (
                                  <div className="overflow-x-auto mb-3">
                                    <table className="w-full text-sm border-collapse" {...props} />
                                  </div>
                                ),
                                thead: ({ ...props }) => (
                                  <thead className="bg-[rgba(108,92,231,0.1)]" {...props} />
                                ),
                                th: ({ ...props }) => (
                                  <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold text-white" {...props} />
                                ),
                                td: ({ ...props }) => (
                                  <td className="border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]" {...props} />
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>

                          {/* Follow Up Suggestions */}
                          {msg.follow_up_suggestions && msg.follow_up_suggestions.length > 0 && (
                            <div className="mt-4 flex gap-2 flex-wrap">
                              {msg.follow_up_suggestions.map((suggestion, k) => (
                                <button
                                  key={k}
                                  onClick={() => {
                                    setInputValue(suggestion);
                                  }}
                                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-[1.03]"
                                  style={{
                                    background: "var(--accent-subtle)",
                                    color: "var(--accent-hover)",
                                    border: "1px solid rgba(108,92,231,0.2)",
                                  }}
                                >
                                  {suggestion}
                                </button>
                              ))}
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
            className="px-6 py-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-muted)" }}
              >
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                placeholder="Ask a question about your memory..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] text-white disabled:opacity-50"
              />
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-muted)" }}
              >
                <Mic size={16} />
              </button>
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

        {/* RIGHT PANEL — Sources & Related Data */}
        <div
          className="w-80 flex flex-col border-l border-[var(--border)]"
          style={{ background: "var(--bg)" }}
        >
          <div className="p-5">
            <h2 className="text-sm font-bold text-white mb-4">Context</h2>
            {/* Confidence */}
            {lastAiMessage?.confidence !== undefined && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Confidence
                  </span>
                  <span
                    className="text-[12px] font-bold"
                    style={{
                      color: confidenceColor(lastAiMessage.confidence),
                    }}
                  >
                    {Math.round(lastAiMessage.confidence * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(108,92,231,0.1)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(lastAiMessage.confidence * 100)}%`,
                      background: confidenceColor(lastAiMessage.confidence),
                    }}
                  />
                </div>
              </div>
            )}
            {/* Sources Used */}
            {lastAiMessage?.sources && lastAiMessage.sources.length > 0 && (
              <div className="mb-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Sources Used ({lastAiMessage.sources.length})
                </h3>
                <div className="space-y-2">
                  {lastAiMessage.sources.slice(0, 4).map((src, k) => (
                    <div
                      key={k}
                      className="p-3 rounded-xl"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText
                          size={12}
                          style={{ color: "var(--accent)" }}
                        />
                        <span className="text-[11px] font-semibold text-white truncate">
                          {src.document_name}
                        </span>
                      </div>
                      <p
                        className="text-[10px] leading-relaxed line-clamp-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {src.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Related Memories */}
            {lastAiMessage?.memory_ids && lastAiMessage.memory_ids.length > 0 && (
              <div className="mb-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Related Memories
                </h3>
                <div className="space-y-2">
                  {lastAiMessage.memory_ids.slice(0, 3).map((memId, k) => (
                    <div
                      key={k}
                      className="p-3 rounded-xl flex items-center gap-2"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    >
                      <Brain size={12} style={{ color: "#6c5ce7" }} />
                      <span className="text-[11px] text-[var(--text-secondary)] truncate">
                        Memory {memId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Related Documents */}
            {lastAiMessage?.related_documents && lastAiMessage.related_documents.length > 0 && (
              <div className="mb-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Related Documents
                </h3>
                <div className="space-y-2">
                  {lastAiMessage.related_documents.slice(0, 3).map((doc, k) => (
                    <div
                      key={k}
                      className="p-3 rounded-xl flex items-center gap-2"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    >
                      <FileText size={12} style={{ color: "#4facfe" }} />
                      <span className="text-[11px] text-[var(--text-secondary)] truncate">
                        {doc.filename || "Document"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
