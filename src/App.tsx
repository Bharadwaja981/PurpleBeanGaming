/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ViewType, NotificationItem, CompetitiveGame } from './types/tournament';
import { Navigation } from './components/Navigation';
import { SearchModal } from './components/SearchModal';
import { NotificationsModal } from './components/NotificationsModal';
import { RegistrationModal } from './components/RegistrationModal';
import { BrandKitModal } from './components/BrandKitModal';
import { PurpleBeanLogo } from './components/PurpleBeanLogo';
import { tournamentService } from './services/firebaseService';
import { dotaTournamentOperations } from './domain/dotaTournamentOperationsEngine';

// Views
import { HomeView } from './views/HomeView';
import { TournamentsView } from './views/TournamentsView';
import { TournamentDetailView } from './views/TournamentDetailView';
import { MatchesView } from './views/MatchesView';
import { MatchDetailView } from './views/MatchDetailView';
import { DoubleEliminationBracket } from './components/DoubleEliminationBracket';
import { TeamsView } from './views/TeamsView';
import { TeamProfileView } from './views/TeamProfileView';
import { PlayersView } from './views/PlayersView';
import { PlayerProfileView } from './views/PlayerProfileView';
import { RankingsView } from './views/RankingsView';
import { RegisteredPlayersView } from './views/RegisteredPlayersView';
import { CaptainSelectionView } from './views/CaptainSelectionView';
import { AuctionDraft } from './components/AuctionDraft';
import { OrganiserDashboardView } from './views/OrganiserDashboardView';
import { NotFoundView } from './views/NotFoundView';

import { Trophy, Shield, Swords, Users, Heart, ArrowUpRight, Flame, MapPin } from 'lucide-react';

const THEMES = [
  { name: 'Purple Bean', bg: 'bg-[#F3E8FF]', accent: 'bg-[#7C3AED]', card: 'bg-white', tag: 'bg-[#FFE600]' },
  { name: 'Canary Punch', bg: 'bg-[#FFDE59]', accent: 'bg-[#FF5757]', card: 'bg-white', tag: 'bg-[#5CE1E6]' },
  { name: 'Cyber Mint', bg: 'bg-[#70FFAF]', accent: 'bg-[#FFDE59]', card: 'bg-white', tag: 'bg-[#FF70A6]' },
  { name: 'Bubblegum', bg: 'bg-[#FF90E8]', accent: 'bg-[#38EF7D]', card: 'bg-white', tag: 'bg-[#FFDE59]' },
  { name: 'Electric Sky', bg: 'bg-[#5CE1E6]', accent: 'bg-[#FF90E8]', card: 'bg-white', tag: 'bg-[#FFDE59]' },
];

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [activeEntityId, setActiveEntityId] = useState<string | undefined>('purple-bean-india-masters-2026');
  const [themeIdx, setThemeIdx] = useState(0);
  const [selectedGame, setSelectedGame] = useState<CompetitiveGame>('All Games');
  const [isEmbed, setIsEmbed] = useState(false);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Sync user notifications from tournamentService
  useEffect(() => {
    const updateNotifs = () => {
      const curUser = tournamentService.getCurrentUser();
      const dotaNotifs = tournamentService.getUserNotifications(curUser.id);
      const opsNotifs = dotaTournamentOperations.getUserNotifications(curUser.id, curUser.role);

      const combinedDota = [
        ...dotaNotifs.map(n => ({
          id: n.id,
          type: 'registration' as const,
          title: n.title,
          description: n.message,
          timestamp: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: !n.read
        })),
        ...opsNotifs.map(n => ({
          id: n.id,
          type: (n.type === 'MATCH_RESCHEDULE' ? 'match' : n.type === 'ANNOUNCEMENT' ? 'system' : 'registration') as any,
          title: n.title,
          description: n.content,
          timestamp: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: !n.read
        }))
      ];

      if (combinedDota.length > 0) {
        setNotifications(prev => {
          const nonDota = prev.filter(p => !p.id.startsWith('notif-'));
          return [...combinedDota, ...nonDota];
        });
      }
    };

    updateNotifs();
    const unsub = tournamentService.subscribe(updateNotifs);
    return unsub;
  }, []);

  const currentTheme = THEMES[themeIdx];
  const unreadCount = notifications.filter((n) => n.unread).length;

  // External App URL parameters & postMessage synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as ViewType;
    if (viewParam) {
      setCurrentView(viewParam);
    }
    const entityParam = params.get('entity');
    if (entityParam) {
      setActiveEntityId(entityParam);
    }
    if (params.get('brandkit') === 'true') {
      setIsBrandKitOpen(true);
    }
    if (params.get('embed') === 'true') {
      setIsEmbed(true);
    }

    // Bidirectional postMessage listener for host applications
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'PB_NAVIGATE' && data.view) {
          handleNavigate(data.view as ViewType, data.entityId);
        } else if (data.type === 'PB_SET_THEME' && typeof data.themeIdx === 'number') {
          setThemeIdx(data.themeIdx % THEMES.length);
        } else if (data.type === 'PB_OPEN_BRANDKIT') {
          setIsBrandKitOpen(true);
        }
      } catch {
        // ignore malformed events
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  const handleNavigate = (view: ViewType, entityId?: string) => {
    setCurrentView(view);
    if (entityId) {
      setActiveEntityId(entityId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Notify host application if running in an iframe
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'PB_VIEW_CHANGED', view, entityId }, '*');
    }
  };

  const handleCycleTheme = () => {
    setThemeIdx((prev) => (prev + 1) % THEMES.length);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => {
      if (n.id.startsWith('notif-')) {
        tournamentService.markNotificationRead(n.id);
      }
      return { ...n, unread: false };
    }));
  };

  return (
    <div 
      className={`min-h-screen w-full transition-colors duration-200 ${currentTheme.bg} selection:bg-black selection:text-white flex flex-col`}
      style={{
        backgroundImage: `radial-gradient(#000 1.2px, transparent 1.2px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* External App Embed Mode Mini-Banner */}
      {isEmbed && (
        <div className="bg-black text-white px-3 sm:px-6 py-1.5 flex items-center justify-between font-mono text-[11px] border-b-2 border-black z-40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="font-bold text-[#FFE600] uppercase">Purple Bean Widget</span>
            <span className="text-stone-400 hidden sm:inline">· Active View: {currentView.toUpperCase()}</span>
          </div>
          <a
            href={window.location.href.replace(/([&?])embed=true&?/, '$1').replace(/\?$/, '')}
            target="_blank"
            rel="noreferrer"
            className="text-stone-300 hover:text-white underline flex items-center gap-1"
          >
            Open Standalone App <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Neo-brutalist Navigation Header */}
      <Navigation
        currentView={currentView}
        onNavigate={handleNavigate}
        unreadCount={unreadCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
        activeThemeName={currentTheme.name}
        onCycleTheme={handleCycleTheme}
        selectedGame={selectedGame}
        onSelectGame={(g) => setSelectedGame(g)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {currentView === 'home' && (
          <HomeView 
            onNavigate={handleNavigate} 
            onOpenRegister={() => setIsRegisterOpen(true)}
            onOpenBrandKit={() => setIsBrandKitOpen(true)}
          />
        )}

        {currentView === 'tournaments' && (
          <TournamentsView 
            onNavigate={handleNavigate} 
            onOpenRegister={() => setIsRegisterOpen(true)} 
          />
        )}

        {currentView === 'tournament_detail' && (
          <TournamentDetailView 
            tournamentId={activeEntityId} 
            onNavigate={handleNavigate} 
            onOpenRegister={() => setIsRegisterOpen(true)} 
          />
        )}

        {currentView === 'matches' && (
          <MatchesView onNavigate={handleNavigate} />
        )}

        {currentView === 'match_detail' && (
          <MatchDetailView 
            matchId={activeEntityId} 
            onNavigate={handleNavigate} 
          />
        )}

        {currentView === 'bracket' && (
          <div className="space-y-6">
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-2">
              <span className="font-mono text-xs font-black uppercase text-[#7C3AED] block">
                PURPLE BEAN TOURNAMENT ENGINE · INDIA
              </span>
              <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
                INDIA MASTERS 2026 BRACKET
              </h1>
              <p className="font-mono text-xs text-stone-600">
                Official double elimination bracket. Solid black lines denote winner advancement; dotted red lines demonstrate upper bracket losers dropping directly to lower bracket survival deciders.
              </p>
            </div>
            <DoubleEliminationBracket onSelectMatch={(mId) => handleNavigate('match_detail', mId)} />
          </div>
        )}

        {currentView === 'teams' && (
          <TeamsView onNavigate={handleNavigate} />
        )}

        {currentView === 'team_profile' && (
          <TeamProfileView 
            teamId={activeEntityId} 
            onNavigate={handleNavigate} 
          />
        )}

        {currentView === 'players' && (
          <PlayersView onNavigate={handleNavigate} />
        )}

        {currentView === 'player_profile' && (
          <PlayerProfileView 
            playerId={activeEntityId} 
            onNavigate={handleNavigate} 
          />
        )}

        {currentView === 'rankings' && (
          <RankingsView onNavigate={handleNavigate} />
        )}

        {currentView === 'registered_players' && (
          <RegisteredPlayersView onNavigate={handleNavigate} />
        )}

        {currentView === 'captain_selection' && (
          <CaptainSelectionView onNavigate={handleNavigate} />
        )}

        {(currentView === 'auction' || currentView === 'draft') && (
          <AuctionDraft />
        )}

        {currentView === 'organiser_dashboard' && (
          <OrganiserDashboardView 
            onNavigate={handleNavigate} 
            onOpenRegister={() => setIsRegisterOpen(true)} 
          />
        )}

        {currentView === 'not_found' && (
          <NotFoundView onNavigate={handleNavigate} />
        )}
      </main>

      {/* Global Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onNavigate={handleNavigate}
      />

      <RegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />

      <BrandKitModal
        isOpen={isBrandKitOpen}
        onClose={() => setIsBrandKitOpen(false)}
      />

      {/* Neo-brutalist Footer */}
      <footer className="w-full border-t-[3.5px] border-black bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div 
                onClick={() => setIsBrandKitOpen(true)}
                className="inline-block cursor-pointer group"
                title="Click to view & export Official Mascot & Logo Kit"
              >
                <PurpleBeanLogo size="md" showText={true} animated={true} />
              </div>
              <p className="font-mono text-xs text-stone-600 max-w-sm mt-2">
                India’s premier esports tournament infrastructure featuring real-time captain purse auctions, double-elimination routing, OpenDota verification, and anti-cheat referee auditing for competitive Dota 2.
              </p>
              <button
                onClick={() => setIsBrandKitOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F3E8FF] hover:bg-[#FFE600] text-black border border-black font-mono text-[11px] font-bold shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                <span>Explore Mascot &amp; Brand Kit (SVG)</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {/* Quick Links Matrix */}
            <div className="flex flex-wrap items-center gap-4 font-mono text-xs font-black uppercase">
              <button onClick={() => handleNavigate('home')} className="hover:underline cursor-pointer">Home</button>
              <span>·</span>
              <button onClick={() => handleNavigate('tournaments')} className="hover:underline cursor-pointer">Tournaments</button>
              <span>·</span>
              <button onClick={() => handleNavigate('matches')} className="hover:underline cursor-pointer">Matches</button>
              <span>·</span>
              <button onClick={() => handleNavigate('bracket')} className="hover:underline cursor-pointer">Bracket Engine</button>
              <span>·</span>
              <button onClick={() => handleNavigate('auction')} className="hover:underline cursor-pointer">Auction Desk</button>
              <span>·</span>
              <button onClick={() => handleNavigate('rankings')} className="hover:underline cursor-pointer">Rankings</button>
              <span>·</span>
              <button onClick={() => handleNavigate('organiser_dashboard')} className="hover:underline cursor-pointer">Organiser Desk</button>
              <span>·</span>
              <button onClick={() => setIsBrandKitOpen(true)} className="hover:underline cursor-pointer text-[#7C3AED]">Logo Kit</button>
            </div>
          </div>

          <div className="pt-6 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] sm:text-xs text-stone-600 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 border border-black rounded-full inline-block animate-pulse shrink-0" />
              <span>VALVE &amp; RIOT API SYNC · MUMBAI &amp; BENGALURU RELAYS ONLINE</span>
            </div>

            <div className="flex items-center gap-2">
              <span>DESIGNED FOR INDIAN ESPORTS</span>
              <span>·</span>
              <span>© 2026 PURPLE BEAN GAMING</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
