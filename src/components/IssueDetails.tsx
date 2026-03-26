import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, db, doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, collection, addDoc } from '../firebase';
import { IssueReport, IssueComment, UserProfile } from '../types';
import { 
  ArrowLeft, MapPin, Calendar, Clock, MessageSquare, 
  ThumbsUp, Share2, Shield, AlertTriangle, CheckCircle2, 
  Send, User, MoreVertical, Trash2, Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useI18n } from '../i18n';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function IssueDetails() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<IssueReport | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'issues', id), (snapshot) => {
      if (snapshot.exists()) {
        setIssue({ id: snapshot.id, ...snapshot.data() } as IssueReport);
      } else {
        navigate('/');
      }
    });

    if (auth.currentUser) {
      const unsubscribeUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
        if (snapshot.exists()) {
          setUserProfile(snapshot.data() as UserProfile);
        }
      });
      return () => {
        unsubscribe();
        unsubscribeUser();
      };
    }

    return () => unsubscribe();
  }, [id, navigate]);

  const handleUpvote = async () => {
    if (!auth.currentUser || !issue) return;
    const isUpvoted = issue.upvotes?.includes(auth.currentUser.uid);
    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        upvotes: isUpvoted ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
      });
    } catch (error) {
      console.error('Error upvoting:', error);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !issue || !commentText.trim() || !userProfile) return;

    setIsSubmitting(true);
    const newComment: IssueComment = {
      id: Math.random().toString(36).substr(2, 9),
      authorUid: auth.currentUser.uid,
      authorName: userProfile.displayName,
      authorPhoto: userProfile.photoURL,
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        comments: arrayUnion(newComment),
        updatedAt: new Date().toISOString()
      });
      
      // Notify the reporter if someone else comments
      if (issue.reporterUid !== auth.currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          recipientUid: issue.reporterUid,
          title: t('issue.new_comment'),
          message: t('issue.new_comment_desc', { user: userProfile.displayName, category: t(`cat.${issue.category.toLowerCase().replace(' ', '_')}`) }),
          type: 'comment',
          issueId: issue.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!issue) return;
    const updatedComments = issue.comments.filter(c => c.id !== commentId);
    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        comments: updatedComments
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  if (!issue) return null;

  const isUpvoted = auth.currentUser ? issue.upvotes?.includes(auth.currentUser.uid) : false;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="group flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-neutral-400 hover:text-indigo-500 transition-all"
      >
        <div className="p-3 bg-white rounded-2xl shadow-xl shadow-indigo-500/5 border-2 border-neutral-50 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </div>
        {t('issue.back_to_dashboard')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          {/* Issue Header & Image */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[48px] overflow-hidden shadow-2xl shadow-indigo-500/5 border-2 border-neutral-100"
          >
            <div className="relative aspect-video group">
              <img 
                src={issue.imageUrl} 
                alt={issue.category}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/30">
                      {issue.category}
                    </span>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/30 ${
                      issue.status === 'Resolved' ? 'bg-emerald-500/40' :
                      issue.status === 'Rejected' ? 'bg-red-500/40' :
                      'bg-indigo-500/40'
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                  <h1 className="text-4xl font-display font-black tracking-tighter text-white">
                    {issue.address}
                  </h1>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleUpvote}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl backdrop-blur-md border transition-all ${
                      isUpvoted ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                    }`}
                  >
                    <ThumbsUp className={`w-5 h-5 ${isUpvoted ? 'fill-current' : ''}`} />
                    <span className="text-sm font-black">{issue.upvotes?.length || 0}</span>
                  </button>
                  <button className="p-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-12 space-y-8">
              <div className="flex items-center justify-between py-6 border-b-2 border-neutral-50">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center">
                    <User className="w-7 h-7 text-neutral-300" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('issue.reported_by')}</p>
                    <p className="text-lg font-bold text-neutral-900">User ID: {issue.reporterUid.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-12">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('issue.date_reported')}</p>
                    <p className="text-lg font-bold text-neutral-900">{issue.createdAt ? format(new Date(issue.createdAt), 'MMM dd, yyyy') : 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('issue.time')}</p>
                    <p className="text-lg font-bold text-neutral-900">{issue.createdAt ? format(new Date(issue.createdAt), 'hh:mm a') : 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-display font-black tracking-tight text-neutral-900">{t('issue.description')}</h3>
                <p className="text-xl text-neutral-600 leading-relaxed font-medium opacity-80">
                  {issue.description || t('admin.no_description')}
                </p>
              </div>

              {issue.landmark && (
                <div className="flex items-center gap-4 p-6 bg-neutral-50 rounded-3xl">
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <MapPin className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('issue.nearby_landmark')}</p>
                    <p className="text-lg font-bold text-neutral-900">{issue.landmark}</p>
                  </div>
                </div>
              )}

              {issue.aiReasoning && (
                <div className="p-8 bg-indigo-50/50 rounded-[32px] border-2 border-indigo-100/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-indigo-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-500">{t('issue.ai_verification')}</span>
                  </div>
                  <p className="text-neutral-700 font-medium leading-relaxed italic">
                    "{issue.aiReasoning}"
                  </p>
                  <div className="flex items-center gap-4 pt-4 border-t border-indigo-100">
                    <div className="flex-1 h-2 bg-indigo-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-1000" 
                        style={{ width: `${(issue.aiConfidence || 0) * 100}%` }} 
                      />
                    </div>
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                      {Math.round((issue.aiConfidence || 0) * 100)}% {t('issue.confidence')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Comments Section */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-display font-black tracking-tighter text-neutral-900">
                {t('issue.community')} <span className="text-gradient">{t('issue.discussion')}</span>
              </h2>
              <span className="px-4 py-2 bg-neutral-50 rounded-xl text-[11px] font-black uppercase tracking-widest text-neutral-400">
                {issue.comments?.length || 0} {t('issue.comments')}
              </span>
            </div>

            {/* Comment Form */}
            {auth.currentUser ? (
              <form onSubmit={handleComment} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-white border-2 border-neutral-100 rounded-[32px] p-2 flex items-center shadow-2xl shadow-indigo-500/5 group-focus-within:border-indigo-500 group-focus-within:ring-8 group-focus-within:ring-indigo-500/5 transition-all duration-300">
                  <div className="pl-6 pr-4">
                    <MessageSquare className="w-6 h-6 text-neutral-300 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input 
                    type="text"
                    placeholder={t('issue.share_thoughts')}
                    className="flex-1 bg-transparent border-none outline-none py-6 text-lg font-medium text-neutral-900 placeholder:text-neutral-300"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button 
                    type="submit"
                    disabled={isSubmitting || !commentText.trim()}
                    className="p-4 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-neutral-50 rounded-[32px] p-8 text-center">
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">
                  {t('issue.sign_in_discuss')}
                </p>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {issue.comments?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((comment) => (
                  <motion.div
                    key={comment.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white border-2 border-neutral-50 rounded-[32px] p-8 shadow-xl shadow-indigo-500/5 group"
                  >
                    <div className="flex gap-6">
                      <img 
                        src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName}&background=f3f4f6&color=6b7280`} 
                        alt={comment.authorName}
                        className="w-14 h-14 rounded-2xl object-cover shadow-lg"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg font-black text-neutral-900">{comment.authorName}</h4>
                            <span className="w-1 h-1 bg-neutral-200 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                              {formatDistanceToNow(new Date(comment.createdAt))} ago
                            </span>
                          </div>
                          {auth.currentUser?.uid === comment.authorUid && (
                            <button 
                              onClick={() => deleteComment(comment.id)}
                              className="p-2 text-neutral-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-lg text-neutral-600 font-medium leading-relaxed">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {(!issue.comments || issue.comments.length === 0) && (
                <div className="text-center py-12 opacity-50">
                  <p className="text-neutral-400 font-black uppercase tracking-[0.2em] text-xs">{t('issue.no_comments')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Status Timeline */}
          <div className="bg-white rounded-[40px] p-8 border-2 border-neutral-100 shadow-xl shadow-indigo-500/5 space-y-8">
            <h3 className="text-xl font-display font-black tracking-tight text-neutral-900">{t('issue.issue_status')}</h3>
            <div className="space-y-6">
              {[
                { label: t('status.reported'), status: 'Pending', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
                { label: t('status.verified'), status: 'Verified', icon: CheckCircle2, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                { label: t('status.processing'), status: 'In Progress', icon: AlertTriangle, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: t('status.resolved'), status: 'Resolved', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              ].map((step, i) => {
                const isCompleted = issue.status === step.status || 
                                   (issue.status === 'Verified' && i < 1) ||
                                   (issue.status === 'In Progress' && i < 2) ||
                                   (issue.status === 'Resolved' && i < 3);
                const isCurrent = issue.status === step.status;

                return (
                  <div key={i} className="flex items-center gap-4 relative">
                    {i < 3 && (
                      <div className={`absolute left-6 top-10 w-0.5 h-8 ${isCompleted ? 'bg-indigo-500' : 'bg-neutral-100'}`} />
                    )}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                      isCompleted ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-neutral-50 text-neutral-300'
                    }`}>
                      <step.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className={`text-sm font-black uppercase tracking-widest ${isCompleted ? 'text-neutral-900' : 'text-neutral-300'}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest animate-pulse">{t('issue.current_phase')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Location Map */}
          <div className="bg-white rounded-[40px] p-8 border-2 border-neutral-100 shadow-xl shadow-indigo-500/5 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-display font-black tracking-tight text-neutral-900">{t('issue.location')}</h3>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${issue.latitude},${issue.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors"
              >
                {t('issue.open_maps')}
              </a>
            </div>
            <div className="aspect-square bg-neutral-50 rounded-[32px] relative overflow-hidden border-2 border-neutral-50">
              <div className="h-full w-full z-0">
                <MapContainer 
                  center={[issue.latitude, issue.longitude]} 
                  zoom={15} 
                  scrollWheelZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[issue.latitude, issue.longitude]}>
                    <Popup>
                      <div className="p-2">
                        <p className="font-bold text-xs">{t(`cat.${issue.category.toLowerCase().replace(' ', '_')}`)}</p>
                        <p className="text-[10px] text-neutral-500">{issue.address}</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
              <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-white/50 z-[1000] pointer-events-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{t('issue.coordinates')}</p>
                <p className="text-xs font-bold text-neutral-900">{issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}</p>
              </div>
            </div>
          </div>

          {/* Community Impact */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[40px] p-8 text-white shadow-2xl shadow-indigo-500/20 space-y-6">
            <h3 className="text-xl font-display font-black tracking-tight">{t('issue.community_impact')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">{t('issue.upvotes')}</p>
                <p className="text-3xl font-display font-black">{issue.upvotes?.length || 0}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">{t('issue.comments')}</p>
                <p className="text-3xl font-display font-black">{issue.comments?.length || 0}</p>
              </div>
            </div>
            <p className="text-sm font-medium text-white/80 leading-relaxed">
              {t('issue.impact_message').replace('{count}', (issue.upvotes?.length || 0).toString())}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
