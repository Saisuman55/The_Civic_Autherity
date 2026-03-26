import React from 'react';
import { MapPin, Calendar, Clock, Shield, CheckCircle2, AlertTriangle, Info, Map as MapIcon, List as ListIcon, ArrowUpRight, Zap, ThumbsUp, MessageSquare } from 'lucide-react';
import { IssueReport, UserProfile } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { db, doc, updateDoc, arrayUnion, arrayRemove, auth } from '../firebase';
import { useI18n } from '../i18n';

interface IssueCardProps {
  issue: IssueReport;
  user?: UserProfile | null;
}

export default function IssueCard({ issue, user }: IssueCardProps) {
  const { t } = useI18n();
  const statusConfig = {
    Pending: { color: 'bg-orange-500', label: t('status.under_review'), icon: Clock, gradient: 'from-orange-400 to-amber-600' },
    Verified: { color: 'bg-green-500', label: t('status.verified'), icon: CheckCircle2, gradient: 'from-emerald-400 to-teal-600' },
    'In Progress': { color: 'bg-blue-500', label: t('status.processing'), icon: Shield, gradient: 'from-blue-400 to-indigo-600' },
    Resolved: { color: 'bg-emerald-500', label: t('status.resolved'), icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-700' },
    Rejected: { color: 'bg-red-500', label: t('status.rejected'), icon: AlertTriangle, gradient: 'from-rose-500 to-red-700' },
  };

  const categoryConfig = {
    Traffic: { color: 'bg-vibrant-amber', icon: '🚦', shadow: 'shadow-amber-500/40', gradient: 'from-amber-400 to-orange-500' },
    Road: { color: 'bg-vibrant-indigo', icon: '🛣️', shadow: 'shadow-indigo-500/40', gradient: 'from-indigo-400 to-violet-600' },
    Emergency: { color: 'bg-vibrant-rose', icon: '🚨', shadow: 'shadow-rose-500/40', gradient: 'from-rose-400 to-red-600' },
    Safety: { color: 'bg-vibrant-emerald', icon: '🛡️', shadow: 'shadow-emerald-500/40', gradient: 'from-emerald-400 to-teal-600' },
    Sanitation: { color: 'bg-emerald-500', icon: '♻️', shadow: 'shadow-emerald-500/40', gradient: 'from-emerald-400 to-teal-600' },
    Water: { color: 'bg-blue-500', icon: '💧', shadow: 'shadow-blue-500/40', gradient: 'from-blue-400 to-indigo-600' },
    Electricity: { color: 'bg-yellow-500', icon: '⚡', shadow: 'shadow-yellow-500/40', gradient: 'from-yellow-400 to-orange-600' },
    Environment: { color: 'bg-green-500', icon: '🌳', shadow: 'shadow-green-500/40', gradient: 'from-green-400 to-emerald-600' },
    Infrastructure: { color: 'bg-neutral-500', icon: '🏗️', shadow: 'shadow-neutral-500/40', gradient: 'from-neutral-400 to-neutral-600' },
    'Public Health': { color: 'bg-red-500', icon: '🏥', shadow: 'shadow-red-500/40', gradient: 'from-red-400 to-rose-600' },
    Other: { color: 'bg-neutral-500', icon: '📝', shadow: 'shadow-neutral-500/40', gradient: 'from-neutral-400 to-neutral-600' },
  };

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;
    const isUpvoted = issue.upvotes?.includes(auth.currentUser.uid);
    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        upvotes: isUpvoted ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
      });
    } catch (error) {
      console.error('Error upvoting:', error);
    }
  };

  const config = statusConfig[issue.status as keyof typeof statusConfig] || statusConfig.Pending;
  const catConfig = (categoryConfig as any)[issue.category] || categoryConfig.Other;
  const isUpvoted = auth.currentUser ? issue.upvotes?.includes(auth.currentUser.uid) : false;

  return (
    <Link to={`/issue/${issue.id}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -12, scale: 1.02 }}
        className="group bg-white rounded-[48px] border border-neutral-100 overflow-hidden hover:shadow-4xl transition-all duration-700 cursor-pointer flex flex-col h-full relative"
      >
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={issue.imageUrl} 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
          alt={issue.category} 
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://picsum.photos/seed/${issue.id}/800/600?blur=2`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-700" />
        
        {/* Status Badge */}
        <div className="absolute top-8 left-8 flex flex-col gap-4">
          {auth.currentUser?.uid === issue.reporterUid && (
            <div className="flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] bg-vibrant-indigo text-white shadow-3xl border border-white/20 animate-pulse">
              <Zap className="w-4 h-4 fill-current" />
              {t('issue.your_report')}
            </div>
          )}
          <div className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] backdrop-blur-3xl bg-white/90 text-neutral-900 border border-white/20 shadow-3xl transition-all`}>
            <div className={`w-3 h-3 rounded-full ${config.color} shadow-[0_0_15px_rgba(0,0,0,0.4)] animate-pulse`} />
            {config.label}
          </div>
          
          <div className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] bg-gradient-to-r ${catConfig.gradient} text-white shadow-3xl ${catConfig.shadow} border border-white/20`}>
            <span className="text-lg leading-none">{catConfig.icon}</span>
            {t(`cat.${issue.category.toLowerCase().replace(' ', '_')}`)}
          </div>
        </div>

        {/* AI Confidence Badge */}
        {issue.aiConfidence !== undefined && (
          <div className="absolute bottom-8 left-8 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] bg-neutral-900/95 backdrop-blur-3xl text-white border border-white/10 shadow-3xl flex items-center gap-4 group-hover:bg-vibrant-indigo transition-colors duration-500">
            <Shield className="w-5 h-5 text-vibrant-emerald" />
            <span className="text-white">{t('issue.neural_confidence')}: {(issue.aiConfidence * 100).toFixed(0)}%</span>
          </div>
        )}

        {issue.isFake && (
          <div className="absolute top-8 right-8 bg-vibrant-rose text-white p-5 rounded-3xl shadow-3xl animate-bounce border-4 border-white/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
        )}
      </div>

      <div className="p-12 flex-1 flex flex-col relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-vibrant opacity-[0.02] rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="flex-1 relative z-10">
          <div className="flex items-start justify-between gap-10 mb-10">
            <h3 className="font-display font-black text-4xl text-neutral-900 leading-[0.85] line-clamp-2 group-hover:text-vibrant-indigo transition-colors duration-500 tracking-tighter">
              {issue.description || t('issue.new_intelligence', { category: t(`cat.${issue.category.toLowerCase().replace(' ', '_')}`) })}
            </h3>
            <div className="w-16 h-16 rounded-2xl bg-neutral-50 flex items-center justify-center group-hover:bg-gradient-vibrant group-hover:text-white transition-all duration-700 flex-shrink-0 shadow-sm group-hover:shadow-2xl group-hover:shadow-indigo-500/30 group-hover:rotate-12">
              <ArrowUpRight className="w-8 h-8" />
            </div>
          </div>

          <div className="flex items-center gap-5 text-neutral-400 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center group-hover:bg-white transition-colors duration-500 shadow-sm">
              <MapPin className="w-6 h-6 text-neutral-300 group-hover:text-vibrant-indigo transition-colors" />
            </div>
            <p className="text-lg font-bold text-neutral-500 truncate tracking-tight opacity-80">
              {issue.address.split(',').slice(0, 2).join(',')}
            </p>
          </div>
        </div>

        <div className="pt-12 border-t border-neutral-100 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-6">
            <button 
              onClick={handleUpvote}
              className={`flex items-center gap-2 group/upvote transition-all ${isUpvoted ? 'text-indigo-500' : 'text-neutral-400 hover:text-indigo-500'}`}
            >
              <ThumbsUp className={`w-5 h-5 ${isUpvoted ? 'fill-current' : ''}`} />
              <span className="text-xs font-black">{issue.upvotes?.length || 0}</span>
            </button>
            <div className="flex items-center gap-2 text-neutral-400">
              <MessageSquare className="w-5 h-5" />
              <span className="text-xs font-black">{issue.comments?.length || 0}</span>
            </div>
          </div>
          
          <div className="flex items-center -space-x-6">
            <div className="w-14 h-14 rounded-2xl border-4 border-white bg-neutral-100 flex items-center justify-center overflow-hidden shadow-2xl hover:z-10 transition-all hover:scale-125 hover:rotate-6">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${issue.reporterUid}`} className="w-full h-full object-cover" alt="User" />
            </div>
            <div className={`w-14 h-14 rounded-2xl border-4 border-white flex items-center justify-center text-[10px] font-black shadow-2xl hover:z-10 transition-all hover:scale-125 hover:-rotate-6 ${issue.isFake ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {issue.isFake ? t('issue.low') : t('issue.high')}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    </Link>
  );
}
