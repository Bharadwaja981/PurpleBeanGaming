import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  subtitle?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

export function PromptModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  subtitle,
  message,
  defaultValue = '',
  placeholder = '',
  submitLabel = 'CONFIRM',
  cancelLabel = 'CANCEL'
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-[#171527] border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#FFE600] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-[#FFE600] text-black border-b-[3.5px] border-black p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-black text-black dark:text-white flex items-center justify-center font-black text-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <HelpCircle className="w-5 h-5 text-amber-500" />
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
            className="w-8 h-8 bg-white dark:bg-black text-black dark:text-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800 transition-all shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="text-sm font-sans text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
            {message}
          </div>

          <div>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-[#121020] border-2 border-black text-black dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] shadow-[2px_2px_0px_0px_#000]"
            />
          </div>

          {/* Action Button Row */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-black dark:text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              {cancelLabel}
            </button>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
