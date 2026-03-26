import React, { useState } from 'react';
import { Shield, LogIn, ShieldAlert, Loader2, Mail, Lock, UserPlus, ArrowRight } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '../firebase';
import { GoogleAuthProvider } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

import { useI18n, Language } from '../i18n';
import { Globe } from 'lucide-react';

export default function Auth() {
  const { t, language, setLanguage } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const languages: { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'or', name: 'ଓଡ଼ିଆ' }
  ];

  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email is already registered. Try signing in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed before completion.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      default:
        return 'Authentication failed. Please try again later.';
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(getFriendlyErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(getFriendlyErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl relative z-10"
      >
        {/* Language Switcher */}
        <div className="flex justify-center gap-4 mb-8">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                language === lang.code 
                  ? 'bg-white text-neutral-900 shadow-lg' 
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[48px] p-12 lg:p-16 shadow-4xl border border-white/20">
          <div className="flex flex-col items-center text-center mb-12">
            <div className="w-24 h-24 bg-gradient-vibrant rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/40">
              <Shield className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-display font-black text-neutral-900 tracking-tighter mb-4">
              {t('auth.title').split(' ')[0]} <span className="text-gradient">{t('auth.title').split(' ')[1]}</span>
            </h1>
            <p className="text-neutral-500 text-lg font-medium max-w-xs leading-relaxed">
              {isSignUp ? t('auth.subtitle_signup') : t('auth.subtitle_signin')}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl flex items-center gap-4 text-rose-600"
            >
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <p className="text-sm font-bold uppercase tracking-widest">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-6 mb-10">
            <div className="relative group">
              <Mail className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="email"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-[32px] py-6 pl-18 pr-8 text-lg font-bold text-neutral-900 placeholder:text-neutral-300 focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all shadow-sm"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="password"
                placeholder={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-[32px] py-6 pl-18 pr-8 text-lg font-bold text-neutral-900 placeholder:text-neutral-300 focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all shadow-sm"
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-indigo-600 text-white py-7 rounded-[32px] font-black text-[11px] uppercase tracking-[0.4em] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-600/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isSignUp ? t('auth.signup_btn') : t('auth.signin_btn')}
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-6 py-4 mb-10">
            <div className="h-px flex-1 bg-neutral-100" />
            <span className="text-[10px] font-black text-neutral-300 uppercase tracking-[0.3em]">{t('auth.or')}</span>
            <div className="h-px flex-1 bg-neutral-100" />
          </div>

          <div className="space-y-6">
            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full group relative flex items-center justify-center gap-4 bg-white border-2 border-neutral-100 text-neutral-900 py-7 rounded-[32px] font-black text-[11px] uppercase tracking-[0.4em] hover:border-indigo-500 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" alt="Google" />
                  {t('auth.google_btn')}
                </>
              )}
            </button>
            
            <div className="text-center">
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-indigo-600 transition-colors flex items-center gap-2 mx-auto"
              >
                {isSignUp ? t('auth.switch_signin') : t('auth.switch_signup')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-loose">
              {t('auth.agree_terms')} <br />
              <span className="text-neutral-900">{t('auth.governance_privacy')}</span>
            </p>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-8 opacity-40">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">{t('auth.ssl_encrypted')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">{t('auth.biometric_ready')}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
