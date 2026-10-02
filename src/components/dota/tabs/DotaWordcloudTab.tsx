import React, { useState, useMemo } from 'react';
import { ChatBubbleLeftRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { OpenDotaWordcloud } from '../../../services/openDotaService';

interface DotaWordcloudTabProps {
  wordcloud: OpenDotaWordcloud | null;
  isLoading?: boolean;
}

export function DotaWordcloudTab({ wordcloud, isLoading }: DotaWordcloudTabProps) {
  const [mode, setMode] = useState<'my' | 'all'>('my');
  const [search, setSearch] = useState('');

  const activeDict = mode === 'my' 
    ? (wordcloud?.my_word_counts || {}) 
    : (wordcloud?.all_word_counts || {});

  const words = useMemo(() => {
    let list = Object.entries(activeDict).map(([word, count]) => ({ 
      word, 
      count: Number(count || 0) 
    }));
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((w) => w.word.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.count - a.count);
  }, [activeDict, search]);

  const maxCount = Math.max(...words.map((w) => w.count), 1);
  const hasWords = Object.keys(activeDict).length > 0;

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            ALL CHAT &amp; TEAM CHAT TELEMETRY (GET /players/&#123;account_id&#125;/wordcloud)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Word Cloud &amp; In-Game Vocabulary
          </h3>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 border-2 border-black text-xs font-black uppercase">
          <button
            onClick={() => setMode('my')}
            className={`px-3 py-1 cursor-pointer transition-all ${
              mode === 'my' ? 'bg-[#FFE600] text-black border border-black shadow-[1px_1px_0px_0px_#000]' : 'text-stone-700 hover:bg-white'
            }`}
          >
            Words Said (Player)
          </button>
          <button
            onClick={() => setMode('all')}
            className={`px-3 py-1 cursor-pointer transition-all ${
              mode === 'all' ? 'bg-[#FFE600] text-black border border-black shadow-[1px_1px_0px_0px_#000]' : 'text-stone-700 hover:bg-white'
            }`}
          >
            Words Read (All Chat)
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading chat word cloud from OpenDota...</p>
        </div>
      ) : !hasWords ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <ChatBubbleLeftRightIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No in-game chat data available.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota extracts word frequencies from parsed match chat logs. Unparsed match replays do not contain chat text.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-stone-600">
              {words.length} Vocabulary Tokens Indexed
            </span>

            <div className="relative w-48 sm:w-64">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Filter word..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-stone-50 border-2 border-black pl-8 pr-3 py-1 text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* Word Cloud Visualizer */}
          <div className="p-6 bg-stone-50 border-2 border-black shadow-[3px_3px_0px_0px_#000] flex flex-wrap items-center justify-center gap-3">
            {words.map(({ word, count }) => {
              const weight = count / maxCount;
              const fontSize = Math.max(12, Math.min(36, Math.round(12 + weight * 24)));
              const color = weight > 0.6 ? 'text-[#7C3AED] font-black' : weight > 0.3 ? 'text-black font-bold' : 'text-stone-600 font-semibold';

              return (
                <span
                  key={word}
                  style={{ fontSize: `${fontSize}px` }}
                  className={`px-2 py-1 bg-white border border-black/30 shadow-[1px_1px_0px_0px_#000] cursor-default hover:scale-110 transition-transform ${color}`}
                  title={`"${word}": Used ${count} times in parsed matches`}
                >
                  {word} <span className="text-[10px] text-stone-400">({count})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
