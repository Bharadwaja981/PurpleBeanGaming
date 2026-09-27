import React, { useState } from 'react';
import { 
  Radio, 
  Plus, 
  Send, 
  CheckCircle, 
  Clock, 
  Users, 
  Shield, 
  Globe, 
  AlertTriangle 
} from 'lucide-react';
import { 
  dotaTournamentOperations, 
  TournamentAnnouncement, 
  AnnouncementAudience, 
  AnnouncementType 
} from '../domain/dotaTournamentOperationsEngine';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';

interface AnnouncementsManagerProps {
  tournamentId: string;
}

export const AnnouncementsManager: React.FC<AnnouncementsManagerProps> = ({ tournamentId }) => {
  const [announcements, setAnnouncements] = useState<TournamentAnnouncement[]>(() => 
    dotaTournamentOperations.getAnnouncements(tournamentId, {
      userId: 'admin',
      email: 'admin@purplebeangaming.com',
      role: 'organizer',
      isAdmin: true
    })
  );
  const [isPosting, setIsPosting] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<AnnouncementType>('general');
  const [audience, setAudience] = useState<AnnouncementAudience>('PUBLIC');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    const curUser = tournamentService.getCurrentUser();
    const caller = {
      userId: curUser.id,
      email: curUser.email,
      role: (curUser.role || 'organizer') as any,
      isAdmin: Boolean(curUser.isAdmin)
    };

    const res = dotaTournamentOperations.postAnnouncement(
      {
        tournamentId,
        title,
        content,
        type,
        audience,
        authorId: curUser.id,
        authorName: curUser.displayName || 'Tournament Director'
      },
      caller
    );

    if (res.success) {
      setAnnouncements(dotaTournamentOperations.getAnnouncements(tournamentId, caller));
      setIsPosting(false);
      setTitle('');
      setContent('');
      setFeedback('Announcement broadcasted and participants notified!');
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback(`Error: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-600 animate-pulse" />
            <h3 className="font-black text-sm uppercase text-black font-sans">
              TOURNAMENT BROADCAST &amp; ANNOUNCEMENTS
            </h3>
          </div>
          <p className="text-stone-600 text-[11px] mt-0.5">
            Broadcast emergency alerts, schedule delays, and captain draft instructions across notification channels.
          </p>
        </div>

        <button
          onClick={() => setIsPosting(!isPosting)}
          className="px-3.5 py-1.5 bg-[#FF5757] text-white border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-red-600 cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isPosting ? 'Cancel' : 'Post Announcement'}</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-[#70FFAF] border-2 border-black text-black font-bold">
          {feedback}
        </div>
      )}

      {isPosting && (
        <form onSubmit={handlePost} className="bg-white border-[3px] border-black p-5 shadow-[5px_5px_0px_0px_#000] space-y-4">
          <span className="font-black text-sm uppercase text-black block border-b-2 border-black pb-2">
            Compose Official Dispatch
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-black uppercase text-[10px] block mb-1">Headline:</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Server Maintenance: AWS Mumbai"
                className="w-full p-2 bg-stone-50 border-2 border-black text-xs font-mono"
              />
            </div>

            <div>
              <SelectDropdown
                label="Category:"
                value={type}
                onChange={val => setType(val as AnnouncementType)}
                options={[
                  { value: 'general', label: 'General Notice' },
                  { value: 'schedule_change', label: 'Schedule Change / Delay' },
                  { value: 'registration_update', label: 'Registration Update' },
                  { value: 'auction_update', label: 'Auction / Draft Protocol' },
                  { value: 'rules_update', label: 'Rulebook Amendment' },
                  { value: 'urgent_notice', label: 'Urgent Match Advisory' }
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <SelectDropdown
                label="Target Audience:"
                value={audience}
                onChange={val => setAudience(val as AnnouncementAudience)}
                options={[
                  { value: 'PUBLIC', label: 'Public & Spectators (Global)' },
                  { value: 'ALL_PARTICIPANTS', label: 'All Registered Competitors' },
                  { value: 'CAPTAINS', label: 'Team Captains Only' },
                  { value: 'SPECIFIC_TEAM', label: 'Target Team Only' }
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-black uppercase text-[10px] block mb-1">Dispatch Content:</label>
            <textarea
              required
              rows={3}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="State the authoritative announcement details clearly..."
              className="w-full p-2 bg-stone-50 border-2 border-black text-xs font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-black text-[#FFE600] font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:bg-stone-800 cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Dispatch</span>
            </button>
          </div>
        </form>
      )}

      {/* Announcements Stream */}
      <div className="space-y-3">
        {announcements.map(ann => (
          <div key={ann.id} className="p-4 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase text-black">{ann.title}</span>
                <span className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase ${
                  ann.audience === 'CAPTAINS' ? 'bg-[#FFE600] text-black' :
                  ann.audience === 'PUBLIC' ? 'bg-[#70FFAF] text-black' :
                  'bg-[#5CE1E6] text-black'
                }`}>
                  {ann.audience}
                </span>
              </div>
              <span className="text-[10px] text-stone-500 font-bold">
                {new Date(ann.timestamp).toLocaleString()}
              </span>
            </div>

            <p className="text-stone-700 text-xs leading-relaxed whitespace-pre-line">
              {ann.content}
            </p>

            <div className="text-[10px] text-stone-500 pt-1 flex items-center justify-between">
              <span>Author: <strong className="text-black">{ann.authorName}</strong></span>
              <span className="uppercase text-stone-400 font-bold">{ann.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
