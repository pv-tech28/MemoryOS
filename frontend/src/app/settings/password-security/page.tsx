"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronLeft, Lock, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { changePassword, updateTwoFactor } from "@/lib/api";

export default function PasswordSecurityPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTwoFactor = async () => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const result = await updateTwoFactor(!twoFactorEnabled);
      setTwoFactorEnabled(result.two_factor_enabled);
      setSuccess(`Two-factor authentication ${result.two_factor_enabled ? "enabled" : "disabled"}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to update two-factor authentication");
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-white">Password & Security</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Manage your password and security settings
            </p>
          </div>
        </motion.div>

        {/* Success/Error Messages */}
        {success && (
          <motion.div
            className="mb-6 card p-4 flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: "#00d68f18", border: "1px solid #00d68f40" }}
          >
            <CheckCircle size={20} style={{ color: "#00d68f" }} />
            <p className="text-sm" style={{ color: "#00d68f" }}>{success}</p>
          </motion.div>
        )}
        {error && (
          <motion.div
            className="mb-6 card p-4 flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: "#ff6b6b18", border: "1px solid #ff6b6b40" }}
          >
            <AlertCircle size={20} style={{ color: "#ff6b6b" }} />
            <p className="text-sm" style={{ color: "#ff6b6b" }}>{error}</p>
          </motion.div>
        )}

        <motion.div
          className="space-y-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Change Password */}
          <div className="card p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lock size={18} style={{ color: "#f0a500" }} />
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Confirm new password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg bg-[var(--accent)] text-white font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Changing Password..." : "Change Password"}
              </button>
            </form>
          </div>

          {/* Two-Factor Authentication */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#f0a50018" }}>
                  <Shield size={20} style={{ color: "#f0a500" }} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Two-Factor Authentication</h3>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Add an extra layer of security to your account
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleTwoFactor}
                disabled={loading}
                className={`w-12 h-6 rounded-full transition-colors ${
                  twoFactorEnabled ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)]"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    twoFactorEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
