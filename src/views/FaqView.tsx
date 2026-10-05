import { useState, useMemo } from 'react';
import { Search, ChevronDown, HelpCircle, Shield, Trophy, Gavel, UserCheck, Gamepad2, Swords, MessageSquare } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface FaqViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

interface FaqItem {
  id: string;
  category: 'accounts' | 'pbg_id' | 'dota_linking' | 'tournaments' | 'auction' | 'captains' | 'matches' | 'support';
  question: string;
  answer: string;
}

export function FaqView({ onNavigate }: FaqViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>('faq-1');

  const faqs: FaqItem[] = [
    // Accounts
    {
      id: 'faq-1',
      category: 'accounts',
      question: 'How do I create a Purple Bean Gaming account?',
      answer: 'Click "Sign In" in the navigation bar and authenticate using your Google account. Your PBG account is created instantly without complex password requirements.'
    },
    {
      id: 'faq-2',
      category: 'accounts',
      question: 'Can I have multiple PBG accounts?',
      answer: 'No. PBG enforces a strict one-person-one-account policy. Each Google identity is tied to a single PBG ID and verified Steam account. Multi-accounting or alternate account registration results in permanent disqualification from all tournaments.'
    },
    // PBG ID
    {
      id: 'faq-3',
      category: 'pbg_id',
      question: 'What is a PBG ID and where do I find it?',
      answer: 'Your PBG ID is your permanent, unique tournament serial identifier (e.g., PBG-000184). It tracks your lifetime tournament career, Elo rating, match history, and trophy records across all seasons. You can find it on your Player Profile page or under your avatar in the navigation.'
    },
    {
      id: 'faq-4',
      category: 'pbg_id',
      question: 'Can my PBG ID be changed or transferred?',
      answer: 'No. PBG IDs are immutable and non-transferable to preserve tournament history integrity, anti-cheat tracking, and Elo rating accuracy.'
    },
    // Dota Linking
    {
      id: 'faq-5',
      category: 'dota_linking',
      question: 'Why do I need to link my Dota 2 / Steam account?',
      answer: 'Linking your Steam account verifies your Dota 2 32-bit Account ID and 64-bit Steam ID. This allows our backend to pull your real matchmaking rating (MMR), rank tier, and verified match data via OpenDota, ensuring balanced tournament brackets and preventing smurfs.'
    },
    {
      id: 'faq-6',
      category: 'dota_linking',
      question: 'Why does PBG say "Expose Public Match Data" is required?',
      answer: 'In Dota 2 Settings -> Social, you must check "Expose Public Match Data". Without this enabled in the Dota client, OpenDota and Valve APIs cannot verify your recent matches or MMR tier, which prevents tournament registration verification.'
    },
    // Tournaments
    {
      id: 'faq-7',
      category: 'tournaments',
      question: 'Is it free to participate in PBG tournaments?',
      answer: 'Yes! Community cups and regular seasonal circuits are 100% free to enter. High-tier invitational leagues may have qualification criteria based on PBG Elo or MMR, but never require entry fees.'
    },
    {
      id: 'faq-8',
      category: 'tournaments',
      question: 'How do prize pool payouts work in India?',
      answer: 'Prize pools are disbursed directly to winning team captains or split evenly among verified roster members via UPI or direct bank transfer within 48 to 72 hours of the Grand Final result confirmation.'
    },
    // Auction
    {
      id: 'faq-9',
      category: 'auction',
      question: 'How does the Live Purse Auction draft work?',
      answer: 'All registered solo players enter the auction pool. Appointed team captains receive equal virtual purse credits (e.g., 1,000 points). In turn order, captains nominate players to the auction block. Captains bid in increments of 25–50 credits until the 30-second timer expires. The highest bidder drafts the player to their 5-man roster.'
    },
    {
      id: 'faq-10',
      category: 'auction',
      question: 'What happens if a player is passed as "UNSOLD"?',
      answer: 'Players who receive zero bids during Round 1 are moved to the Unsold Pool. After all captains finish their initial purse allocations, an Unsold Re-Entry Round takes place at discounted base bids (e.g., 10 credits) so every team fills its mandatory 5 player roster.'
    },
    // Captains
    {
      id: 'faq-11',
      category: 'captains',
      question: 'How are captains selected for Auction Tournaments?',
      answer: 'When registering for a tournament, you can check "Interested in Captaincy". PBG tournament organizers and referees evaluate applicants based on previous PBG participation, leadership reliability, communication record, and MMR tier before appointing official captains.'
    },
    {
      id: 'faq-12',
      category: 'captains',
      question: 'What are a captain’s primary duties during match day?',
      answer: 'Captains are responsible for attending the Live Auction, coordinating team Discord voice lobbies, participating in the coin toss / server veto (e.g. Mumbai vs. Singapore), reporting final match scores, and submitting replay screenshots.'
    },
    // Matches
    {
      id: 'faq-13',
      category: 'matches',
      question: 'How are game lobbies hosted and password protected?',
      answer: 'Match lobbies are created in the Dota 2 client by designated referees or team captains using the lobby name and password posted inside the PBG Match Detail room. Matches are played under Tournament Draft rules.'
    },
    {
      id: 'faq-14',
      category: 'matches',
      question: 'What if an opponent pauses excessively or disconnects?',
      answer: 'Each team is allowed up to 10 minutes of total pause time per game for disconnects. Pauses exceeding 10 minutes require referee consent. Unsportsmanlike unpausing or tactical pauses result in game forfeits under Fair Play Section 4.'
    },
    // Support
    {
      id: 'faq-15',
      category: 'support',
      question: 'How do I submit a match dispute or report a smurf?',
      answer: 'Visit the Support page (/support) or click "Report Match / Player". Include the Match ID, Steam ID, and any relevant screenshot evidence. Referees review ticket logs within 2 hours during tournament weekends.'
    },
    {
      id: 'faq-16',
      category: 'support',
      question: 'How do I receive my Discord PBG Player or Captain roles?',
      answer: 'Link your Discord account on your profile. When you are approved for a tournament or appointed as a captain, our server bot automatically assigns the official PBG Member, PBG Player, and Captain roles in the Purple Bean Discord server.'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Questions', icon: HelpCircle },
    { id: 'accounts', label: 'Accounts', icon: UserCheck },
    { id: 'pbg_id', label: 'PBG ID', icon: Shield },
    { id: 'dota_linking', label: 'Dota Linking', icon: Gamepad2 },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'auction', label: 'Live Auction', icon: Gavel },
    { id: 'captains', label: 'Captains', icon: Shield },
    { id: 'matches', label: 'Matches', icon: Swords },
    { id: 'support', label: 'Support', icon: MessageSquare }
  ];

  const filteredFaqs = useMemo(() => {
    return faqs.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchQuery = !searchQuery.trim() || 
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [faqs, selectedCategory, searchQuery]);

  return (
    <div className="space-y-10 pb-12 max-w-5xl mx-auto">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>HELP CENTER</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">KNOWLEDGE BASE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          FREQUENTLY ASKED QUESTIONS
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
          Find instant answers to common questions regarding tournament registration, PBG IDs, OpenDota account verification, live purse auctions, and match day rules.
        </p>

        {/* Search Input */}
        <div className="pt-2 relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs (e.g. auction, MMR, steam linking, captain)..."
            className="w-full pl-11 pr-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-black font-mono text-xs sm:text-sm text-black dark:text-white placeholder:text-stone-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_#000]"
          />
        </div>
      </section>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const Icon = c.icon;
          const isSelected = selectedCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 font-mono text-xs font-black uppercase border-2 border-black transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Accordion Questions */}
      <section className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="bg-white dark:bg-[#141222] border-[3px] border-black p-8 text-center font-mono space-y-2">
            <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
              No matching questions found for "{searchQuery}".
            </p>
            <p className="text-xs text-stone-500">
              Try searching with different terms or contact our support desk directly.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-2 px-3 py-1.5 bg-black text-white text-xs font-bold uppercase border border-black cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = expandedId === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-white dark:bg-[#141222] border-[3px] border-black shadow-[3px_3px_0px_0px_#000] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-900/50"
                  aria-expanded={isExpanded}
                >
                  <span className="font-sans font-black text-base sm:text-lg uppercase text-black dark:text-white leading-tight">
                    {faq.question}
                  </span>
                  <div className={`p-1 border border-black shrink-0 transition-transform ${isExpanded ? 'rotate-180 bg-[#FFE600]' : 'bg-stone-100'}`}>
                    <ChevronDown className="w-4 h-4 text-black" />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t-2 border-dashed border-stone-200 dark:border-stone-800 font-mono text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed space-y-2">
                    <p>{faq.answer}</p>
                    <div className="pt-2 text-[11px] text-stone-500 uppercase flex items-center gap-2">
                      <span>Category: {faq.category.replace('_', ' ')}</span>
                      <span aria-hidden="true">·</span>
                      <button 
                        onClick={() => onNavigate('contact')} 
                        className="text-[#7C3AED] hover:underline font-bold"
                      >
                        Ask follow-up question →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Still need help CTA */}
      <section className="bg-[#F3E8FF] border-[3.5px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono">
        <div className="space-y-1">
          <h3 className="font-sans font-black text-xl text-black uppercase">
            Can't find the answer you need?
          </h3>
          <p className="text-xs text-stone-700">
            Submit a support ticket or join the Purple Bean Discord community for live assistance from staff referees.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('support')}
            className="px-4 py-2 bg-black text-white hover:bg-stone-800 text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            Open Support Desk
          </button>
          <button
            onClick={() => onNavigate('community')}
            className="px-4 py-2 bg-[#FFE600] text-black hover:bg-[#FFDE59] text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            Discord Live Chat
          </button>
        </div>
      </section>
    </div>
  );
}
