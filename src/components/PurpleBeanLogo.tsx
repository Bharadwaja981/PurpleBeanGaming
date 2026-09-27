import React from 'react';

export interface PurpleBeanLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showText?: boolean;
  animated?: boolean;
  variant?: 'mascot' | 'badge' | 'full' | 'icon';
  badgeBg?: string;
  onClick?: () => void;
  title?: string;
}

export function PurpleBeanLogo({
  className = '',
  size = 'md',
  showText = false,
  animated = false,
  variant = 'badge',
  badgeBg = 'bg-[#8B5CF6]',
  onClick,
  title,
}: PurpleBeanLogoProps) {
  // Dimension mappings
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28',
    hero: 'w-36 h-36 sm:w-44 sm:h-44',
  };

  const textSizes = {
    xs: { main: 'text-sm', badge: 'text-[7px]', sub: 'text-[8px]' },
    sm: { main: 'text-base', badge: 'text-[8px]', sub: 'text-[9px]' },
    md: { main: 'text-xl sm:text-2xl', badge: 'text-[9px]', sub: 'text-[10px]' },
    lg: { main: 'text-2xl sm:text-3xl', badge: 'text-[10px]', sub: 'text-xs' },
    xl: { main: 'text-3xl sm:text-4xl', badge: 'text-xs', sub: 'text-sm' },
    '2xl': { main: 'text-4xl sm:text-5xl', badge: 'text-sm', sub: 'text-base' },
    hero: { main: 'text-5xl sm:text-6xl', badge: 'text-base', sub: 'text-lg' },
  };

  // Pure SVG mascot component
  const MascotSvg = () => (
    <svg
      viewBox="0 0 120 120"
      className="w-full h-full drop-shadow-sm select-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Purple Bean Gaming Mascot"
    >
      <defs>
        {/* Deep 3D Bean Body Gradient */}
        <radialGradient
          id="pbBodyGrad"
          cx="45%"
          cy="38%"
          r="62%"
          fx="42%"
          fy="32%"
        >
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="25%" stopColor="#A78BFA" />
          <stop offset="65%" stopColor="#7C3AED" />
          <stop offset="90%" stopColor="#5B21B6" />
          <stop offset="100%" stopColor="#3B0764" />
        </radialGradient>

        {/* Specular curved gloss highlight */}
        <linearGradient id="pbGlossGrad" x1="0%" y1="0%" x2="40%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
        </linearGradient>

        {/* Headset Arc Gradient */}
        <linearGradient id="pbHeadsetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27272A" />
          <stop offset="50%" stopColor="#18181B" />
          <stop offset="100%" stopColor="#09090B" />
        </linearGradient>

        {/* Headband LED Violet Accent */}
        <linearGradient id="pbHeadbandLed" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Earcup RGB Ring Glow */}
        <linearGradient id="pbEarcupRgb" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE600" />
          <stop offset="100%" stopColor="#FF5757" />
        </linearGradient>

        {/* Neon drop shadow */}
        <filter id="pbNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Behind-earcup Headset Band Shadow / Structure */}
      <path
        d="M 23 58 C 21 22, 97 18, 97 58"
        stroke="#000000"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M 24 58 C 22 24, 96 20, 96 58"
        stroke="url(#pbHeadsetGrad)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Headset Neon LED Band Accent */}
      <path
        d="M 32 46 C 35 27, 85 24, 88 46"
        stroke="url(#pbHeadbandLed)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Bean Main Body Silhouette (Organic Kidney/Jelly Bean curve) */}
      <path
        d="M 34 58 C 30 36, 46 22, 66 22 C 86 22, 98 38, 98 60 C 98 84, 84 98, 62 98 C 42 98, 30 84, 34 58 Z"
        fill="url(#pbBodyGrad)"
        stroke="#000000"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Gloss Specular Highlight Pill on upper-left curve */}
      <path
        d="M 44 32 C 54 26, 68 26, 76 30 C 72 35, 60 37, 48 37 C 45 37, 43 35, 44 32 Z"
        fill="url(#pbGlossGrad)"
      />
      <ellipse
        cx="44"
        cy="42"
        rx="4.5"
        ry="7"
        transform="rotate(-25 44 42)"
        fill="#FFFFFF"
        opacity="0.65"
      />

      {/* Secondary Soft Rim Reflection on Lower Right */}
      <path
        d="M 76 84 C 84 78, 89 68, 89 58"
        stroke="#E9D5FF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Eyes (Esports Anime Gamer Focus) */}
      {/* Left Eye */}
      <g>
        <ellipse cx="50" cy="54" rx="6.5" ry="8" fill="#000000" />
        {/* Screen Catchlights */}
        <circle cx="48" cy="51" r="2.5" fill="#FFFFFF" />
        <circle cx="53" cy="56" r="1.2" fill="#FFFFFF" />
        {/* Upper Gamer Lash / Brow */}
        <path d="M 42 45 Q 50 43 56 46" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Right Eye */}
      <g>
        <ellipse cx="72" cy="54" rx="6.5" ry="8" fill="#000000" />
        {/* Screen Catchlights */}
        <circle cx="70" cy="51" r="2.5" fill="#FFFFFF" />
        <circle cx="75" cy="56" r="1.2" fill="#FFFFFF" />
        {/* Upper Gamer Lash / Brow */}
        <path d="M 66 46 Q 72 43 80 45" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Cheerful Esports Gamer Smirk */}
      <path
        d="M 57 66 Q 62 72 69 66"
        stroke="#000000"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Playful Smirk Accent */}
      <path
        d="M 69 66 Q 72 64 71 62"
        stroke="#000000"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Gamer Cheek Decal / Lightning Spark */}
      <path
        d="M 39 65 L 44 60 L 41 68 L 47 62"
        stroke="#FFE600"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* HEADSET: Left Earcup with Swivel Fork */}
      <g>
        {/* Swivel metal mount */}
        <path d="M 23 50 L 23 62" stroke="#000000" strokeWidth="4" strokeLinecap="round" />
        {/* Cushion back */}
        <rect
          x="20"
          y="46"
          width="7"
          height="28"
          rx="3.5"
          fill="#18181B"
          stroke="#000000"
          strokeWidth="3"
        />
        {/* Main Earcup Shell */}
        <rect
          x="12"
          y="48"
          width="12"
          height="24"
          rx="5"
          fill="#27272A"
          stroke="#000000"
          strokeWidth="3.5"
        />
        {/* Outer RGB LED Ring / Badge */}
        <rect
          x="14"
          y="52"
          width="5"
          height="16"
          rx="2.5"
          fill="url(#pbEarcupRgb)"
          stroke="#000000"
          strokeWidth="1.5"
        />
      </g>

      {/* HEADSET: Right Earcup with Swivel Fork */}
      <g>
        {/* Swivel metal mount */}
        <path d="M 97 50 L 97 62" stroke="#000000" strokeWidth="4" strokeLinecap="round" />
        {/* Cushion back */}
        <rect
          x="93"
          y="46"
          width="7"
          height="28"
          rx="3.5"
          fill="#18181B"
          stroke="#000000"
          strokeWidth="3"
        />
        {/* Main Earcup Shell */}
        <rect
          x="96"
          y="48"
          width="12"
          height="24"
          rx="5"
          fill="#27272A"
          stroke="#000000"
          strokeWidth="3.5"
        />
        {/* Outer RGB LED Ring / Badge */}
        <rect
          x="101"
          y="52"
          width="5"
          height="16"
          rx="2.5"
          fill="url(#pbEarcupRgb)"
          stroke="#000000"
          strokeWidth="1.5"
        />
      </g>

      {/* HEADSET: Flexible Boom Microphone */}
      <g>
        {/* Boom arm curving to the mouth */}
        <path
          d="M 20 66 Q 28 80 46 76"
          stroke="#000000"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 20 66 Q 28 80 46 76"
          stroke="#71717A"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Mic capsule */}
        <ellipse
          cx="48"
          cy="75"
          rx="4.5"
          ry="3.5"
          fill="#18181B"
          stroke="#000000"
          strokeWidth="2"
        />
        {/* Glowing Live Tally LED (Esports On-Air mic) */}
        <circle cx="50" cy="75" r="2" fill="#10B981" stroke="#000000" strokeWidth="1" />
      </g>
    </svg>
  );

  // If variant is 'mascot', render pure SVG without frame
  if (variant === 'mascot') {
    return (
      <div
        onClick={onClick}
        title={title || 'Purple Bean Gaming Mascot'}
        className={`inline-block ${sizeMap[size]} ${
          onClick ? 'cursor-pointer' : ''
        } ${
          animated
            ? 'transition-transform duration-200 hover:scale-105 active:scale-95'
            : ''
        } ${className}`}
      >
        <MascotSvg />
      </div>
    );
  }

  // If variant is 'icon' (circular / rounded app icon)
  if (variant === 'icon') {
    return (
      <div
        onClick={onClick}
        title={title || 'Purple Bean Gaming Icon'}
        className={`relative ${sizeMap[size]} bg-[#F3E8FF] border-[2.5px] border-black rounded-2xl shadow-[2.5px_2.5px_0px_0px_#000] p-1 flex items-center justify-center overflow-hidden shrink-0 select-none ${
          onClick ? 'cursor-pointer' : ''
        } ${
          animated
            ? 'hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all'
            : ''
        } ${className}`}
      >
        <MascotSvg />
      </div>
    );
  }

  // Default 'badge' or 'full' Neo-Brutalist Frame
  return (
    <div
      onClick={onClick}
      title={title || 'Purple Bean Gaming'}
      className={`inline-flex items-center gap-2.5 sm:gap-3 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Mascot Framed Badge */}
      <div
        className={`relative ${sizeMap[size]} ${badgeBg} border-[2.5px] sm:border-[3px] border-black shadow-[2.5px_2.5px_0px_0px_#000] sm:shadow-[3px_3px_0px_0px_#000] rounded-2xl p-0.5 flex items-center justify-center shrink-0 select-none ${
          animated
            ? 'hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all'
            : ''
        }`}
      >
        <MascotSvg />

        {/* Little corner live dot */}
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#FFE600] border-[1.5px] border-black rounded-full" />
      </div>

      {/* Brand Wordmark & Regional Identity */}
      {showText && (
        <div className="flex flex-col text-left select-none">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`${textSizes[size].main} font-black tracking-tight text-black uppercase font-sans`}
            >
              PURPLE<span className="text-[#7C3AED]">.</span>BEAN
            </span>
            <span
              className={`bg-[#FFE600] text-black border-[1.5px] border-black ${textSizes[size].badge} font-mono font-black px-1.5 py-0.5 shadow-[1px_1px_0px_0px_#000] uppercase tracking-wider`}
            >
              INDIA
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`${textSizes[size].sub} font-mono font-bold tracking-widest text-stone-700 uppercase`}
            >
              ESPORTS PLATFORM
            </span>
            <span className="inline-block w-2 h-2 bg-[#10B981] rounded-full border border-black animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
