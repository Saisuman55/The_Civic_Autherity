import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, limit, onSnapshot, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile } from '../types';
import { Trophy, Medal, Award, Shield, Zap, TrendingUp, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useI18n } from '../i18n';

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('trustScore', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setTopUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-3 px-6 py-2 bg-amber-500/10 rounded-full border border-amber-500/20"
        >
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-600">{t('leaderboard.excellence')}</span>
        </motion.div>
        <h1 className="text-7xl font-display font-black tracking-tighter text-neutral-900">
          {t('leaderboard.title').split(' ')[0]} <span className="text-gradient">{t('leaderboard.title').split(' ').slice(1).join(' ')}</span>
        </h1>
        <p className="text-xl text-neutral-500 font-medium max-w-2xl mx-auto opacity-70">
          {t('leaderboard.desc')}
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end pt-12">
        {topUsers.slice(0, 3).map((user, i) => {
          const order = [1, 0, 2]; // 2nd, 1st, 3rd
          const currentUser = topUsers[order[i]];
          if (!currentUser) return null;

          const rank = order[i] + 1;
          const height = rank === 1 ? 'h-[420px]' : rank === 2 ? 'h-[360px]' : 'h-[320px]';
          const icon = rank === 1 ? Medal : rank === 2 ? Award : Shield;
          const color = rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-neutral-400' : 'text-amber-700';

          return (
            <motion.div 
              key={currentUser.uid}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
              className={`relative group ${rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent rounded-[48px] -z-10`} />
              <div className={`flex flex-col items-center justify-end ${height} p-8 space-y-6 text-center`}>
                <div className="relative">
                  <img 
                    src={currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`} 
                    className={`w-24 h-24 rounded-[32px] border-4 border-white shadow-2xl object-cover ${rank === 1 ? 'scale-125' : ''}`}
                    alt={currentUser.displayName}
                  />
                  <div className={`absolute -bottom-4 -right-4 w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl border-2 border-neutral-50 ${color}`}>
                    {rank === 1 ? <Trophy className="w-6 h-6" /> : <Medal className="w-6 h-6" />}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-2xl font-display font-black text-neutral-900 truncate w-full">
                    {currentUser.displayName}
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-500" />
                    <span className="text-lg font-black text-indigo-600">{currentUser.trustScore}</span>
                  </div>
                </div>

                <div className={`w-full bg-white border-2 border-neutral-50 rounded-3xl p-4 shadow-xl shadow-indigo-500/5`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('leaderboard.rank', { rank })}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* List for 4-10 */}
      <div className="bg-white rounded-[48px] border-2 border-neutral-100 shadow-2xl shadow-indigo-500/5 overflow-hidden">
        <div className="p-8 border-b-2 border-neutral-50 bg-neutral-50/50 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400">{t('leaderboard.citizen_ranking')}</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400">{t('leaderboard.trust_integrity')}</span>
        </div>
        <div className="divide-y-2 divide-neutral-50">
          {topUsers.slice(3).map((user, i) => (
            <motion.div 
              key={user.uid}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="p-8 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
            >
              <div className="flex items-center gap-8">
                <span className="text-2xl font-display font-black text-neutral-300 w-8">#{i + 4}</span>
                <div className="flex items-center gap-4">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-14 h-14 rounded-2xl object-cover shadow-lg"
                    alt={user.displayName}
                  />
                  <div>
                    <h4 className="text-xl font-black text-neutral-900">{user.displayName}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('leaderboard.level_citizen', { level: Math.floor(user.trustScore / 100) + 1 })}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-2xl font-display font-black text-neutral-900">{user.trustScore}</span>
                  </div>
                  <div className="w-32 h-1.5 bg-neutral-100 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ width: `${(user.trustScore / 1000) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
