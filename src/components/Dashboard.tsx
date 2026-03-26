import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot, getDocs, limit, startAfter, OperationType, handleFirestoreError, where } from '../firebase';
import { IssueReport, UserProfile } from '../types';
import IssueCard from './IssueCard';
import LoadingSpinner from './ui/LoadingSpinner';
import { Map as MapIcon, List as ListIcon, Filter, Search, Loader2, MapPin, AlertCircle, TrendingUp, Users, CheckCircle2, Clock, Shield, Zap, ChevronDown, Activity } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';

// Fix Leaflet marker icon issue
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import { Link } from 'react-router-dom';

import { toast } from 'sonner';

import { useI18n } from '../i18n';

interface DashboardProps {
  user: UserProfile | null;
}

export default function Dashboard({ user }: DashboardProps) {
  const { t } = useI18n();
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [activeUsersCount, setActiveUsersCount] = useState<number | null>(null);
  const [activeUsersTrend, setActiveUsersTrend] = useState<string>('+0%');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Calculate trends
  const calculateTrend = (status?: string) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const filteredIssues = status 
      ? issues.filter(i => i.status === status)
      : issues;

    const currentPeriod = filteredIssues.filter(i => new Date(i.createdAt) >= sevenDaysAgo).length;
    const previousPeriod = filteredIssues.filter(i => {
      const date = new Date(i.createdAt);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    }).length;

    if (previousPeriod === 0) return currentPeriod > 0 ? '+100%' : '0%';
    const diff = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
    return `${diff > 0 ? '+' : ''}${Math.round(diff)}%`;
  };

  const PAGE_SIZE = 20;
  const INITIAL_FETCH_LIMIT = 200;

  const handleLocateMe = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setIsLocating(false);
          setViewMode('map');
          toast.success("Location synchronized successfully.");
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLocating(false);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error("Location access denied. Please enable location permissions in your browser settings to use this feature.");
          } else {
            toast.error("Could not get your location. Please ensure location services are active.");
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
      setIsLocating(false);
    }
  };

  useEffect(() => {
    // Fetch active users count and trend
    const fetchUsersCount = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        setActiveUsersCount(snapshot.size);
        
        // Calculate trend
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        const users = snapshot.docs.map(doc => doc.data());
        const currentPeriod = users.filter(u => u.joinedAt && new Date(u.joinedAt) >= sevenDaysAgo).length;
        const previousPeriod = users.filter(u => {
          if (!u.joinedAt) return false;
          const date = new Date(u.joinedAt);
          return date >= fourteenDaysAgo && date < sevenDaysAgo;
        }).length;
        
        if (previousPeriod === 0) {
          setActiveUsersTrend(currentPeriod > 0 ? '+100%' : '0%');
        } else {
          const diff = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
          setActiveUsersTrend(`${diff > 0 ? '+' : ''}${Math.round(diff)}%`);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    };
    fetchUsersCount();
  }, []);

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    
    if (filter !== 'All') {
      q = query(collection(db, 'issues'), where('category', '==', filter), orderBy('createdAt', 'desc'));
    }
    
    const limitedQ = query(q, limit(INITIAL_FETCH_LIMIT));

    const unsubscribe = onSnapshot(limitedQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IssueReport));
      setIssues(data);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === INITIAL_FETCH_LIMIT);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filter]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      let q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      
      if (filter !== 'All') {
        q = query(collection(db, 'issues'), where('category', '==', filter), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      }

      const snapshot = await getDocs(q);
      const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IssueReport));
      
      setIssues(prev => [...prev, ...newData]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error loading more issues:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredIssues = issues.filter(issue => {
    const matchesFilter = filter === 'All' || issue.category === filter;
    const matchesSearch = issue.description?.toLowerCase().includes(search.toLowerCase()) || 
                          issue.address.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    if (userLocation) {
      const distA = getDistance(userLocation[0], userLocation[1], a.latitude, a.longitude);
      const distB = getDistance(userLocation[0], userLocation[1], b.latitude, b.longitude);
      return distA - distB;
    }
    return 0; // Keep original sorting (by date) if no location
  });

  const stats = [
    { label: t('dashboard.total_reports'), value: issues.length, trend: calculateTrend(), icon: ListIcon, color: 'from-indigo-500 to-violet-600', shadow: 'shadow-indigo-500/25' },
    { label: t('dashboard.verified'), value: issues.filter(i => i.status === 'Verified').length, trend: calculateTrend('Verified'), icon: CheckCircle2, color: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-500/25' },
    { label: t('dashboard.pending'), value: issues.filter(i => i.status === 'Pending').length, trend: calculateTrend('Pending'), icon: Clock, color: 'from-amber-400 to-orange-600', shadow: 'shadow-amber-500/25' },
    { label: t('dashboard.active_users'), value: activeUsersCount ?? '...', trend: activeUsersTrend, icon: Users, color: 'from-fuchsia-500 to-pink-600', shadow: 'shadow-fuchsia-500/25' },
  ];

  // Dynamic center based on user location or issues
  const center: [number, number] = userLocation 
    ? userLocation
    : filteredIssues.length > 0 
      ? [
          filteredIssues.reduce((sum, i) => sum + i.latitude, 0) / filteredIssues.length,
          filteredIssues.reduce((sum, i) => sum + i.longitude, 0) / filteredIssues.length
        ]
      : [20.2961, 85.8245]; // Default center (Bhubaneswar)

  function ChangeView({ issues, userLocation }: { issues: IssueReport[], userLocation: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
      if (issues.length === 0 && !userLocation) return;
      
      const bounds = L.latLngBounds([]);
      if (userLocation) bounds.extend(userLocation);
      issues.forEach(issue => bounds.extend([issue.latitude, issue.longitude]));
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }, [issues, userLocation, map]);
    return null;
  }

  return (
    <div className="space-y-16 relative z-10">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8, ease: "circOut" }}
            className={`group relative bg-white p-8 rounded-[40px] border border-neutral-100 shadow-sm hover:shadow-3xl transition-all duration-500 overflow-hidden`}
          >
            <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${stat.color} opacity-[0.05] rounded-full -mr-20 -mt-20 group-hover:opacity-[0.12] transition-opacity duration-700`} />
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div className={`w-16 h-16 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center shadow-xl ${stat.shadow} group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                <stat.icon className="w-8 h-8 text-white" />
              </div>
              <div className="flex items-center gap-1.5 bg-neutral-50 px-4 py-2 rounded-full border border-neutral-100 shadow-sm">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] font-black text-emerald-600 tracking-tighter">{stat.trend}</span>
              </div>
            </div>
            <p className="text-6xl font-display font-black text-neutral-900 tracking-tighter relative z-10 mb-1">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 font-black relative z-10">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-16">
        <div className="max-w-3xl">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-vibrant-indigo animate-pulse shadow-[0_0_15px_rgba(79,70,229,0.6)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-neutral-400">{t('dashboard.live_feed')}</span>
            </div>
            <Link 
              to="/live" 
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-all group"
            >
              {t('dashboard.view_full')}
              <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <ChevronDown className="w-3 h-3 -rotate-90" />
              </div>
            </Link>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-7xl lg:text-8xl font-display font-black tracking-tighter text-neutral-900 mb-8 leading-[0.85]"
          >
            {t('dashboard.title').split(' ')[0]} <br />
            <span className="text-gradient">{t('dashboard.title').split(' ')[1]}</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-neutral-500 text-2xl font-medium leading-relaxed max-w-2xl opacity-80"
          >
            {t('dashboard.subtitle')}
          </motion.p>
        </div>

        <div className="flex flex-wrap items-center gap-10">
          <div className="bg-white/80 backdrop-blur-xl border border-neutral-200 rounded-[32px] p-2.5 flex shadow-2xl shadow-black/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-3 px-10 py-5 rounded-[24px] transition-all duration-500 font-black text-[11px] uppercase tracking-widest ${viewMode === 'grid' ? 'bg-neutral-900 text-white shadow-2xl shadow-black/30 scale-105' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <ListIcon className="w-5 h-5" />
              {t('dashboard.grid_view')}
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-3 px-10 py-5 rounded-[24px] transition-all duration-500 font-black text-[11px] uppercase tracking-widest ${viewMode === 'map' ? 'bg-neutral-900 text-white shadow-2xl shadow-black/30 scale-105' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <MapIcon className="w-5 h-5" />
              {t('dashboard.map_view')}
            </button>
          </div>
          
          <div className="relative flex-1 min-w-[400px] group flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-300 group-focus-within:text-vibrant-indigo transition-colors" />
              <input 
                type="text"
                placeholder="Search by location or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border-2 border-neutral-100 rounded-[40px] py-7 pl-20 pr-12 text-lg font-bold text-neutral-900 placeholder:text-neutral-300 focus:border-vibrant-indigo focus:ring-8 focus:ring-vibrant-indigo/5 outline-none transition-all shadow-sm hover:shadow-2xl"
              />
            </div>
            <button
              onClick={handleLocateMe}
              disabled={isLocating}
              className={`px-8 py-7 rounded-[40px] border-2 border-neutral-100 bg-white font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all hover:border-indigo-500 hover:text-indigo-500 shadow-sm hover:shadow-2xl ${userLocation ? 'border-indigo-500 text-indigo-500' : 'text-neutral-400'}`}
              title="Search near my location"
            >
              {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              {userLocation ? t('dashboard.near_me_active') : t('dashboard.near_me')}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 overflow-x-auto pb-10 no-scrollbar">
        {['All', 'Traffic', 'Road', 'Emergency', 'Safety', 'Sanitation', 'Water', 'Electricity', 'Environment', 'Infrastructure', 'Public Health'].map((cat, i) => (
          <motion.button
            key={cat}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + (i * 0.05) }}
            onClick={() => setFilter(cat)}
            className={`px-14 py-6 rounded-[28px] text-[11px] font-black uppercase tracking-[0.4em] transition-all border-2 whitespace-nowrap ${
              filter === cat 
                ? 'bg-gradient-vibrant text-white border-transparent shadow-2xl shadow-indigo-500/40 scale-110' 
                : 'bg-white text-neutral-400 border-neutral-100 hover:border-neutral-300 hover:text-neutral-600 hover:shadow-xl'
            }`}
          >
            {cat === 'All' ? t('admin.all_categories') : t(`cat.${cat.toLowerCase().replace(' ', '_')}`)}
          </motion.button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <LoadingSpinner label={t('dashboard.syncing')} />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredIssues.length > 0 ? (
              filteredIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} user={user} />
              ))
            ) : (
              <div className="col-span-full h-80 flex flex-col items-center justify-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-[40px] bg-neutral-50/50">
                <AlertCircle className="w-12 h-12 mb-4 text-neutral-200" />
                <p className="font-bold uppercase tracking-widest text-[10px]">{t('dashboard.no_intelligence')}</p>
              </div>
            )}
          </div>
          
          {hasMore && (
            <div className="flex justify-center pt-8">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-3 px-12 py-6 bg-white border-2 border-neutral-100 rounded-[32px] text-[11px] font-black uppercase tracking-[0.3em] text-neutral-900 hover:border-vibrant-indigo hover:text-vibrant-indigo transition-all shadow-xl hover:shadow-vibrant-indigo/10 disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5" />
                    {t('dashboard.load_more')}
                  </>
                )}
              </button>
            </div>
          )}
          
          {!hasMore && filteredIssues.length > 0 && (
            <div className="flex justify-center pt-8">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300">{t('dashboard.end_feed')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[650px] bg-neutral-100 rounded-[40px] overflow-hidden border border-neutral-200 shadow-2xl relative">
          <MapContainer 
            center={center} 
            zoom={12} 
            scrollWheelZoom={true}
            className="h-full w-full z-0"
          >
            <ChangeView issues={filteredIssues} userLocation={userLocation} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {userLocation && (
              <Marker position={userLocation}>
                <Popup>
                  <div className="p-2">
                    <p className="font-bold text-xs text-indigo-500">{t('dashboard.you_are_here')}</p>
                  </div>
                </Popup>
              </Marker>
            )}
            {filteredIssues.map((issue) => (
              <Marker 
                key={issue.id} 
                position={[issue.latitude, issue.longitude]}
              >
                <Popup className="custom-popup">
                  <div className="p-3 max-w-[240px]">
                    <div className="relative mb-3 aspect-video">
                      <img 
                        src={issue.imageUrl} 
                        className="w-full h-full object-cover rounded-2xl" 
                        alt="Issue" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-md text-white text-[8px] font-bold uppercase tracking-widest rounded-lg">
                        {issue.category}
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-600 leading-relaxed line-clamp-2 mb-3">{issue.description}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        issue.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {issue.status}
                      </span>
                      <span className="text-[8px] font-bold text-neutral-400">{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}


