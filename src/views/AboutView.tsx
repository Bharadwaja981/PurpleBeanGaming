import { Shield, Trophy, Users, Zap, Heart, Flame, Globe, Sparkles, ArrowRight, Gamepad2, Award } from 'lucide-react';
import { ViewType } from '../types/tournament';
import { PurpleBeanLogo } from '../components/PurpleBeanLogo';

interface AboutViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister?: () => void;
}

export function AboutView({ onNavigate, onOpenRegister }: AboutViewProps) {
  const pillars = [
    {
      title: 'Zero-Tolerance Fair Play',
      desc: 'Valve Steam OpenID & OpenDota account linking verify real player identities, match history, and true MMR tiers—eliminating smurfing and hidden account abuse.',
      icon: Shield,
      tag: 'INTEGRITY'
    },
    {
      title: 'Purse Auction Innovation',
      desc: 'Our proprietary real-time auction engine transforms draft night into an exhilarating bidding spectacle where appointed captains assemble balanced squads.',
      icon: Trophy,
      tag: 'INNOVATION'
    },
    {
      title: 'Pan-Indian Infrastructure',
      desc: 'Tailored specifically for Indian and South Asian gamers with optimized Mumbai & Bengaluru server vetoes, sub-20ms relays, and UPI / INR prize distributions.',
      icon: Globe,
      tag: 'LOCAL FOCUS'
    },
    {
      title: 'Grassroots to Pro Pathway',
      desc: 'Every community match generates verifiable career statistics and PBG Elo rating points, giving unsigned talent visible resumes for semi-pro scouting.',
      icon: Award,
      tag: 'OPPORTUNITY'
    }
  ];

  const milestones = [
    { year: '2024', title: 'Community Foundations', desc: 'Started as a weekend private Dota 2 in-house league among 60 passionate Indian gamers.' },
    { year: '2025', title: 'Purse Auction Protocol', desc: 'Engineered the first automated credit purse draft system with live WebSocket bidding.' },
    { year: '2026', title: 'National Competitive Platform', desc: 'Launched full double-elimination brackets, Discord bot integration, and multi-city tournament hubs.' }
  ];

  return (
    <div className="space-y-10 pb-12">
      {/* Hero Intro */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_#000] space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>ABOUT US</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">EST. 2024</span>
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
              REBUILDING COMPETITIVE DOTA 2 FOR SOUTH ASIA
            </h1>
            <p className="font-mono text-sm sm:text-base text-stone-700 dark:text-stone-300 leading-relaxed">
              PurpleBeanGaming (PBG) is an independent esports tournament platform engineered to provide fair, structured, and exhilarating competitive circuits. We bridge the gap between casual matchmaking and premier esports.
            </p>
          </div>
          <div className="shrink-0 p-4 bg-[#F3E8FF] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center">
            <PurpleBeanLogo size="lg" animated={true} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t-2 border-black font-mono text-center">
          <div className="p-3 bg-stone-50 dark:bg-stone-900 border-2 border-black">
            <div className="text-2xl font-black text-black dark:text-white">1,200+</div>
            <div className="text-[10px] text-stone-500 uppercase font-bold">Verified Players</div>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-900 border-2 border-black">
            <div className="text-2xl font-black text-[#7C3AED]">100%</div>
            <div className="text-[10px] text-stone-500 uppercase font-bold">Real Dota 2 MMR Sync</div>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-900 border-2 border-black">
            <div className="text-2xl font-black text-black dark:text-white">&lt;20ms</div>
            <div className="text-[10px] text-stone-500 uppercase font-bold">Mumbai Server Relays</div>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-900 border-2 border-black">
            <div className="text-2xl font-black text-emerald-600">₹0</div>
            <div className="text-[10px] text-stone-500 uppercase font-bold">Platform Paywalls</div>
          </div>
        </div>
      </section>

      {/* Mission & Why PBG Exists */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono font-black text-[#7C3AED] uppercase">
            <Heart className="w-4 h-4" />
            <span>OUR MISSION</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-black dark:text-white font-sans">
            Level the Playing Field
          </h2>
          <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Our mission is to establish a transparent, meritocratic competitive environment where any Dota 2 player—regardless of MMR tier—can experience the electrifying tension of organized team competition, tournament brackets, and live audience spectating.
          </p>
          <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            We believe esports shouldn't be reserved only for the top 0.1% Immortal players. Every skill bracket deserves referee moderation, clean scheduling, and meaningful stakes.
          </p>
        </div>

        <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono font-black text-[#FF5757] uppercase">
            <Flame className="w-4 h-4" />
            <span>WHY IT EXISTS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-black dark:text-white font-sans">
            Solving the Community Void
          </h2>
          <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Grassroots Dota 2 in India was fractured by smurf accounts, unreliable tournament hosts, ghosted payouts, and chaotic WhatsApp groups.
          </p>
          <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            PurpleBeanGaming replaces discord spreadsheets with automated double-elimination software, OpenDota identity validation, live purse drafting, and authoritative Discord role automation.
          </p>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="space-y-4">
        <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
          The Purple Bean Standard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div 
                key={idx}
                className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-[#FFE600] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-[10px] font-black uppercase text-stone-500">
                    {p.tag}
                  </span>
                </div>
                <h3 className="font-sans font-black text-lg text-black dark:text-white uppercase">
                  {p.title}
                </h3>
                <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dota 2 Focus & Future Vision */}
      <section className="bg-stone-50 dark:bg-stone-900 border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-black text-[#7C3AED] uppercase">
            <Gamepad2 className="w-4 h-4" />
            <span>GAMEPLAY FOCUS &amp; FUTURE VISION</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-black dark:text-white font-sans">
            Why Dota 2 First, What's Next?
          </h2>
          <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-3xl">
            Dota 2 represents the pinnacle of team synergy, tactical depth, and strategic draft theory. By mastering the intricate demands of 5v5 MOBA draft rooms, purse auctions, and API-based stat synchronization, we built an engine that can expand to any competitive title.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t-2 border-black pt-6">
          {milestones.map((m, i) => (
            <div key={i} className="bg-white dark:bg-[#141222] border-2 border-black p-4 space-y-1 shadow-[2px_2px_0px_0px_#000]">
              <span className="font-mono text-xs font-black text-[#7C3AED]">{m.year}</span>
              <h4 className="font-sans font-black text-base text-black dark:text-white uppercase">{m.title}</h4>
              <p className="font-mono text-xs text-stone-500">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Box */}
      <section className="bg-[#FFE600] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-black">
          <h3 className="text-2xl sm:text-3xl font-black uppercase font-sans tracking-tight">
            Be Part of the Purple Bean Movement
          </h3>
          <p className="font-mono text-xs sm:text-sm text-stone-900 max-w-xl">
            Sign in, verify your Steam identity, and compete in upcoming seasonal cups or auction leagues.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('tournaments')}
            className="px-5 py-2.5 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            Explore Tournaments
          </button>
          <button
            onClick={() => onNavigate('community')}
            className="px-5 py-2.5 bg-white hover:bg-stone-100 text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            Join Discord
          </button>
        </div>
      </section>
    </div>
  );
}
