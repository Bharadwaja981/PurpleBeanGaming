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
import { AdminCredentialsModal } from './components/AdminCredentialsModal';
import { PurpleBeanLogo } from './components/PurpleBeanLogo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { tournamentService } from './services/firebaseService';
import { isQuotaExhausted, onQuotaStateChange } from './services/firebaseConfig';
import { dotaTournamentOperations } from './domain/dotaTournamentOperationsEngine';

// Loading System Components (Matching Reference Image)
import { AppLaunchSplashScreen } from './components/loading/AppLaunchSplashScreen';
import { HomepageSkeleton } from './components/loading/HomepageSkeleton';
import { TournamentListingSkeleton } from './components/loading/TournamentListingSkeleton';
import { BracketDetailSkeleton } from './components/loading/BracketDetailSkeleton';
import { LiveMatchSkeleton } from './components/loading/LiveMatchSkeleton';
import { LoadingScreenSystemModal } from './components/loading/LoadingScreenSystemModal';

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

import { Trophy, Shield, Swords, Users, Heart, ArrowUpRight, Flame, MapPin, Key, Loader2, Zap } from 'lucide-react';

const THEMES = [
  { name: 'Purple Bean', bg: 'bg-[#F3E8FF]', accent: 'bg-[#7C3AED]', card: 'bg-white', tag: 'bg-[#FFE600]' },
  { name: 'Canary Punch', bg: 'bg-[#FFDE59]', accent: 'bg-[#FF5757]', card: 'bg-white', tag: 'bg-[#5CE1E6]' },
  { name: 'Cyber Mint', bg: 'bg-[#70FFAF]', accent: 'bg-[#FFDE59]', card: 'bg-white', tag: 'bg-[#FF70A6]' },
  { name: 'Bubblegum', bg: 'bg-[#FF90E8]', accent: 'bg-[#38EF7D]', card: 'bg-white', tag: 'bg-[#FFDE59]' },
  { name: 'Electric Sky', bg: 'bg-[#5CE1E6]', accent: 'bg-[#FF90E8]', card: 'bg-white', tag: 'bg-[#FFDE59]' },
];

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [activeEntityId, setActiveEntityId] = useState<string | undefined>(undefined);
  const [themeIdx, setThemeIdx] = useState(0);
  const [selectedGame, setSelectedGame] = useState<CompetitiveGame>('All Games');
  const [isEmbed, setIsEmbed] = useState(false);

  // Loading Screen States
  const [isInitialLaunchLoading, setIsInitialLaunchLoading] = useState(true);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [isLoadingShowcaseOpen, setIsLoadingShowcaseOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerTournamentId, setRegisterTournamentId] = useState<string | undefined>(undefined);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhaustedState] = useState(() => isQuotaExhausted());

  useEffect(() => {
    return onQuotaStateChange((exhausted) => {
      setQuotaExhaustedState(exhausted);
    });
  }, []);

  const handleOpenRegister = (tourneyId?: string) => {
    setRegisterTournamentId(tourneyId || activeEntityId);
    setIsRegisterOpen(true);
  };

  // Monitor auth state changes & handle proper page redirection on sign out
  useEffect(() => {
    let prevUser = tournamentService.getCurrentUser();

    const unsub = tournamentService.subscribe(() => {
      const curUser = tournamentService.getCurrentUser();
      const wasAuth = prevUser && prevUser.id !== 'guest-spectator' && Boolean(prevUser.email);
      const isNowGuest = !curUser || curUser.id === 'guest-spectator' || !curUser.email;

      // When signing out from an authenticated account:
      if (wasAuth && isNowGuest) {
        // Automatically redirect to home and clear private entity ID
        setActiveEntityId(undefined);
        handleNavigate('home');
        setSignOutNotice('✓ Signed out successfully. Switched to Public Spectator Mode.');
        setTimeout(() => setSignOutNotice(null), 4000);
      } else {
        // Enforce protected view restrictions
        const restrictedViews: ViewType[] = ['organiser_dashboard', 'captain_selection'];
        if (isNowGuest && restrictedViews.includes(currentView)) {
          handleNavigate('home');
        }
      }
      prevUser = curUser;
    });

    return unsub;
  }, [currentView]);

  // Initial app launch simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLaunchLoading(false);
    }, 1100);
    return () => clearTimeout(timer);
  }, []);

  // Sync user notifications from tournamentService
  useEffect(() => {
    const updateNotifs = () => {
      const curUser = tournamentService.getCurrentUser();
      const dotaNotifs = tournamentService.getUserNotifications(curUser.id);
      const opsNotifs = dotaTournamentOperations.getUserNotifications(curUser.id, curUser.role);

      const combinedDota: NotificationItem[] = [
        ...dotaNotifs.map(n => {
          let viewTarget: ViewType = 'tournament_detail';
          let entityIdTarget: string | undefined = n.tournamentId;
          let linkText = 'View Details →';

          if (n.type === 'CAPTAIN_SELECTED') {
            const engine = tournamentService.getDotaAuctionEngine(n.tournamentId);
            const isAuctionReady = engine.getState().status === 'READY' || engine.getState().status === 'LIVE';
            viewTarget = isAuctionReady ? 'auction' : 'captain_selection';
            entityIdTarget = n.tournamentId || 'auction-basic-test-1';
            linkText = isAuctionReady ? 'Join Live Auction Lobby →' : 'View Captain & Team Desk →';
          } else if (n.type === 'MATCH_SCHEDULED' || n.type === 'RESULT_CONFIRMATION_REQUIRED') {
            viewTarget = 'match_detail';
            entityIdTarget = n.matchId || 'm-live-1';
            linkText = n.type === 'RESULT_CONFIRMATION_REQUIRED' ? 'Confirm Match Results →' : 'Go to Match Room →';
          } else if (n.type === 'EVIDENCE_REQUESTED') {
            viewTarget = 'tournament_detail';
            entityIdTarget = n.tournamentId || 'auction-basic-test-1';
            linkText = 'Submit Evidence / Review →';
          } else if (n.type === 'AUCTION_STARTING') {
            viewTarget = 'auction';
            entityIdTarget = n.tournamentId || 'auction-basic-test-1';
            linkText = 'Enter Auction Room →';
          } else if (n.type === 'TOURNAMENT_ANNOUNCEMENT') {
            viewTarget = 'tournament_detail';
            entityIdTarget = n.tournamentId || 'auction-basic-test-1';
            linkText = 'Read Announcement →';
          }

          return {
            id: n.id,
            type: n.type as any,
            title: n.title,
            description: n.message,
            timestamp: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unread: !n.read,
            tournamentId: n.tournamentId,
            actionTarget: {
              view: viewTarget,
              entityId: entityIdTarget
            },
            linkText
          };
        }),
        ...opsNotifs.map(n => ({
          id: n.id,
          type: (n.type === 'MATCH_RESCHEDULE' ? 'match' : n.type === 'ANNOUNCEMENT' ? 'system' : 'registration') as any,
          title: n.title,
          description: n.content,
          timestamp: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: !n.read,
          actionTarget: {
            view: (n.type === 'MATCH_RESCHEDULE' ? 'match_detail' : 'tournament_detail') as ViewType,
            entityId: (n as any).matchId || n.tournamentId
          }
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

  // External App URL parameters, pathname parsing & postMessage synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Parse HTML5 pathname for tournament-scoped routes: e.g. /tournaments/:tournamentId/auction
    const pathname = window.location.pathname;
    const auctionPathMatch = pathname.match(/^\/tournaments\/([^/]+)\/auction\/?$/);
    const tournamentPathMatch = pathname.match(/^\/tournaments\/([^/]+)\/?$/);

    if (auctionPathMatch) {
      const tourneyId = auctionPathMatch[1];
      setActiveEntityId(tourneyId);
      setCurrentView('auction');
    } else if (tournamentPathMatch) {
      const tourneyId = tournamentPathMatch[1];
      setActiveEntityId(tourneyId);
      setCurrentView('tournament_detail');
    } else if (pathname === '/auction' || pathname === '/auction/') {
      // Direct un-scoped /auction URL requested: redirect to tournaments directory
      window.history.replaceState({}, '', '/tournaments');
      setCurrentView('tournaments');
    } else {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as ViewType;
      const entityParam = params.get('entity') || params.get('tournamentId');

      if (viewParam === 'auction' || viewParam === 'draft') {
        if (entityParam) {
          setActiveEntityId(entityParam);
          setCurrentView('auction');
        } else {
          // Direct un-scoped auction param: redirect to tournaments
          setCurrentView('tournaments');
        }
      } else if (viewParam) {
        setCurrentView(viewParam);
        if (entityParam) {
          setActiveEntityId(entityParam);
        }
      } else if (entityParam) {
        setActiveEntityId(entityParam);
      }
    }

    const params = new URLSearchParams(window.location.search);
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
    setIsViewLoading(true);
    setCurrentView(view);
    if (entityId) {
      setActiveEntityId(entityId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update browser history URL cleanly without full reload
    if (typeof window !== 'undefined' && window.history) {
      try {
        if ((view === 'auction' || view === 'draft') && entityId) {
          window.history.pushState({ view, entityId }, '', `/tournaments/${entityId}/auction`);
        } else if (view === 'tournament_detail' && entityId) {
          window.history.pushState({ view, entityId }, '', `/tournaments/${entityId}`);
        } else if (view === 'home') {
          window.history.pushState({ view }, '', '/');
        } else if (view === 'tournaments') {
          window.history.pushState({ view }, '', '/tournaments');
        }
      } catch {
        // Ignore iframe pushState restrictions
      }
    }

    // Brief smooth transition to allow skeleton display matching reference system
    setTimeout(() => {
      setIsViewLoading(false);
    }, 260);

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

  const handleMarkNotificationRead = (id: string) => {
    tournamentService.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  return (
    <div 
      className={`min-h-screen w-full transition-colors duration-200 ${currentTheme.bg} selection:bg-black selection:text-white flex flex-col`}
      style={{
        backgroundImage: `radial-gradient(#000 1.2px, transparent 1.2px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* 1. App Launch Splash Screen (Matches Reference Image Screen 1) */}
      {isInitialLaunchLoading && (
        <AppLaunchSplashScreen
          onFinished={() => setIsInitialLaunchLoading(false)}
          isDismissible={true}
        />
      )}

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

      {/* Development Zero-Quota Protection & Firestore Status Banner */}
      {quotaExhausted && (
        <div className="bg-[#FFFDEB] border-b-2 border-black px-4 py-2 text-xs font-mono text-stone-900 flex flex-wrap items-center justify-between gap-3 z-40 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="bg-[#70FFAF] text-black border border-black px-2 py-0.5 font-black uppercase text-[10px] tracking-wide shrink-0">
              Dev Safe-Mode Active
            </span>
            <span className="leading-tight text-stone-800">
              <strong className="text-black">Zero Quota Mode:</strong> Live Firestore writes are paused to prevent exhausting daily write limits. Full tournament operations, captain registration & auction bidding run in local persistent memory.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://console.firebase.google.com/project/gen-lang-client-0634745445/firestore/databases/ai-studio-helloworld-3b15cdcf-4ce0-4040-9e96-73767517ade0/data?openUpgradeDialog=true"
              target="_blank"
              rel="noreferrer"
              className="bg-black text-white hover:bg-stone-800 px-3 py-1 font-bold text-[11px] flex items-center gap-1 border border-black transition-colors"
            >
              Firestore Console / Quota Settings <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>
      )}

      {/* Neo-brutalist Navigation Header */}
      <Navigation
        currentView={currentView}
        onNavigate={handleNavigate}
        unreadCount={unreadCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenRegister={() => handleOpenRegister()}
        onOpenAdminCredentials={() => setIsAdminModalOpen(true)}
        activeThemeName={currentTheme.name}
        onCycleTheme={handleCycleTheme}
        selectedGame={selectedGame}
        onSelectGame={(g) => setSelectedGame(g)}
      />

      {/* Sign Out & Auth State Notification Banner */}
      {signOutNotice && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
          <div className="bg-[#FFE600] text-black border-[3px] border-black p-3.5 shadow-[4px_4px_0px_0px_#000] font-mono text-xs font-black flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 fill-black" />
              <span>{signOutNotice}</span>
            </div>
            <button
              onClick={() => setSignOutNotice(null)}
              className="text-black hover:bg-black hover:text-white px-1.5 py-0.5 border border-black cursor-pointer text-[10px]"
            >
              DISMISS ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area Protected by Neo-Brutalist ErrorBoundary */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <ErrorBoundary fallbackView={() => handleNavigate('home')}>
          {isViewLoading ? (
            currentView === 'tournaments' ? (
              <TournamentListingSkeleton />
            ) : currentView === 'bracket' ? (
              <BracketDetailSkeleton />
            ) : currentView === 'match_detail' ? (
              <LiveMatchSkeleton />
            ) : (
              <HomepageSkeleton />
            )
          ) : (
            <>
              {currentView === 'home' && (
                <HomeView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                />
              )}

              {currentView === 'tournaments' && (
                <TournamentsView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                />
              )}

              {(currentView === 'tournament_detail' || currentView === 'standings') && (
                <TournamentDetailView 
                  tournamentId={activeEntityId} 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
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
                <CaptainSelectionView onNavigate={handleNavigate} tournamentId={activeEntityId} />
              )}

              {(currentView === 'auction' || currentView === 'draft' || currentView === 'draft_results') && (
                <AuctionDraft onNavigate={handleNavigate} tournamentId={activeEntityId} />
              )}

              {currentView === 'organiser_dashboard' && (
                <OrganiserDashboardView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                />
              )}

              {currentView === 'register' && (
                <TournamentsView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                />
              )}

              {currentView === 'not_found' && (
                <NotFoundView onNavigate={handleNavigate} />
              )}

              {/* Robust Fallback in case of any unmapped view state */}
              {![
                'home',
                'tournaments',
                'tournament_detail',
                'standings',
                'matches',
                'match_detail',
                'bracket',
                'teams',
                'team_profile',
                'players',
                'player_profile',
                'rankings',
                'registered_players',
                'captain_selection',
                'auction',
                'draft',
                'draft_results',
                'organiser_dashboard',
                'register',
                'not_found'
              ].includes(currentView) && (
                <HomeView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                  onOpenBrandKit={() => setIsBrandKitOpen(true)}
                />
              )}
            </>
          )}
        </ErrorBoundary>
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
        onMarkAsRead={handleMarkNotificationRead}
        onNavigate={handleNavigate}
      />

      <RegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        tournamentId={registerTournamentId || activeEntityId || (tournamentService.getTournaments()[0]?.id || '')}
        tournamentName={tournamentService.getTournamentBySlug(registerTournamentId || activeEntityId || '')?.name || tournamentService.getTournaments()[0]?.name || 'Tournament'}
      />

      <BrandKitModal
        isOpen={isBrandKitOpen}
        onClose={() => setIsBrandKitOpen(false)}
      />

      {/* Reference Loading Screen System Modal */}
      <LoadingScreenSystemModal
        isOpen={isLoadingShowcaseOpen}
        onClose={() => setIsLoadingShowcaseOpen(false)}
      />

      {/* Admin Access & Credentials Modal (Strictly Restricted to Primary Project Admin) */}
      <AdminCredentialsModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
      />

      {/* Neo-brutalist Footer */}
      <footer className="w-full border-t-[3.5px] border-black bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div 
                onClick={() => handleNavigate('home')}
                className="inline-block cursor-pointer group"
                title="Purple Bean Gaming Esports Circuit"
              >
                <PurpleBeanLogo size="md" showText={true} />
              </div>
              <p className="font-mono text-xs text-stone-600 max-w-sm mt-2">
                India’s premier esports tournament infrastructure featuring real-time captain purse auctions, double-elimination routing, OpenDota verification, and anti-cheat referee auditing for competitive Dota 2.
              </p>
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
              <button onClick={() => handleNavigate('rankings')} className="hover:underline cursor-pointer">Rankings</button>
              <span>·</span>
              <button onClick={() => handleNavigate('organiser_dashboard')} className="hover:underline cursor-pointer">Organiser Desk</button>
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
