import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2, Mic, Maximize2, Minimize2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { chatWithAI } from '../services/aiService';

import { useI18n } from '../i18n';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Hello! I am **Authority AI**. How can I help you with civic reporting today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLocate = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            setLocation({ latitude, longitude, address: data.display_name });
            setMessages(prev => [...prev, { role: 'model', text: `📍 Location shared: **${data.display_name}**. I can now assist you with nearby issues.` }]);
          } catch (error) {
            setLocation({ latitude, longitude });
            setMessages(prev => [...prev, { role: 'model', text: `📍 Location shared (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). I can now assist you with nearby issues.` }]);
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLocating(false);
          setMessages(prev => [...prev, { role: 'model', text: '❌ Could not access your location. Please ensure permissions are granted.' }]);
        }
      );
    } else {
      setIsLocating(false);
      setMessages(prev => [...prev, { role: 'model', text: '❌ Geolocation is not supported by your browser.' }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    // Auto-prompt for location if user asks about "nearby" or "where"
    const locationKeywords = ['near', 'where', 'location', 'around', 'nearby', 'place', 'address'];
    const needsLocation = locationKeywords.some(kw => userMsg.toLowerCase().includes(kw));

    if (needsLocation && !location && !isLocating) {
      setMessages(prev => [...prev, { role: 'model', text: 'I noticed you are asking about a location. Would you like to share your current location for better assistance?' }]);
      setIsLoading(false);
      return;
    }

    try {
      const text = await chatWithAI(userMsg, messages, location || undefined);
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`bg-white rounded-[40px] shadow-3xl border border-neutral-200 flex flex-col overflow-hidden transition-all ${
              isMinimized ? 'h-20 w-80' : 'h-[650px] w-[450px]'
            }`}
          >
            {/* Header */}
            <div className="p-6 bg-neutral-900 text-white flex items-center justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-vibrant opacity-20 animate-gradient-x" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-xl">
                  <Bot className="w-7 h-7 text-brand-accent" />
                </div>
                <div>
                  <p className="font-black text-sm tracking-tight uppercase">{t('chatbot.authority_ai')}</p>
                  {!isMinimized && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-vibrant-emerald animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <p className="text-[9px] uppercase tracking-[0.3em] opacity-60 font-black">{t('chatbot.neural_link')}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 relative z-10">
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-90">
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-90">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-10 bg-neutral-50/30 no-scrollbar">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xl transition-transform hover:scale-110 ${
                        msg.role === 'user' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-100 text-neutral-900'
                      }`}>
                        {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6 text-vibrant-indigo" />}
                      </div>
                      <div className={`max-w-[80%] p-6 rounded-[32px] text-sm leading-relaxed shadow-xl border transition-all ${
                        msg.role === 'user' 
                          ? 'bg-neutral-900 text-white border-neutral-800 rounded-tr-none' 
                          : 'bg-white text-neutral-800 border-neutral-50 rounded-tl-none'
                      }`}>
                        <div className="markdown-body prose prose-sm prose-neutral max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-5">
                      <div className="w-12 h-12 bg-white border border-neutral-100 text-neutral-900 rounded-2xl flex items-center justify-center shadow-xl">
                        <Bot className="w-6 h-6 text-vibrant-indigo animate-bounce" />
                      </div>
                      <div className="bg-white p-6 rounded-[32px] rounded-tl-none border border-neutral-50 shadow-xl flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 bg-vibrant-indigo/30 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <div className="w-2 h-2 bg-vibrant-indigo/30 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <div className="w-2 h-2 bg-vibrant-indigo/30 rounded-full animate-bounce" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-8 border-t border-neutral-100 bg-white space-y-4">
                  <div className="flex items-center gap-4 bg-neutral-50 border-2 border-neutral-100 rounded-[32px] p-3 focus-within:border-vibrant-indigo focus-within:ring-8 focus-within:ring-vibrant-indigo/5 transition-all shadow-inner group">
                    <button 
                      onClick={handleLocate}
                      disabled={isLocating}
                      className={`p-2.5 rounded-xl transition-all ${location ? 'bg-emerald-50 text-emerald-500' : 'hover:bg-neutral-200 text-neutral-400'}`}
                      title={location ? t('chatbot.location_shared') : t('chatbot.share_location')}
                    >
                      {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      placeholder={t('chatbot.placeholder')}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      className="flex-1 bg-transparent border-none outline-none px-4 text-base font-bold text-neutral-900 placeholder:text-neutral-300"
                    />
                    <button onClick={handleSend} className="w-12 h-12 flex items-center justify-center bg-neutral-900 text-white rounded-2xl hover:bg-black transition-all shadow-2xl active:scale-90 group-focus-within:bg-vibrant-indigo">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-20 h-20 bg-neutral-900 text-white rounded-[32px] shadow-3xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-vibrant opacity-0 group-hover:opacity-100 transition-opacity animate-gradient-x" />
          <MessageSquare className="w-10 h-10 group-hover:rotate-12 transition-transform relative z-10" />
          <div className="absolute top-4 right-4 w-4 h-4 bg-vibrant-rose rounded-full border-4 border-neutral-900 animate-bounce z-20"></div>
        </button>
      )}
    </div>
  );
}
