'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Brain, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signInWithPassword, signInWithGoogle, signInAsDemoUser } = useAuth();
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithPassword(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInAsDemoUser();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // signInWithOAuth redirects the page, so we don't need to wait for it to resolve
      signInWithGoogle().catch((err: any) => {
        setError(err.message || 'Google login failed');
        setLoading(false);
      });
    } catch (err: any) {
      setError(err.message || 'Google login failed');
      setLoading(false);
    }
  };

  const features = [
    { icon: '🧠', label: 'AI Memory Graph', desc: 'Connected knowledge' },
    { icon: '📧', label: 'Gmail Integration', desc: 'Auto-sync emails' },
    { icon: '📁', label: 'Google Drive', desc: 'Index documents' },
    { icon: '🔍', label: 'Semantic Search', desc: 'Find anything fast' },
  ];

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#06060e' }}>
      {/* Aurora Background */}
      <div className="absolute inset-0">
        {/* Main aurora blobs */}
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            top: '-20%',
            left: '10%',
            background: 'radial-gradient(circle, rgba(124, 92, 252, 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -30, 20, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            bottom: '-10%',
            right: '5%',
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 40, -20, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            top: '40%',
            left: '40%',
            background: 'radial-gradient(circle, rgba(244, 114, 182, 0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, 30, -30, 0],
            y: [0, -40, 30, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(148, 163, 184, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Left Side - Hero Content */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col justify-center items-center p-16">
        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 3 + 1,
                height: Math.random() * 3 + 1,
                background: i % 3 === 0 ? '#7c5cfc' : i % 3 === 1 ? '#22d3ee' : '#f472b6',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -(Math.random() * 80 + 30)],
                opacity: [0, 0.6, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{
                duration: Math.random() * 5 + 4,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-10"
          >
            {/* Logo */}
            <div className="flex items-center gap-3 mb-12">
              <div className="relative">
                <div
                  className="absolute -inset-1 rounded-xl rotate-gradient opacity-60"
                  style={{
                    background: 'conic-gradient(from 0deg, #7c5cfc, #22d3ee, #2dd4bf, #7c5cfc)',
                    filter: 'blur(6px)',
                  }}
                />
                <div className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c5cfc, #22d3ee)' }}>
                  <Brain size={26} className="text-white" />
                </div>
              </div>
              <span className="text-2xl font-bold tracking-wider text-white">EVOLVE AI</span>
            </div>

            <h1 className="text-5xl font-bold text-white mb-5 leading-tight">
              Your AI Memory
              <br />
              <span className="gradient-text">Operating System</span>
            </h1>

            <p className="text-lg text-slate-400 mb-10 leading-relaxed">
              Never forget a thing. Your AI-powered second brain that connects, 
              remembers, and finds everything across all your digital life.
            </p>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 gap-3"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                className="p-4 rounded-2xl transition-all duration-300 group cursor-default"
                style={{
                  background: 'rgba(14, 14, 32, 0.4)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(148, 163, 184, 0.06)',
                }}
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <p className="text-sm font-semibold text-white mb-0.5">{feature.label}</p>
                <p className="text-xs text-slate-500">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login Card */}
      <div className="w-full lg:w-[42%] flex items-center justify-center p-6 sm:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Glass Card */}
          <div
            className="rounded-3xl p-8 relative overflow-hidden"
            style={{
              background: 'rgba(14, 14, 32, 0.6)',
              backdropFilter: 'blur(40px) saturate(1.8)',
              border: '1px solid rgba(148, 163, 184, 0.08)',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(148, 163, 184, 0.04)',
            }}
          >
            {/* Gradient shimmer border */}
            <div className="absolute inset-0 rounded-3xl" style={{
              background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08), transparent 40%, transparent 60%, rgba(34, 211, 238, 0.05))',
              pointerEvents: 'none',
            }} />

            {/* Mobile Logo */}
            <div className="text-center mb-8 lg:mb-6 relative z-10">
              <div className="inline-flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c5cfc, #22d3ee)' }}>
                  <Brain size={22} className="text-white" />
                </div>
                <span className="text-xl font-bold tracking-wide text-white lg:hidden">EVOLVE AI</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Welcome Back</h2>
              <p className="text-sm text-slate-500">Sign in to your memory vault</p>
            </div>

            <div className="relative z-10">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 p-4 rounded-xl text-sm"
                  style={{
                    background: 'rgba(248, 113, 113, 0.08)',
                    border: '1px solid rgba(248, 113, 113, 0.15)',
                    color: '#fca5a5',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-red-400 shrink-0">⚠</span>
                    <div>
                      <span>
                        {error === 'AUTH_SERVER_UNREACHABLE' || error.includes('fetch')
                          ? 'Authentication service is unreachable. The backend may be paused or unconfigured.'
                          : error}
                      </span>
                      {(error === 'AUTH_SERVER_UNREACHABLE' || error.includes('fetch')) && (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(248, 113, 113, 0.1)' }}>
                          <p className="text-xs text-slate-400 mb-2">
                            Try Demo Mode for instant access:
                          </p>
                          <button
                            type="button"
                            onClick={handleDemoLogin}
                            disabled={loading}
                            className="w-full py-2 px-3 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                            style={{
                              background: 'linear-gradient(135deg, #7c5cfc, #22d3ee)',
                              boxShadow: '0 4px 16px rgba(124, 92, 252, 0.3)',
                            }}
                          >
                            <Sparkles size={13} /> Enter Demo Mode
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Quick Demo Access */}
              <motion.button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="w-full mb-4 flex items-center justify-center gap-2.5 p-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(34, 211, 238, 0.06))',
                  border: '1px solid rgba(124, 92, 252, 0.2)',
                  color: '#c4b5fd',
                }}
              >
                <Zap size={17} className="text-cyan-400" />
                <span>Explore with Demo Account</span>
                <ArrowRight size={15} className="ml-1 text-slate-500" />
              </motion.button>

              {/* Google Login */}
              <motion.button
                onClick={handleGoogleLogin}
                disabled={loading}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="w-full mb-4 flex items-center justify-center gap-3 p-3.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  color: '#1f2937',
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </motion.button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.1), transparent)' }} />
                <span className="text-xs text-slate-600 font-medium">OR</span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.1), transparent)' }} />
              </div>

              {/* Email Login Form */}
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 ml-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-slate-600 transition-all duration-300"
                    style={{
                      background: 'rgba(148, 163, 184, 0.04)',
                      border: '1px solid rgba(148, 163, 184, 0.08)',
                      outline: 'none',
                    }}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-slate-600 pr-12 transition-all duration-300"
                      style={{
                        background: 'rgba(148, 163, 184, 0.04)',
                        border: '1px solid rgba(148, 163, 184, 0.08)',
                        outline: 'none',
                      }}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-transparent"
                    />
                    <label htmlFor="remember" className="text-xs text-slate-500">
                      Remember me
                    </label>
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
                  style={{
                    background: 'linear-gradient(135deg, #7c5cfc, #6366f1)',
                    boxShadow: '0 4px 24px rgba(124, 92, 252, 0.3), 0 0 0 1px rgba(124, 92, 252, 0.15)',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-slate-500 text-sm">
                  Don't have an account?{' '}
                  <Link
                    href="/signup"
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    Create Account
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-6 flex justify-center gap-6 text-xs text-slate-600">
            <a href="#" className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-400 transition-colors">
              Terms
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
