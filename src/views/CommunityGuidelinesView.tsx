import { HeartHandshake, ShieldAlert, Award, MessageSquare, CheckCircle2, UserX } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface CommunityGuidelinesViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function CommunityGuidelinesView({ onNavigate }: CommunityGuidelinesViewProps) {
  const guidelines = [
    {
      title: '1. Sportsmanship & In-Game Respect',
      desc: 'Treat opponents, teammates, tournament referees, and casters with dignity. Heated competitive moments are natural, but personal attacks, racial/religious slurs, sexism, hate speech, or targeted harassment result in instant account termination.',
      icon: HeartHandshake
    },
    {
      title: '2. All-Chat & Tactical Pause Conduct',
      desc: 'In-game all-chat during official matches must be limited to administrative communication (e.g. pause reasons, server latency issues, and "GG" calls). Offensive spam, flame, or taunting all-chat is strictly penalized.',
      icon: MessageSquare
    },
    {
      title: '3. Draft Room & Auction Honor Code',
      desc: 'Captains and players must maintain integrity during live purse auctions. Collusion between captains to artificially suppress bidding on specific players or intentionally draft ghost rosters to throw matches is strictly audited and banned.',
      icon: Award
    },
    {
      title: '4. No Match Fixing, Betting or Bribery',
      desc: 'Attempting to bribe referees, match opponents, or captains—or intentionally losing a match for outside wagering—is a permanent criminal fraud violation resulting in immediate lifetime banning and reporting to esports integrity coalitions.',
      icon: ShieldAlert
    },
    {
      title: '5. Reliable Punctuality & Team Commitment',
      desc: 'When registering as a player or captain, you commit to being present for tournament match lobbies. No-showing without 12-hour advance notice disrupts four other teammates and compromises bracket scheduling.',
      icon: CheckCircle2
    }
  ];

  return (
    <div className="space-y-10 pb-12 max-w-4xl mx-auto font-mono">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-500 uppercase">
          <span>COMMUNITY</span>
          <span aria-hidden="true">·</span>
          <span>STANDARDS &amp; CODE OF CONDUCT</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">RESPECT FIRST</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          COMMUNITY GUIDELINES
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-2xl">
          PurpleBeanGaming is a community of passionate South Asian gamers. We hold every competitor, captain, and referee to high standards of sportsmanship.
        </p>
      </section>

      {/* Guidelines Content */}
      <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_#000] space-y-6">
        <div className="space-y-4">
          {guidelines.map((g, i) => {
            const Icon = g.icon;
            return (
              <div 
                key={i}
                className="border-2 border-black p-5 bg-stone-50 dark:bg-stone-900 space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#FFE600] border-2 border-black flex items-center justify-center text-black shrink-0 shadow-[1px_1px_0px_0px_#000]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-sans font-black text-base sm:text-lg uppercase text-black dark:text-white">
                    {g.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed pl-10">
                  {g.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <span className="text-stone-500">
            Witnessed misconduct? Referees review reports 24/7.
          </span>
          <button
            onClick={() => onNavigate('support')}
            className="px-4 py-2 bg-[#FF5757] hover:bg-[#FF3838] text-white text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            File a Conduct Report →
          </button>
        </div>
      </div>
    </div>
  );
}
