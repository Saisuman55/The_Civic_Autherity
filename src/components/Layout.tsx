import React from 'react';
import { LogOut, User as UserIcon, Shield, LayoutDashboard, FilePlus, BarChart3, Menu, X, Bell, UserCircle, Trophy, Activity, BookOpen } from 'lucide-react';
import { auth, signOut, db, collection, query, where, onSnapshot } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile | null;
}

import { useI18n } from '../i18n';
import { Globe } from 'lucide-react';

export default function Layout({ children, user }: LayoutProps) {
  const { t, language, setLanguage } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', user.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifications(snapshot.size);
    });
    return () => unsubscribe();
  }, [user]);

  const navItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, path: '/' },
    { id: 'guide', label: t('nav.guide') || 'User Guide', icon: BookOpen, path: '/guide' },
    { id: 'report', label: t('nav.report'), icon: FilePlus, path: '/report' },
    { id: 'live', label: t('nav.live'), icon: Activity, path: '/live' },
    { id: 'analytics', label: t('nav.analytics'), icon: BarChart3, path: '/analytics' },
    { id: 'leaderboard', label: t('nav.leaderboard'), icon: Trophy, path: '/leaderboard' },
    { id: 'notifications', label: t('nav.notifications') || 'Notifications', icon: Bell, path: '/notifications', badge: unreadNotifications },
    { id: 'profile', label: t('nav.profile'), icon: UserCircle, path: '/profile' },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: t('nav.admin'), icon: Shield, path: '/admin' }] : []),
  ];

  const activeTab = navItems.find(item => 
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  )?.id || 'dashboard';

  return (
    <div className="min-h-screen bg-white font-sans text-brand-primary relative overflow-hidden">
      {/* Background Mesh */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-40 pointer-events-none z-0" />

      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-white/80 backdrop-blur-2xl border-r border-neutral-200 z-50 hidden lg:flex flex-col shadow-[20px_0_40px_rgba(0,0,0,0.02)]">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-vibrant rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-indigo-600 to-violet-600">CIVIC PILLAR</span>
          </div>
          <p className="text-[10px] text-neutral-400 uppercase tracking-[0.2em] font-bold ml-1">{t('nav.governance_framework')}</p>
          
          <div className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm hover:shadow-md transition-all group">
            <Globe className="w-3.5 h-3.5 text-indigo-500 group-hover:rotate-12 transition-transform" />
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-indigo-600 focus:outline-none cursor-pointer w-full appearance-none"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="or">ଓଡ଼ିଆ</option>
            </select>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                activeTab === item.id 
                  ? 'text-white shadow-xl shadow-indigo-500/20' 
                  : 'hover:bg-neutral-50 text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-vibrant"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <item.icon className={`w-5 h-5 relative z-10 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="font-bold text-sm relative z-10 tracking-tight">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full relative z-10 shadow-lg">
                  {item.badge}
                </span>
              )}
              {activeTab === item.id && !item.badge && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-auto w-2 h-2 bg-white rounded-full relative z-10 shadow-[0_0_10px_rgba(255,255,255,0.8)]" 
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="p-6 mt-auto">
          {user && (
            <div className="p-5 bg-neutral-50 rounded-[32px] border border-neutral-100 mb-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="relative">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-12 h-12 rounded-2xl border-4 border-white shadow-md object-cover" 
                    alt="Profile" 
                    referrerPolicy="no-referrer" 
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-vibrant-emerald border-4 border-white rounded-full shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-neutral-900 truncate tracking-tight">{user.displayName}</p>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black">{t('nav.level_citizen').replace('{level}', (Math.floor(user.trustScore / 100) + 1).toString())}</p>
                </div>
              </div>
              <div className="space-y-2 relative z-10">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{t('nav.trust_integrity')}</p>
                  <p className="text-xs font-black text-indigo-600">{user.trustScore}<span className="text-neutral-300 font-medium">/1000</span></p>
                </div>
                <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-vibrant rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)]" 
                    style={{ width: `${Math.min(100, (user.trustScore / 1000) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 transition-all font-black text-xs uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Header - Mobile */}
      <header className="lg:hidden fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md border-b border-neutral-200 p-4 flex items-center justify-between z-[60]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">CIVIC PILLAR</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl mr-2">
            <Globe className="w-3.5 h-3.5 text-indigo-500" />
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-indigo-600 focus:outline-none cursor-pointer"
            >
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="or">OR</option>
            </select>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 bg-neutral-100 rounded-xl"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-0 bg-white z-[55] pt-24 p-6"
          >
            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`w-full flex items-center gap-4 px-6 py-5 rounded-2xl transition-all ${
                    activeTab === item.id ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-600'
                  }`}
                >
                  <div className="relative">
                    <item.icon className="w-6 h-6" />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-lg">{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-8 space-y-4">
              <button
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl bg-red-50 text-red-600 font-bold text-lg"
              >
                <LogOut className="w-6 h-6" />
                {t('nav.logout')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:ml-72 pt-24 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
