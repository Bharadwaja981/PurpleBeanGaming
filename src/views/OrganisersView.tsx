import { 
  Trophy, 
  Users, 
  Gavel, 
  ShieldCheck, 
  Swords, 
  Settings, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  Award
} from 'lucide-react';
import { ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';

interface OrganisersViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenCreateTournament?: () => void;
}

export function OrganisersView({ onNavigate, onOpenCreateTournament }: OrganisersViewProps) {
  const currentUser = tournamentService.getCurrentUser();
  const isOrganiserOrAdmin = currentUser.role === 'organizer' || currentUser.isAdmin;

  const tools = [
    {
      title: 'Automated Tournament Architect',
      desc: 'Deploy custom competitive formats in seconds: choose between Auction Draft or Premade Stack, set MMR tier caps, configure prize pools in INR, and schedule match stages.',
      icon: Trophy,
      badge: 'CREATION'
    },
    {
      title: 'Player & Roster Verification',
      desc: 'Zero-effort player auditing: our system verifies Dota 2 account IDs via Steam OpenID and OpenDota API, flags suspected smurfs, and handles registration confirmations.',
      icon: Users,
      badge: 'VERIFICATION'
    },
    {
      title: 'Captain Selection & Purse Allocator',
      desc: 'Appoint reliable community leaders as captains, distribute virtual bidding purses (e.g. 1,000 points per captain), and configure minimum bid increments.',
      icon: ShieldCheck,
      badge: 'LEADERSHIP'
    },
    {
      title: 'Live Auction Draft Room Master',
      desc: 'Command the live draft floor: control 30-second bidding countdowns, manage player nomination queues, trigger unsold re-entry rounds, and finalize rosters automatically.',
      icon: Gavel,
      badge: 'LIVE AUCTION'
    },
    {
      title: 'Dynamic Double-Elimination Brackets',
      desc: 'Algorithmic bracket generation with automatic upper bracket progression and lower bracket survival routing. Seed teams by collective rating or auction purse expenditure.',
      icon: Swords,
      badge: 'BRACKETS'
    },
    {
      title: 'Match Operations & Score Reporting',
      desc: 'Automated lobby credential distribution, referee dispute management, screenshot scoreboard validation, and instant bracket advancement upon match confirmation.',
      icon: Settings,
      badge: 'MATCH OPERATIONS'
    }
  ];

  return (
    <div className="space-y-10 pb-12 max-w-5xl mx-auto">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>ORGANISER PORTAL</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">INFRASTRUCTURE SUITE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          FOR TOURNAMENT ORGANISERS
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-3xl leading-relaxed">
          The full-stack esports operating system: from player registration to real-time live purse auctions, automated double-elimination brackets, and Discord server synchronization.
        </p>

        <div className="pt-2 flex flex-wrap gap-3">
          {onOpenCreateTournament && (
            <button
              onClick={onOpenCreateTournament}
              className="px-5 py-3 bg-[#FFE600] hover:bg-[#FFDE59] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2 transition-transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create a Tournament</span>
            </button>
          )}

          {isOrganiserOrAdmin && (
            <button
              onClick={() => onNavigate('organiser_dashboard')}
              className="px-5 py-3 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              <span>Enter Organiser &amp; Referee Desk</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('contact')}
            className="px-5 py-3 bg-white dark:bg-stone-900 hover:bg-stone-100 text-black dark:text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2"
          >
            <span>Partner / Host League</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="space-y-4">
        <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
          The Organiser Operating System
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <div 
                key={idx}
                className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-3 font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-[#FFE600] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-stone-500">
                    {tool.badge}
                  </span>
                </div>
                <h3 className="font-sans font-black text-lg text-black dark:text-white uppercase leading-tight">
                  {tool.title}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  {tool.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Collegiate & Club Partnerships */}
      <section className="bg-stone-50 dark:bg-stone-900 border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] space-y-4 font-mono">
        <div className="space-y-1">
          <span className="font-black text-xs text-[#7C3AED] uppercase">COLLEGE CLUBS &amp; COMMUNITY LEAGUES</span>
          <h3 className="font-sans font-black text-2xl text-black dark:text-white uppercase">
            Host Your Campus or Clan Tournament on PBG
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-2xl">
            Are you running a university gaming fest or regional LAN event in Mumbai, Bengaluru, Delhi, or Pune? PBG provides complete software licensing, Discord integration, and live auction draft rooms free of charge for approved esports clubs.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => onNavigate('contact')}
            className="px-5 py-2.5 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            Apply for Campus Tournament License →
          </button>
        </div>
      </section>
    </div>
  );
}
