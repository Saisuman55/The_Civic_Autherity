import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, setDoc, addDoc, getDocs, getDoc, where, OperationType, handleFirestoreError } from '../firebase';
import { IssueReport, UserProfile, IssueStatus, IssueUpdate } from '../types';
import LoadingSpinner from './ui/LoadingSpinner';
import { Shield, CheckCircle2, Trash2, AlertTriangle, Search, FileText, Users, Ban, Check, UserCheck, UserMinus, Activity, Zap, ShieldAlert, Globe, Loader2, X, AlertCircle, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n';

export default function AdminPanel() {
  const { t } = useI18n();
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'issues' | 'users'>('issues');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [rejectionModal, setRejectionModal] = useState<{ id: string; isOpen: boolean }>({ id: '', isOpen: false });
  const [deleteModal, setDeleteModal] = useState<{ id: string | string[]; isOpen: boolean }>({ id: '', isOpen: false });
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [autoAiVerification, setAutoAiVerification] = useState(true);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState({ title: '', message: '' });
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  useEffect(() => {
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'system'), (snapshot) => {
      if (snapshot.exists()) {
        setAutoAiVerification(snapshot.data().autoAiVerification);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/system');
    });

    const qIssues = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    const unsubscribeIssues = onSnapshot(qIssues, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IssueReport));
      setIssues(data);
      if (activeTab === 'issues') setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
    });

    const qUsers = query(collection(db, 'users'), orderBy('trustScore', 'desc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
      if (activeTab === 'users') setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeSettings();
      unsubscribeIssues();
      unsubscribeUsers();
    };
  }, [activeTab]);

  const toggleAutoAiVerification = async () => {
    try {
      await setDoc(doc(db, 'settings', 'system'), {
        autoAiVerification: !autoAiVerification
      }, { merge: true });
    } catch (error) {
      console.error('Settings update error:', error);
    }
  };

  const updateStatus = async (id: string, status: IssueStatus, reason?: string) => {
    try {
      const issue = issues.find(i => i.id === id);
      if (!issue) return;

      const updateData: IssueUpdate = { status, updatedAt: new Date().toISOString() };
      if (reason) updateData.rejectionReason = reason;
      try {
        await updateDoc(doc(db, 'issues', id), updateData as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
      }

      // Update reporter's trust score
      const userRef = doc(db, 'users', issue.reporterUid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${issue.reporterUid}`);
      }
      
      if (userSnap && userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        let scoreChange = 0;
        if (status === 'Verified') scoreChange = 5;
        if (status === 'Resolved') scoreChange = 2;
        if (status === 'Rejected') scoreChange = -10;

        if (scoreChange !== 0) {
          const newScore = Math.max(0, Math.min(100, (userData.trustScore || 50) + scoreChange));
          try {
            await updateDoc(userRef, { trustScore: newScore });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${issue.reporterUid}`);
          }
        }
      }

      // Send notification to user
      try {
        await addDoc(collection(db, 'notifications'), {
          recipientUid: issue.reporterUid,
          title: t('admin.status_updated'),
          message: t('admin.status_updated_desc').replace('{status}', t(`dashboard.${status.toLowerCase().replace(' ', '_')}`)).replace('{reason}', reason ? `. ${t('admin.reason')}: ${reason}` : ''),
          type: 'status_change',
          issueId: id,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'notifications');
      }

      setRejectionModal({ id: '', isOpen: false });
      setRejectionReason('');
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      try {
        await updateDoc(doc(db, 'users', userId), { role: newRole });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      }
    } catch (error) {
      console.error('Role update error:', error);
    }
  };

  const deleteReport = async (id: string | string[]) => {
    try {
      if (Array.isArray(id)) {
        await Promise.all(id.map(async (i) => {
          try {
            await deleteDoc(doc(db, 'issues', i));
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `issues/${i}`);
          }
        }));
        setSelectedIssues([]);
      } else {
        try {
          await deleteDoc(doc(db, 'issues', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `issues/${id}`);
        }
        setSelectedIssues(prev => prev.filter(item => item !== id));
      }
      setDeleteModal({ id: '', isOpen: false });
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const bulkUpdateStatus = async (status: IssueStatus) => {
    setBulkActionLoading(true);
    try {
      await Promise.all(selectedIssues.map(async (id) => {
        const issue = issues.find(i => i.id === id);
        if (!issue) return;

        const updateData: IssueUpdate = { status, updatedAt: new Date().toISOString() };
        try {
          await updateDoc(doc(db, 'issues', id), updateData as any);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
        }

        // Update reporter's trust score
        const userRef = doc(db, 'users', issue.reporterUid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${issue.reporterUid}`);
        }
        
        if (userSnap && userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          let scoreChange = 0;
          if (status === 'Verified') scoreChange = 5;
          if (status === 'Resolved') scoreChange = 2;
          if (status === 'Rejected') scoreChange = -10;

          if (scoreChange !== 0) {
            const newScore = Math.max(0, Math.min(100, (userData.trustScore || 50) + scoreChange));
            try {
              await updateDoc(userRef, { trustScore: newScore });
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, `users/${issue.reporterUid}`);
            }
          }
        }

        // Send notification
        await addDoc(collection(db, 'notifications'), {
          recipientUid: issue.reporterUid,
          title: t('admin.status_updated'),
          message: t('admin.status_updated_desc').replace('{status}', t(`dashboard.${status.toLowerCase().replace(' ', '_')}`)).replace('{reason}', ''),
          type: 'status_change',
          issueId: id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }));
      setSelectedIssues([]);
    } catch (error) {
      console.error('Bulk update error:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const bulkToggleUserRoles = async () => {
    setBulkActionLoading(true);
    try {
      await Promise.all(selectedUsers.map(uid => {
        const user = users.find(u => u.uid === uid);
        if (!user) return Promise.resolve();
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        return updateDoc(doc(db, 'users', uid), { role: newRole });
      }));
      setSelectedUsers([]);
    } catch (error) {
      console.error('Bulk role update error:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleIssueSelection = (id: string) => {
    setSelectedIssues(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleUserSelection = (uid: string) => {
    setSelectedUsers(prev => 
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    );
  };

  const selectAllIssues = () => {
    if (selectedIssues.length === filteredIssues.length) {
      setSelectedIssues([]);
    } else {
      setSelectedIssues(filteredIssues.map(i => i.id));
    }
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.uid));
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage.title || !broadcastMessage.message) return;
    setBroadcastLoading(true);
    try {
      const batch = users.map(u => {
        const notifRef = doc(collection(db, 'notifications'));
        return setDoc(notifRef, {
          recipientUid: u.uid,
          title: `[BROADCAST] ${broadcastMessage.title}`,
          message: broadcastMessage.message,
          type: 'broadcast',
          read: false,
          createdAt: new Date().toISOString()
        });
      });
      await Promise.all(batch);
      setBroadcastModal(false);
      setBroadcastMessage({ title: '', message: '' });
      alert(t('admin.broadcast_success'));
    } catch (error) {
      console.error('Broadcast error:', error);
      alert(t('admin.broadcast_error'));
    } finally {
      setBroadcastLoading(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    const matchesStatus = statusFilter === 'All' || issue.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || issue.category === categoryFilter;
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      issue.description?.toLowerCase().includes(searchLower) || 
      issue.address.toLowerCase().includes(searchLower) ||
      issue.category.toLowerCase().includes(searchLower) ||
      issue.landmark?.toLowerCase().includes(searchLower) ||
      issue.status.toLowerCase().includes(searchLower);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const filteredUsers = users.filter(u => {
    const searchLower = search.toLowerCase();
    return u.displayName.toLowerCase().includes(searchLower) || 
           u.email.toLowerCase().includes(searchLower) ||
           u.role.toLowerCase().includes(searchLower);
  });

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <LoadingSpinner label={t('admin.accessing_db')} />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* Global Search Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group max-w-5xl mx-auto w-full"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
        <div className="relative bg-white border-2 border-neutral-100 rounded-[32px] p-2 flex items-center shadow-2xl shadow-indigo-500/5 group-focus-within:border-indigo-500 group-focus-within:ring-8 group-focus-within:ring-indigo-500/5 transition-all duration-300">
          <div className="pl-8 pr-4">
            <Search className="w-6 h-6 text-neutral-300 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input 
            type="text"
            placeholder={t('admin.search_placeholder')}
            className="flex-1 bg-transparent border-none outline-none py-6 text-xl font-medium text-neutral-900 placeholder:text-neutral-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <div className="flex items-center gap-4 pr-6">
              <div className="hidden sm:flex items-center gap-4 border-r border-neutral-100 pr-6">
                <button 
                  onClick={() => setActiveTab('issues')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${activeTab === 'issues' ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-400 hover:bg-neutral-50'}`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{filteredIssues.length}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${activeTab === 'users' ? 'bg-purple-50 text-purple-600' : 'text-neutral-400 hover:bg-neutral-50'}`}
                >
                  <Users className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{filteredUsers.length}</span>
                </button>
              </div>
              <button 
                onClick={() => setSearch('')}
                className="p-3 hover:bg-neutral-100 rounded-2xl transition-colors"
                title={t('admin.clear_search')}
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500">{t('admin.protocol')}</span>
          </div>
          <h2 className="text-6xl font-display font-black tracking-tighter text-neutral-900 flex items-center gap-4">
            {t('admin.command_center')}
          </h2>
          <div className="mt-8 flex items-center gap-6">
            <div className="flex items-center gap-4 bg-white border-2 border-neutral-100 rounded-[28px] px-8 py-4 shadow-xl shadow-indigo-500/5">
              <div className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${autoAiVerification ? 'bg-emerald-500' : 'bg-neutral-200'}`} onClick={toggleAutoAiVerification}>
                <motion.div 
                  animate={{ x: autoAiVerification ? 24 : 0 }}
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900">{t('admin.auto_ai')}</span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{autoAiVerification ? t('admin.active') : t('admin.disabled')}</span>
              </div>
            </div>

            <button 
              onClick={() => setBroadcastModal(true)}
              className="flex items-center gap-4 bg-neutral-900 text-white border-2 border-neutral-900 rounded-[28px] px-8 py-4 shadow-xl shadow-black/10 hover:bg-black transition-all group"
            >
              <Globe className="w-5 h-5 text-indigo-400 group-hover:animate-pulse" />
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-widest">{t('admin.broadcast')}</span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t('admin.broadcast_desc')}</span>
              </div>
            </button>
          </div>
          <p className="text-neutral-500 mt-4 text-xl font-medium max-w-2xl opacity-70">
            {t('admin.description')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {activeTab === 'issues' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white border-2 border-neutral-100 rounded-[28px] p-1.5 flex shadow-xl shadow-indigo-500/5 overflow-x-auto no-scrollbar max-w-full">
                {['All', 'Pending', 'Verified', 'In Progress', 'Resolved', 'Rejected'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-6 py-2.5 rounded-[20px] transition-all text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                      statusFilter === f ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-neutral-400 hover:text-neutral-600'
                    }`}
                  >
                    {f === 'All' ? t('admin.all_statuses') : t(`dashboard.${f.toLowerCase().replace(' ', '_')}`)}
                  </button>
                ))}
              </div>
              <div className="bg-white border-2 border-neutral-100 rounded-[28px] p-1.5 flex shadow-xl shadow-indigo-500/5 overflow-x-auto no-scrollbar max-w-full">
                {['All', 'Traffic', 'Road', 'Emergency', 'Safety'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`px-6 py-2.5 rounded-[20px] transition-all text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                      categoryFilter === c ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-neutral-400 hover:text-neutral-600'
                    }`}
                  >
                    {c === 'All' ? t('admin.all_categories') : t(`cat.${c.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="bg-white border-2 border-neutral-100 rounded-[28px] p-1.5 flex shadow-xl shadow-indigo-500/5">
            <button 
              onClick={() => setActiveTab('issues')}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-[22px] transition-all text-[11px] font-black uppercase tracking-[0.2em] ${
                activeTab === 'issues' ? 'bg-neutral-900 text-white shadow-xl shadow-black/20' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t('admin.issues_tab')}
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-[22px] transition-all text-[11px] font-black uppercase tracking-[0.2em] ${
                activeTab === 'users' ? 'bg-neutral-900 text-white shadow-xl shadow-black/20' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <Users className="w-4 h-4" />
              {t('admin.users_tab')}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { label: t('admin.pending_audit'), value: issues.filter(i => i.status === 'Pending').length, color: 'text-amber-500', gradient: 'from-amber-500 to-amber-600', icon: Activity },
          { label: t('admin.active_progress'), value: issues.filter(i => i.status === 'In Progress').length, color: 'text-indigo-500', gradient: 'from-indigo-500 to-indigo-600', icon: Zap },
          { label: t('admin.total_verified'), value: issues.filter(i => i.status === 'Verified').length, color: 'text-emerald-500', gradient: 'from-emerald-500 to-emerald-600', icon: Shield },
          { label: t('admin.high_trust'), value: users.filter(u => u.trustScore > 80).length, color: 'text-violet-500', gradient: 'from-violet-500 to-violet-600', icon: Globe },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[40px] border-2 border-neutral-100 shadow-xl shadow-indigo-500/5 group cursor-default relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-[0.03] rounded-bl-[60px] group-hover:scale-150 transition-transform duration-700`} />
            
            <div className="flex items-center justify-between mb-6">
              <div className={`p-3 rounded-xl bg-neutral-50 ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${stat.gradient} animate-pulse`} />
            </div>
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-display font-black tracking-tighter text-neutral-900`}>{stat.value}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">{stat.label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <AnimatePresence>
          {(activeTab === 'issues' ? selectedIssues.length > 0 : selectedUsers.length > 0) && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-10 py-6 rounded-[32px] shadow-4xl flex items-center gap-10 border border-white/10 backdrop-blur-2xl"
            >
              <div className="flex items-center gap-4 border-r border-white/10 pr-10">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-black text-sm">
                  {bulkActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (activeTab === 'issues' ? selectedIssues.length : selectedUsers.length)}
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">{t('admin.selected')}</span>
              </div>

              <div className="flex items-center gap-6">
                {activeTab === 'issues' ? (
                  <>
                    <button 
                      onClick={() => bulkUpdateStatus('Verified')}
                      disabled={bulkActionLoading}
                      className="flex items-center gap-3 px-6 py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" /> {t('admin.approve')}
                    </button>
                    <button 
                      onClick={() => bulkUpdateStatus('In Progress')}
                      disabled={bulkActionLoading}
                      className="flex items-center gap-3 px-6 py-3 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" /> {t('admin.process')}
                    </button>
                    <button 
                      onClick={() => bulkUpdateStatus('Resolved')}
                      disabled={bulkActionLoading}
                      className="flex items-center gap-3 px-6 py-3 bg-teal-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {t('admin.resolve')}
                    </button>
                    <button 
                      onClick={() => setDeleteModal({ id: selectedIssues, isOpen: true })}
                      disabled={bulkActionLoading}
                      className="flex items-center gap-3 px-6 py-3 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> {t('admin.purge')}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={bulkToggleUserRoles}
                    disabled={bulkActionLoading}
                    className="flex items-center gap-3 px-6 py-3 bg-violet-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-600 transition-all disabled:opacity-50"
                  >
                    <Shield className="w-4 h-4" /> {t('admin.toggle_roles')}
                  </button>
                )}
                <button 
                  onClick={() => activeTab === 'issues' ? setSelectedIssues([]) : setSelectedUsers([])}
                  className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
                >
                  {t('admin.cancel')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-[48px] border-2 border-neutral-100 shadow-2xl shadow-indigo-500/10 overflow-hidden"
        >
          {activeTab === 'issues' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50 border-b-2 border-neutral-100">
                    <th className="p-10 w-20">
                      <input 
                        type="checkbox"
                        checked={selectedIssues.length === filteredIssues.length && filteredIssues.length > 0}
                        onChange={selectAllIssues}
                        className="w-6 h-6 rounded-lg border-2 border-neutral-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      />
                    </th>
                    <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400">{t('admin.report_detail')}</th>
                    <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400">{t('admin.status')}</th>
                    <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400">{t('admin.ai_audit')}</th>
                    <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400 text-right">{t('admin.operations')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-neutral-50">
                  {filteredIssues.map((issue) => (
                    <tr key={issue.id} className={`hover:bg-neutral-50/50 transition-all group ${selectedIssues.includes(issue.id) ? 'bg-indigo-50/30' : ''}`}>
                      <td className="p-10">
                        <input 
                          type="checkbox"
                          checked={selectedIssues.includes(issue.id)}
                          onChange={() => toggleIssueSelection(issue.id)}
                          className="w-6 h-6 rounded-lg border-2 border-neutral-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                        />
                      </td>
                      <td className="p-10">
                      <div className="flex items-start gap-8">
                        <div className="relative shrink-0">
                          <img src={issue.imageUrl} className="w-32 h-32 rounded-[32px] object-cover border-4 border-white shadow-xl group-hover:scale-105 transition-transform duration-700" alt="Issue" referrerPolicy="no-referrer" />
                          <div className="absolute -top-3 -right-3 bg-white rounded-2xl p-2 shadow-2xl border-2 border-neutral-50">
                            <div className={`w-4 h-4 rounded-full ${issue.isFake ? 'bg-rose-500' : 'bg-emerald-500'} shadow-lg`} />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">{t(`cat.${issue.category.toLowerCase()}`)}</span>
                            <span className="font-mono text-[10px] text-neutral-300 font-bold uppercase tracking-tighter">ID: {issue.id.slice(0, 8)}</span>
                          </div>
                          <p className="text-lg font-display font-black text-neutral-900 leading-tight tracking-tight">{issue.address}</p>
                          <p className="text-sm text-neutral-500 line-clamp-2 max-w-md font-medium leading-relaxed opacity-70">{issue.description || t('admin.no_description')}</p>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-black uppercase tracking-widest">
                            <Activity className="w-3 h-3" />
                            {t('admin.reported')} {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-10">
                      <div className="flex flex-col gap-3">
                        <span className={`inline-flex items-center px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border-2 shadow-sm ${
                          issue.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          issue.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                          issue.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                          {t(`dashboard.${issue.status.toLowerCase().replace(' ', '_')}`)}
                        </span>
                        {issue.rejectionReason && (
                          <div className="p-3 bg-rose-50 rounded-2xl border-2 border-rose-100">
                            <p className="text-[10px] text-rose-600 font-black leading-tight uppercase tracking-widest">{t('admin.reason')}: {issue.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-10">
                      <div className="max-w-[280px] space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">{t('admin.confidence')}</span>
                          <span className={`text-[11px] font-black font-mono ${issue.aiConfidence && issue.aiConfidence > 0.8 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {issue.aiConfidence !== undefined ? `${(issue.aiConfidence * 100).toFixed(0)}%` : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(issue.aiConfidence || 0) * 100}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full ${issue.aiConfidence && issue.aiConfidence > 0.8 ? 'bg-emerald-500' : 'bg-amber-500'} shadow-lg`}
                          />
                        </div>
                        <p className="text-[11px] text-neutral-600 leading-relaxed font-medium opacity-80 italic">
                          "{issue.aiReasoning || t('admin.awaiting_ai')}"
                        </p>
                      </div>
                    </td>
                    <td className="p-10">
                      <div className="flex items-center justify-end gap-4">
                        {issue.status === 'Pending' && (
                          <>
                            <button 
                              onClick={() => updateStatus(issue.id, 'Verified')}
                              className="w-12 h-12 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-500/10 hover:-translate-y-1"
                              title={t('admin.approve')}
                            >
                              <Check className="w-6 h-6" />
                            </button>
                            <button 
                              onClick={() => setRejectionModal({ id: issue.id, isOpen: true })}
                              className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-500/10 hover:-translate-y-1"
                              title={t('admin.reject')}
                            >
                              <Ban className="w-6 h-6" />
                            </button>
                          </>
                        )}
                        {issue.status === 'Verified' && (
                          <button 
                            onClick={() => updateStatus(issue.id, 'In Progress')}
                            className="w-12 h-12 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-lg shadow-indigo-500/10 hover:-translate-y-1"
                            title={t('admin.process')}
                          >
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </button>
                        )}
                        {issue.status === 'In Progress' && (
                          <button 
                            onClick={() => updateStatus(issue.id, 'Resolved')}
                            className="w-12 h-12 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-500/10 hover:-translate-y-1"
                            title={t('admin.resolve')}
                          >
                            <CheckCircle2 className="w-6 h-6" />
                          </button>
                        )}
                        <button 
                          onClick={() => setDeleteModal({ id: issue.id, isOpen: true })}
                          className="w-12 h-12 flex items-center justify-center bg-neutral-100 text-neutral-400 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-lg hover:-translate-y-1"
                          title={t('admin.purge')}
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50/50 border-b-2 border-neutral-100">
                  <th className="p-10 w-20">
                    <input 
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={selectAllUsers}
                      className="w-6 h-6 rounded-lg border-2 border-neutral-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                    />
                  </th>
                  <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400">{t('admin.user_identity')}</th>
                  <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400 text-center">{t('admin.trust_score')}</th>
                  <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400">{t('admin.role')}</th>
                  <th className="p-10 text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400 text-right">{t('admin.authority')}</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-neutral-50">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className={`hover:bg-neutral-50/50 transition-all group ${selectedUsers.includes(u.uid) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="p-10">
                      <input 
                        type="checkbox"
                        checked={selectedUsers.includes(u.uid)}
                        onChange={() => toggleUserSelection(u.uid)}
                        className="w-6 h-6 rounded-lg border-2 border-neutral-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      />
                    </td>
                    <td className="p-10">
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-16 h-16 rounded-[24px] border-4 border-white shadow-xl" alt="User" />
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white shadow-lg ${u.trustScore > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        </div>
                        <div>
                          <p className="font-display font-black text-lg text-neutral-900 tracking-tight">{u.displayName}</p>
                          <p className="text-xs text-neutral-400 font-black tracking-widest uppercase opacity-70">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-10 text-center">
                      <div className="inline-flex flex-col items-center gap-3">
                        <span className="font-display font-black text-4xl text-neutral-900 tracking-tighter">{u.trustScore}</span>
                        <div className="w-40 h-2 bg-neutral-100 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${u.trustScore}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full shadow-lg ${u.trustScore > 70 ? 'bg-emerald-500' : u.trustScore > 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-10">
                      <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border-2 shadow-sm ${
                        u.role === 'admin' ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-neutral-50 text-neutral-600 border-neutral-100'
                      }`}>
                        {u.role === 'admin' ? t('admin.admin') : t('admin.user')}
                      </span>
                    </td>
                    <td className="p-10">
                      <div className="flex items-center justify-end gap-4">
                        <button 
                          onClick={() => toggleUserRole(u.uid, u.role)}
                          className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all shadow-lg hover:-translate-y-1 ${
                            u.role === 'admin' ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white shadow-rose-500/10' : 'bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white shadow-violet-500/10'
                          }`}
                          title={u.role === 'admin' ? t('admin.revoke_admin') : t('admin.grant_admin')}
                        >
                          {u.role === 'admin' ? <UserMinus className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>

      {/* Modals */}
      <AnimatePresence>
        {broadcastModal && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] w-full max-w-xl p-12 shadow-2xl border-2 border-neutral-100"
            >
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-8">
                <Globe className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-4xl font-display font-black text-neutral-900 mb-4 tracking-tighter">{t('admin.broadcast')}</h3>
              <p className="text-neutral-500 text-lg font-medium mb-10 opacity-70">{t('admin.broadcast_desc')}</p>
              
              <div className="space-y-6 mb-10">
                <input
                  type="text"
                  value={broadcastMessage.title}
                  onChange={(e) => setBroadcastMessage({ ...broadcastMessage, title: e.target.value })}
                  placeholder={t('admin.broadcast_title')}
                  className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl px-8 py-4 text-lg font-bold focus:border-indigo-500 outline-none transition-all"
                />
                <textarea
                  value={broadcastMessage.message}
                  onChange={(e) => setBroadcastMessage({ ...broadcastMessage, message: e.target.value })}
                  placeholder={t('admin.broadcast_msg')}
                  className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-[32px] p-8 text-lg font-medium focus:border-indigo-500 outline-none transition-all h-48 shadow-inner"
                />
              </div>

              <div className="flex gap-6">
                <button 
                  onClick={() => setBroadcastModal(false)}
                  className="flex-1 py-6 rounded-[28px] text-sm font-black uppercase tracking-[0.3em] text-neutral-400 hover:bg-neutral-50 transition-all"
                >
                  {t('admin.cancel')}
                </button>
                <button 
                  onClick={sendBroadcast}
                  disabled={broadcastLoading || !broadcastMessage.title || !broadcastMessage.message}
                  className="flex-[2] py-6 bg-indigo-600 text-white rounded-[28px] text-sm font-black uppercase tracking-[0.3em] hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-2xl shadow-indigo-500/20 flex items-center justify-center gap-3"
                >
                  {broadcastLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {t('admin.transmit')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {rejectionModal.isOpen && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] w-full max-w-xl p-12 shadow-2xl border-2 border-neutral-100"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8">
                <Ban className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-4xl font-display font-black text-neutral-900 mb-4 tracking-tighter">{t('admin.reject_report')}</h3>
              <p className="text-neutral-500 text-lg font-medium mb-10 opacity-70">{t('admin.reject_desc')}</p>
              
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('admin.reject_placeholder')}
                className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-[32px] p-8 text-lg font-medium focus:border-rose-500 focus:ring-8 focus:ring-rose-500/10 outline-none transition-all h-48 mb-10 shadow-inner"
              />

              <div className="flex gap-6">
                <button 
                  onClick={() => setRejectionModal({ id: '', isOpen: false })}
                  className="flex-1 py-6 rounded-[28px] text-sm font-black uppercase tracking-[0.3em] text-neutral-400 hover:bg-neutral-50 transition-all"
                >
                  {t('admin.cancel')}
                </button>
                <button 
                  onClick={() => updateStatus(rejectionModal.id, 'Rejected', rejectionReason)}
                  disabled={!rejectionReason.trim()}
                  className="flex-[2] py-6 bg-rose-600 text-white rounded-[28px] text-sm font-black uppercase tracking-[0.3em] hover:bg-rose-700 transition-all disabled:opacity-50 shadow-2xl shadow-rose-500/20"
                >
                  {t('admin.confirm_reject')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteModal.isOpen && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] w-full max-w-xl p-12 shadow-2xl border-2 border-neutral-100"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8">
                <AlertTriangle className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-4xl font-display font-black text-neutral-900 mb-4 tracking-tighter">{t('admin.purge_record')}</h3>
              <p className="text-neutral-500 text-lg font-medium mb-12 opacity-70">
                {Array.isArray(deleteModal.id) 
                  ? t('admin.delete_multiple_warning')
                  : t('admin.delete_warning')}
              </p>
              
              <div className="flex gap-6">
                <button 
                  onClick={() => setDeleteModal({ id: '', isOpen: false })}
                  className="flex-1 py-6 rounded-[28px] text-sm font-black uppercase tracking-[0.3em] text-neutral-400 hover:bg-neutral-50 transition-all"
                >
                  {t('admin.cancel')}
                </button>
                <button 
                  onClick={() => deleteReport(deleteModal.id)}
                  className="flex-[2] py-6 bg-rose-600 text-white rounded-[28px] text-sm font-black uppercase tracking-[0.3em] hover:bg-rose-700 transition-all shadow-2xl shadow-rose-500/20"
                >
                  {t('admin.delete_permanently')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

