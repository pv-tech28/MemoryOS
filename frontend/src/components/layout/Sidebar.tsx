"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
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
  LogOut,
  User,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ask", label: "Ask EVOLVE", icon: MessageCircle },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/memory-graph", label: "Memory Graph", icon: Share2 },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        return;
      }
      setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  const handleLogout = async () => {
    setShowMenu(false);
    await logout();
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
      <div className="relative mx-3 mb-4" ref={menuRef}>
        <div
          onClick={() => setShowMenu(!showMenu)}
          className="p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
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
              {getInitials(user?.user_metadata?.full_name || user?.email)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"}
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              Free Plan
            </p>
          </div>
          <ChevronDown
            size={14}
            style={{ color: "var(--text-muted)" }}
            className={showMenu ? "rotate-180" : ""}
          />
        </div>
        {/* Dropdown Menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-full left-0 right-0 mb-2 p-1 rounded-xl border shadow-lg"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
              }}
            >
              <Link href="/settings" onClick={() => setShowMenu(false)}>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:opacity-90"
                     style={{color: "var(--text-secondary)"}}>
                  <User size={16} />
                  <span>Profile</span>
                </div>
              </Link>
              <Link href="/settings" onClick={() => setShowMenu(false)}>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:opacity-90"
                     style={{color: "var(--text-secondary)"}}>
                  <CreditCard size={16} />
                  <span>Billing</span>
                </div>
              </Link>
              <div className="h-px mx-2 my-1" style={{ background: "var(--border)" }} />
              <div onClick={handleLogout}>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:opacity-90 text-red-400">
                  <LogOut size={16} />
                  <span>Logout</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
