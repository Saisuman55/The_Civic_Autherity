import React, { useState, useEffect } from 'react';
import { auth, db, doc, onSnapshot, updateDoc, collection, query, where, orderBy, signOut } from '../firebase';
import { UserProfile, IssueReport } from '../types';
import { User, MapPin, Calendar, Mail, Edit3, Save, X, FileText, CheckCircle2, Clock, AlertTriangle, Shield, Award, Zap, TrendingUp, Loader2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import IssueCard from './IssueCard';

import { useI18n } from '../i18n';

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { t } = useI18n();
  const [userIssues, setUserIssues] = useState<IssueReport[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ displayName: '', bio: '', location: '' });
  const [loading, setLoading] = useState(true);

  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeProfile = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setProfile(data);
        setEditData({
          displayName: data.displayName,
          bio: data.bio || '',
          location: data.location || ''
        });
      }
    });

    const q = query(
      collection(db, 'issues'),
      where('reporterUid', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeIssues = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IssueReport));
      setUserIssues(data);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeIssues();
    };
  }, []);

  const handleDetectLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            const address = data.address.city || data.address.town || data.address.village || data.address.state || 'Unknown';
            setEditData(prev => ({ ...prev, location: address }));
            toast.success("Location detected.");
          } catch (error) {
            console.error("Error geocoding:", error);
            setEditData(prev => ({ ...prev, location: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` }));
            toast.info("Coordinates captured, but address resolution failed.");
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLocating(false);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error("Location access denied. Please enable permissions in browser settings.");
          } else {
            toast.error("Could not detect location. Please try again or enter manually.");
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
      setIsLocating(false);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser || !profile) return;
    try {
      const updates: any = {
        ...editData,
        updatedAt: new Date().toISOString()
      };
      
      // If joinedAt is missing (for legacy users), set it now
      if (!profile.joinedAt) {
        updates.joinedAt = new Date().toISOString();
      }

      await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
      setIsEditing(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error("Failed to update profile.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully.");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const stats = [
    { label: t('profile.reports'), value: userIssues.length, icon: FileText, color: 'text-indigo-500' },
    { label: t('profile.resolved'), value: userIssues.filter(i => i.status === 'Resolved').length, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: t('profile.trust_score'), value: profile.trustScore, icon: Shield, color: 'text-violet-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[48px] p-12 shadow-2xl shadow-indigo-500/5 border-2 border-neutral-100 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full -mr-48 -mt-48 blur-3xl" />
        
        <div className="flex flex-col md:flex-row gap-12 items-start relative z-10">
          <div className="relative group">
            <img 
              src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}&background=6366f1&color=fff`} 
              alt={profile.displayName}
              className="w-48 h-48 rounded-[40px] object-cover border-8 border-white shadow-2xl group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 border-4 border-white">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-5xl font-display font-black tracking-tighter text-neutral-900 mb-2">
                  {profile.displayName}
                </h1>
                <div className="flex items-center gap-6 text-neutral-400 font-medium">
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {profile.email}
                  </span>
                  {profile.location && (
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> {profile.location}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> {t('profile.joined')} {profile.joinedAt ? format(new Date(profile.joinedAt), 'MMM yyyy') : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-4 bg-neutral-50 rounded-2xl text-neutral-400 hover:bg-indigo-50 hover:text-indigo-500 transition-all"
                  title={isEditing ? t('profile.cancel') : t('profile.edit')}
                >
                  {isEditing ? <X className="w-6 h-6" /> : <Edit3 className="w-6 h-6" />}
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-4 bg-neutral-50 rounded-2xl text-neutral-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                  title={t('profile.logout')}
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 bg-neutral-50 p-8 rounded-[32px]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">{t('profile.display_name')}</label>
                      <input 
                        type="text"
                        value={editData.displayName}
                        onChange={(e) => setEditData({...editData, displayName: e.target.value})}
                        className="w-full bg-white border-2 border-neutral-100 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">{t('profile.location')}</label>
                      <div className="relative">
                        <input 
                          type="text"
                          value={editData.location}
                          onChange={(e) => setEditData({...editData, location: e.target.value})}
                          className="w-full bg-white border-2 border-neutral-100 rounded-2xl px-6 py-4 pr-16 outline-none focus:border-indigo-500 transition-all"
                          placeholder={t('profile.detect_location')}
                        />
                        <button
                          type="button"
                          onClick={handleDetectLocation}
                          disabled={isLocating}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-neutral-400 hover:text-indigo-500 transition-colors"
                          title="Detect Current Location"
                        >
                          {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">{t('profile.bio')}</label>
                    <textarea 
                      value={editData.bio}
                      onChange={(e) => setEditData({...editData, bio: e.target.value})}
                      className="w-full bg-white border-2 border-neutral-100 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 transition-all h-32 resize-none"
                    />
                  </div>
                  <button 
                    onClick={handleSave}
                    className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3"
                  >
                    <Save className="w-5 h-5" /> {t('profile.save')}
                  </button>
                </motion.div>
              ) : (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xl text-neutral-600 leading-relaxed font-medium opacity-80"
                >
                  {profile.bio || t('profile.no_bio')}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mt-12 pt-12 border-t-2 border-neutral-50">
          {stats.map((stat, i) => (
            <div key={i} className="text-center space-y-2">
              <div className={`w-12 h-12 ${stat.color} bg-neutral-50 rounded-xl flex items-center justify-center mx-auto mb-4`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <p className="text-4xl font-display font-black tracking-tighter text-neutral-900">{stat.value}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* User Activity */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-display font-black tracking-tighter text-neutral-900">
            {t('profile.my_reports')}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-50 px-4 py-2 rounded-xl">
              {userIssues.length} {t('profile.total')}
            </span>
          </div>
        </div>

        {userIssues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {userIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[48px] p-20 text-center border-2 border-dashed border-neutral-100">
            <div className="w-24 h-24 bg-neutral-50 rounded-[32px] flex items-center justify-center mx-auto mb-8">
              <FileText className="w-12 h-12 text-neutral-200" />
            </div>
            <h3 className="text-2xl font-display font-black text-neutral-900 mb-4">{t('profile.no_reports')}</h3>
            <p className="text-neutral-500 font-medium max-w-md mx-auto opacity-70">
              {t('profile.no_reports_desc')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
