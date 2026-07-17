"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  ChevronLeft,
  Trash2,
  FileText,
  Database,
  MessageSquare,
  Mail,
  HardDrive,
  Calendar,
  XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  deleteDocuments,
  deleteMemoryGraph,
  deleteConversations,
  deleteGmailData,
  deleteDriveData,
  deleteCalendarData,
  deleteAllData
} from "@/lib/api";

export default function DeleteDataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleDelete = async (action: string) => {
    let confirmMessage = "Are you sure you want to delete this data?";
    if (action === "all") {
      confirmMessage =
        "Are you ABSOLUTELY sure you want to delete ALL data? This action is irreversible!";
    }

    if (!confirm(confirmMessage)) return;

    setLoading(action);
    try {
      switch (action) {
        case "documents":
          await deleteDocuments();
          break;
        case "graph":
          await deleteMemoryGraph();
          break;
        case "conversations":
          await deleteConversations();
          break;
        case "gmail":
          await deleteGmailData();
          break;
        case "drive":
          await deleteDriveData();
          break;
        case "calendar":
          await deleteCalendarData();
          break;
        case "all":
          await deleteAllData();
          break;
      }
      alert("Data deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete data");
    } finally {
      setLoading(null);
    }
  };

  const deleteOptions = [
    {
      id: "documents",
      label: "Delete Uploaded Documents",
      desc: "Remove all your uploaded documents",
      icon: FileText,
      color: "#4facfe",
    },
    {
      id: "graph",
      label: "Delete Memory Graph",
      desc: "Clear all nodes and connections from your graph",
      icon: Database,
      color: "#6c5ce7",
    },
    {
      id: "conversations",
      label: "Delete Conversation Memories",
      desc: "Remove all chat history and associated memories",
      icon: MessageSquare,
      color: "#00d68f",
    },
    {
      id: "gmail",
      label: "Delete Synced Gmail Data",
      desc: "Remove all synced Gmail data",
      icon: Mail,
      color: "#ea4335",
    },
    {
      id: "drive",
      label: "Delete Synced Drive Data",
      desc: "Remove all synced Google Drive data",
      icon: HardDrive,
      color: "#4285f4",
    },
    {
      id: "calendar",
      label: "Delete Synced Calendar Data",
      desc: "Remove all synced Google Calendar data",
      icon: Calendar,
      color: "#fbbc04",
    },
  ];

  return (
    <AppLayout>
      <div className="p-8 max-w-[600px] mx-auto">
        <motion.div
          className="mb-8 flex items-center gap-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
          >
            <ChevronLeft size={24} style={{ color: "var(--text-secondary)" }} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Delete Data</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Remove your data (this is irreversible)
            </p>
          </div>
        </motion.div>

        <div className="space-y-4 mb-8">
          {deleteOptions.map((option, i) => {
            const Icon = option.icon;
            return (
              <motion.div
                key={option.id}
                className="card p-5 flex items-center gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: option.color + "18" }}
                >
                  <Icon size={20} style={{ color: option.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{option.label}</h3>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {option.desc}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(option.id)}
                  disabled={loading === option.id}
                  className="px-4 py-2 rounded-lg text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {loading === option.id ? (
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Delete All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <button
            onClick={() => handleDelete("all")}
            disabled={loading === "all"}
            className="w-full py-4 rounded-xl border-2 border-red-500/30 text-red-500 font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <XCircle size={20} />
            {loading === "all" ? "Deleting Everything..." : "Delete Everything"}
          </button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
