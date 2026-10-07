import React from 'react';
import { AuctionReport } from './AuctionReport';

interface DraftReplayViewerProps {
  tournamentId?: string;
  onNavigate?: (view: any, entityId?: string) => void;
}

export const DraftReplayViewer: React.FC<DraftReplayViewerProps> = ({ 
  tournamentId = 'pb-game-dota2-1791361091142',
  onNavigate
}) => {
  return (
    <AuctionReport tournamentId={tournamentId} onNavigate={onNavigate} />
  );
};
