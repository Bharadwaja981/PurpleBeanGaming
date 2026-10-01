import { Bell, CheckCheck, X, Trophy, Swords, Gavel, AlertCircle, Crown, FileText, ArrowRight } from 'lucide-react';
import { NotificationItem, ViewType } from '../types/tournament';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onMarkAsRead?: (id: string) => void;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onNavigate
}: NotificationsModalProps) {
  if (!isOpen) return null;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'CAPTAIN_SELECTED':
      case 'captain':
        return <Crown className="w-4 h-4 text-[#7C3AED]" />;
      case 'registration':
      case 'EVIDENCE_REQUESTED':
        return <Trophy className="w-4 h-4 text-emerald-600" />;
      case 'match':
      case 'MATCH_SCHEDULED':
      case 'RESULT_CONFIRMATION_REQUIRED':
        return <Swords className="w-4 h-4 text-blue-600" />;
      case 'auction':
      case 'AUCTION_STARTING':
        return <Gavel className="w-4 h-4 text-pink-600" />;
      case 'TOURNAMENT_ANNOUNCEMENT':
      case 'system':
        return <FileText className="w-4 h-4 text-amber-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    // 1. Mark as read
    if (onMarkAsRead) {
      onMarkAsRead(item.id);
    }

    // 2. Navigate to authoritative destination based on notification type / actionTarget
    if (item.actionTarget) {
      onNavigate(item.actionTarget.view, item.actionTarget.entityId);
      onClose();
      return;
    }

    // Fallback destinations per specification:
    // CAPTAIN_SELECTED -> tournament captain/team section or auction
    // MATCH_SCHEDULED -> match page
    // EVIDENCE_REQUESTED -> tournament registration/evidence page
    // AUCTION_STARTING -> /tournaments/{tournamentId}/auction
    // RESULT_CONFIRMATION_REQUIRED -> relevant match page
    // TOURNAMENT_ANNOUNCEMENT -> tournament detail page
    const tId = item.tournamentId || 'auction-basic-test-1';

    switch (item.type) {
      case 'CAPTAIN_SELECTED':
      case 'captain':
        onNavigate('auction', tId);
        break;
      case 'AUCTION_STARTING':
      case 'auction':
        onNavigate('auction', tId);
        break;
      case 'MATCH_SCHEDULED':
      case 'RESULT_CONFIRMATION_REQUIRED':
      case 'match':
        onNavigate('match_detail', 'm-live-1');
        break;
      case 'EVIDENCE_REQUESTED':
      case 'TOURNAMENT_ANNOUNCEMENT':
      case 'registration':
      default:
        onNavigate('tournament_detail', tId);
        break;
    }
    onClose();
  };

  const getActionLabel = (item: NotificationItem): string => {
    if (item.linkText) return item.linkText;
    switch (item.type) {
      case 'CAPTAIN_SELECTED':
      case 'captain':
        return 'Enter Auction Room ↗';
      case 'AUCTION_STARTING':
      case 'auction':
        return 'Join Live Auction Lobby →';
      case 'MATCH_SCHEDULED':
        return 'Go to Match Room →';
      case 'RESULT_CONFIRMATION_REQUIRED':
        return 'Confirm Match Results →';
      case 'EVIDENCE_REQUESTED':
        return 'Submit Evidence / Review →';
      case 'TOURNAMENT_ANNOUNCEMENT':
        return 'View Tournament Announcement →';
      default:
        return 'View Details →';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:justify-end p-3 sm:p-6 pt-16 sm:pt-20 bg-black/40 backdrop-blur-xs">
      <div 
        className="w-full max-w-md max-h-[85vh] flex flex-col bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FFDE59] border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between font-mono text-xs font-black shrink-0">
          <div className="flex items-center gap-2 text-black">
            <Bell className="w-4 h-4" />
            <span>TOURNAMENT ALERTS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllAsRead}
              className="text-[10px] bg-white border border-black px-1.5 py-0.5 hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono font-bold"
              title="Mark all as read"
            >
              <CheckCheck className="w-3 h-3" />
              <span>READ ALL</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-black hover:text-white border border-black transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[70vh] overflow-y-auto divide-y-2 divide-black font-mono text-xs">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-stone-500">
              No notifications at this time.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3.5 transition-colors cursor-pointer hover:bg-[#FFF9E6] ${
                  item.unread ? 'bg-[#FFFBEB] border-l-4 border-l-[#7C3AED]' : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-white border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-black">{item.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.unread && (
                          <span className="w-2 h-2 rounded-full bg-[#7C3AED]" title="Unread" />
                        )}
                        <span className="text-[10px] text-stone-500">{item.timestamp}</span>
                      </div>
                    </div>
                    <p className="text-stone-700 text-[11px] leading-relaxed">
                      {item.description}
                    </p>
                    <div className="pt-1 flex items-center gap-1 text-[10px] font-black text-[#7C3AED] hover:text-black">
                      <span>{getActionLabel(item)}</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-stone-100 border-t-2 border-black text-center font-mono text-[10px] text-stone-600">
          All notifications are real-time &amp; persistent across sessions
        </div>
      </div>
    </div>
  );
}
