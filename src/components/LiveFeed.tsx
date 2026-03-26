import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, limit, onSnapshot, OperationType, handleFirestoreError } from '../firebase';
import { IssueReport, IssueComment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Activity, MessageSquare, AlertTriangle, CheckCircle2, 
  Clock, Shield, Zap, User, MapPin, ArrowUpRight 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

interface FeedEvent {
  id: string;
  type: 'new_issue' | 'status_change' | 'comment';
  title: string;
  description: string;
  timestamp: string;
  issueId: string;
  category: string;
  status?: string;
  authorName?: string;
  address: string;
}

export default function LiveFeed() {
  const { t } = useI18n();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We'll derive events from the issues collection
    // In a production app, you'd have a dedicated 'activities' collection
    const q = query(collection(db, 'issues'), orderBy('updatedAt', 'desc'), limit(30));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allEvents: FeedEvent[] = [];
      
      snapshot.docs.forEach(doc => {
        const issue = { id: doc.id, ...doc.data() } as IssueReport;
        
        // Event 1: The issue itself (either new or updated status)
        if (issue.createdAt === issue.updatedAt) {
          allEvents.push({
            id: `${issue.id}-created`,
            type: 'new_issue',
            title: t('live_feed.new_intel'),
            description: t('live_feed.new_issue_desc', { category: t(`cat.${issue.category.toLowerCase().replace(' ', '_')}`), address: issue.address }),
            timestamp: issue.createdAt,
            issueId: issue.id,
            category: issue.category,
            address: issue.address
          });
        } else {
          allEvents.push({
            id: `${issue.id}-updated-${issue.updatedAt}`,
            type: 'status_change',
            title: t('live_feed.protocol_updated'),
            description: t('live_feed.status_changed', { status: t(`dashboard.${issue.status.toLowerCase().replace(' ', '_')}`) }),
            timestamp: issue.updatedAt,
            issueId: issue.id,
            category: issue.category,
            status: issue.status,
            address: issue.address
          });
        }

        // Event 2: Comments (if any recent)
        if (issue.comments && issue.comments.length > 0) {
          issue.comments.forEach(comment => {
            allEvents.push({
              id: `${issue.id}-comment-${comment.id}`,
              type: 'comment',
              title: t('live_feed.new_community_intel'),
              description: t('live_feed.shared_update', { author: comment.authorName, text: `${comment.text.slice(0, 50)}${comment.text.length > 50 ? '...' : ''}` }),
              timestamp: comment.createdAt,
              issueId: issue.id,
              category: issue.category,
              authorName: comment.authorName,
              address: issue.address
            });
          });
        }
      });

      // Sort all derived events by timestamp
      const sortedEvents = allEvents
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      setEvents(sortedEvents);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
    });

    return () => unsubscribe();
  }, []);

  const getEventIcon = (type: FeedEvent['type'], status?: string) => {
    switch (type) {
      case 'new_issue': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'comment': return <MessageSquare className="w-5 h-5 text-indigo-500" />;
      case 'status_change':
        if (status === 'Resolved') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
        if (status === 'Verified') return <Shield className="w-5 h-5 text-indigo-500" />;
        if (status === 'In Progress') return <Zap className="w-5 h-5 text-blue-500" />;
        return <Clock className="w-5 h-5 text-neutral-400" />;
      default: return <Activity className="w-5 h-5 text-neutral-400" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.5em] text-neutral-400">{t('live_feed.real_time_stream')}</span>
        </div>
        <h1 className="text-7xl font-display font-black tracking-tighter text-neutral-900 leading-[0.85]">
          {t('live_feed.title').split(' ')[0]} <span className="text-gradient">{t('live_feed.title').split(' ').slice(1).join(' ')}</span>
        </h1>
        <p className="text-neutral-500 mt-6 text-2xl font-medium max-w-2xl opacity-70">
          {t('live_feed.desc')}
        </p>
      </div>

      {/* Feed Container */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-neutral-100" />

        <div className="space-y-8 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-neutral-100 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('live_feed.synchronizing')}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-8 group"
                >
                  {/* Icon Node */}
                  <div className="relative z-10">
                    <div className={`w-16 h-16 rounded-2xl bg-white border-2 border-neutral-100 shadow-xl flex items-center justify-center group-hover:scale-110 group-hover:border-indigo-500 transition-all duration-500`}>
                      {getEventIcon(event.type, event.status)}
                    </div>
                  </div>

                  {/* Content Card */}
                  <div className="flex-1 bg-white rounded-[32px] p-8 border-2 border-neutral-50 shadow-xl shadow-indigo-500/5 group-hover:shadow-indigo-500/10 group-hover:border-indigo-100 transition-all duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                          {event.timestamp ? formatDistanceToNow(new Date(event.timestamp), { addSuffix: true }) : 'N/A'}
                        </span>
                        <span className="w-1 h-1 bg-neutral-200 rounded-full" />
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          event.type === 'new_issue' ? 'bg-amber-50 text-amber-600' :
                          event.type === 'comment' ? 'bg-indigo-50 text-indigo-600' :
                          'bg-emerald-50 text-emerald-600'
                        }`}>
                          {t(`live_feed.type_${event.type}`)}
                        </span>
                      </div>
                      <Link 
                        to={`/issue/${event.issueId}`}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors"
                      >
                        {t('live_feed.view_intel')} <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <h3 className="text-xl font-display font-black text-neutral-900 mb-2 tracking-tight">
                      {event.title}
                    </h3>
                    <p className="text-neutral-500 font-medium leading-relaxed mb-6">
                      {event.description}
                    </p>

                    <div className="flex items-center gap-6 pt-6 border-t border-neutral-50">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-neutral-300" />
                        <span className="text-xs font-bold text-neutral-400 line-clamp-1">{event.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-neutral-300" />
                        <span className="text-xs font-bold text-neutral-400">{t(`cat.${event.category.toLowerCase().replace(' ', '_')}`)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!loading && events.length === 0 && (
            <div className="text-center py-20">
              <p className="text-neutral-400 font-black uppercase tracking-widest text-xs">No recent activity detected in the stream.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
