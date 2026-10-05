import { useState } from 'react';
import { 
  HelpCircle, 
  UserCheck, 
  Gamepad2, 
  Trophy, 
  Swords, 
  Flag, 
  Wrench, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  ArrowRight,
  Send,
  RefreshCw
} from 'lucide-react';
import { ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';

interface SupportViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function SupportView({ onNavigate }: SupportViewProps) {
  const [activeTroubleshooter, setActiveTroubleshooter] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportData, setReportData] = useState({
    targetType: 'player',
    identifier: '',
    matchId: '',
    reason: 'smurf',
    details: ''
  });

  const categories = [
    {
      id: 'dota_linking',
      title: 'Dota & Steam Linking',
      desc: 'Fix "Public Match Data" errors, Steam 64 ID mismatches, and OpenDota MMR synchronization issues.',
      icon: Gamepad2,
      solutions: [
        'Open Dota 2 -> Settings (gear icon) -> Social tab.',
        'Ensure "Expose Public Match Data" is checked ON.',
        'Play at least one matchmaking or Turbo game to trigger an OpenDota refresh.',
        'Re-click "Sync Steam Account" in your PBG Player Profile.'
      ]
    },
    {
      id: 'discord_roles',
      title: 'Discord Role Automation',
      desc: 'Missing PBG Member, Tournament Player, or Team Captain roles in the official Discord server.',
      icon: MessageSquare,
      solutions: [
        'Confirm your Discord Snowflake ID is linked on your PBG profile.',
        'Make sure you have joined the official Discord server (discord.gg/w8h6Jv8wsq).',
        'Our bot assigns the PBG Player role as soon as your tournament registration is verified by staff.',
        'If roles do not update within 2 minutes, click "Re-sync Discord" in profile settings.'
      ]
    },
    {
      id: 'auction_connectivity',
      title: 'Auction & Draft Rooms',
      desc: 'Bidding delays, timer synchronization, or WebSocket connection drops during live captain auctions.',
      icon: Wrench,
      solutions: [
        'Disable aggressive ad-blockers or VPN extensions that terminate WebSocket streaming.',
        'Hard refresh the page using Ctrl+F5 (Cmd+Shift+R on Mac).',
        'The PBG Auction engine features auto-reconnect with authoritative server state recovery.',
        'In critical drafts, notify your room referee immediately via the #auction-chat channel.'
      ]
    },
    {
      id: 'tournament_rules',
      title: 'Tournament & Bracket Disputes',
      desc: 'Incorrect match score reporting, opponent delays, stand-in eligibility, or pause violations.',
      icon: Trophy,
      solutions: [
        'Take full-screen screenshots of end-game scoreboard and combat logs showing Match ID.',
        'Do not leave the post-game lobby until both team captains or referees acknowledge the result.',
        'Submit a dispute ticket below with the Valve match ID within 15 minutes of match conclusion.'
      ]
    }
  ];

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportSuccess(true);
    setTimeout(() => {
      setReportModalOpen(false);
      setReportSuccess(false);
      setReportData({ targetType: 'player', identifier: '', matchId: '', reason: 'smurf', details: '' });
    }, 2000);
  };

  return (
    <div className="space-y-10 pb-12 max-w-5xl mx-auto">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>SUPPORT &amp; DISPUTE DESK</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">24/7 ASSISTANCE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          HELP &amp; TECHNICAL RESOLUTION
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-3xl leading-relaxed">
          Troubleshoot account linkage, report rule violations, resolve match disputes, or get in touch with our live referee desk.
        </p>

        <div className="pt-2 flex flex-wrap gap-3">
          <button
            onClick={() => setReportModalOpen(true)}
            className="px-4 py-2.5 bg-[#FF5757] hover:bg-[#FF3838] text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2 transition-transform hover:-translate-y-0.5"
          >
            <Flag className="w-4 h-4" />
            <span>Report Player / Team</span>
          </button>
          <a
            href="https://discord.gg/w8h6Jv8wsq"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Discord Support Ticket</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Interactive Troubleshooter Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
            Interactive Troubleshooting Guides
          </h2>
          <span className="font-mono text-xs text-stone-500 font-bold uppercase">
            INSTANT SOLUTIONS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isOpen = activeTroubleshooter === cat.id;
            return (
              <div
                key={cat.id}
                className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-4 font-mono transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#FFE600] border-2 border-black flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_0px_#000]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-lg text-black dark:text-white uppercase">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
                      {cat.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t-2 border-dashed border-stone-200 dark:border-stone-800">
                  <button
                    onClick={() => setActiveTroubleshooter(isOpen ? null : cat.id)}
                    className="text-xs font-black uppercase text-[#7C3AED] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>{isOpen ? 'Hide Diagnostic Steps ↑' : 'View Step-by-Step Resolution ↓'}</span>
                  </button>

                  {isOpen && (
                    <ol className="mt-3 space-y-2 text-xs text-stone-700 dark:text-stone-300 list-decimal list-inside bg-stone-50 dark:bg-stone-900 p-3 border border-black">
                      {cat.solutions.map((sol, i) => (
                        <li key={i} className="leading-relaxed">
                          <span>{sol}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Emergency Referee Contact */}
      <section className="bg-[#FFFDEB] border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-6 font-mono">
        <div className="space-y-1">
          <span className="font-black text-xs uppercase text-[#FF5757]">URGENT MATCH DAY ISSUE?</span>
          <h3 className="font-sans font-black text-xl sm:text-2xl text-black uppercase">
            Active Match In Progress?
          </h3>
          <p className="text-xs sm:text-sm text-stone-700 max-w-xl">
            If a match lobby is delayed or an opponent is unresponsive during a tournament round, ping the <strong>@Referee</strong> role inside the match-specific channel on Discord.
          </p>
        </div>
        <button
          onClick={() => onNavigate('contact')}
          className="px-5 py-2.5 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer shrink-0"
        >
          Contact Head Referee →
        </button>
      </section>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black max-w-lg w-full p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] font-mono space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-[#FF5757]" />
                <h3 className="font-sans font-black text-xl uppercase text-black dark:text-white">
                  Report Player or Team
                </h3>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="text-black dark:text-white hover:bg-black hover:text-white px-2 py-0.5 border border-black cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {reportSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-sans font-black text-lg uppercase text-black dark:text-white">
                  Report Lodged Successfully
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-300">
                  Referees have logged your audit submission and will inspect match logs.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Report Target
                  </label>
                  <select
                    value={reportData.targetType}
                    onChange={(e) => setReportData({ ...reportData, targetType: e.target.value })}
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border-2 border-black text-xs text-black dark:text-white"
                  >
                    <option value="player">Individual Player (IGN or PBG ID)</option>
                    <option value="team">Team Stack</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Player Handle / PBG ID / Team Name <span className="text-[#FF5757]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={reportData.identifier}
                    onChange={(e) => setReportData({ ...reportData, identifier: e.target.value })}
                    placeholder="e.g. ShadowFiendPro or PBG-000188"
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border-2 border-black text-xs text-black dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Dota 2 Match ID (If Applicable)
                  </label>
                  <input
                    type="text"
                    value={reportData.matchId}
                    onChange={(e) => setReportData({ ...reportData, matchId: e.target.value })}
                    placeholder="e.g. 7984128591"
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border-2 border-black text-xs text-black dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Violation Type
                  </label>
                  <select
                    value={reportData.reason}
                    onChange={(e) => setReportData({ ...reportData, reason: e.target.value })}
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border-2 border-black text-xs text-black dark:text-white"
                  >
                    <option value="smurf">Suspected Smurf / False MMR</option>
                    <option value="cheating">Scripts / Zoom Hack / Third-Party Tools</option>
                    <option value="toxicity">Severe Toxic Harassment / Griefing</option>
                    <option value="pause">Tactical Pause Abuse / Unpausing</option>
                    <option value="other">Other Rule Violation</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Evidence &amp; Description <span className="text-[#FF5757]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reportData.details}
                    onChange={(e) => setReportData({ ...reportData, details: e.target.value })}
                    placeholder="Provide timestamps in replay or links to screenshot evidence..."
                    className="w-full p-2 bg-stone-50 dark:bg-stone-900 border-2 border-black text-xs text-black dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-black text-xs font-black uppercase border border-black cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#FF5757] hover:bg-[#FF3838] text-white text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    Submit Report Confidentially
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
