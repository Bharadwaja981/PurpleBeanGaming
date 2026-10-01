import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';

export interface DropdownOption<T extends string | number = string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
  dividerAfter?: boolean;
}

export interface SelectDropdownProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  menuClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
  mobileTitle?: string;
  disabled?: boolean;
}

export function SelectDropdown<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  icon: TriggerIcon,
  className = '',
  menuClassName = '',
  size = 'md',
  align = 'left',
  mobileTitle,
  disabled = false
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(align);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Compute position (upward flip and alignment) when opening on desktop/tablet
  useEffect(() => {
    if (!isOpen || isMobile) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If less than 240px below and more above, flip upward
      setOpenUpward(spaceBelow < 240 && spaceAbove > spaceBelow);

      // If opening left would push it off the right edge of the screen, align right
      if (rect.left + 220 > window.innerWidth && spaceAbove > 0) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign(align);
      }
    }
  }, [isOpen, isMobile, align]);

  // Lock body scroll on mobile drawer
  useEffect(() => {
    if (isOpen && isMobile && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isMobile]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const CurrentIcon = selectedOption?.icon || TriggerIcon;

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-[11px] gap-1.5 min-h-[32px]',
    md: 'px-3 py-1.5 text-xs gap-2 min-h-[36px]',
    lg: 'px-4 py-2 text-sm gap-2.5 min-h-[42px]'
  }[size];

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const mobileDrawer = isOpen && isMobile && typeof document !== 'undefined' ? (
    createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
        {/* Bottom Drawer */}
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-h-[85vh] bg-white border-t-[3.5px] border-black shadow-[0_-8px_0px_0px_#000] rounded-t-2xl p-4 flex flex-col animate-in slide-in-from-bottom duration-200 z-10 pb-6"
        >
          {/* Handle */}
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-3" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-2">
            <div className="flex items-center gap-2 truncate">
              {TriggerIcon && <TriggerIcon className="w-4 h-4 text-[#7C3AED] shrink-0" />}
              <h3 className="font-sans font-black text-sm uppercase tracking-wide text-black truncate">
                {mobileTitle || label || placeholder}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 border-2 border-black bg-stone-100 hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5 transition-all text-black"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-stone-100 py-1 overscroll-contain">
            {options.map((option) => {
              const isSelected = option.value === value;
              const ItemIcon = option.icon;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3.5 py-3 min-h-[46px] font-mono text-xs flex items-center justify-between gap-3 transition-colors active:bg-[#FFF9E6] ${
                    isSelected
                      ? 'bg-[#FFE600] font-black text-black border-l-4 border-black'
                      : 'hover:bg-purple-50 text-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {ItemIcon && <ItemIcon className="w-4 h-4 text-[#7C3AED] shrink-0" />}
                    <div className="truncate">
                      <span className="block truncate font-bold text-xs">{option.label}</span>
                      {option.subtitle && (
                        <span className="block text-[10px] text-stone-500 font-normal truncate mt-0.5">
                          {option.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {option.badge && (
                      <span
                        className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.5 border border-black ${
                          option.badgeColor || 'bg-stone-100 text-black'
                        }`}
                      >
                        {option.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-black shrink-0 font-black stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div
      className={`relative ${className.includes('w-full') ? 'block w-full' : 'inline-block'} text-left ${className}`}
      ref={containerRef}
    >
      {label && (
        <label className="block font-mono text-[10px] font-black uppercase tracking-wider text-stone-600 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full font-mono font-bold uppercase tracking-tight border-2 border-black transition-all flex items-center justify-between select-none ${sizeStyles} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-stone-100' : 'cursor-pointer'
        } ${
          isOpen
            ? 'bg-[#FFF9E6] shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
            : 'bg-white hover:bg-stone-50 shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {CurrentIcon && <CurrentIcon className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-700 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Mobile Drawer */}
      {mobileDrawer}

      {/* Desktop / Laptop / Tablet Popover */}
      {isOpen && !isMobile && (
        <div
          role="listbox"
          className={`absolute ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } bg-white border-[2.5px] border-black shadow-[4px_4px_0px_0px_#000] py-1 z-[150] min-w-full min-w-[200px] max-w-[calc(100vw-32px)] max-h-[70vh] overflow-y-auto ${
            effectiveAlign === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const ItemIcon = option.icon;
            return (
              <React.Fragment key={String(option.value)}>
                <button
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-2 font-mono text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFE600] text-black font-black'
                      : 'hover:bg-[#F3E8FF] text-stone-800'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {ItemIcon && (
                      <ItemIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-black' : 'text-[#7C3AED]'
                        }`}
                      />
                    )}
                    <span className="truncate">{option.label}</span>
                  </span>

                  <span className="flex items-center gap-1.5 shrink-0">
                    {option.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 border border-black ${
                          option.badgeColor || 'bg-stone-100 text-black'
                        }`}
                      >
                        {option.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-black shrink-0 font-black stroke-[3]" />
                    )}
                  </span>
                </button>
                {option.dividerAfter && <div className="border-b border-black/10 my-1" />}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface MultiSelectDropdownProps<T extends string = string> {
  value: T[];
  onChange: (value: T[]) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  menuClassName?: string;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  mobileTitle?: string;
}

export function MultiSelectDropdown<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select roles...',
  label,
  icon: TriggerIcon,
  className = '',
  menuClassName = '',
  size = 'md',
  align = 'left',
  mobileTitle
}: MultiSelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(align);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen || isMobile) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < 240 && spaceAbove > spaceBelow);

      if (rect.left + 220 > window.innerWidth && spaceAbove > 0) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign(align);
      }
    }
  }, [isOpen, isMobile, align]);

  useEffect(() => {
    if (isOpen && isMobile && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const toggleOption = (val: T) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const displayText =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? options.find((o) => o.value === value[0])?.label || value[0]
      : `${value.length} selected`;

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-[11px] gap-1.5 min-h-[32px]',
    md: 'px-3 py-1.5 text-xs gap-2 min-h-[36px]'
  }[size];

  const mobileDrawer = isOpen && isMobile && typeof document !== 'undefined' ? (
    createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-h-[85vh] bg-white border-t-[3.5px] border-black shadow-[0_-8px_0px_0px_#000] rounded-t-2xl p-4 flex flex-col animate-in slide-in-from-bottom duration-200 z-10 pb-6"
        >
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-2">
            <h3 className="font-sans font-black text-sm uppercase text-black">
              {mobileTitle || label || placeholder}
            </h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 border-2 border-black bg-stone-100 hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5 text-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-stone-100 py-1 overscroll-contain">
            {options.map((option) => {
              const isSelected = value.includes(option.value);
              const ItemIcon = option.icon;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={`w-full text-left px-3.5 py-3 min-h-[46px] font-mono text-xs flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#FFE600] font-black text-black border-l-4 border-black'
                      : 'hover:bg-purple-50 text-stone-800'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {ItemIcon && <ItemIcon className="w-4 h-4 text-[#7C3AED] shrink-0" />}
                    <span className="truncate font-bold">{option.label}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="w-4 h-4 accent-[#7C3AED] border-2 border-black"
                  />
                </button>
              );
            })}
          </div>
          <div className="pt-3 border-t-2 border-black flex justify-between gap-2 mt-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="px-3.5 py-2 border-2 border-black font-mono text-xs font-bold hover:bg-stone-100 cursor-pointer"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2 bg-[#FFE600] border-2 border-black font-mono text-xs font-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div
      className={`relative ${className.includes('w-full') ? 'block w-full' : 'inline-block'} text-left ${className}`}
      ref={containerRef}
    >
      {label && (
        <label className="block font-mono text-[10px] font-black uppercase text-stone-600 mb-1">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full font-mono text-xs font-bold uppercase tracking-tight border-2 border-black transition-all flex items-center justify-between gap-2 select-none cursor-pointer ${sizeStyles} ${
          isOpen
            ? 'bg-[#FFF9E6] shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
            : 'bg-white hover:bg-stone-50 shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {TriggerIcon && <TriggerIcon className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />}
          <span className="truncate">{displayText}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-700 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {mobileDrawer}

      {/* Desktop Popover */}
      {isOpen && !isMobile && (
        <div
          className={`absolute ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } bg-white border-[2.5px] border-black shadow-[4px_4px_0px_0px_#000] py-1 z-[150] min-w-[220px] max-w-[calc(100vw-32px)] max-h-[70vh] overflow-y-auto ${
            effectiveAlign === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            const ItemIcon = option.icon;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={`w-full text-left px-3 py-2 font-mono text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFE600] text-black font-black'
                    : 'hover:bg-[#F3E8FF] text-stone-800'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {ItemIcon && (
                    <ItemIcon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-black' : 'text-[#7C3AED]'
                      }`}
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="w-3.5 h-3.5 accent-[#7C3AED] border border-black pointer-events-none"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface MenuDropdownProps {
  trigger: React.ReactNode | ((isOpen: boolean) => React.ReactNode);
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
  mobileTitle?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MenuDropdown({
  trigger,
  children,
  align = 'right',
  className = '',
  menuClassName = '',
  mobileTitle,
  isOpen: controlledIsOpen,
  onOpenChange
}: MenuDropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(align);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isControlled = typeof controlledIsOpen === 'boolean';
  const open = isControlled ? controlledIsOpen : internalIsOpen;

  const setOpen = useCallback(
    (newVal: boolean) => {
      if (!isControlled) {
        setInternalIsOpen(newVal);
      }
      onOpenChange?.(newVal);
    },
    [isControlled, onOpenChange]
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < 240 && spaceAbove > spaceBelow);

      if (rect.left + 220 > window.innerWidth && spaceAbove > 0) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign(align);
      }
    }
  }, [open, isMobile, align]);

  useEffect(() => {
    if (open && isMobile && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        (!drawerRef.current || !drawerRef.current.contains(e.target as Node))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, isMobile, setOpen]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, setOpen]);

  const mobileDrawer = open && isMobile && typeof document !== 'undefined' ? (
    createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-h-[85vh] bg-white border-t-[3.5px] border-black shadow-[0_-8px_0px_0px_#000] rounded-t-2xl p-4 flex flex-col animate-in slide-in-from-bottom duration-200 z-10 pb-6"
        >
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-3" />
          {mobileTitle && (
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-2">
              <h3 className="font-sans font-black text-sm uppercase text-black">
                {mobileTitle}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 border-2 border-black bg-stone-100 hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5 text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div
            className="overflow-y-auto max-h-[60vh] py-1 overscroll-contain"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (
                target.closest('[data-no-close="true"]') ||
                target.closest('button[disabled]') ||
                target.closest('input, textarea, select')
              ) {
                return;
              }
              if (target.closest('button, a')) {
                setOpen(false);
              }
            }}
          >
            {children}
          </div>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer select-none">
        {typeof trigger === 'function' ? trigger(open) : trigger}
      </div>

      {mobileDrawer}

      {/* Desktop Popover */}
      {open && !isMobile && (
        <div
          className={`absolute ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } bg-white border-[2.5px] border-black shadow-[4px_4px_0px_0px_#000] py-1.5 z-[150] min-w-[200px] max-w-[calc(100vw-32px)] max-h-[70vh] overflow-y-auto ${
            effectiveAlign === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (
              target.closest('[data-no-close="true"]') ||
              target.closest('button[disabled]') ||
              target.closest('input, textarea, select')
            ) {
              return;
            }
            if (target.closest('button, a')) {
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface MenuItemProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  selected?: boolean;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  showCheck?: boolean;
  className?: string;
}

export function MenuItem({
  icon: ItemIcon,
  label,
  subtitle,
  badge,
  badgeColor,
  selected = false,
  onClick,
  destructive = false,
  disabled = false,
  showCheck = false,
  className = ''
}: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-3 py-2 font-mono text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${
        selected
          ? 'bg-[#FFE600] text-black font-black'
          : destructive
          ? 'text-red-600 hover:bg-red-50'
          : 'hover:bg-[#F3E8FF] text-stone-800'
      } ${className}`}
    >
      <span className="flex items-center gap-2 truncate">
        {ItemIcon && (
          <ItemIcon
            className={`w-3.5 h-3.5 shrink-0 ${
              selected
                ? 'text-black'
                : destructive
                ? 'text-red-500'
                : 'text-[#7C3AED]'
            }`}
          />
        )}
        <span className="truncate">
          <span className="block truncate font-bold">{label}</span>
          {subtitle && (
            <span className="block text-[10px] text-stone-500 font-normal">
              {subtitle}
            </span>
          )}
        </span>
      </span>

      <span className="flex items-center gap-1.5 shrink-0">
        {badge && (
          <span
            className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.2 border border-black ${
              badgeColor || 'bg-stone-100 text-black'
            }`}
          >
            {badge}
          </span>
        )}
        {showCheck && selected && (
          <Check className="w-3.5 h-3.5 text-black shrink-0 font-black stroke-[3]" />
        )}
      </span>
    </button>
  );
}

export function MenuHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-mono font-black uppercase text-stone-500 bg-stone-50 border-b border-black/10">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="border-b border-black/10 my-1" />;
}
