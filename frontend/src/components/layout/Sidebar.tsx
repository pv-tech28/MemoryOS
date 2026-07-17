"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Home,
  MessageCircle,
  Database,
  Share2,
  Clock,
  FolderOpen,
  FileText,
  Settings,
  ChevronDown,
  Brain,
} from "lucide-react";
import { getProfile, Profile } from "@/lib/api";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/ask", label: "Ask EVOLVE", icon: MessageCircle },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/memory-graph", label: "Memory Graph", icon: Share2 },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/daily-summary", label: "Daily Summary", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getProfile();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };
    loadProfile();
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col justify-between z-50"
      style={{
        width: 240,
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div>
        <div className="flex items-center gap-3 px-5 py-6">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--accent), #a29bfe)",
              boxShadow: "0 0 16px rgba(108,92,231,0.4)",
            }}
          >
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">
              EVOLVE AI
            </h1>
            <p
              className="text-[10px] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Digital Memory Vault
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 mt-1 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                  style={{
                    background: isActive ? "var(--accent)" : "transparent",
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    boxShadow: isActive
                      ? "0 4px 16px rgba(108,92,231,0.35)"
                      : "none",
                  }}
                  whileHover={{
                    background: isActive
                      ? "var(--accent)"
                      : "var(--accent-subtle)",
                    color: "#fff",
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile */}
      <Link href="/settings/profile">
        <div
          className="mx-3 mb-4 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          {profile?.profile_picture_url ? (
            <img
              src={`http://localhost:8000${profile.profile_picture_url}`}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: "linear-gradient(135deg, #6c5ce7, #e84393)",
              }}
            >
              {getInitials(profile?.display_name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.display_name || "User"}
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              Free Plan
            </p>
          </div>
          <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
        </div>
      </Link>
    </aside>
  );
}
