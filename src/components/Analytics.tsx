import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, limit, orderBy } from '../firebase';
import { IssueReport } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, CheckCircle2, AlertTriangle, ShieldCheck, Activity, Zap, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from '../i18n';

export default function Analytics() {
  const { t } = useI18n();
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState(30);

  useEffect(() => {
    const now = new Date();
    const rangeDate = new Date(now.getTime() - daysRange * 24 * 60 * 60 * 1000);
    
    // Note: Firestore requires a composite index for orderBy + where(createdAt, '>=')
    // If the index is missing, it will throw an error with a link to create it.
    // We'll use a simple query first and filter in memory if needed, 
    // but the user specifically asked for date range filter UI.
    const q = query(
      collection(db, 'issues'), 
      orderBy('createdAt', 'desc'), 
      limit(500)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IssueReport));
      // Filter by date range in memory to avoid index requirement for now, 
      // or if we want to be strictly server-side we'd need where('createdAt', '>=', rangeDate.toISOString())
      const filtered = data.filter(i => new Date(i.createdAt) >= rangeDate);
      setIssues(filtered);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [daysRange]);

  const stats = {
    total: issues.length,
    verified: issues.filter(i => i.status === 'Verified' || i.status === 'In Progress' || i.status === 'Resolved').length,
    resolved: issues.filter(i => i.status === 'Resolved').length,
    fake: issues.filter(i => i.isFake).length,
    pending: issues.filter(i => i.status === 'Pending').length,
  };

  const VIBRANT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#d946ef'];

  const categoryData = Array.from(new Set(issues.map(i => i.category))).map((cat, index) => ({
    name: t(`cat.${cat.toLowerCase().replace(' ', '_')}`),
    value: issues.filter(i => i.category === cat).length,
    color: VIBRANT_COLORS[index % VIBRANT_COLORS.length]
  }));

  const statusData = [
    { name: t('dashboard.pending'), value: stats.pending, color: '#94a3b8' },
    { name: t('dashboard.verified'), value: issues.filter(i => i.status === 'Verified').length, color: '#6366f1' },
    { name: t('dashboard.in_progress'), value: issues.filter(i => i.status === 'In Progress').length, color: '#8b5cf6' },
    { name: t('dashboard.resolved'), value: stats.resolved, color: '#10b981' },
    { name: t('dashboard.rejected'), value: issues.filter(i => i.status === 'Rejected').length, color: '#ef4444' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500">{t('analytics.system_intelligence')}</span>
          </div>
          <h2 className="text-6xl font-display font-black tracking-tighter text-neutral-900">
            {t('analytics.title').split(' ')[0]} <span className="text-gradient">{t('analytics.title').split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="text-neutral-500 mt-4 text-xl font-medium max-w-2xl opacity-70">
            {t('analytics.desc')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-6">
          <div className="flex items-center gap-4 px-6 py-3 bg-white border-2 border-neutral-100 rounded-3xl shadow-xl shadow-indigo-500/5">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute inset-0" />
              <div className="w-3 h-3 rounded-full bg-emerald-500 relative" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-600">{t('analytics.live_feed')}</span>
          </div>
          
          <div className="flex bg-neutral-100 p-1.5 rounded-2xl">
            {[30, 90, 365].map((range) => (
              <button
                key={range}
                onClick={() => setDaysRange(range)}
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  daysRange === range 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                {range}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: t('analytics.total_reports'), value: stats.total, icon: TrendingUp, gradient: 'from-indigo-500 to-indigo-600', trend: '+12%', iconColor: 'text-indigo-500' },
          { label: t('analytics.verified'), value: stats.verified, icon: ShieldCheck, gradient: 'from-violet-500 to-violet-600', trend: '94%', iconColor: 'text-violet-500' },
          { label: t('analytics.resolved'), value: stats.resolved, icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-600', trend: '82%', iconColor: 'text-emerald-500' },
          { label: t('analytics.fake_spam'), value: stats.fake, icon: AlertTriangle, gradient: 'from-rose-500 to-rose-600', trend: 'Low', iconColor: 'text-rose-500' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative overflow-hidden bg-white p-10 rounded-[40px] border-2 border-neutral-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all group cursor-default"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-[0.03] rounded-bl-[100px] group-hover:scale-150 transition-transform duration-700`} />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className={`p-5 rounded-2xl bg-neutral-50 ${stat.iconColor} group-hover:scale-110 transition-transform duration-500 shadow-inner`}>
                <stat.icon className="w-8 h-8" />
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r ${stat.gradient} text-white shadow-lg shadow-indigo-500/20`}>
                {stat.trend}
              </div>
            </div>
            <p className="text-7xl font-display font-black text-neutral-900 tracking-tighter mb-2 relative z-10">{stat.value}</p>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-400 relative z-10">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-12 rounded-[48px] border-2 border-neutral-100 shadow-xl shadow-indigo-500/5"
        >
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-2xl">
                <BarChart3 className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-400">{t('analytics.reports_by_category')}</h3>
                <p className="text-xl font-display font-black text-neutral-900 tracking-tight">{t('analytics.distribution_analysis')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 900, fill: '#94a3b8', letterSpacing: '0.1em' }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 900, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '32px', 
                    border: 'none', 
                    boxShadow: '0 40px 80px rgba(99, 102, 241, 0.15)', 
                    padding: '24px', 
                    backgroundColor: '#fff',
                    fontWeight: 900
                  }}
                  cursor={{ fill: '#f8fafc', radius: 20 }}
                />
                <Bar dataKey="value" radius={[20, 20, 0, 0]} barSize={60}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white p-12 rounded-[48px] border-2 border-neutral-100 shadow-xl shadow-indigo-500/5"
        >
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/10 rounded-2xl">
                <PieChartIcon className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-400">{t('analytics.status_breakdown')}</h3>
                <p className="text-xl font-display font-black text-neutral-900 tracking-tight">{t('analytics.operational_lifecycle')}</p>
              </div>
            </div>
          </div>
          <div className="h-[400px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={100}
                  outerRadius={160}
                  paddingAngle={10}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '32px', 
                    border: 'none', 
                    boxShadow: '0 40px 80px rgba(139, 92, 246, 0.15)', 
                    padding: '24px',
                    fontWeight: 900
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-6xl font-display font-black text-neutral-900 tracking-tighter">{stats.total}</span>
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-400">{t('analytics.total_nodes')}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-8 mt-12">
            {statusData.map((entry, i) => (
              <div key={i} className="flex flex-col gap-2 group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 group-hover:text-neutral-900 transition-colors">{entry.name}</span>
                </div>
                <span className="text-2xl font-display font-black text-neutral-900 pl-6">{entry.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
