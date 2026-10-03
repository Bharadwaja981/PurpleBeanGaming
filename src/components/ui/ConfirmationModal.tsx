import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, X, Loader2 } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  subtitle?: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  details?: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  variant = 'danger',
  isLoading = false,
  details
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const headerColors = {
    danger: 'bg-[#FF6B6B] text-black',
    warning: 'bg-[#FFE600] text-black',
    info: 'bg-[#7C3AED] text-white'
  };

  const confirmBtnStyles = {
    danger: 'bg-[#FF6B6B] hover:bg-red-400 text-black',
    warning: 'bg-[#FFE600] hover:bg-yellow-400 text-black',
    info: 'bg-[#7C3AED] hover:bg-purple-600 text-white'
  };

  const IconComponent = variant === 'danger' 
    ? AlertTriangle 
    : variant === 'warning' 
    ? AlertCircle 
    : HelpCircle;

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-[#171527] border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#FFE600] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className={`${headerColors[variant]} border-b-[3.5px] border-black p-4 sm:p-5 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-black text-black dark:text-white flex items-center justify-center font-black text-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <IconComponent className={`w-5 h-5 ${variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-500' : 'text-purple-400'}`} />
            </div>
            <div>
              {subtitle && (
                <span className="font-mono text-[10px] font-black uppercase tracking-wider block opacity-80">
                  {subtitle}
                </span>
              )}
              <h3 className="text-lg sm:text-xl font-black uppercase font-sans tracking-wide leading-tight">
                {title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 bg-white dark:bg-black text-black dark:text-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800 transition-all shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="text-sm font-sans text-stone-800 dark:text-stone-200 leading-relaxed">
            {typeof message === 'string' ? (
              <p className="font-medium">{message}</p>
            ) : (
              message
            )}
          </div>

          {details && (
            <div className="p-3 bg-stone-50 dark:bg-[#121020] border-2 border-black text-xs font-mono text-stone-700 dark:text-stone-300">
              {details}
            </div>
          )}

          {/* Action Button Row */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-black dark:text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
            >
              {cancelLabel}
            </button>

            <button
              type="button"
              onClick={async () => {
                await onConfirm();
              }}
              disabled={isLoading}
              className={`w-full sm:w-auto px-6 py-2.5 ${confirmBtnStyles[variant]} border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
