"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { User, ChevronLeft, Camera, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getProfile, updateProfile, uploadProfilePicture, Profile } from "@/lib/api";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const p = await getProfile();
      setProfile(p);
      setDisplayName(p.display_name || "");
      setUsername(p.username || "");
      setBio(p.bio || "");
      if (p.profile_picture_url) {
        setImagePreview(`http://localhost:8000${p.profile_picture_url}`);
      }
    }
    fetchData();
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (imageFile) {
        await uploadProfilePicture(imageFile);
      }
      const updated = await updateProfile({ display_name: displayName, username, bio });
      setProfile(updated);
      alert("Profile saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
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
            <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Update your profile details
            </p>
          </div>
        </motion.div>

        {/* Profile Picture */}
        <motion.div
          className="card p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-6">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold overflow-hidden"
                style={{ background: "linear-gradient(135deg, #6c5ce7, #e84393)" }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : "U")
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-[var(--accent)] p-2 rounded-xl cursor-pointer hover:opacity-90 transition-opacity">
                <Camera size={16} className="text-white" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </label>
            </div>
            <div>
              <h3 className="text-white font-semibold">Profile Picture</h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Upload a new profile picture
              </p>
            </div>
          </div>
        </motion.div>

        {/* Form Fields */}
        <motion.div
          className="space-y-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="card p-5">
            <label className="block text-sm font-medium text-white mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)]"
              placeholder="Enter your full name"
            />
          </div>

          <div className="card p-5">
            <label className="block text-sm font-medium text-white mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)]"
              placeholder="Enter your username"
            />
          </div>

          <div className="card p-5">
            <label className="block text-sm font-medium text-white mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-white focus:outline-none focus:border-[var(--accent)] min-h-[100px]"
              placeholder="Tell us a little about yourself"
            />
          </div>
        </motion.div>

        <motion.button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 transition-opacity"
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
