import React from 'react';
import { Users, CheckCircle, Shield } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';

interface OrganiserRegistrationReviewProps {
  tournamentId?: string;
  tournamentName?: string;
  config?: any;
}

export const OrganiserRegistrationReview: React.FC<OrganiserRegistrationReviewProps> = ({ tournamentId, config }) => {
  const registrations = tournamentService.getTournamentRegistrations(tournamentId || '');

  return (
    <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] font-mono space-y-4">
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#7C3AED]" />
          <h3 className="font-sans font-black text-lg uppercase">Organiser Registration Review</h3>
        </div>
        <span className="text-xs bg-[#EDE9FE] text-[#7C3AED] px-2 py-0.5 border border-black font-bold uppercase">
          {registrations.length} Contenders
        </span>
      </div>
      <p className="text-xs text-stone-600">
        Review contenders, verify rank certificates and lock Tournament MMRs for auction eligibility.
      </p>
      {registrations.length === 0 ? (
        <div className="p-6 border-2 border-dashed border-stone-300 text-center text-xs text-stone-500 italic">
          No pending player registrations awaiting review.
        </div>
      ) : (
        <div className="space-y-2">
          {registrations.map(r => (
            <div key={r.userId} className="border-2 border-black p-3 bg-stone-50 flex justify-between items-center text-xs">
              <span className="font-bold">{r.ign} ({r.primaryRole})</span>
              <span className="font-black text-[#7C3AED]">{r.tournamentMmr || r.declaredMmr} MMR</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
