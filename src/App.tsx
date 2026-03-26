import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth, onAuthStateChanged, db, doc, getDoc, setDoc, updateDoc, OperationType, handleFirestoreError } from './firebase';
import { UserProfile } from './types';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ReportForm from './components/ReportForm';
import Analytics from './components/Analytics';
import AdminPanel from './components/AdminPanel';
import Chatbot from './components/Chatbot';
import Profile from './components/Profile';
import Notifications from './components/Notifications';
import IssueDetails from './components/IssueDetails';
import Leaderboard from './components/Leaderboard';
import LiveFeed from './components/LiveFeed';
import UserGuide from './components/UserGuide';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

import { I18nProvider, useI18n } from './i18n';

function AppContent({ loading, user }: { loading: boolean, user: UserProfile | null }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center text-white gap-6">
        <LoadingSpinner size="lg" label={t('app.initializing')} />
        <div className="text-center mt-4">
          <p className="text-xl font-bold tracking-tight">{t('app.title')}</p>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mt-1">{t('app.version')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/report" element={<ReportForm onSuccess={() => navigate('/')} />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/live" element={<LiveFeed />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/guide" element={<UserGuide />} />
        <Route path="/issue/:id" element={<IssueDetails />} />
        <Route 
          path="/admin" 
          element={user.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Chatbot />
      <Toaster position="top-right" richColors closeButton />
    </Layout>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          const isAdmin = !!tokenResult.claims.admin || (firebaseUser.email === 'saisumansamantaray184@gmail.com' && firebaseUser.emailVerified);
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          
          let userDoc;
          try {
            userDoc = await getDoc(userDocRef);
          } catch (error) {
            console.error("Error fetching user doc:", error);
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            // If we can't fetch the doc, we still have the firebaseUser
            // We can create a temporary profile to let them in, or show an error
          }
          
          if (userDoc && userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            // Sync role with custom claims or default admin email
            if (isAdmin && userData.role !== 'admin') {
              userData.role = 'admin';
              try {
                await updateDoc(userDocRef, { role: 'admin' });
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, `users/${firebaseUser.uid}`);
              }
            }
            setUser(userData);
          } else if (userDoc || !userDoc) {
            // If userDoc is undefined (error) or doesn't exist, try to create/use basic info
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Anonymous User',
              role: isAdmin ? 'admin' : 'user',
              trustScore: 50,
              photoURL: firebaseUser.photoURL || undefined,
              joinedAt: new Date().toISOString()
            };
            
            if (userDoc && !userDoc.exists()) {
              try {
                await setDoc(userDocRef, newUser);
                setUser(newUser);
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
                // Fallback to local user state even if DB write fails
                setUser(newUser);
              }
            } else {
              // If getDoc failed entirely, still let them in with basic info
              setUser(newUser);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <I18nProvider>
      <AppContent loading={loading} user={user} />
    </I18nProvider>
  );
}

