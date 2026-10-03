import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'error' | 'success' | 'info';
  buttonLabel?: string;
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'error',
  buttonLabel = 'OK, UNDERSTOOD'
}: AlertModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headerStyles = {
    error: 'bg-[#FF6B6B] text-black',
    success: 'bg-[#70FFAF] text-black',
    info: 'bg-[#FFE600] text-black'
  };

  const IconComponent = variant === 'error'
    ? AlertCircle
    : variant === 'success'
    ? CheckCircle2
    : Info;

  return (
    <div 
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-[#171527] border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#FFE600] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className={`${headerStyles[variant]} border-b-[3.5px] border-black p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white dark:bg-black text-black dark:text-white flex items-center justify-center font-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <IconComponent className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-black uppercase font-sans tracking-wide">
              {title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 bg-white dark:bg-black text-black dark:text-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800 transition-all shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm font-sans text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
            {message}
          </p>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
