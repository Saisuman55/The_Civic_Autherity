import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, MapPin, Mic, Send, Loader2, CheckCircle2, AlertCircle, X, Shield, ArrowRight, ArrowLeft, Info, Bot, Map as MapIcon, Zap } from 'lucide-react';
import { db, auth, collection, setDoc, doc, serverTimestamp, onSnapshot, storage, ref, uploadString, getDownloadURL, uploadBytes, handleFirestoreError, OperationType } from '../firebase';
import { IssueCategory } from '../types';
import { validateImage } from '../services/aiService';
import LoadingSpinner from './ui/LoadingSpinner';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';

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

interface ReportFormProps {
  onSuccess: () => void;
}

import { useI18n } from '../i18n';

export default function ReportForm({ onSuccess }: ReportFormProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<IssueCategory>('Road');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [autoAiVerification, setAutoAiVerification] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Track background promises to avoid duplicate work and handle timeouts better
  const uploadPromiseRef = useRef<Promise<string | null> | null>(null);
  const aiPromiseRef = useRef<Promise<any> | null>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (step !== 1) return;
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result as string;
                processImage(base64);
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
      stopCamera(); // Ensure camera is stopped on unmount
    };
  }, [step]);

  const compressImage = (base64: string): Promise<{ dataUrl: string; blob: Blob }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; // Reduced slightly for speed
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ dataUrl, blob });
          } else {
            // Fallback if toBlob fails
            resolve({ dataUrl, blob: new Blob() });
          }
        }, 'image/jpeg', 0.6);
      };
    });
  };

  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  const processImage = async (base64: string) => {
    const { dataUrl, blob } = await compressImage(base64);
    setImage(dataUrl);
    setImageBlob(blob);
    
    // Start background upload and AI validation in parallel
    uploadPromiseRef.current = (async () => {
      if (!auth.currentUser) return null;
      setUploadingImage(true);
      try {
        const storageRef = ref(storage, `issues/${auth.currentUser.uid}_${Date.now()}.jpg`);
        const uploadResult = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(uploadResult.ref);
        setImageUrl(url);
        return url;
      } catch (error) {
        console.error('Background upload error:', error);
        return null;
      } finally {
        setUploadingImage(false);
      }
    })();

    aiPromiseRef.current = (async () => {
      if (!autoAiVerification) return null;
      setIsValidating(true);
      try {
        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const data = await validateImage(base64Data, category, description);
        setValidationResult(data);
        return data;
      } catch (error) {
        console.error('Auto-validation error:', error);
        return null;
      } finally {
        setIsValidating(false);
      }
    })();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => processImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsCameraOpen(false);
      alert('Camera access denied or not available.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg');
        processImage(base64);
        stopCamera();
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => processImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  function LocationPicker() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        updateLocation(lat, lng);
      },
    });
    return location ? <Marker position={[location.lat, location.lng]} /> : null;
  }

  function ChangeView({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center);
    }, [center, map]);
    return null;
  }

  const updateLocation = async (lat: number, lng: number) => {
    setLocation({ lat, lng });
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      setAddress(data.display_name || 'Unknown Location');
    } catch (error) {
      console.error('Geocoding error:', error);
      setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          updateLocation(latitude, longitude);
          toast.success("GPS coordinates locked.");
        },
        (error) => {
          console.error("Error getting location:", error);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error("Location access denied. Please enable permissions to pinpoint the issue.");
          } else {
            toast.error("Failed to acquire GPS signal. Please select on map manually.");
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!image) {
      toast.error("Please capture or upload an image first.");
      return;
    }
    if (!location) {
      toast.error("Please select the incident location on the map.");
      return;
    }
    if (!auth.currentUser) {
      toast.error("Authentication session expired. Please log in again.");
      return;
    }
    
    if (category === 'Other' && !customCategory.trim()) {
      toast.error("Please specify the custom category.");
      return;
    }

    if (!description.trim()) {
      toast.error("Please provide a description of the issue.");
      return;
    }

    try {
      setIsSubmitting(true);
      console.log("Starting submission protocol...");
      
      // Create a timeout promise to prevent hanging indefinitely
      const timeout = (ms: number, label: string) => new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out: ${label}`)), ms));

      let finalImageUrl = imageUrl;
      let aiResult = validationResult;

      // 1. Handle Critical Task: Image Upload
      if (!finalImageUrl) {
        if (uploadPromiseRef.current) {
          console.log("Waiting for background upload to complete...");
          try {
            finalImageUrl = await Promise.race([uploadPromiseRef.current, timeout(60000, 'Background Upload')]) as string | null;
          } catch (e) {
            console.warn("Background upload timed out or failed, attempting foreground retry...");
          }
          
          if (!finalImageUrl && imageBlob) {
             // If still no URL, try one last time in foreground
             console.log("Background upload didn't yield a URL, retrying in foreground...");
             const storageRef = ref(storage, `issues/${auth.currentUser.uid}_${Date.now()}.jpg`);
             const uploadResult = await Promise.race([uploadBytes(storageRef, imageBlob, { contentType: 'image/jpeg' }), timeout(60000, 'Foreground Upload')]) as any;
             finalImageUrl = await Promise.race([getDownloadURL(uploadResult.ref), timeout(20000, 'Get Download URL')]) as string;
          }
        } else if (imageBlob) {
          console.log("No background upload found, starting foreground upload...");
          const storageRef = ref(storage, `issues/${auth.currentUser.uid}_${Date.now()}.jpg`);
          const uploadResult = await Promise.race([uploadBytes(storageRef, imageBlob, { contentType: 'image/jpeg' }), timeout(60000, 'Foreground Upload')]) as any;
          finalImageUrl = await Promise.race([getDownloadURL(uploadResult.ref), timeout(20000, 'Get Download URL')]) as string;
        }
      }

      if (!finalImageUrl) {
        throw new Error("Image upload failed. Please try again.");
      }

      // 2. Handle Non-Critical Task: AI Validation
      if (autoAiVerification && !aiResult) {
        try {
          console.log("Waiting for AI validation (non-blocking)...");
          if (aiPromiseRef.current) {
            // Give AI 15 more seconds, but don't fail if it takes longer
            aiResult = await Promise.race([aiPromiseRef.current, timeout(15000, 'AI Validation')]);
          } else {
            const base64 = image.includes(',') ? image.split(',')[1] : image;
            aiResult = await Promise.race([validateImage(base64, category, description), timeout(15000, 'AI Validation')]);
            setValidationResult(aiResult);
          }
        } catch (e) {
          console.warn("AI validation timed out or failed, proceeding with manual submission.");
        }
      }

      console.log("Preparing Firestore document...");
      const isHighlyConfident = autoAiVerification && aiResult && aiResult.isLikelyReal && aiResult.confidence > 0.85;
      const isLikelyFake = autoAiVerification && aiResult && (!aiResult.isLikelyReal || aiResult.confidence < 0.4);

      const issueRef = doc(collection(db, 'issues'));
      const issueData = {
        id: issueRef.id,
        reporterUid: auth.currentUser.uid,
        category: category === 'Other' ? customCategory : category,
        description,
        imageUrl: finalImageUrl,
        latitude: location.lat,
        longitude: location.lng,
        address,
        landmark,
        status: isHighlyConfident ? 'Verified' : 'Pending',
        isFake: !!isLikelyFake,
        aiReasoning: autoAiVerification ? (aiResult?.reasoning || 'AI verification failed.') : 'AI verification disabled by administrator.',
        aiConfidence: autoAiVerification ? (aiResult?.confidence || 0) : 0,
        upvotes: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log("Transmitting to Firestore...");
      // Add a timeout to the Firestore write as well
      await Promise.race([setDoc(issueRef, issueData), timeout(30000, 'Firestore Write')]);
      
      console.log("Firestore document created successfully.");
      toast.success("Intelligence report transmitted successfully.");
      onSuccess();
    } catch (error) {
      console.error('Submission error:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.startsWith('Operation timed out')) {
        toast.error(`${errorMessage}. Please check your connection and try again.`);
      } else if (errorMessage === "Image upload failed. Please try again.") {
        toast.error(errorMessage);
      } else {
        // Use handleFirestoreError to log detailed info
        handleFirestoreError(error, OperationType.WRITE, `issues/NEW`);
        toast.error(t('report.error_transmit'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          try {
            const response = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64Audio }),
            });
            const data = await response.json();
            if (data.text) {
              setDescription(prev => prev ? `${prev} ${data.text}` : data.text);
            }
          } catch (error) {
            console.error('Transcription error:', error);
            setTranscriptionError('Failed to transcribe audio.');
          } finally {
            setIsRecording(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscriptionError(null);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setTranscriptionError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const StepGuide = ({ title, items }: { title: string; items: string[] }) => (
    <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-3xl p-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Info className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-900">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-indigo-700/80 font-medium leading-relaxed">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto relative">
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-12 text-center"
          >
            <LoadingSpinner size="xl" label={isSubmitting ? t('report.submitting') : t('report.neural_analysis')} />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 max-w-md"
            >
              <h3 className="text-2xl font-display font-black text-neutral-900 mb-4 tracking-tight">
                {isSubmitting ? t('report.securing_data') : t('report.ai_verification_core')}
              </h3>
              <p className="text-neutral-500 font-medium leading-relaxed">
                {isSubmitting 
                  ? t('report.securing_data_desc')
                  : t('report.ai_verification_desc')}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Header */}
      <div className="mb-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-6">
              <div className={`w-14 h-14 rounded-3xl flex items-center justify-center font-display font-black transition-all duration-700 shadow-sm ${
                step === s ? 'bg-neutral-900 text-white shadow-2xl shadow-black/30 scale-125 rotate-6' : 
                step > s ? 'bg-gradient-success text-white shadow-lg shadow-emerald-500/20' : 'bg-white border border-neutral-100 text-neutral-300'
              }`}>
                {step > s ? <CheckCircle2 className="w-7 h-7" /> : s}
              </div>
              {s < 3 && <div className={`w-16 h-1 rounded-full transition-all duration-700 ${step > s ? 'bg-gradient-success' : 'bg-neutral-100'}`} />}
            </div>
          ))}
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-400 mb-2">{t('report.current_protocol')}</p>
          <p className="font-display font-black text-3xl tracking-tighter text-neutral-900">
            {step === 1 ? t('report.step1') : step === 2 ? t('report.step2') : t('report.step3')}
          </p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-2xl rounded-[56px] shadow-3xl shadow-black/5 border border-neutral-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-vibrant opacity-[0.03] rounded-full -mr-32 -mt-32 blur-3xl" />
        <form onSubmit={handleSubmit} className="p-12 lg:p-24 relative z-10">
          {step === 1 && (
            <div className="space-y-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
              <div className="max-w-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-3 h-3 rounded-full bg-vibrant-indigo animate-pulse shadow-[0_0_12px_rgba(79,70,229,0.5)]" />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400">{t('report.step1_title')}</span>
                </div>
                <h2 className="text-6xl lg:text-7xl font-display font-black text-neutral-900 mb-8 tracking-tighter leading-[0.9]">
                  {t('report.visual_evidence').split(' ')[0]} <span className="text-gradient">{t('report.visual_evidence').split(' ').slice(1).join(' ')}</span>
                </h2>
                <p className="text-neutral-500 text-2xl font-medium leading-relaxed opacity-80 mb-12">
                  {t('report.visual_evidence_desc')}
                </p>

                <StepGuide 
                  title={t('report.step1')}
                  items={[
                    t('report.step1_guide1'),
                    t('report.step1_guide2'),
                    t('report.step1_guide3'),
                    t('report.step1_guide4')
                  ]}
                />
              </div>

              <div 
                onClick={() => !isCameraOpen && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative aspect-video border-4 border-dashed rounded-[48px] flex flex-col items-center justify-center cursor-pointer transition-all duration-700 overflow-hidden group shadow-2xl ${
                  isDragging ? 'border-vibrant-indigo bg-indigo-50/50 scale-[1.02]' :
                  image ? 'border-vibrant-emerald bg-emerald-50/30' : 'border-neutral-100 bg-neutral-50/50 hover:border-vibrant-indigo hover:bg-white'
                }`}
              >
                {isCameraOpen ? (
                  <div className="absolute inset-0 bg-black z-20 flex flex-col">
                    <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-8 px-10">
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); stopCamera(); }}
                        className="flex-1 py-6 bg-white/10 backdrop-blur-md text-white rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/20 hover:bg-white/20"
                      >
                        {t('report.cancel')}
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                        className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all"
                      >
                        <div className="w-16 h-16 border-4 border-black rounded-full" />
                      </button>
                      <div className="flex-1" />
                    </div>
                  </div>
                ) : image ? (
                  <>
                    <img src={image} className="w-full h-full object-cover" alt="Preview" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-md">
                      <div className="flex gap-6">
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setImage(null); setValidationResult(null); }}
                          className="p-8 bg-white text-black rounded-full shadow-3xl hover:scale-110 transition-transform active:scale-90"
                        >
                          <X className="w-10 h-10" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startCamera(); }}
                          className="p-8 bg-indigo-500 text-white rounded-full shadow-3xl hover:scale-110 transition-transform active:scale-90"
                        >
                          <Camera className="w-10 h-10" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-12">
                    <div className="flex gap-4 justify-center mb-10">
                      <div className="w-32 h-32 bg-white rounded-[40px] flex items-center justify-center shadow-3xl group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 border border-neutral-50">
                        <Upload className="w-14 h-14 text-neutral-200 group-hover:text-vibrant-indigo transition-colors" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startCamera(); }}
                        className="w-32 h-32 bg-indigo-500 rounded-[40px] flex items-center justify-center shadow-3xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 border border-indigo-400"
                      >
                        <Camera className="w-14 h-14 text-white" />
                      </button>
                    </div>
                    <p className="text-3xl font-display font-black text-neutral-900 mb-4 tracking-tighter">{t('report.initialize_capture')}</p>
                    <p className="text-base text-neutral-400 max-w-[320px] mx-auto leading-relaxed font-medium">
                      {t('report.upload_img')}
                    </p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex justify-end pt-8">
                <button
                  type="button"
                  disabled={!image || isValidating}
                  onClick={() => {
                    setStep(2);
                    getCurrentLocation();
                  }}
                  className="flex items-center gap-6 bg-neutral-900 text-white px-16 py-7 rounded-3xl font-black uppercase tracking-[0.3em] text-xs hover:bg-black transition-all disabled:opacity-50 group shadow-3xl shadow-black/20 active:scale-95"
                >
                  Proceed to Intelligence
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
              <div className="max-w-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">{t('report.step2_title_short')}</span>
                </div>
                <h2 className="text-5xl font-display font-bold text-neutral-900 mb-6 tracking-tight">{t('report.intelligence_location').split(' ')[0]} <span className="text-gradient">{t('report.intelligence_location').split(' ').slice(1).join(' ')}</span></h2>
                <p className="text-neutral-500 text-xl font-light leading-relaxed mb-10">
                  {t('report.intelligence_location_desc')}
                </p>

                <StepGuide 
                  title={t('report.intelligence_protocol')}
                  items={[
                    t('report.step2_guide1'),
                    t('report.step2_guide2'),
                    t('report.step2_guide3'),
                    t('report.step2_guide4')
                  ]}
                />
              </div>

              {/* Map Picker */}
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">{t('report.incident_location')}</label>
                  <button 
                    type="button"
                    onClick={getCurrentLocation}
                    className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:underline"
                  >
                    <MapPin className="w-3 h-3" />
                    {t('report.use_my_location')}
                  </button>
                </div>
                <div className="h-[300px] rounded-[32px] overflow-hidden border-2 border-neutral-100 shadow-inner relative">
                  <MapContainer 
                    center={location ? [location.lat, location.lng] : [20.2961, 85.8245]} 
                    zoom={15} 
                    className="h-full w-full z-0"
                  >
                    <ChangeView center={location ? [location.lat, location.lng] : [20.2961, 85.8245]} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationPicker />
                  </MapContainer>
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-neutral-100 shadow-lg z-10">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{t('report.detected_address')}</p>
                    <p className="text-xs font-bold text-neutral-900 truncate">{address || t('report.click_map')}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 ml-1">{t('report.classification')}</label>
                  <div className="relative">
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value as IssueCategory)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-[24px] p-6 font-bold focus:ring-2 focus:ring-black outline-none transition-all appearance-none shadow-sm"
                    >
                      <option value="Traffic">{t('cat.traffic')}</option>
                      <option value="Road">{t('cat.road')}</option>
                      <option value="Emergency">{t('cat.emergency')}</option>
                      <option value="Safety">{t('cat.safety')}</option>
                      <option value="Sanitation">{t('cat.sanitation')}</option>
                      <option value="Water">{t('cat.water')}</option>
                      <option value="Electricity">{t('cat.electricity')}</option>
                      <option value="Environment">{t('cat.environment')}</option>
                      <option value="Infrastructure">{t('cat.infrastructure')}</option>
                      <option value="Public Health">{t('cat.public_health')}</option>
                      <option value="Other">{t('cat.other')}</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                      <ArrowRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>

                {category === 'Other' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 ml-1">{t('report.custom_classification')}</label>
                    <input 
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder={t('report.specify_issue')}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-[24px] p-6 font-bold focus:ring-2 focus:ring-black outline-none transition-all shadow-sm"
                    />
                  </div>
                )}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 ml-1">{t('report.proximity_landmark')}</label>
                  <input 
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder={t('report.landmark_placeholder')}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-[24px] p-6 font-bold focus:ring-2 focus:ring-black outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">{t('report.detailed_narrative')}</label>
                  <button 
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm ${
                      isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    {isRecording ? t('report.recording_stop') : t('report.voice_input')}
                  </button>
                </div>
                {transcriptionError && (
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> {transcriptionError}
                  </p>
                )}
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('report.description_placeholder')}
                  rows={5}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-[32px] p-8 font-medium focus:ring-2 focus:ring-black outline-none transition-all resize-none leading-relaxed shadow-sm"
                />
              </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-3 text-neutral-400 hover:text-black font-bold uppercase tracking-[0.2em] text-[10px] transition-all group order-3 sm:order-1"
                  >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    {t('report.back')}
                  </button>
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto order-1 sm:order-2">
                    <button
                      type="button"
                      disabled={!description || !location || isSubmitting}
                      onClick={handleSubmit}
                      className="flex items-center justify-center gap-4 bg-indigo-600 text-white px-10 py-6 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-700 transition-all disabled:opacity-50 group shadow-xl shadow-indigo-500/20 active:scale-95"
                    >
                      {t('report.quick_submit')}
                      <Zap className="w-4 h-4 text-yellow-400 group-hover:scale-125 transition-transform" />
                    </button>

                    <button
                      type="button"
                      disabled={!description || !location}
                      onClick={() => setStep(3)}
                      className="flex items-center justify-center gap-4 bg-black text-white px-10 py-6 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-neutral-800 transition-all disabled:opacity-50 group shadow-2xl shadow-black/20 active:scale-95"
                    >
                      {t('report.final_review')}
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
              <div className="max-w-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">{t('report.step3_title_short')}</span>
                </div>
                <h2 className="text-5xl font-display font-bold text-neutral-900 mb-6 tracking-tight">{t('report.final_submission')}</h2>
                <p className="text-neutral-500 text-xl font-light leading-relaxed mb-10">
                  {t('report.final_submission_desc')}
                </p>

                <StepGuide 
                  title={t('report.verification_protocol')}
                  items={[
                    t('report.step3_guide1'),
                    t('report.step3_guide2'),
                    t('report.step3_guide3'),
                    t('report.step3_guide4')
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="p-10 bg-neutral-900 text-white rounded-[40px] space-y-6 shadow-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                        <Shield className="w-5 h-5 text-brand-accent" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em]">{t('report.protocol_summary')}</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm border-b border-white/5 pb-4">
                        <span className="text-neutral-500 font-medium">{t('report.classification')}</span>
                        <span className="font-bold">{category === 'Other' ? customCategory : t(`cat.${category.toLowerCase()}`)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b border-white/5 pb-4">
                        <span className="text-neutral-500 font-medium">{t('report.incident_location')}</span>
                        <span className="font-bold text-brand-accent truncate max-w-[150px]">{address}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b border-white/5 pb-4">
                        <span className="text-neutral-500 font-medium">{t('report.evidence')}</span>
                        <span className="font-bold text-brand-accent">{t('report.captured')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500 font-medium">{t('report.ai_status')}</span>
                        <span className="font-bold">{isValidating ? t('report.processing') : t('report.analyzed')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 ml-1">{t('report.ai_verification_engine')}</label>
                  {isValidating ? (
                    <div className="h-full min-h-[300px] rounded-[40px] border border-neutral-100 bg-neutral-50 flex flex-col items-center justify-center gap-6 animate-pulse shadow-inner">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 animate-spin text-black" />
                        <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-black" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">{t('report.neural_analysis_progress')}</span>
                    </div>
                  ) : validationResult ? (
                    <div className={`h-full min-h-[300px] p-10 rounded-[40px] border flex flex-col justify-between shadow-sm ${
                      validationResult.isLikelyReal ? 'bg-green-50/50 border-green-100 text-green-900' : 'bg-red-50/50 border-red-100 text-red-900'
                    }`}>
                      <div>
                        <div className="flex items-center gap-4 mb-6">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${validationResult.isLikelyReal ? 'bg-green-100' : 'bg-red-100'}`}>
                            {validationResult.isLikelyReal ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                          </div>
                          <span className="font-display font-bold text-2xl tracking-tight">{t('report.analysis_complete')}</span>
                        </div>
                        <p className="text-base font-medium leading-relaxed opacity-80">{validationResult.reasoning}</p>
                      </div>
                      <div className="mt-10 flex items-center justify-between pt-8 border-t border-black/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50 mb-1">{t('report.confidence')}</span>
                          <span className="text-3xl font-display font-bold tracking-tight">{(validationResult.confidence * 100).toFixed(0)}%</span>
                        </div>
                        {validationResult.isLikelyReal && validationResult.confidence > 0.85 && (
                          <div className="flex items-center gap-3 px-6 py-3 bg-black text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl">
                            <Shield className="w-4 h-4 text-brand-accent" />
                            {t('report.auto_verified')}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] rounded-[40px] border border-neutral-100 bg-neutral-50 flex flex-col items-center justify-center gap-6 p-12 text-center shadow-inner">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md">
                        <Info className="w-8 h-8 text-neutral-200" />
                      </div>
                      <p className="text-sm text-neutral-400 font-medium leading-relaxed">{t('report.ai_analysis_pending')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-12 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-3 text-neutral-400 hover:text-black font-bold uppercase tracking-[0.2em] text-[10px] transition-all group"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  {t('report.back')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !image || !location}
                  className="flex items-center gap-5 bg-black text-white px-14 py-7 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-neutral-800 transition-all disabled:opacity-50 group shadow-2xl shadow-black/20 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      {t('report.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="w-6 h-6" />
                      {t('report.submit')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
