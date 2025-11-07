// src/components/ToastNotification.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { X, Check, AlertCircle, Info, Sparkles } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastNotificationProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <Check className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success': return 'bg-green-500/90 text-white border-green-600';
      case 'error': return 'bg-red-500/90 text-white border-red-600';
      case 'warning': return 'bg-yellow-500/90 text-white border-yellow-600';
      case 'info': return 'bg-blue-500/90 text-white border-blue-600';
      default: return 'bg-purple-500/90 text-white border-purple-600';
    }
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border-2 backdrop-blur-lg shadow-2xl
        pointer-events-auto max-w-md transition-all duration-300
        ${getColors()}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        animate-slide-in-right
      `}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ToastNotification;

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return {
    toasts,
    showToast,
    removeToast,
    success: (msg: string, dur?: number) => showToast('success', msg, dur),
    error: (msg: string, dur?: number) => showToast('error', msg, dur),
    info: (msg: string, dur?: number) => showToast('info', msg, dur),
    warning: (msg: string, dur?: number) => showToast('warning', msg, dur),
  };
}