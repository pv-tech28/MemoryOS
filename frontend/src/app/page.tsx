'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#04040a' }}>
      {/* Living Ambient Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.16) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 70%)',
            filter: 'blur(85px)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 left-1/3 w-[320px] h-[320px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(244, 63, 94, 0.08), transparent 70%)',
            filter: 'blur(65px)',
          }}
          animate={{ x: [0, 35, -25, 0], y: [0, -25, 20, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-7 relative z-10"
      >
        {/* Animated Bioluminescent Logo */}
        <div className="relative">
          <motion.div
            className="absolute -inset-3 rounded-2xl opacity-60"
            style={{
              background: 'conic-gradient(from 0deg, #8b5cf6, #06b6d4, #f43f5e, #8b5cf6)',
              filter: 'blur(12px)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            }}
          >
            <Brain size={32} className="text-white drop-shadow-md" />
          </div>
        </div>

        {/* Loading Pulsing Synapse Dots */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6' }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: '#06b6d4', boxShadow: '0 0 10px #06b6d4' }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: '#f43f5e', boxShadow: '0 0 10px #f43f5e' }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
          />
        </div>

        <p className="text-sm font-medium tracking-wide" style={{ color: '#94a3b8' }}>
          Initializing neural vault...
        </p>
      </motion.div>
    </div>
  );
}
