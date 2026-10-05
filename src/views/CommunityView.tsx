import { useState } from 'react';
import { MessageSquare, Users, Calendar, Swords, Sparkles, ExternalLink, ShieldCheck, Flame, Radio, Plus, CheckCircle2 } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface CommunityViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister?: () => void;
}

export function CommunityView({ onNavigate, onOpenRegister }: CommunityViewProps) {
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [lftEntries, setLftEntries] = useState([
    {
      id: 'lft-1',
      ign: 'VortexSniper',
      pbgId: 'PBG-000188',
      role: 'Position 1 — Carry',
      mmr: 4850,
      region: 'Bengaluru / South India',
      heroes: ['Anti-Mage', 'Juggernaut', 'Slark'],
      bio: 'Looking for a competitive 5-man stack for upcoming weekend cups. Solid map awareness and available all evenings.',
      discord: 'vortex#8291',
      postedAgo: '2h ago'
    },
    {
      id: 'lft-2',
      ign: 'InvokerGod_IN',
      pbgId: 'PBG-000192',
      role: 'Position 2 — Mid',
      mmr: 5400,
      region: 'Mumbai / West India',
      heroes: ['Invoker', 'Storm Spirit', 'Puck'],
      bio: 'Ex-collegiate mid laner looking for serious captain looking to push into top 4. Can shotcall mid-game tempo.',
      discord: 'invokergod#1102',
      postedAgo: '5h ago'
    },
    {
      id: 'lft-3',
      ign: 'BlinkDaggerDk',
      pbgId: 'PBG-000204',
      role: 'Position 3 — Offlane',
      mmr: 4620,
      region: 'Delhi / North India',
      heroes: ['Centaur Warrunner', 'Axe', 'Slardar'],
      bio: 'Aggressive initiator seeking team for the Indian Masters qualifier. Punctual and voice-chat active.',
      discord: 'blinkdk#4491',
      postedAgo: '1d ago'
    },
    {
      id: 'lft-4',
      ign: 'OracleMain26',
      pbgId: 'PBG-000215',
      role: 'Position 5 — Hard Support',
      mmr: 5100,
      region: 'Pune / West India',
      heroes: ['Oracle', 'Bane', 'Disruptor'],
      bio: 'Dedicated Pos 5 warder, smoke caller, and lane baby-sitter. Looking for stable stack with good vibes.',
      discord: 'oracle#9910',
      postedAgo: '1d ago'
    }
  ]);

  const communityEvents = [
    {
      title: 'Saturday Night In-House Inhouse Brawls',
      date: 'Every Saturday · 9:00 PM IST',
      format: 'In-House 5v5 · Custom Draft',
      desc: 'Weekly community custom games with randomized captains and live spectator casting in the PBG Discord.',
      icon: Swords
    },
    {
      title: '1v1 Shadow Fiend Mid Decider',
      date: 'Bi-Weekly Friday · 8:30 PM IST',
      format: 'Single Elimination 1v1',
      desc: 'Pure mechanical showdown on the classic 1v1 mid lane. Winner earns the "Mid Demon" custom Discord role.',
      icon: Flame
    },
    {
      title: 'Casual Ability Draft & Turbo Nights',
      date: 'Every Tuesday · 8:00 PM IST',
      format: 'Fun & Casual Scrims',
      desc: 'Unwind from ranked stress with chaotic 5v5 Ability Draft lobbies and Turbo speed-runs with fellow members.',
      icon: Sparkles
    }
  ];

  const filteredLft = roleFilter === 'all' 
    ? lftEntries 
    : lftEntries.filter(entry => entry.role.toLowerCase().includes(roleFilter.toLowerCase()));

  return (
    <div className="space-y-10 pb-12 max-w-6xl mx-auto">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>COMMUNITY HUB</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#5865F2] font-black">DISCORD &amp; LOBBIES</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          THE PBG COMMUNITY ECOSYSTEM
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-3xl leading-relaxed">
          Connect with over 1,200 verified competitive players, find teammates for upcoming tournaments, attend weekly in-house scrims, and participate in lively strategy discussions.
        </p>
      </section>

      {/* Discord Hero Section */}
      <section className="bg-[#5865F2] text-white border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 font-mono">
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-2 text-[#FFE600] font-black text-xs uppercase">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>OFFICIAL DISCORD GUILD · ONLINE 24/7</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black uppercase font-sans tracking-tight text-white leading-tight">
            Join the Heart of Indian Esports
          </h2>
          <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
            Our Discord server features automated tournament role sync, captain draft voice rooms, referee ticket channels, in-house scrim matchmaking, and live broadcast notifications.
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-bold pt-1">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#70FFAF]" /> Verified Player Roles</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#70FFAF]" /> Automated Match Rooms</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#70FFAF]" /> Active Referee Desk</span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <a
            href="https://discord.gg/w8h6Jv8wsq"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-6 py-3.5 bg-[#FFE600] hover:bg-[#FFDE59] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform hover:-translate-y-0.5"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Join Purple Bean Discord</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>
        </div>
      </section>

      {/* Community Events */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
            Weekly Community Events
          </h2>
          <span className="font-mono text-xs text-stone-500 font-bold uppercase">
            OPEN TO ALL MEMBERS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {communityEvents.map((evt, idx) => {
            const Icon = evt.icon;
            return (
              <div 
                key={idx}
                className="bg-white dark:bg-[#141222] border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-3 font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-[#FFE600] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-stone-500">
                    {evt.format}
                  </span>
                </div>
                <h3 className="font-sans font-black text-lg text-black dark:text-white uppercase leading-tight">
                  {evt.title}
                </h3>
                <div className="text-xs text-[#7C3AED] font-black">
                  {evt.date}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  {evt.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Looking For Team (LFT / LFP) Free Agent Board */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
          <div>
            <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
              Looking for Team (LFT) Board
            </h2>
            <p className="font-mono text-xs text-stone-500 mt-0.5">
              Solo free agents seeking rosters for upcoming tournaments and scrims
            </p>
          </div>

          {/* Role Filters */}
          <div className="flex flex-wrap gap-1.5 font-mono text-xs">
            {['all', 'Carry', 'Mid', 'Offlane', 'Support'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 font-black uppercase border-2 border-black transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                {r === 'all' ? 'All Roles' : r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLft.map((entry) => (
            <div 
              key={entry.id}
              className="bg-white dark:bg-[#141222] border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-3 font-mono"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-black text-lg text-black dark:text-white uppercase">
                      {entry.ign}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#7C3AED]">
                      {entry.pbgId}
                    </span>
                  </div>
                  <span className="text-xs text-stone-500 block">
                    {entry.region} · {entry.postedAgo}
                  </span>
                </div>
                <span className="bg-[#FFE600] text-black border border-black font-black text-xs px-2 py-0.5 shadow-[1px_1px_0px_0px_#000]">
                  {entry.mmr} MMR
                </span>
              </div>

              <div className="text-xs font-bold text-stone-700 dark:text-stone-300">
                <span className="text-[#7C3AED] font-black">{entry.role}</span>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                "{entry.bio}"
              </p>

              <div className="pt-2 border-t border-dashed border-stone-300 dark:border-stone-800 flex items-center justify-between text-xs">
                <div className="text-[11px] text-stone-500">
                  <span>Heroes: {entry.heroes.join(', ')}</span>
                </div>
                <span className="font-bold text-black dark:text-stone-200 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 border border-black text-[10px]">
                  Discord: {entry.discord}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tournament Discussions / Community Banner */}
      <section className="bg-[#FFFDEB] border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-6 font-mono">
        <div className="space-y-1">
          <span className="font-mono text-xs font-black uppercase text-[#7C3AED]">NEED A SQUAD TONIGHT?</span>
          <h3 className="font-sans font-black text-xl sm:text-2xl text-black uppercase">
            Post in the #looking-for-team Channel
          </h3>
          <p className="text-xs sm:text-sm text-stone-700 max-w-xl">
            Drop your PBG ID and hero pool in the Discord LFT channel to connect directly with captains preparing for next week's auction.
          </p>
        </div>
        <a
          href="https://discord.gg/w8h6Jv8wsq"
          target="_blank"
          rel="noreferrer"
          className="px-5 py-2.5 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer shrink-0 flex items-center gap-1.5"
        >
          <span>Open Discord Channels</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>
    </div>
  );
}
