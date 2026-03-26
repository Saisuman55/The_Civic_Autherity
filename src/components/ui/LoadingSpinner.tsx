import React from 'react';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  className?: string;
}

export default function LoadingSpinner({ size = 'md', label, className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      <div className="relative">
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className={`${sizes[size]} border-4 border-neutral-100 border-t-indigo-600 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.1)]`}
        />
        
        {/* Inner pulsing shield */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <Shield className={`${iconSizes[size]} text-neutral-900`} />
        </motion.div>

        {/* Orbiting dots */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className={`absolute inset-0 ${sizes[size]}`}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
        </motion.div>
      </div>

      {label && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-400 animate-pulse">
            {label}
          </p>
        </motion.div>
      )}
    </div>
  );
}
