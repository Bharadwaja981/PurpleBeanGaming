import React, { useState } from 'react';
import { X, Download, Copy, Check, Sparkles, Layers, Palette, Eye, ShieldCheck, Code2, ExternalLink, Share2, Globe, FileCode, CheckCheck, Laptop, Code } from 'lucide-react';
import { PurpleBeanLogo } from './PurpleBeanLogo';

interface BrandKitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BRAND_COLORS = [
  { name: 'Purple Bean Electric', hex: '#7C3AED', role: 'Primary Brand Color', contrast: 'text-white' },
  { name: 'Canary Gold', hex: '#FFE600', role: 'Regional & Live Accents', contrast: 'text-black' },
  { name: 'Cyber Mint', hex: '#10B981', role: 'Low-Latency Ping / Live Match', contrast: 'text-black' },
  { name: 'Electric Sky', hex: '#5CE1E6', role: 'Broadcast Accent', contrast: 'text-black' },
  { name: 'Bubblegum Rose', hex: '#FF70A6', role: 'Tournament Champion Badge', contrast: 'text-black' },
  { name: 'Neo-Brutal Black', hex: '#000000', role: 'Outlines & Deep Borders', contrast: 'text-white' },
];

export function BrandKitModal({ isOpen, onClose }: BrandKitModalProps) {
  const [bgStyle, setBgStyle] = useState<'lavender' | 'stadium' | 'gold' | 'grid'>('lavender');
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mascot' | 'lockup' | 'colors' | 'guidelines' | 'connect'>('connect');
  const [embedView, setEmbedView] = useState<'home' | 'bracket' | 'matches' | 'draft' | 'tournaments'>('bracket');

  if (!isOpen) return null;

  const bgClasses = {
    lavender: 'bg-[#F3E8FF] border-black',
    stadium: 'bg-[#0F0D1B] border-purple-500 text-white',
    gold: 'bg-[#FFE600] border-black text-black',
    grid: 'bg-white border-black [background-image:linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]',
  };

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1800);
  };

  const handleCopySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleDownloadTokensJson = () => {
    const tokens = {
      name: "Purple Bean Gaming Design System",
      version: "2.4.0",
      theme: "Neo-Brutalist Indian Esports",
      colors: {
        primary: "#7C3AED",
        primaryLight: "#C4B5FD",
        accentGold: "#FFE600",
        cyberMint: "#10B981",
        electricSky: "#5CE1E6",
        bubblegumRose: "#FF70A6",
        borderBlack: "#000000",
        surfaceWhite: "#FFFFFF",
        surfaceLavender: "#F3E8FF",
        arenaDark: "#0F0D1B"
      },
      typography: {
        fontFamilySans: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        fontFamilyMono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        headings: "font-black tracking-tight uppercase"
      },
      neoBrutalism: {
        borderWidth: "3.5px solid #000000",
        boxShadowDefault: "4px 4px 0px 0px #000000",
        boxShadowLg: "8px 8px 0px 0px #000000",
        boxShadowSm: "2px 2px 0px 0px #000000",
        borderRadius: "0px or 8px (sharp angles preferred)"
      },
      appUrl: typeof window !== 'undefined' ? window.location.origin : "https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app",
      supportedViews: ["home", "tournaments", "tournament_detail", "matches", "match_detail", "bracket", "draft", "teams", "players", "rankings"]
    };

    const blob = new Blob([JSON.stringify(tokens, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'purple-bean-design-tokens.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvg = () => {
    // Generate clean standalone SVG file
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="pbBodyGrad" cx="45%" cy="38%" r="62%">
      <stop offset="0%" stop-color="#C4B5FD"/>
      <stop offset="25%" stop-color="#A78BFA"/>
      <stop offset="65%" stop-color="#7C3AED"/>
      <stop offset="90%" stop-color="#5B21B6"/>
      <stop offset="100%" stop-color="#3B0764"/>
    </radialGradient>
    <linearGradient id="pbGlossGrad" x1="0%" y1="0%" x2="40%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0"/>
    </linearGradient>
    <linearGradient id="pbHeadsetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#27272A"/>
      <stop offset="50%" stop-color="#18181B"/>
      <stop offset="100%" stop-color="#09090B"/>
    </linearGradient>
    <linearGradient id="pbHeadbandLed" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#EC4899"/>
      <stop offset="50%" stop-color="#A855F7"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
    <linearGradient id="pbEarcupRgb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE600"/>
      <stop offset="100%" stop-color="#FF5757"/>
    </linearGradient>
  </defs>
  <path d="M 23 58 C 21 22, 97 18, 97 58" stroke="#000000" stroke-width="9" stroke-linecap="round"/>
  <path d="M 24 58 C 22 24, 96 20, 96 58" stroke="url(#pbHeadsetGrad)" stroke-width="6" stroke-linecap="round"/>
  <path d="M 32 46 C 35 27, 85 24, 88 46" stroke="url(#pbHeadbandLed)" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 34 58 C 30 36, 46 22, 66 22 C 86 22, 98 38, 98 60 C 98 84, 84 98, 62 98 C 42 98, 30 84, 34 58 Z" fill="url(#pbBodyGrad)" stroke="#000000" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M 44 32 C 54 26, 68 26, 76 30 C 72 35, 60 37, 48 37 C 45 37, 43 35, 44 32 Z" fill="url(#pbGlossGrad)"/>
  <ellipse cx="44" cy="42" rx="4.5" ry="7" transform="rotate(-25 44 42)" fill="#FFFFFF" opacity="0.65"/>
  <path d="M 76 84 C 84 78, 89 68, 89 58" stroke="#E9D5FF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  <ellipse cx="50" cy="54" rx="6.5" ry="8" fill="#000000"/>
  <circle cx="48" cy="51" r="2.5" fill="#FFFFFF"/>
  <circle cx="53" cy="56" r="1.2" fill="#FFFFFF"/>
  <path d="M 42 45 Q 50 43 56 46" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="72" cy="54" rx="6.5" ry="8" fill="#000000"/>
  <circle cx="70" cy="51" r="2.5" fill="#FFFFFF"/>
  <circle cx="75" cy="56" r="1.2" fill="#FFFFFF"/>
  <path d="M 66 46 Q 72 43 80 45" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 57 66 Q 62 72 69 66" stroke="#000000" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M 39 65 L 44 60 L 41 68 L 47 62" stroke="#FFE600" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 23 50 L 23 62" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
  <rect x="20" y="46" width="7" height="28" rx="3.5" fill="#18181B" stroke="#000000" stroke-width="3"/>
  <rect x="12" y="48" width="12" height="24" rx="5" fill="#27272A" stroke="#000000" stroke-width="3.5"/>
  <rect x="14" y="52" width="5" height="16" rx="2.5" fill="url(#pbEarcupRgb)" stroke="#000000" stroke-width="1.5"/>
  <path d="M 97 50 L 97 62" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
  <rect x="93" y="46" width="7" height="28" rx="3.5" fill="#18181B" stroke="#000000" stroke-width="3"/>
  <rect x="96" y="48" width="12" height="24" rx="5" fill="#27272A" stroke="#000000" stroke-width="3.5"/>
  <rect x="101" y="52" width="5" height="16" rx="2.5" fill="url(#pbEarcupRgb)" stroke="#000000" stroke-width="1.5"/>
  <path d="M 20 66 Q 28 80 46 76" stroke="#000000" stroke-width="4" stroke-linecap="round" fill="none"/>
  <ellipse cx="48" cy="75" rx="4.5" ry="3.5" fill="#18181B" stroke="#000000" stroke-width="2"/>
  <circle cx="50" cy="75" r="2" fill="#10B981" stroke="#000000" stroke-width="1"/>
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'purple-bean-mascot-logo.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySvg = () => {
    setCopiedSvg(true);
    handleDownloadSvg();
    setTimeout(() => setCopiedSvg(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] rounded-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#8B5CF6] text-white px-5 sm:px-6 py-4 border-b-[3.5px] border-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PurpleBeanLogo size="sm" variant="mascot" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white font-sans">
                  PURPLE BEAN GAMING
                </h2>
                <span className="bg-[#FFE600] text-black border border-black text-[10px] font-mono font-black px-1.5 py-0.5 shadow-[1px_1px_0px_0px_#000]">
                  LOGO &amp; BRAND KIT
                </span>
              </div>
              <p className="text-xs font-mono text-purple-100">
                Official Mascot, Vector Badges, Color System &amp; Regional Marks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-white text-black border-2 border-black hover:bg-[#FFE600] shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
            aria-label="Close brand kit modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="bg-stone-100 border-b-2 border-black px-4 sm:px-6 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('mascot')}
            className={`px-3 py-2.5 font-mono text-xs font-black uppercase border-b-4 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'mascot'
                ? 'border-[#7C3AED] text-[#7C3AED] bg-white'
                : 'border-transparent text-stone-600 hover:text-black'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Official Mascot
          </button>
          <button
            onClick={() => setActiveTab('lockup')}
            className={`px-3 py-2.5 font-mono text-xs font-black uppercase border-b-4 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'lockup'
                ? 'border-[#7C3AED] text-[#7C3AED] bg-white'
                : 'border-transparent text-stone-600 hover:text-black'
            }`}
          >
            <Layers className="w-4 h-4" />
            Lockups &amp; Badges
          </button>
          <button
            onClick={() => setActiveTab('colors')}
            className={`px-3 py-2.5 font-mono text-xs font-black uppercase border-b-4 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'colors'
                ? 'border-[#7C3AED] text-[#7C3AED] bg-white'
                : 'border-transparent text-stone-600 hover:text-black'
            }`}
          >
            <Palette className="w-4 h-4" />
            Color Palette
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`px-3 py-2.5 font-mono text-xs font-black uppercase border-b-4 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'guidelines'
                ? 'border-[#7C3AED] text-[#7C3AED] bg-white'
                : 'border-transparent text-stone-600 hover:text-black'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Brand Guidelines
          </button>
          <button
            onClick={() => setActiveTab('connect')}
            className={`px-3 py-2.5 font-mono text-xs font-black uppercase border-b-4 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'connect'
                ? 'border-[#7C3AED] text-[#7C3AED] bg-white'
                : 'border-transparent text-stone-600 hover:text-black'
            }`}
          >
            <Code2 className="w-4 h-4 text-[#7C3AED]" />
            <span className="bg-[#FFE600] text-black px-1.5 py-0.5 rounded text-[10px] border border-black font-black">NEW</span>
            Export &amp; Connect
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'mascot' && (
            <div className="space-y-6">
              {/* Stage Box */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-stone-600 uppercase">
                    Stage Background:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setBgStyle('lavender')}
                      className={`px-2.5 py-1 text-xs font-mono font-bold border-2 border-black rounded ${
                        bgStyle === 'lavender' ? 'bg-[#7C3AED] text-white' : 'bg-[#F3E8FF] text-black'
                      }`}
                    >
                      Lavender
                    </button>
                    <button
                      onClick={() => setBgStyle('stadium')}
                      className={`px-2.5 py-1 text-xs font-mono font-bold border-2 border-black rounded ${
                        bgStyle === 'stadium' ? 'bg-purple-900 text-white' : 'bg-stone-900 text-white'
                      }`}
                    >
                      Dark Arena
                    </button>
                    <button
                      onClick={() => setBgStyle('gold')}
                      className={`px-2.5 py-1 text-xs font-mono font-bold border-2 border-black rounded ${
                        bgStyle === 'gold' ? 'bg-amber-400 text-black' : 'bg-[#FFE600] text-black'
                      }`}
                    >
                      Gold
                    </button>
                    <button
                      onClick={() => setBgStyle('grid')}
                      className={`px-2.5 py-1 text-xs font-mono font-bold border-2 border-black rounded ${
                        bgStyle === 'grid' ? 'bg-stone-300 text-black' : 'bg-white text-black'
                      }`}
                    >
                      Grid
                    </button>
                  </div>
                </div>

                {/* Main Hero Showcase */}
                <div
                  className={`w-full py-8 sm:py-12 px-4 sm:px-6 rounded-2xl border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] flex flex-col items-center justify-center transition-colors relative overflow-hidden ${bgClasses[bgStyle]}`}
                >
                  <div className="relative group">
                    <PurpleBeanLogo size="hero" variant="mascot" animated={true} />
                  </div>

                  <div className="mt-4 flex flex-col items-center text-center space-y-1">
                    <span className="text-xl sm:text-2xl font-black uppercase font-sans tracking-tight">
                      THE PURPLE BEAN
                    </span>
                    <span className="font-mono text-xs opacity-80 uppercase tracking-widest">
                      Official Mascot · Indian Esports Champion
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t-2 border-stone-200">
                <div className="flex items-center gap-2 font-mono text-xs text-stone-600">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black inline-block animate-pulse shrink-0" />
                  <span>Scalable Vector Graphics (SVG) · Native Neo-Brutalist 120x120 Grid</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleDownloadSvg}
                    className="flex-1 sm:flex-none justify-center px-4 py-2 bg-[#FFE600] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download SVG Asset
                  </button>
                  <button
                    onClick={handleCopySvg}
                    className="flex-1 sm:flex-none justify-center px-4 py-2 bg-black text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#FFE600] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSvg ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedSvg ? 'Downloaded!' : 'Export & Save'}
                  </button>
                </div>
              </div>

              {/* Multi-Size Scaling Matrix */}
              <div className="space-y-3">
                <h3 className="font-mono text-xs font-bold text-stone-700 uppercase">
                  Responsive Scale Matrix:
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-stone-50 border-2 border-black rounded-lg flex flex-col items-center gap-2 text-center">
                    <span className="font-mono text-[10px] text-stone-500">28px · Favicon / Pill</span>
                    <PurpleBeanLogo size="sm" variant="badge" />
                  </div>
                  <div className="p-3 bg-stone-50 border-2 border-black rounded-lg flex flex-col items-center gap-2 text-center">
                    <span className="font-mono text-[10px] text-stone-500">36px · Navigation Bar</span>
                    <PurpleBeanLogo size="md" variant="badge" />
                  </div>
                  <div className="p-3 bg-stone-50 border-2 border-black rounded-lg flex flex-col items-center gap-2 text-center">
                    <span className="font-mono text-[10px] text-stone-500">48px · Player Card / Chat</span>
                    <PurpleBeanLogo size="lg" variant="badge" />
                  </div>
                  <div className="p-3 bg-stone-50 border-2 border-black rounded-lg flex flex-col items-center gap-2 text-center">
                    <span className="font-mono text-[10px] text-stone-500">64px · Hero Showcase</span>
                    <PurpleBeanLogo size="xl" variant="badge" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lockup' && (
            <div className="space-y-6">
              <div className="space-y-4">
                {/* Horizontal Lockup */}
                <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl flex items-center justify-between">
                  <PurpleBeanLogo size="lg" showText={true} />
                  <span className="font-mono text-xs bg-stone-100 border border-black px-2 py-1">
                    Primary Horizontal Lockup
                  </span>
                </div>

                {/* Badge Lockup with Neon Yellow */}
                <div className="p-6 bg-[#F3E8FF] border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PurpleBeanLogo size="md" badgeBg="bg-[#FFE600]" />
                    <div>
                      <h4 className="font-black text-lg font-sans uppercase">
                        PURPLE BEAN TOURNAMENTS
                      </h4>
                      <p className="font-mono text-xs text-stone-600">
                        Gold Edition Badge · Finals &amp; Trophy Routing
                      </p>
                    </div>
                  </div>
                  <span className="bg-[#FFE600] border border-black font-mono text-xs px-2 py-1 font-bold">
                    Gold Finals Tag
                  </span>
                </div>

                {/* Streamer Watermark */}
                <div className="p-6 bg-stone-900 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PurpleBeanLogo size="md" variant="mascot" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base font-sans tracking-wide">
                          PB GAMING BROADCAST
                        </span>
                        <span className="bg-red-500 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 border border-white">
                          LIVE 1080P
                        </span>
                      </div>
                      <p className="font-mono text-xs text-stone-400">
                        Over-The-Air Stream HUD Watermark
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-emerald-400 border border-emerald-400 px-2 py-1">
                    OBS Overlay Ready
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-4">
              <p className="font-mono text-xs text-stone-600">
                Click any palette token below to copy its HEX value to clipboard:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {BRAND_COLORS.map((col) => (
                  <div
                    key={col.hex}
                    onClick={() => handleCopyHex(col.hex)}
                    className="p-4 border-2 border-black shadow-[3px_3px_0px_0px_#000] rounded-xl cursor-pointer hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex flex-col justify-between h-28"
                    style={{ backgroundColor: col.hex }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-xs font-black ${col.contrast}`}>
                        {col.name}
                      </span>
                      {copiedHex === col.hex ? (
                        <span className="bg-white text-black px-1.5 py-0.5 text-[10px] font-mono font-bold border border-black flex items-center gap-1">
                          <Check className="w-3 h-3" /> Copied!
                        </span>
                      ) : (
                        <Copy className={`w-3.5 h-3.5 ${col.contrast} opacity-75`} />
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <span className={`font-mono text-sm font-black ${col.contrast}`}>
                        {col.hex}
                      </span>
                      <span className={`text-[10px] font-mono ${col.contrast} opacity-90`}>
                        {col.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'guidelines' && (
            <div className="space-y-4 font-mono text-xs text-stone-800">
              <div className="p-4 bg-purple-50 border-2 border-black rounded-lg space-y-2">
                <h4 className="font-black text-sm text-[#7C3AED] uppercase">
                  1. Brand Representation &amp; Regional Identity
                </h4>
                <p>
                  Purple Bean Gaming is built exclusively for India's esports ecosystem. The logo embodies the energy, competitiveness, and approachable fun of grassroots to pro tournament players in Hyderabad, Bengaluru, Mumbai, Delhi, Pune, Chennai, and Kolkata.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border-2 border-black rounded-lg space-y-2">
                <h4 className="font-black text-sm text-stone-900 uppercase">
                  2. Clearspace &amp; Contrast Discipline
                </h4>
                <p>
                  Maintain at least 16px of clear padding around the mascot badge. Never distort the aspect ratio. Always preserve the heavy black neo-brutalist border (`strokeWidth="4"`) and specular gloss layer.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border-2 border-black rounded-lg space-y-2">
                <h4 className="font-black text-sm text-emerald-900 uppercase">
                  3. Supported Games &amp; Titles
                </h4>
                <p>
                  Official esports badges represent Dota 2 competitive play, with dedicated server routing indications across AWS Mumbai (ap-south-1) and Bengaluru nodes.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'connect' && (
            <div className="space-y-6">
              {/* Introduction Banner */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-100 via-yellow-50 to-emerald-50 border-[3px] border-black shadow-[4px_4px_0px_0px_#000] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#7C3AED] text-white px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider">
                        Universal Integration
                      </span>
                      <span className="font-mono text-xs font-bold text-stone-600">
                        Version 2.4 · Ready for External Apps
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black font-sans uppercase tracking-tight text-black">
                      Connect This Design &amp; Platform Into Any App
                    </h3>
                    <p className="font-mono text-xs text-stone-700 mt-1 max-w-2xl">
                      You can use this design in another app in 4 ways: embed as an iframe widget, copy the Tailwind neo-brutalist theme tokens, reuse React standalone components, or control it via postMessage API.
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadTokensJson}
                    className="self-start sm:self-center px-3.5 py-2 bg-[#FFE600] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download JSON Tokens
                  </button>
                </div>
              </div>

              {/* Method 1: Live iFrame Widget Embed */}
              <div className="p-4 sm:p-5 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#7C3AED]" />
                    <h4 className="font-black text-sm uppercase tracking-tight font-sans">
                      1. Embed Directly in Any App or Website (iFrame Widget)
                    </h4>
                  </div>
                  <span className="font-mono text-[11px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-300">
                    Works in React, Vue, WordPress, Next.js, HTML
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-stone-700 uppercase">Select Target View:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'bracket', label: 'Bracket View' },
                        { id: 'draft', label: 'Auction Draft' },
                        { id: 'matches', label: 'Matches Hub' },
                        { id: 'tournaments', label: 'Tournaments' },
                        { id: 'home', label: 'Full Home App' }
                      ].map((viewOption) => (
                        <button
                          key={viewOption.id}
                          onClick={() => setEmbedView(viewOption.id as any)}
                          className={`px-2.5 py-1 text-xs font-mono font-bold border-2 border-black rounded transition-all cursor-pointer ${
                            embedView === viewOption.id
                              ? 'bg-[#7C3AED] text-white shadow-[2px_2px_0px_0px_#000]'
                              : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                          }`}
                        >
                          {viewOption.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Code snippet display */}
                  <div className="relative">
                    <pre className="p-3.5 bg-stone-900 text-stone-100 font-mono text-xs rounded-lg overflow-x-auto border-2 border-black">
                      {`<iframe
  src="${typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app'}?view=${embedView}&embed=true"
  width="100%"
  height="750"
  style="border: 3.5px solid #000; border-radius: 12px; box-shadow: 6px 6px 0px #000;"
  title="Purple Bean Esports - ${embedView.toUpperCase()}"
  allow="clipboard-write"
/>`}
                    </pre>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          handleCopySnippet(
                            `<iframe src="${typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app'}?view=${embedView}&embed=true" width="100%" height="750" style="border: 3.5px solid #000; border-radius: 12px; box-shadow: 6px 6px 0px #000;" title="Purple Bean Esports - ${embedView}" allow="clipboard-write"></iframe>`,
                            'iframe-code'
                          )
                        }
                        className="px-2.5 py-1 bg-[#FFE600] text-black font-mono text-xs font-black uppercase border border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSnippet === 'iframe-code' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy iFrame Code
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Method 2: Tailwind CSS & Design Tokens Preset */}
              <div className="p-4 sm:p-5 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-black text-sm uppercase tracking-tight font-sans">
                      2. Tailwind CSS &amp; Neo-Brutalist Theme Config
                    </h4>
                  </div>
                  <button
                    onClick={() =>
                      handleCopySnippet(
`// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        pb: {
          purple: '#7C3AED',
          lavender: '#C4B5FD',
          gold: '#FFE600',
          mint: '#10B981',
          sky: '#5CE1E6',
          rose: '#FF70A6',
          arena: '#0F0D1B',
          bg: '#F3E8FF',
        }
      },
      boxShadow: {
        'neo-sm': '2px 2px 0px 0px #000000',
        'neo': '4px 4px 0px 0px #000000',
        'neo-lg': '8px 8px 0px 0px #000000',
        'neo-gold': '4px 4px 0px 0px #FFE600',
      },
      borderWidth: {
        'neo': '3.5px',
      }
    }
  }
};`,
                        'tailwind-config'
                      )
                    }
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-black font-mono text-xs font-bold border border-black flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    {copiedSnippet === 'tailwind-config' ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copied Config!
                      </span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy tailwind.config.js
                      </>
                    )}
                  </button>
                </div>

                <p className="font-mono text-xs text-stone-600">
                  Drop these design tokens into your other app to inherit the exact high-contrast purple-gold neo-brutalist theme, hard drop shadows, and border hierarchy:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3 bg-stone-50 border border-black rounded">
                    <span className="font-bold text-[#7C3AED]">Key Utility Classes:</span>
                    <ul className="mt-1.5 space-y-1 text-stone-700">
                      <li>• Card outline: <code className="bg-stone-200 px-1 py-0.5 rounded font-black text-black">border-[3.5px] border-black</code></li>
                      <li>• Hard shadow: <code className="bg-stone-200 px-1 py-0.5 rounded font-black text-black">shadow-[4px_4px_0px_0px_#000]</code></li>
                      <li>• Click offset: <code className="bg-stone-200 px-1 py-0.5 rounded font-black text-black">hover:translate-x-0.5 hover:translate-y-0.5</code></li>
                      <li>• Dot background: <code className="bg-stone-200 px-1 py-0.5 rounded font-black text-black">radial-gradient(#000 1.2px, transparent 1.2px)</code></li>
                    </ul>
                  </div>

                  <div className="p-3 bg-stone-50 border border-black rounded">
                    <span className="font-bold text-amber-700">CSS Custom Properties (Variables):</span>
                    <ul className="mt-1.5 space-y-1 text-stone-700">
                      <li>• <code className="text-purple-700">--pb-purple: #7C3AED;</code></li>
                      <li>• <code className="text-yellow-600">--pb-gold: #FFE600;</code></li>
                      <li>• <code className="text-emerald-700">--pb-mint: #10B981;</code></li>
                      <li>• <code className="text-black">--pb-shadow: 4px 4px 0px 0px #000;</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Method 3: Standalone React Component Library */}
              <div className="p-4 sm:p-5 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-purple-600" />
                    <h4 className="font-black text-sm uppercase tracking-tight font-sans">
                      3. Reuse Standalone React Components
                    </h4>
                  </div>
                  <span className="font-mono text-xs text-stone-500 bg-purple-50 text-purple-900 border border-purple-300 px-2 py-0.5 rounded">
                    Zero External Framework Dependencies
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-stone-50 border border-black rounded-lg space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <PurpleBeanLogo size="sm" variant="badge" />
                        <h5 className="font-black text-xs uppercase font-sans">PurpleBeanLogo.tsx</h5>
                      </div>
                      <p className="font-mono text-[11px] text-stone-600 mt-1">
                        Vector mascot with multi-layer radial gradients, gaming headset, and dynamic sizes (sm, md, lg, hero).
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadSvg}
                      className="w-full py-1.5 bg-white hover:bg-stone-100 text-black border border-black font-mono text-[11px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download SVG
                    </button>
                  </div>

                  <div className="p-3 bg-stone-50 border border-black rounded-lg space-y-2 flex flex-col justify-between">
                    <div>
                      <h5 className="font-black text-xs uppercase font-sans">DoubleEliminationBracket.tsx</h5>
                      <p className="font-mono text-[11px] text-stone-600 mt-1">
                        Complete Upper, Lower, and Grand Finals interactive brackets with status tags and score badges.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleCopySnippet(
                          `// Import in your app:\nimport { DoubleEliminationBracket } from './components/DoubleEliminationBracket';\n\n<DoubleEliminationBracket\n  tournamentId="purple-bean-india-masters-2026"\n  onMatchClick={(matchId) => console.log('Match clicked:', matchId)}\n/>`,
                          'bracket-import'
                        )
                      }
                      className="w-full py-1.5 bg-white hover:bg-stone-100 text-black border border-black font-mono text-[11px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {copiedSnippet === 'bracket-import' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Usage Snippet
                    </button>
                  </div>

                  <div className="p-3 bg-stone-50 border border-black rounded-lg space-y-2 flex flex-col justify-between">
                    <div>
                      <h5 className="font-black text-xs uppercase font-sans">AuctionDraft.tsx</h5>
                      <p className="font-mono text-[11px] text-stone-600 mt-1">
                        Live bidding simulator, purse budgets (₹1,00,000), sound/visual effects, and team roster assignments.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleCopySnippet(
                          `// Import in your app:\nimport { AuctionDraft } from './components/AuctionDraft';\n\n<AuctionDraft\n  onComplete={(results) => console.log('Draft completed:', results)}\n/>`,
                          'draft-import'
                        )
                      }
                      className="w-full py-1.5 bg-white hover:bg-stone-100 text-black border border-black font-mono text-[11px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {copiedSnippet === 'draft-import' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Usage Snippet
                    </button>
                  </div>
                </div>
              </div>

              {/* Method 4: Bidirectional postMessage Bridge */}
              <div className="p-4 sm:p-5 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-amber-500" />
                    <h4 className="font-black text-sm uppercase tracking-tight font-sans">
                      4. JavaScript postMessage Bridge (App-to-App Communication)
                    </h4>
                  </div>
                  <button
                    onClick={() =>
                      handleCopySnippet(
`// In your external parent application:
const iframe = document.getElementById('pb-esports-frame');

// 1. Tell Purple Bean to switch view:
iframe.contentWindow.postMessage({ type: 'PB_NAVIGATE', view: 'bracket' }, '*');

// 2. Change active theme:
iframe.contentWindow.postMessage({ type: 'PB_SET_THEME', themeIdx: 1 }, '*');

// 3. Listen for view changes or events from Purple Bean:
window.addEventListener('message', (event) => {
  if (event.data?.type === 'PB_VIEW_CHANGED') {
    console.log('User navigated to:', event.data.view);
  }
});`,
                        'postmessage-guide'
                      )
                    }
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-black font-mono text-xs font-bold border border-black flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    {copiedSnippet === 'postmessage-guide' ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copied SDK Code!
                      </span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy JS Bridge Code
                      </>
                    )}
                  </button>
                </div>

                <p className="font-mono text-xs text-stone-600">
                  When embedded in an iframe, the host app can send and receive commands seamlessly via standard browser <code className="bg-stone-100 px-1 border border-stone-300">window.postMessage</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-stone-50 border-t-2 border-black px-6 py-3 flex items-center justify-between text-xs font-mono text-stone-600">
          <div className="flex items-center gap-2">
            <span>PURPLE BEAN GAMING ASSET KIT · V2.4</span>
            <span>·</span>
            <span>HYDERABAD &amp; BENGALURU ESCHQ</span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1 bg-white border border-black hover:bg-stone-200 cursor-pointer font-bold uppercase"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
