import React, { useState, useEffect, useRef } from 'react';
import { Send, Flame, Sparkles, MessageSquare, Shield, Trophy, Users, Heart, Crown } from 'lucide-react';
import { Match } from '../../types/tournament';
import { tournamentService } from '../../services/firebaseService';

interface ChatMessage {
  id: string;
  sender: string;
  role: 'caster' | 'admin' | 'referee' | 'fan' | 'captain';
  teamAffiliation?: 'A' | 'B';
  message: string;
  timestamp: string;
}

interface LiveMatchChatPanelProps {
  match: Match;
  isOrganizer: boolean;
}

export function LiveMatchChatPanel({ match, isOrganizer }: LiveMatchChatPanelProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'official'>('all');
  const [inputText, setInputText] = useState('');
  const [reactions, setReactions] = useState<{ [key: string]: number }>({
    '🔥': 142,
    '👑': 88,
    '⚡': 94,
    '🛡️': 65,
    '🇮🇳': 210,
    '⚔️': 120
  });
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const currentUser = tournamentService.getCurrentUser();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'PBG Observer',
      role: 'admin',
      message: `Welcome to the official broadcast of ${match.teamA.name} vs ${match.teamB.name}!`,
      timestamp: '14:00'
    },
    {
      id: 'm2',
      sender: 'Synderen (Caster)',
      role: 'caster',
      message: 'Draft completed! Aggressive early tri-lane strategy from Team A.',
      timestamp: '14:02'
    },
    {
      id: 'm3',
      sender: 'Rohan_Gamer',
      role: 'fan',
      teamAffiliation: 'A',
      message: `${match.teamA.name} taking this 2-0 easily! Let's go! 🔥`,
      timestamp: '14:05'
    },
    {
      id: 'm4',
      sender: 'DelhiDotaPro',
      role: 'fan',
      teamAffiliation: 'B',
      message: `Don't underestimate ${match.teamB.name}'s late game teamfight!`,
      timestamp: '14:08'
    },
    {
      id: 'm5',
      sender: 'Official Referee',
      role: 'referee',
      message: 'Lobby ping verified: 12ms Mumbai Server. Both rosters ready.',
      timestamp: '14:10'
    }
  ]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Periodic incoming fan messages to keep the arena buzzing
  useEffect(() => {
    const crowdMessages = [
      `Huge teamfight coming up at the river! 💥`,
      `That black hole setup was unbelievable!! 😱`,
      `${match.teamA.name} carry is completely free farming right now`,
      `GG in the chat? Not yet, defense is holding! 🛡️`,
      `Indian Dota on the top level right now 🇮🇳🇮🇳`,
      `Best of 3 series delivering pure hype!`
    ];

    const interval = setInterval(() => {
      const randomMsg = crowdMessages[Math.floor(Math.random() * crowdMessages.length)];
      const randomSender = ['Kavya_Carry', 'Aditya_Mid', 'Vikram_Dota', 'Arjun_Offlane', 'Sneha_Support'][Math.floor(Math.random() * 5)];
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      setMessages(prev => [
        ...prev.slice(-30), // keep last 30
        {
          id: `msg-${Date.now()}`,
          sender: randomSender,
          role: 'fan',
          teamAffiliation: Math.random() > 0.5 ? 'A' : 'B',
          message: randomMsg,
          timestamp: timeStr
        }
      ]);
    }, 12000);

    return () => clearInterval(interval);
  }, [match.teamA.name, match.teamB.name]);

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const userName = currentUser.displayName || currentUser.ign || currentUser.email?.split('@')[0] || 'Esports Fan';
    const newMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: userName,
      role: isOrganizer ? 'admin' : 'fan',
      message: inputText.trim(),
      timestamp: timeStr
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
  };

  // Trigger floating reaction emoji
  const handleReaction = (emoji: string) => {
    setReactions(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));

    const newId = Date.now() + Math.random();
    const randomX = Math.floor(Math.random() * 80) + 10;
    setFloatingReactions(prev => [...prev, { id: newId, emoji, x: randomX }]);

    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== newId));
    }, 1800);
  };

  const filteredMessages = filterMode === 'official' 
    ? messages.filter(m => m.role === 'admin' || m.role === 'caster' || m.role === 'referee')
    : messages;

  return (
    <div className="relative bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] flex flex-col h-full min-h-[480px] max-h-[640px] overflow-hidden">
      
      {/* Header */}
      <div className="bg-[#FFE600] border-b-2 border-black p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-black" />
          <h4 className="font-sans font-black text-sm uppercase text-black">
            STREAM CHAT &amp; DESK
          </h4>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-1 bg-white border border-black p-0.5 font-mono text-[10px]">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2 py-0.5 font-bold cursor-pointer transition-colors ${
              filterMode === 'all' ? 'bg-black text-white' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            ALL CHAT
          </button>
          <button
            onClick={() => setFilterMode('official')}
            className={`px-2 py-0.5 font-bold cursor-pointer transition-colors ${
              filterMode === 'official' ? 'bg-[#7C3AED] text-white' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            OFFICIAL
          </button>
        </div>
      </div>

      {/* Floating Reactions Container */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-16 text-2xl animate-float-up pointer-events-none"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Chat Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs bg-[#FAF8F5]">
        {filteredMessages.map(msg => (
          <div key={msg.id} className="p-2 bg-white border border-black shadow-[2px_2px_0px_0px_#000] space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Role Badge */}
                {msg.role === 'admin' ? (
                  <span className="px-1.5 py-0.2 bg-[#FF5757] text-white font-black uppercase text-[9px] border border-black">
                    ADMIN
                  </span>
                ) : msg.role === 'caster' ? (
                  <span className="px-1.5 py-0.2 bg-[#7C3AED] text-white font-black uppercase text-[9px] border border-black">
                    CASTER
                  </span>
                ) : msg.role === 'referee' ? (
                  <span className="px-1.5 py-0.2 bg-[#5CE1E6] text-black font-black uppercase text-[9px] border border-black">
                    REFEREE
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-stone-100 text-stone-700 font-bold uppercase text-[9px] border border-stone-300">
                    FAN
                  </span>
                )}

                <span className="font-black text-black">
                  {msg.sender}
                </span>

                {msg.teamAffiliation && (
                  <span className={`text-[9px] font-bold px-1 rounded ${
                    msg.teamAffiliation === 'A' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                  }`}>
                    [{msg.teamAffiliation === 'A' ? match.teamA.tag : match.teamB.tag}]
                  </span>
                )}
              </div>

              <span className="text-stone-400 text-[10px]">{msg.timestamp}</span>
            </div>

            <p className="text-stone-800 font-medium break-words leading-snug">
              {msg.message}
            </p>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Quick Emoji Cheers Bar */}
      <div className="bg-stone-100 border-t-2 border-black px-2 py-1.5 flex items-center justify-between gap-1 shrink-0 overflow-x-auto">
        <span className="text-[10px] font-mono font-bold text-stone-500 uppercase shrink-0 pl-1">
          CHEER:
        </span>
        <div className="flex items-center gap-1">
          {Object.entries(reactions).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="px-1.5 py-0.5 bg-white hover:bg-stone-200 border border-black text-xs font-mono flex items-center gap-1 cursor-pointer transition-transform active:scale-90 shadow-[1px_1px_0px_0px_#000]"
              title={`React ${emoji}`}
            >
              <span>{emoji}</span>
              <span className="text-[9px] font-bold text-stone-600">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="bg-white border-t-2 border-black p-2 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Chat as ${currentUser.displayName || currentUser.ign || 'Esports Fan'}...`}
          className="flex-1 border-2 border-black px-2.5 py-1.5 font-mono text-xs bg-[#FAF8F5] focus:outline-none focus:bg-white"
          maxLength={140}
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-3 py-1.5 bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-40 transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
