import { Shield, Lock, Eye, FileText, ArrowRight } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface PrivacyViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function PrivacyView({ onNavigate }: PrivacyViewProps) {
  const sections = [
    {
      num: '1',
      title: 'Information We Collect',
      content: 'When you interact with PurpleBeanGaming, we collect specific data points necessary to authenticate you, verify competitive integrity, and facilitate tournaments: (a) Google Account information (email, full name, avatar URL, Google UID); (b) Steam & Dota 2 data (64-bit Steam ID, 32-bit Dota Account ID, matchmaking rating tier, public match history from OpenDota); (c) Discord identity (Snowflake user ID, username, guild membership status); and (d) Operational telemetry (IP addresses, match timestamps, referee audit logs).'
    },
    {
      num: '2',
      title: 'How We Use Your Data',
      content: 'Your data is strictly utilized for esports platform operations: (a) Generating your immutable PBG Player ID; (b) Verifying your Dota 2 MMR to enforce tournament tier brackets; (c) Synchronizing official Discord tournament roles and private team chat lobbies; (d) Facilitating live credit purse auction drafts; and (e) Reviewing match replays in case of disputed results or smurfing allegations.'
    },
    {
      num: '3',
      title: 'Third-Party Data Processors',
      content: 'We interface with trusted third-party platforms to provide our services: (a) Google Firebase for secure user authentication and Firestore database hosting; (b) Valve Corporation for Steam OpenID login; (c) OpenDota for public Dota 2 API telemetry; and (d) Discord Inc. for guild member verification. We do not sell, rent, or trade your personal information to third-party advertisers.'
    },
    {
      num: '4',
      title: 'Data Storage & Security Measures',
      content: 'All participant records are stored within Google Cloud Platform encrypted databases adhering to industry standard AES-256 encryption at rest and TLS 1.3 in transit. Financial banking details for prize payouts are processed directly via secure payment gateways and are never stored on PBG servers.'
    },
    {
      num: '5',
      title: 'Your Privacy Rights & Account Erasure',
      content: 'You retain the right to access your stored data, request corrections, or request account erasure. Note that while personal identifiers (email, name) can be anonymized upon request, historical tournament match outcomes, scoreboards, and PBG IDs remain in the public ledger to preserve competitive records.'
    },
    {
      num: '6',
      title: 'Updates & Privacy Contact',
      content: 'We may periodically update this Privacy Policy to reflect platform features. Material changes will be announced via the PBG Discord and on our website. For inquiries, email privacy@purplebeangaming.com.'
    }
  ];

  return (
    <div className="space-y-10 pb-12 max-w-4xl mx-auto font-mono">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-500 uppercase">
          <span>LEGAL</span>
          <span aria-hidden="true">·</span>
          <span>PRIVACY POLICY</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">GDPR &amp; DPDP COMPLIANT</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          PRIVACY POLICY
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-2xl">
          Learn how PurpleBeanGaming protects your personal identity, Steam match telemetry, and Discord account links.
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
            Inquiries: privacy@purplebeangaming.com
          </span>
          <button
            onClick={() => onNavigate('contact')}
            className="px-4 py-2 bg-black text-white hover:bg-stone-800 text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            Contact Privacy Officer →
          </button>
        </div>
      </div>
    </div>
  );
}
