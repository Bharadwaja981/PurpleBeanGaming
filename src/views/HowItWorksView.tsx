import { useState } from 'react';
import { 
  UserCheck, 
  Gamepad2, 
  Trophy, 
  Gavel, 
  Swords, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Users, 
  Award,
  ChevronRight,
  Flame,
  HelpCircle
} from 'lucide-react';
import { ViewType } from '../types/tournament';

interface HowItWorksViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister?: () => void;
}

export function HowItWorksView({ onNavigate, onOpenRegister }: HowItWorksViewProps) {
  const [activeTab, setActiveTab] = useState<'player' | 'captain' | 'formats'>('player');

  const playerSteps = [
    {
      num: '01',
      title: 'Create Your PBG Profile',
      desc: 'Sign in with Google to receive your permanent, tamper-proof PBG Player ID (e.g. PBG-000184). Set your regional hub, preferred roles, and custom gamer tag.',
      icon: UserCheck,
      details: [
        'Single sign-on via secure Google OAuth',
        'Permanent PBG ID used across all national leagues',
        'No multi-accounting or identity spoofing'
      ],
      ctaText: 'Sign In / Register',
      action: () => onOpenRegister ? onOpenRegister() : onNavigate('tournaments')
    },
    {
      num: '02',
      title: 'Link Your Dota 2 Account',
      desc: 'Verify ownership through Steam OpenID. Our engine automatically pulls your matchmaking rating (MMR), rank tier, OpenDota match history, and hero pool.',
      icon: Gamepad2,
      details: [
        'Real-time Valve & OpenDota API verification',
        'Smurf detection and MMR tier classification',
        'Transparent match statistics visible to captain scouts'
      ],
      ctaText: 'View Player Leaderboard',
      action: () => onNavigate('rankings')
    },
    {
      num: '03',
      title: 'Find & Select Tournaments',
      desc: 'Explore open tournament circuits. Filter by game, MMR tier brackets, entry deadlines, and formats (Auction Purse or Premade Team).',
      icon: Trophy,
      details: [
        'Tier-capped tournaments for balanced competition',
        'Pan-India and regional circuits (Bengaluru, Mumbai, Delhi)',
        'Full schedule, prize pool distributions, and rulesets'
      ],
      ctaText: 'Explore Tournaments',
      action: () => onNavigate('tournaments')
    },
    {
      num: '04',
      title: 'Register Your Entry',
      desc: 'Confirm your availability, lock in your primary and secondary roles (Pos 1–5), and indicate whether you want to apply for captaincy.',
      icon: ShieldCheck,
      details: [
        'Automated referee roster verification',
        'Instant confirmation notice and Discord role sync',
        'Withdrawable anytime before roster freeze'
      ],
      ctaText: 'Browse Open Registrations',
      action: () => onNavigate('tournaments')
    },
    {
      num: '05',
      title: 'Enter the Live Auction or Join Roster',
      desc: 'For Auction tournaments, watch captains bid virtual credits in real time for your contract. In Premade circuits, unite with your squad under one team banner.',
      icon: Gavel,
      details: [
        'Live WebSocket bidding rooms with 30-second timers',
        'Dynamic purse management & budget strategy',
        'Automatic team channel & Discord role assignment upon sale'
      ],
      ctaText: 'Learn About Auction Engine',
      action: () => setActiveTab('formats')
    },
    {
      num: '06',
      title: 'Compete in Match Rooms',
      desc: 'Play double-elimination brackets with dedicated referee lobbies, server vetoes (Mumbai/Singapore), screenshot verification, and live match scoring.',
      icon: Swords,
      details: [
        'Real-time bracket updates with winner/loser routing',
        'In-client lobby password generation and spectator relays',
        'Dispute referee escalation system'
      ],
      ctaText: 'View Live Matches',
      action: () => onNavigate('matches')
    },
    {
      num: '07',
      title: 'Build Your Career & PBG Rating',
      desc: 'Every match influences your PBG Elo ranking, career win rate, tournament trophy cabinet, and MVP record. Get scouted for invitational majors.',
      icon: TrendingUp,
      details: [
        'Permanent tournament badges and championship trophies',
        'Public verifiable gaming resume for tier-1 scouting',
        'Prize pool payouts directly to verified player accounts'
      ],
      ctaText: 'View Top Players',
      action: () => onNavigate('players')
    }
  ];

  const captainSteps = [
    {
      num: '01',
      title: 'Apply for Team Captaincy',
      desc: 'Mark "Interested in Captaincy" when registering. PBG referees review your competitive history, leadership track record, and communication reliability.',
      icon: ShieldCheck,
      badge: 'LEADERSHIP'
    },
    {
      num: '02',
      title: 'Purse Budget Allocation',
      desc: 'Every captain receives an identical starting purse (e.g. 1,000 Credits). Your mission: assemble a balanced 5-man roster without bankrupting your pool.',
      icon: Award,
      badge: 'FINANCIAL STRATEGY'
    },
    {
      num: '03',
      title: 'Live Draft Room Bidding',
      desc: 'Take turns nominating eligible registered players into the bidding circle. Raise bids, call bluffs, and secure your key role anchors.',
      icon: Gavel,
      badge: 'LIVE AUCTION'
    },
    {
      num: '04',
      title: 'Roster Finalization & Discord Sync',
      desc: 'Once all rosters hit 5 players, the auction engine authoritatively finalizes teams, generates custom Discord team roles, and creates private team channels.',
      icon: Users,
      badge: 'AUTOMATED SYNC'
    }
  ];

  return (
    <div className="space-y-10 pb-12">
      {/* Header Banner */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>COMPETITIVE GUIDE</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">7-STEP PATHWAY</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          HOW PURPLE BEAN WORKS
        </h1>
        <p className="font-mono text-sm sm:text-base text-stone-700 dark:text-stone-300 max-w-3xl leading-relaxed">
          From registering your gamer identity to live purse auctions and double-elimination grand finals—learn how PBG powers fair, transparent, and competitive esports across India.
        </p>

        {/* Tab Controls */}
        <div className="pt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              activeTab === 'player'
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
            }`}
          >
            Player Career Path
          </button>
          <button
            onClick={() => setActiveTab('captain')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              activeTab === 'captain'
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
            }`}
          >
            Captain &amp; Auction Role
          </button>
          <button
            onClick={() => setActiveTab('formats')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              activeTab === 'formats'
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
            }`}
          >
            Auction vs. Premade Formats
          </button>
        </div>
      </section>

      {/* Main Flow: Player Path */}
      {activeTab === 'player' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div>
              <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
                The Competitive Player Journey
              </h2>
              <p className="font-mono text-xs text-stone-500 mt-0.5">
                Complete these 7 milestones to participate in official PBG cups and cash tournaments
              </p>
            </div>
            <span className="hidden sm:inline font-mono text-xs font-bold text-stone-500">
              EST. TIME: ~3 MINUTES
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {playerSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div 
                  key={step.num}
                  className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[5px_5px_0px_0px_#000] flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#FFE600] text-black border-2 border-black flex items-center justify-center font-mono font-black text-lg shrink-0 shadow-[2px_2px_0px_0px_#000]">
                      {step.num}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-[#7C3AED]" />
                        <h3 className="font-sans font-black text-xl text-black dark:text-white uppercase">
                          {step.title}
                        </h3>
                      </div>
                      <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
                        {step.desc}
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {step.details.map((d, i) => (
                          <li key={i} className="flex items-center gap-2 font-mono text-[11px] text-stone-500">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={step.action}
                    className="w-full md:w-auto px-4 py-2.5 bg-black hover:bg-[#7C3AED] text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-2 shrink-0 transition-colors"
                  >
                    <span>{step.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Captain Path */}
      {activeTab === 'captain' && (
        <section className="space-y-6">
          <div className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[5px_5px_0px_0px_#000] space-y-4">
            <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
              Leading as a PBG Captain
            </h2>
            <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-3xl">
              Captains are the tactical anchors of PBG Auction Tournaments. As a captain, you represent your squad, manage draft strategy, allocate purse points, and direct in-game execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {captainSteps.map((s) => {
              const Icon = s.icon;
              return (
                <div 
                  key={s.num}
                  className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-[#7C3AED]">
                      STAGE {s.num}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-stone-500 uppercase">
                      {s.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-black dark:text-[#FFE600]" />
                    <h3 className="font-sans font-black text-lg text-black dark:text-white uppercase">
                      {s.title}
                    </h3>
                  </div>
                  <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="bg-[#FFFDEB] border-[3px] border-black p-6 shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-sans font-black text-base text-black uppercase">
                Ready to Captain an Upcoming Cup?
              </h4>
              <p className="font-mono text-xs text-stone-700">
                Register for any open tournament and check the "Apply as Captain" box.
              </p>
            </div>
            <button
              onClick={() => onNavigate('tournaments')}
              className="px-4 py-2 bg-black text-white hover:bg-stone-800 font-mono text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
            >
              Browse Open Tournaments →
            </button>
          </div>
        </section>
      )}

      {/* Formats Comparison */}
      {activeTab === 'formats' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Auction Tournaments */}
            <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono font-black text-[#7C3AED] uppercase">
                <Gavel className="w-4 h-4" />
                <span>FORMAT TYPE A</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-black dark:text-white font-sans">
                Auction Draft Tournaments
              </h2>
              <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                Players register as solo free agents. Appointed captains bid on them using virtual credit purses in a live draft room. This creates balanced, high-stakes rosters and tests captain scouting acumen.
              </p>
              <div className="space-y-2 border-t-2 border-black pt-4 font-mono text-xs text-stone-700 dark:text-stone-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Equal starting budget per captain (e.g. 1,000 pts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>30-second live bidding countdown with auto-extension</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unsold player re-entry round guarantee</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ideal for solo queue warriors seeking organized stacks</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('tournaments')}
                className="w-full mt-4 px-4 py-3 bg-[#FFE600] hover:bg-[#FFDE59] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
              >
                Find Auction Tournaments →
              </button>
            </div>

            {/* Premade Tournaments */}
            <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono font-black text-black dark:text-stone-300 uppercase">
                <Users className="w-4 h-4" />
                <span>FORMAT TYPE B</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-black dark:text-white font-sans">
                Premade Team Tournaments
              </h2>
              <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                Bring your existing 5-man stack or collegiate clan. Captains register the team roster directly, lock in player IGNs, and compete head-to-head for national championship points.
              </p>
              <div className="space-y-2 border-t-2 border-black pt-4 font-mono text-xs text-stone-700 dark:text-stone-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Roster lock with optional 1 stand-in player</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Combined team MMR cap enforcement</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Custom team logo, banner, and tag support</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Official club ranking points on the PBG Team Leaderboard</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('teams')}
                className="w-full mt-4 px-4 py-3 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
              >
                Browse Registered Teams →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Bottom Help Section */}
      <section className="bg-black text-white border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#FFE600] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#FFE600] font-mono text-xs font-black uppercase">
            <HelpCircle className="w-4 h-4" />
            <span>HAVE QUESTIONS?</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black uppercase font-sans">
            Need Help Getting Started?
          </h3>
          <p className="font-mono text-xs sm:text-sm text-stone-300 max-w-xl">
            Check out our detailed FAQ or connect with tournament staff directly on the Purple Bean Discord server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate('faq')}
            className="px-5 py-2.5 bg-white text-black hover:bg-stone-100 font-mono text-xs font-black uppercase border-2 border-white shadow-[3px_3px_0px_0px_#FFE600] cursor-pointer"
          >
            Read FAQs
          </button>
          <button
            onClick={() => onNavigate('community')}
            className="px-5 py-2.5 bg-[#FFE600] text-black hover:bg-[#FFDE59] font-mono text-xs font-black uppercase border-2 border-[#FFE600] shadow-[3px_3px_0px_0px_#fff] cursor-pointer"
          >
            Join PBG Discord
          </button>
        </div>
      </section>
    </div>
  );
}
