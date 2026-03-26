import React, { useState, useEffect } from 'react';
import { auth, db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, writeBatch, OperationType, handleFirestoreError } from '../firebase';
import { Notification } from '../types';
import { Bell, Check, Trash2, Clock, MessageSquare, AlertCircle, CheckCircle2, X, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

import { useI18n } from '../i18n';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAll = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Bell className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500">{t('notifications.alert_center')}</span>
          </div>
          <h1 className="text-6xl font-display font-black tracking-tighter text-neutral-900">
            {t('notifications.title').split(' ')[0]} <span className="text-gradient">{t('notifications.title').split(' ').slice(1).join(' ')}</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
            >
              {t('notifications.mark_all_read')}
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={clearAll}
              className="px-6 py-3 bg-neutral-50 text-neutral-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all"
            >
              {t('notifications.clear_all')}
            </button>
          )}
        </div>
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative bg-white border-2 rounded-[32px] p-8 transition-all hover:shadow-2xl hover:shadow-indigo-500/5 ${n.read ? 'border-neutral-50 opacity-70' : 'border-indigo-100 shadow-xl shadow-indigo-500/5'}`}
              >
                <div className="flex gap-8 items-start">
                  <div className={`p-4 rounded-2xl ${
                    n.type === 'status_change' ? 'bg-emerald-50 text-emerald-500' :
                    n.type === 'comment' ? 'bg-indigo-50 text-indigo-500' :
                    n.type === 'broadcast' ? 'bg-violet-50 text-violet-500' :
                    'bg-amber-50 text-amber-500'
                  }`}>
                    {n.type === 'status_change' ? <CheckCircle2 className="w-6 h-6" /> :
                     n.type === 'comment' ? <MessageSquare className="w-6 h-6" /> :
                     n.type === 'broadcast' ? <Globe className="w-6 h-6" /> :
                     <AlertCircle className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xl font-display font-black tracking-tight ${n.read ? 'text-neutral-500' : 'text-neutral-900'}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> {n.createdAt ? formatDistanceToNow(new Date(n.createdAt)) : 'N/A'} ago
                      </span>
                    </div>
                    <p className="text-neutral-500 font-medium leading-relaxed opacity-80">
                      {n.message}
                    </p>
                    
                    {n.issueId && (
                      <Link 
                        to={`/issue/${n.issueId}`}
                        onClick={() => markAsRead(n.id)}
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-all mt-4"
                      >
                        {t('notifications.view_issue')} <Check className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.read && (
                      <button 
                        onClick={() => markAsRead(n.id)}
                        className="p-3 bg-indigo-50 text-indigo-500 rounded-xl hover:bg-indigo-100 transition-all"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(n.id)}
                      className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-[48px] p-20 text-center border-2 border-dashed border-neutral-100">
          <div className="w-24 h-24 bg-neutral-50 rounded-[32px] flex items-center justify-center mx-auto mb-8">
            <Bell className="w-12 h-12 text-neutral-200" />
          </div>
          <h3 className="text-2xl font-display font-black text-neutral-900 mb-4">{t('notifications.all_caught_up')}</h3>
          <p className="text-neutral-500 font-medium max-w-md mx-auto opacity-70">
            {t('notifications.no_new')}
          </p>
        </div>
      )}
    </div>
  );
}
