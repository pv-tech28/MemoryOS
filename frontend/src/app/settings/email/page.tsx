"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getEmailSettings, updateEmail, sendVerificationEmail } from "@/lib/api";

export default function EmailSettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getEmailSettings();
        setEmail(data.email || "");
        setEmailVerified(data.email_verified);
      } catch (err) {
        console.error(err);
      }
      return null;
    }
    fetchData();
  }, []);

  const handleSaveEmail = async () => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const updated = await updateEmail(email);
      setEmail(updated.email);
      setEmailVerified(updated.email_verified);
      setSuccess("Email updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to update email");
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      await sendVerificationEmail();
      setSuccess("Verification email sent!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to send verification email");
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
            <h1 className="text-2xl font-bold text-white">Email Settings</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Manage your email address
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

        {/* Email Address */}
        <motion.div
          className="space-y-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="card p-5">
            <label className="block text-sm font-medium text-white mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)]"
              placeholder="Enter your email"
            />
          </div>

          {/* Verification Status */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">
                  {emailVerified ? "Email Verified" : "Email Not Verified"}
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  {emailVerified ? "Your email address has been verified" : "Verify your email address to access all features"}
                </p>
              </div>
              {emailVerified ? (
                <CheckCircle size={24} style={{ color: "#00d68f" }} />
              ) : (
                <button
                  onClick={handleSendVerification}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                >
                  Send Verification
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.button
          onClick={handleSaveEmail}
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {loading ? "Saving..." : "Save Changes"}
        </motion.button>
      </div>
    </AppLayout>
  );
}
