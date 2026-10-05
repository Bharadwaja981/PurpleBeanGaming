import { Shield, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface TermsViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function TermsView({ onNavigate }: TermsViewProps) {
  const sections = [
    {
      num: '1',
      title: 'Acceptance of Terms',
      content: 'By creating an account, linking a Steam/Dota 2 profile, or participating in any tournament, league, auction, or match operated by PurpleBeanGaming ("PBG", "we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use our platform or register for tournaments.'
    },
    {
      num: '2',
      title: 'Account Registration & PBG ID Ownership',
      content: 'Each user is permitted exactly one (1) PBG account tied to their verified Google OAuth identity. Users receive a permanent PBG ID (e.g. PBG-000184). Account sharing, selling, transferring, or generating alternate identities ("multi-accounting") is strictly prohibited and constitutes grounds for immediate lifetime blacklisting.'
    },
    {
      num: '3',
      title: 'Steam & Dota 2 Account Verification',
      content: 'To participate in competitive circuits, you must authenticate through Valve Corporation’s Steam OpenID gateway and maintain the "Expose Public Match Data" setting in your Dota 2 client. PBG uses OpenDota and Steam APIs to verify your Matchmaking Rating (MMR), rank medal, and match history. Submitting alternate accounts or concealing higher calibrated MMR tiers violates Section 7.'
    },
    {
      num: '4',
      title: 'Tournament Rules & Auction Protocol',
      content: 'Tournament participation is governed by specific rulesets published on each tournament detail page. In Auction Draft formats, appointed captains wield authoritative credit purse budgets. All drafted rosters are binding once the draft session concludes. Players who withdraw after auction completion without verified emergencies are subject to disciplinary review.'
    },
    {
      num: '5',
      title: 'Prize Pool Distributions & Currency',
      content: 'All prize pools are denominated in Indian Rupees (INR) unless expressly stated otherwise. Payouts are made directly to verified Indian bank accounts or UPI VPA IDs within 72 hours following Grand Final result certification. Winners are solely responsible for all statutory tax liabilities (including applicable TDS under Indian Income Tax Act regulations).'
    },
    {
      num: '6',
      title: 'Broadcast, Replay & Spectator Rights',
      content: 'By participating in PBG tournaments, you grant PBG the non-exclusive, irrevocable, worldwide right to broadcast, stream, record, and produce content from in-game replays, match scoreboards, player gamer tags, and match voice communications for tournament spectating and media promotion.'
    },
    {
      num: '7',
      title: 'Anti-Cheat, Smurfing & Disciplinary Authority',
      content: 'PBG maintains a zero-tolerance policy against hacking, scripting, macro-assisted inputs, map hacks, smurfing, and match fixing. Referees possess sole and final authority to evaluate match telemetry, forfeit games, disqualify teams, and confiscate purse points in accordance with the PBG Fair Play Code.'
    },
    {
      num: '8',
      title: 'Limitation of Liability & Jurisdiction',
      content: 'PurpleBeanGaming operates on an "as is" and "as available" basis. We are not liable for match disruptions arising from Valve network downtime, internet service provider outages, power cuts, or hardware failures. These terms are governed by the laws of India, and any disputes shall be subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka.'
    }
  ];

  return (
    <div className="space-y-10 pb-12 max-w-4xl mx-auto font-mono">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-500 uppercase">
          <span>LEGAL</span>
          <span aria-hidden="true">·</span>
          <span>TERMS OF SERVICE</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">LAST REVISED: OCTOBER 2026</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          TERMS OF SERVICE
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-2xl">
          Please read these Terms of Service carefully before competing in PurpleBeanGaming leagues or using our digital tournament platform.
        </p>
      </section>

      {/* Content */}
      <div className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_#000] space-y-8">
        {sections.map((sec) => (
          <div key={sec.num} className="space-y-2 border-b-2 border-stone-200 dark:border-stone-800 pb-6 last:border-b-0 last:pb-0">
            <h2 className="text-lg sm:text-xl font-black uppercase text-black dark:text-white font-sans">
              {sec.num}. {sec.title}
            </h2>
            <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
              {sec.content}
            </p>
          </div>
        ))}

        <div className="pt-4 border-t-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <span className="text-stone-500">
            Questions regarding these Terms? Contact legal@purplebeangaming.com
          </span>
          <button
            onClick={() => onNavigate('contact')}
            className="px-4 py-2 bg-black text-white hover:bg-stone-800 text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            Contact Legal Team →
          </button>
        </div>
      </div>
    </div>
  );
}
