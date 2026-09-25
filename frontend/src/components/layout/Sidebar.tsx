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
  Settings,
  ChevronDown,
  Brain,
  LogOut,
  User,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ask", label: "Ask EVOLVE", icon: MessageCircle },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/memory-graph", label: "Memory Graph", icon: Share2 },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/daily-summary", label: "Daily Summary", icon: Sparkles },
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
      className="fixed left-0 top-0 h-screen flex flex-col justify-between z-50 select-none"
      style={{
        width: 264,
        background: "rgba(7, 7, 18, 0.86)",
        backdropFilter: "blur(44px) saturate(2)",
        WebkitBackdropFilter: "blur(44px) saturate(2)",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: "4px 0 36px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Top Header & Navigation */}
      <div>
        <div className="flex items-center gap-3.5 px-6 py-7">
          <div className="relative">
            {/* Animated Bioluminescent Conic Halo */}
            <motion.div
              className="absolute -inset-1 rounded-2xl opacity-75"
              style={{
                background: "conic-gradient(from 0deg, #8b5cf6, #06b6d4, #f43f5e, #8b5cf6)",
                filter: "blur(6px)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            <div
              className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
              }}
            >
              <Brain size={20} className="text-white drop-shadow" />
            </div>
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-wider text-white flex items-center gap-1.5">
              <span>EVOLVE AI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </h1>
            <p
              className="text-[10px] font-medium tracking-wide uppercase"
              style={{ color: "var(--text-muted)", letterSpacing: "0.06em" }}
            >
              Memory Vault OS
            </p>
          </div>
        </div>

        {/* Ethereal Divider */}
        <div
          className="mx-5 mb-4 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.25), rgba(6, 182, 212, 0.25), transparent)",
          }}
        />

        {/* Navigation Items */}
        <nav className="px-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer overflow-hidden group"
                  style={{
                    color: isActive ? "#ffffff" : "var(--text-secondary)",
                  }}
                  whileHover={{
                    color: "#ffffff",
                    x: 3,
                  }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Active background with dual-tone glow */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(6, 182, 212, 0.08))",
                        border: "1px solid rgba(139, 92, 246, 0.3)",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 20px rgba(139, 92, 246, 0.15)",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}

                  {/* Active left glowing accent bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-5 rounded-full"
                      style={{
                        background: "linear-gradient(180deg, #8b5cf6, #06b6d4)",
                        boxShadow: "0 0 14px rgba(139, 92, 246, 0.8)",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}

                  {/* Hover highlight for inactive tabs */}
                  {!isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{
                        background: "linear-gradient(90deg, rgba(255, 255, 255, 0.04), transparent)",
                      }}
                    />
                  )}

                  <Icon
                    size={18}
                    className="relative z-10 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{
                      color: isActive ? "#a78bfa" : undefined,
                    }}
                  />
                  <span className="relative z-10">{item.label}</span>

                  {/* Active glowing micro-indicator dot */}
                  {isActive && (
                    <motion.span
                      className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: "#22d3ee", boxShadow: "0 0 8px #22d3ee" }}
                      animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.2, 0.9] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Upgrade Section */}
      <div className="relative mx-3 mb-4" ref={menuRef}>
        {/* Pro Upgrade Banner */}
        <motion.div
          className="mx-1 mb-3.5 p-3 rounded-xl cursor-pointer group relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(6, 182, 212, 0.06))",
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
          whileHover={{
            borderColor: "rgba(139, 92, 246, 0.4)",
            y: -1.5,
            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.2)",
          }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.25 }}
        >
          {/* Subtle shimmer sweep on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent)",
            }}
          />

          <div className="flex items-center gap-2.5 relative z-10">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                boxShadow: "0 0 12px rgba(139, 92, 246, 0.35)",
              }}
            >
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white tracking-wide">Upgrade to Pro</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                Unlimited memories & synapses
              </p>
            </div>
          </div>
        </motion.div>

        {/* User Card */}
        <motion.div
          onClick={() => setShowMenu(!showMenu)}
          className="p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-300"
          style={{
            background: "rgba(14, 14, 30, 0.55)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
          whileHover={{
            background: "rgba(20, 20, 42, 0.75)",
            borderColor: "rgba(139, 92, 246, 0.25)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
          }}
        >
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover"
              style={{ boxShadow: "0 0 0 2px rgba(139, 92, 246, 0.35)" }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                boxShadow: "0 0 0 2px rgba(139, 92, 246, 0.35)",
              }}
            >
              {getInitials(user?.user_metadata?.full_name || user?.email)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[10px] font-semibold flex items-center gap-1.5" style={{ color: "#a78bfa" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Free Plan</span>
            </p>
          </div>
          <motion.div
            animate={{ rotate: showMenu ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
          </motion.div>
        </motion.div>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-xl overflow-hidden"
              style={{
                background: "rgba(14, 15, 32, 0.95)",
                backdropFilter: "blur(36px)",
                border: "1px solid rgba(139, 92, 246, 0.25)",
                boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7), 0 0 24px rgba(139, 92, 246, 0.15)",
              }}
            >
              <Link href="/settings" onClick={() => setShowMenu(false)}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <User size={15} style={{ color: "#a78bfa" }} />
                  <span>Profile</span>
                </div>
              </Link>
              <Link href="/settings" onClick={() => setShowMenu(false)}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <CreditCard size={15} style={{ color: "#22d3ee" }} />
                  <span>Billing & Plan</span>
                </div>
              </Link>
              <div
                className="h-px mx-2 my-1"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)",
                }}
              />
              <div onClick={handleLogout}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-200 hover:bg-red-500/15 text-rose-400">
                  <LogOut size={15} />
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
