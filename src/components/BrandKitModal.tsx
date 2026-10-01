import React, { useState } from 'react';
import { X, Copy, Check, Download, Palette, Sparkles, Layers, Shield, ExternalLink } from 'lucide-react';
import { PurpleBeanLogo } from './PurpleBeanLogo';

export interface BrandKitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ColorToken {
  name: string;
  role: string;
  hex: string;
  tailwind: string;
  textColor: string;
}

const BRAND_COLORS: ColorToken[] = [
  { name: 'Purple Bean', role: 'Primary Brand / Header Accent', hex: '#7C3AED', tailwind: 'bg-[#7C3AED]', textColor: 'text-white' },
  { name: 'Cyber Yellow', role: 'Active State / Call-to-Action', hex: '#FFE600', tailwind: 'bg-[#FFE600]', textColor: 'text-black' },
  { name: 'Cyber Mint', role: 'Verified / Success / Victory', hex: '#70FFAF', tailwind: 'bg-[#70FFAF]', textColor: 'text-black' },
  { name: 'Punch Coral', role: 'Live State / Alert / Elimination', hex: '#FF5757', tailwind: 'bg-[#FF5757]', textColor: 'text-white' },
  { name: 'Bubblegum', role: 'Special Circuit / Hero Accent', hex: '#FF90E8', tailwind: 'bg-[#FF90E8]', textColor: 'text-black' },
  { name: 'Electric Sky', role: 'Information / Regional Badge', hex: '#5CE1E6', tailwind: 'bg-[#5CE1E6]', textColor: 'text-black' },
  { name: 'Neo Black', role: 'Structural Borders & Shadows', hex: '#000000', tailwind: 'bg-black', textColor: 'text-white' },
  { name: 'Pure Canvas', role: 'Primary Cards & Content Surface', hex: '#FFFFFF', tailwind: 'bg-white', textColor: 'text-black' }
];

export function BrandKitModal({ isOpen, onClose }: BrandKitModalProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyHex = (hex: string) => {
    navigator.clipboard?.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#7C3AED] text-white border-b-[3.5px] border-black p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFE600] text-black flex items-center justify-center font-black text-xl border-2 border-black">
              🎨
            </div>
            <div>
              <span className="font-mono text-[10px] font-black uppercase text-yellow-300 tracking-wider block">
                Design System & Brand Assets
              </span>
              <h2 className="text-xl sm:text-2xl font-black uppercase font-sans leading-none">
                Purple Bean Brand Kit
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white hover:bg-stone-100 text-black border-2 border-black flex items-center justify-center font-black cursor-pointer shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Logo Showcase */}
          <div className="bg-stone-50 border-2 border-black p-5 space-y-3 shadow-[3px_3px_0px_0px_#000]">
            <span className="font-mono text-xs font-black uppercase text-[#7C3AED] block">
              Official Identity Mark
            </span>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border-2 border-black">
              <div className="flex items-center gap-4">
                <PurpleBeanLogo size="lg" showText={true} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-stone-500 font-bold">
                  Vector SVG · Neo-Brutalist Mark
                </span>
              </div>
            </div>
          </div>

          {/* Color Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-[#7C3AED]" />
                <span>Primary Color Tokens</span>
              </span>
              <span className="font-mono text-[11px] text-stone-500">Click any card to copy HEX</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BRAND_COLORS.map((color) => (
                <div
                  key={color.name}
                  onClick={() => handleCopyHex(color.hex)}
                  className="group relative border-2 border-black p-3 space-y-2 cursor-pointer transition-all hover:-translate-y-0.5 shadow-[3px_3px_0px_0px_#000] bg-white"
                >
                  <div className={`h-12 w-full border-2 border-black ${color.tailwind} flex items-center justify-center`}>
                    {copiedHex === color.hex ? (
                      <span className={`font-mono text-xs font-black px-1.5 py-0.5 bg-black text-[#FFE600] flex items-center gap-1`}>
                        <Check className="w-3 h-3" /> Copied!
                      </span>
                    ) : (
                      <Copy className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${color.textColor}`} />
                    )}
                  </div>
                  <div>
                    <span className="font-sans font-black text-xs uppercase block text-black">
                      {color.name}
                    </span>
                    <code className="font-mono text-[11px] font-bold text-stone-600 block">
                      {color.hex}
                    </code>
                    <span className="font-mono text-[10px] text-stone-500 block line-clamp-1 mt-0.5">
                      {color.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Neo-brutalist Architecture Specs */}
          <div className="border-2 border-black p-4 bg-[#FFE600]/20 space-y-3 shadow-[3px_3px_0px_0px_#000]">
            <span className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-black" />
              <span>Neo-Brutalist Construction Guidelines</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-stone-800">
              <div className="bg-white border-2 border-black p-3 space-y-1">
                <span className="font-black text-black block">Border Weight</span>
                <p className="text-[11px] text-stone-600">Standard 2px on interactive elements, 3.5px on cards and modals.</p>
              </div>
              <div className="bg-white border-2 border-black p-3 space-y-1">
                <span className="font-black text-black block">Drop Shadows</span>
                <p className="text-[11px] text-stone-600">Zero-blur hard offset shadows (3px, 4px, 6px, 8px) with #000000.</p>
              </div>
              <div className="bg-white border-2 border-black p-3 space-y-1">
                <span className="font-black text-black block">Typography</span>
                <p className="text-[11px] text-stone-600">Heavy uppercase sans-serif headers with monospace technical metadata.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 border-t-2 border-black p-4 flex items-center justify-between">
          <span className="font-mono text-[11px] text-stone-500 font-bold">
            Purple Bean Esports Circuit India · Brand Specification v2.4
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            Close Brand Kit
          </button>
        </div>
      </div>
    </div>
  );
}
