import { Bell, CheckCheck, X, Trophy, Swords, Gavel, AlertCircle } from 'lucide-react';
import { NotificationItem, ViewType } from '../types/tournament';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onNavigate
}: NotificationsModalProps) {
  if (!isOpen) return null;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'registration':
        return <Trophy className="w-4 h-4 text-emerald-600" />;
      case 'match':
        return <Swords className="w-4 h-4 text-blue-600" />;
      case 'auction':
        return <Gavel className="w-4 h-4 text-pink-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
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
              className="text-[10px] bg-white border border-black px-1.5 py-0.5 hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-1"
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
                className={`p-3.5 transition-colors hover:bg-stone-50 ${
                  item.unread ? 'bg-[#FFFBEB]' : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-white border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-black">{item.title}</span>
                      <span className="text-[10px] text-stone-500">{item.timestamp}</span>
                    </div>
                    <p className="text-stone-700 text-[11px] leading-relaxed">
                      {item.description}
                    </p>
                    {item.type === 'match' && (
                      <button
                        onClick={() => {
                          onNavigate('match_detail', 'm-live-1');
                          onClose();
                        }}
                        className="mt-1 text-[10px] font-black text-black underline hover:text-[#FF5757] cursor-pointer inline-block"
                      >
                        Go to Match Lobby →
                      </button>
                    )}
                    {item.type === 'auction' && (
                      <button
                        onClick={() => {
                          onNavigate('auction');
                          onClose();
                        }}
                        className="mt-1 text-[10px] font-black text-black underline hover:text-[#FF5757] cursor-pointer inline-block"
                      >
                        View Auction Room →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-stone-100 border-t-2 border-black text-center font-mono text-[10px] text-stone-600">
          Instant updates enabled for active tournament match lobbies
        </div>
      </div>
    </div>
  );
}
