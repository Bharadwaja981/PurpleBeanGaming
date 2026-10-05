import { Cookie, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface CookiesViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function CookiesView({ onNavigate }: CookiesViewProps) {
  const cookieTypes = [
    {
      title: 'Essential Authentication Tokens',
      purpose: 'Firebase Auth ID tokens and session credentials required to keep you securely signed in to your PBG profile.',
      retention: 'Session / 30 Days',
      essential: true
    },
    {
      title: 'OAuth Security Signatures',
      purpose: 'Signed cryptographic state parameters (HMAC SHA-256) used during Steam OpenID and Discord OAuth redirection to protect against CSRF attacks.',
      retention: '10 Minutes (Single Use)',
      essential: true
    },
    {
      title: 'Local Browser Preferences & Theme',
      purpose: 'Stores your selected color palette (e.g. Purple Bean, Cyber Mint), dark/light mode toggle, and dismissed onboarding status.',
      retention: 'Persistent (Local Storage)',
      essential: false
    },
    {
      title: 'Offline Draft & Tournament Cache',
      purpose: 'Local state caching for tournament brackets and purse auction rooms to ensure rapid recovery during temporary network dropouts.',
      retention: 'Tournament Session Duration',
      essential: false
    }
  ];

  return (
    <div className="space-y-10 pb-12 max-w-4xl mx-auto font-mono">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-500 uppercase">
          <span>LEGAL</span>
          <span aria-hidden="true">·</span>
          <span>COOKIE POLICY</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">TRANSPARENT STORAGE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          COOKIE &amp; STORAGE POLICY
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-2xl">
          Learn how PurpleBeanGaming uses browser cookies, session tokens, and local storage to provide a seamless esports experience.
        </p>
      </section>

      {/* Content */}
      <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_#000] space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-black uppercase text-black dark:text-white font-sans">
            1. What Are Cookies &amp; Local Storage?
          </h2>
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            Cookies are small text files placed on your device by websites you visit. In addition to cookies, PBG utilizes modern web standards like HTML5 Local Storage and Session Storage to cache real-time auction room states and user interface preferences without sending redundant data over the network.
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <h2 className="text-lg sm:text-xl font-black uppercase text-black dark:text-white font-sans">
            2. Technologies Deployed on PBG
          </h2>

          <div className="space-y-3">
            {cookieTypes.map((c, i) => (
              <div 
                key={i}
                className="border-2 border-black p-4 bg-stone-50 dark:bg-stone-900 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-black dark:text-white uppercase font-sans">
                    {c.title}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-black ${c.essential ? 'bg-[#FFE600] text-black' : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'}`}>
                    {c.essential ? 'Strictly Necessary' : 'Functional'}
                  </span>
                </div>
                <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                  {c.purpose}
                </p>
                <div className="text-[11px] text-stone-500">
                  <span>Lifespan: {c.retention}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <h2 className="text-lg sm:text-xl font-black uppercase text-black dark:text-white font-sans">
            3. No Invasive Third-Party Tracking
          </h2>
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            PurpleBeanGaming does not deploy third-party behavioral advertising pixels (e.g. Meta Pixel, TikTok tracking). All stored keys are strictly dedicated to authentication, tournament socket performance, and user preference retention.
          </p>
        </div>

        <div className="pt-4 border-t-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <span className="text-stone-500">
            You can clear all PBG stored data anytime via browser settings.
          </span>
          <button
            onClick={() => onNavigate('privacy')}
            className="px-4 py-2 bg-black text-white hover:bg-stone-800 text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            View Privacy Policy →
          </button>
        </div>
      </div>
    </div>
  );
}
