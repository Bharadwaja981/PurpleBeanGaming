import { ShieldCheck, AlertTriangle, Scale, Eye, Flag, UserX, FileCheck, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface FairPlayViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function FairPlayView({ onNavigate }: FairPlayViewProps) {
  const rules = [
    {
      title: 'Mandatory Steam 64 & OpenDota Verification',
      desc: 'All participants must authenticate their primary Dota 2 account through Steam OpenID and expose public match data. Accounts must have a minimum of 200 lifetime matchmaking games to enter PBG tournaments.',
      icon: ShieldCheck,
      severity: 'CORE REQUIREMENT'
    },
    {
      title: 'Anti-Smurfing & Secondary Account Prohibition',
      desc: 'Playing on an account with an artificially depressed MMR, using someone else’s Steam credentials, or maintaining undisclosed smurf accounts is strictly prohibited. Our discovery engine analyzes account age, lifetime win rate spikes, and historical tier medals.',
      icon: UserX,
      severity: 'ZERO TOLERANCE'
    },
    {
      title: 'False MMR Declaration Penalties',
      desc: 'If a participant intentionally conceals recent calibration changes or provides an outdated MMR figure to fit into a lower-tier bracket, their team faces immediate disqualification and forfeiture of purse credits.',
      icon: Scale,
      severity: 'IMMEDIATE DISQUALIFICATION'
    },
    {
      title: 'Cheating, Scripting & Unfair Software',
      desc: 'The use of camera zoom modifications, automated combo scripts, macro-binders, map-hack overlays, or any third-party tool injecting memory into the Dota 2 client results in a permanent lifetime PBG ban and Valve anti-cheat escalation.',
      icon: AlertTriangle,
      severity: 'LIFETIME BAN'
    },
    {
      title: 'Match Verification & Replay Auditing',
      desc: 'Designated PBG referees and tournament administrators review official Valve match IDs, parse end-game combat logs, and verify screenshot scoreboards before match outcomes are officially committed to tournament brackets.',
      icon: FileCheck,
      severity: 'OFFICIAL PROCEDURE'
    },
    {
      title: 'Confidential Player & Team Reporting',
      desc: 'Any captain or player can submit a confidential fair play report with match replay timestamps. Referees conduct blind audits without revealing the whistleblower’s identity to ensure whistleblowers are protected.',
      icon: Flag,
      severity: 'WHISTLEBLOWER PROTECTED'
    }
  ];

  const penaltyLadder = [
    {
      tier: 'Level 1: Official Warning',
      triggers: 'Minor administrative delays, late lobby check-in under 10 minutes, unconfirmed draft roster notifications.',
      consequence: 'Formal warning on PBG account record. Repeat offenses within 30 days escalate to Level 2.'
    },
    {
      tier: 'Level 2: Match Forfeit & Purse Deduction',
      triggers: 'Tactical pausing without referee consent, unapproved stand-in player usage, false lobby server veto claims.',
      consequence: 'Forfeit of the affected game (0-1 loss). In auction tournaments, the captain loses 150 purse points for the following season.'
    },
    {
      tier: 'Level 3: Tournament Disqualification & 6-Month Suspension',
      triggers: 'Confirmed smurfing, intentional griefing, severe abusive communication in public all-chat, false MMR deception.',
      consequence: 'Team is disqualified from the tournament; opponent advances. Offending player suspended for 6 months from all PBG leagues.'
    },
    {
      tier: 'Level 4: Permanent Lifetime Blacklist',
      triggers: 'Injectable cheating software, match fixing or bribery, toxic harassment/doxxing, multi-account evasion of existing bans.',
      consequence: 'Permanent lifetime ban across all PBG leagues, Discord server expulsion, and notification shared with partner Asian esports federations.'
    }
  ];

  return (
    <div className="space-y-10 pb-12 max-w-5xl mx-auto">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>COMPETITIVE INTEGRITY</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#FF5757] font-black">ZERO-TOLERANCE POLICY</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          FAIR PLAY &amp; INTEGRITY CODE
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-3xl leading-relaxed">
          The foundation of Purple Bean Gaming is fair competition. We operate automated telemetry audits and dedicated human referee desks to protect every player's competitive experience.
        </p>
      </section>

      {/* Rules Grid */}
      <section className="space-y-4">
        <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
          Core Fair Play Tenets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule, idx) => {
            const Icon = rule.icon;
            return (
              <div 
                key={idx}
                className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-[#FFE600] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 border border-black bg-stone-100 text-black">
                    {rule.severity}
                  </span>
                </div>
                <h3 className="font-sans font-black text-lg text-black dark:text-white uppercase">
                  {rule.title}
                </h3>
                <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  {rule.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Disqualification & Penalty Ladder */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-black text-[#FF5757] uppercase">
            <Scale className="w-4 h-4" />
            <span>DISCIPLINARY PROCEDURES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-black dark:text-white font-sans">
            Penalty Escalation Ladder
          </h2>
          <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-3xl">
            Violations are categorized transparently so participants know exactly what standards apply. All rulings undergo two-referee concurrence before execution.
          </p>
        </div>

        <div className="space-y-4">
          {penaltyLadder.map((p, i) => (
            <div 
              key={i}
              className="border-2 border-black p-4 bg-stone-50 dark:bg-stone-900 space-y-1.5 font-mono"
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-black dark:text-white uppercase font-sans">
                  {p.tier}
                </span>
              </div>
              <div className="text-xs text-stone-700 dark:text-stone-300">
                <strong className="text-black dark:text-white">Trigger:</strong> {p.triggers}
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-400">
                <strong className="text-black dark:text-white">Enforcement:</strong> {p.consequence}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Report Smurf or Cheater CTA */}
      <section className="bg-[#FFE600] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-6 font-mono">
        <div className="space-y-1 text-black">
          <div className="flex items-center gap-2 text-xs font-black uppercase">
            <ShieldAlert className="w-4 h-4" />
            <span>SUSPICIOUS ACTIVITY?</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black uppercase font-sans tracking-tight">
            Report a Suspected Smurf or Rule Violation
          </h3>
          <p className="text-xs sm:text-sm text-stone-900 max-w-xl">
            Our referee team evaluates every report confidentially. Help us maintain the highest standard of competitive integrity.
          </p>
        </div>
        <button
          onClick={() => onNavigate('support')}
          className="px-6 py-3 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer shrink-0"
        >
          Submit Fair Play Report →
        </button>
      </section>
    </div>
  );
}
