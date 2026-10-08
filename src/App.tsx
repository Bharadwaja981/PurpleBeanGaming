/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ViewType, NotificationItem, CompetitiveGame } from './types/tournament';
import { Navigation } from './components/Navigation';
import { SearchModal } from './components/SearchModal';
import { NotificationsModal } from './components/NotificationsModal';
import { RegistrationModal } from './components/RegistrationModal';
import { BrandKitModal } from './components/BrandKitModal';
import { AdminCredentialsModal } from './components/AdminCredentialsModal';
import { CreateTournamentModal } from './components/CreateTournamentModal';
import { FirstTimeOnboardingModal } from './components/FirstTimeOnboardingModal';
import { pbgAccountRegistry } from './domain/pbgAccountRegistry';
import { PBGPlayerAccount } from './types/pbgAccount';
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
import { SingleEliminationBracket } from './components/SingleEliminationBracket';
import { SwissStageView } from './components/SwissStageView';
import { GroupStageView } from './components/GroupStageView';
import { dotaCompetitionEngine } from './domain/dotaCompetitionEngine';
import { TeamsView } from './views/TeamsView';
import { TeamProfileView } from './views/TeamProfileView';
import { PlayersView } from './views/PlayersView';
import { PlayerProfileView } from './views/PlayerProfileView';
import { DotaGameProfileView } from './views/DotaGameProfileView';
import { DotaMatchDetailView } from './views/DotaMatchDetailView';
import { RankingsView } from './views/RankingsView';
import { RegisteredPlayersView } from './views/RegisteredPlayersView';
import { CaptainSelectionView } from './views/CaptainSelectionView';
import { AuctionDraft } from './components/AuctionDraft';
import { AuctionReport } from './components/AuctionReport';
import { OrganiserDashboardView } from './views/OrganiserDashboardView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { NotFoundView } from './views/NotFoundView';
import { HowItWorksView } from './views/HowItWorksView';
import { AboutView } from './views/AboutView';
import { ContactView } from './views/ContactView';
import { FaqView } from './views/FaqView';
import { FairPlayView } from './views/FairPlayView';
import { CommunityView } from './views/CommunityView';
import { SupportView } from './views/SupportView';
import { TermsView } from './views/TermsView';
import { PrivacyView } from './views/PrivacyView';
import { CookiesView } from './views/CookiesView';
import { CommunityGuidelinesView } from './views/CommunityGuidelinesView';
import { OrganisersView } from './views/OrganisersView';
import { themeManager, ColorMode, ThemePalette, PBG_PALETTES } from './services/themeManager';

import { Trophy, Shield, Swords, Users, Heart, ArrowUpRight, Flame, MapPin, Key, Loader2, Zap, Sun, Moon } from 'lucide-react';

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
  const [colorMode, setColorMode] = useState<ColorMode>(() => themeManager.getMode());
  const [currentPalette, setCurrentPalette] = useState<ThemePalette>(() => themeManager.getPalette());
  const [selectedGame, setSelectedGame] = useState<CompetitiveGame>('All Games');
  const [isEmbed, setIsEmbed] = useState(false);

  // Subscribe to ThemeManager
  useEffect(() => {
    const unsubTheme = themeManager.subscribe((mode, palette) => {
      setColorMode(mode);
      setCurrentPalette(palette);
    });
    return unsubTheme;
  }, []);

  // Loading Screen States
  const [isInitialLaunchLoading, setIsInitialLaunchLoading] = useState(true);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [isLoadingShowcaseOpen, setIsLoadingShowcaseOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isCreateTournamentOpen, setIsCreateTournamentOpen] = useState(false);
  const [registerTournamentId, setRegisterTournamentId] = useState<string | undefined>(undefined);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhaustedState] = useState(() => isQuotaExhausted());

  // First-Time PBG Player Onboarding Walkthrough State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingAccount, setOnboardingAccount] = useState<PBGPlayerAccount>(() => {
    return tournamentService.getCurrentPBGAccount() || pbgAccountRegistry.getAccountByPbgId('PBG-000184')!;
  });

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

      // When a user signs in:
      if (curUser && curUser.id !== 'guest-spectator' && curUser.email) {
        const pbgAcc = tournamentService.getCurrentPBGAccount() || pbgAccountRegistry.getAccountByUid(curUser.id);
        if (pbgAcc) {
          setOnboardingAccount(pbgAcc);
          // Automatically prompt first-time onboarding ONLY if truly brand-new and never completed/dismissed
          const alreadyCompleted = pbgAccountRegistry.hasUserCompletedOnboarding(curUser.id);
          const hasShownOnboarding = typeof window !== 'undefined' && (
            localStorage.getItem(`pbg_onboarded_${curUser.id}`) === 'true' ||
            localStorage.getItem(`pbg_onboarding_completed_${curUser.id}`) === 'true' ||
            sessionStorage.getItem(`pbg_onboarded_${curUser.id}`) === 'true'
          );
          if (curUser.isFirstTimePBG && !alreadyCompleted && !pbgAcc.hasCompletedOnboarding && !hasShownOnboarding) {
            sessionStorage.setItem(`pbg_onboarded_${curUser.id}`, 'true');
            try {
              localStorage.setItem(`pbg_onboarded_${curUser.id}`, 'true');
              localStorage.setItem(`pbg_onboarding_completed_${curUser.id}`, 'true');
            } catch {}
            setIsOnboardingOpen(true);
          }
        }
      }

      // When signing out from an authenticated account:
      if (wasAuth && isNowGuest) {
        // Automatically redirect to home and clear private entity ID
        setActiveEntityId(undefined);
        handleNavigate('home');
        setSignOutNotice('✓ Signed out successfully. Switched to Public Spectator Mode.');
        setTimeout(() => setSignOutNotice(null), 4000);
      } else {
        // Enforce protected view restrictions
        const restrictedViews: ViewType[] = ['organiser_dashboard', 'captain_selection', 'admin_dashboard'];
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
      const opsNotifs: any[] = typeof (dotaTournamentOperations as any)?.getUserNotifications === 'function'
        ? (dotaTournamentOperations as any).getUserNotifications(curUser.id, curUser.role)
        : [];

      const combinedDota: NotificationItem[] = [
        ...dotaNotifs.map(n => {
          let viewTarget: ViewType = 'tournament_detail';
          let entityIdTarget: string | undefined = n.tournamentId;
          let linkText = 'View Details →';

          if (n.type === 'CAPTAIN_SELECTED') {
            viewTarget = 'auction';
            entityIdTarget = n.tournamentId;
            linkText = 'Enter Auction Room ↗';
          } else if (n.type === 'MATCH_SCHEDULED' || n.type === 'RESULT_CONFIRMATION_REQUIRED') {
            viewTarget = 'match_detail';
            entityIdTarget = n.matchId;
            linkText = n.type === 'RESULT_CONFIRMATION_REQUIRED' ? 'Confirm Match Results →' : 'Go to Match Room →';
          } else if (n.type === 'EVIDENCE_REQUESTED') {
            viewTarget = 'tournament_detail';
            entityIdTarget = n.tournamentId;
            linkText = 'Submit Evidence / Review →';
          } else if (n.type === 'AUCTION_STARTING') {
            viewTarget = 'auction';
            entityIdTarget = n.tournamentId;
            linkText = 'Enter Auction Room →';
          } else if (n.type === 'TOURNAMENT_ANNOUNCEMENT') {
            viewTarget = 'tournament_detail';
            entityIdTarget = n.tournamentId;
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
        ...opsNotifs.map((n: any) => ({
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
          const map = new Map<string, NotificationItem>();
          // Preserve read state if already acknowledged
          prev.forEach(p => map.set(p.id, p));
          combinedDota.forEach(n => {
            const existing = map.get(n.id);
            if (existing) {
              map.set(n.id, { ...n, unread: existing.unread });
            } else {
              map.set(n.id, n);
            }
          });
          // Cap at max 40 items to conserve browser memory
          return Array.from(map.values()).slice(0, 40);
        });
      }
    };

    updateNotifs();
    const unsub = tournamentService.subscribe(updateNotifs);
    return unsub;
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // External App URL parameters, pathname parsing & postMessage synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Parse HTML5 pathname for tournament-scoped routes: e.g. /tournaments/:tournamentId/auction
    const pathname = window.location.pathname;
    const auctionPathMatch = pathname.match(/^\/tournaments\/([^/]+)\/auction\/?$/);
    const tournamentPathMatch = pathname.match(/^\/tournaments\/([^/]+)\/?$/);
    const dotaPlayerMatch = pathname.match(/^\/game\/dota2\/players\/([^/]+)\/?$/);
    const dotaMatchMatch = pathname.match(/^\/game\/dota2\/matches\/([^/]+)\/?$/);
    const playerMatch = pathname.match(/^\/players\/([^/]+)\/?$/);
    const teamMatch = pathname.match(/^\/teams\/([^/]+)\/?$/);

    if (dotaMatchMatch) {
      const matchId = dotaMatchMatch[1];
      setActiveEntityId(matchId);
      setCurrentView('dota_match_detail');
    } else if (dotaPlayerMatch) {
      const dotaAccId = dotaPlayerMatch[1];
      setActiveEntityId(dotaAccId);
      setCurrentView('dota_game_profile');
    } else if (auctionPathMatch) {
      const tourneyId = auctionPathMatch[1];
      setActiveEntityId(tourneyId);
      setCurrentView('auction');
    } else if (tournamentPathMatch) {
      const tourneyId = tournamentPathMatch[1];
      setActiveEntityId(tourneyId);
      const params = new URLSearchParams(window.location.search);
      if (params.get('manage') === 'true') {
        setCurrentView('organiser_dashboard');
      } else {
        setCurrentView('tournament_detail');
      }
    } else if (playerMatch) {
      setActiveEntityId(playerMatch[1]);
      setCurrentView('player_profile');
    } else if (teamMatch) {
      setActiveEntityId(teamMatch[1]);
      setCurrentView('team_profile');
    } else if (pathname === '/how-it-works' || pathname === '/how-it-works/') {
      setCurrentView('how_it_works');
    } else if (pathname === '/about' || pathname === '/about/') {
      setCurrentView('about');
    } else if (pathname === '/contact' || pathname === '/contact/') {
      setCurrentView('contact');
    } else if (pathname === '/faq' || pathname === '/faq/') {
      setCurrentView('faq');
    } else if (pathname === '/fair-play' || pathname === '/fair-play/') {
      setCurrentView('fair_play');
    } else if (pathname === '/community' || pathname === '/community/') {
      setCurrentView('community');
    } else if (pathname === '/support' || pathname === '/support/') {
      setCurrentView('support');
    } else if (pathname === '/terms' || pathname === '/terms/') {
      setCurrentView('terms');
    } else if (pathname === '/privacy' || pathname === '/privacy/') {
      setCurrentView('privacy');
    } else if (pathname === '/cookies' || pathname === '/cookies/') {
      setCurrentView('cookies');
    } else if (pathname === '/community-guidelines' || pathname === '/community-guidelines/') {
      setCurrentView('community_guidelines');
    } else if (pathname === '/organisers' || pathname === '/organisers/') {
      setCurrentView('organisers');
    } else if (pathname === '/players' || pathname === '/players/') {
      setCurrentView('players');
    } else if (pathname === '/rankings' || pathname === '/rankings/') {
      setCurrentView('rankings');
    } else if (pathname === '/teams' || pathname === '/teams/') {
      setCurrentView('teams');
    } else if (pathname === '/matches' || pathname === '/matches/') {
      setCurrentView('matches');
    } else if (pathname === '/bracket' || pathname === '/bracket/') {
      setCurrentView('bracket');
    } else if (pathname === '/auction' || pathname === '/auction/') {
      // Direct un-scoped /auction URL requested: redirect to tournaments directory
      window.history.replaceState({}, '', '/tournaments');
      setCurrentView('tournaments');
    } else if (pathname === '/tournaments' || pathname === '/tournaments/') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('manage') === 'true') {
        setCurrentView('organiser_dashboard');
      } else {
        setCurrentView('tournaments');
      }
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

    // Client-side Steam OpenID return handler (for Vercel SPA routing)
    const claimedId = params.get('openid.claimed_id') || params.get('openid.identity') || '';
    if (claimedId && (window.name === 'SteamOpenIdLogin' || window.opener)) {
      const steam64Match = claimedId.match(/\/id\/([0-9]{17})/);
      if (steam64Match) {
        const steamId64 = steam64Match[1];
        let dotaAccountId = '';
        try {
          dotaAccountId = (BigInt(steamId64) - BigInt('76561197960265728')).toString();
        } catch {}

        const messageData = {
          type: 'STEAM_LINK_SUCCESS',
          success: true,
          steamId64,
          dotaAccountId,
          timestamp: Date.now()
        };

        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const ch = new BroadcastChannel('pbg_steam_auth');
            ch.postMessage(messageData);
            ch.close();
          }
        } catch {}

        try {
          localStorage.setItem('pbg_steam_link_result', JSON.stringify(messageData));
        } catch {}

        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(messageData, '*');
          }
        } catch {}

        setTimeout(() => {
          try { window.close(); } catch {}
        }, 500);
      }
    }

    // Bidirectional postMessage listener for host applications
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        // Ignore PB_VIEW_CHANGED echoes
        if (data.type === 'PB_VIEW_CHANGED') return;
        if (data.type === 'PB_NAVIGATE' && data.view) {
          handleNavigate(data.view as ViewType, data.entityId);
        } else if (data.type === 'PB_SET_THEME' && typeof data.themeIdx === 'number') {
          themeManager.setPaletteIndex(data.themeIdx % PBG_PALETTES.length);
        } else if (data.type === 'PB_OPEN_BRANDKIT') {
          setIsBrandKitOpen(true);
        }
      } catch {
        // ignore malformed events
      }
    };

    const handlePopState = () => {
      const p = window.location.pathname;
      const dotaMatch = p.match(/^\/game\/dota2\/matches\/([^/]+)\/?$/);
      const dotaPlayer = p.match(/^\/game\/dota2\/players\/([^/]+)\/?$/);
      const tourneyMatch = p.match(/^\/tournaments\/([^/]+)\/?$/);
      const auctionMatch = p.match(/^\/tournaments\/([^/]+)\/auction\/?$/);
      const playerMatch = p.match(/^\/players\/([^/]+)\/?$/);
      const teamMatch = p.match(/^\/teams\/([^/]+)\/?$/);

      if (dotaMatch) {
        setActiveEntityId(dotaMatch[1]);
        setCurrentView('dota_match_detail');
      } else if (dotaPlayer) {
        setActiveEntityId(dotaPlayer[1]);
        setCurrentView('dota_game_profile');
      } else if (auctionMatch) {
        setActiveEntityId(auctionMatch[1]);
        setCurrentView('auction');
      } else if (tourneyMatch) {
        setActiveEntityId(tourneyMatch[1]);
        setCurrentView('tournament_detail');
      } else if (playerMatch) {
        setActiveEntityId(playerMatch[1]);
        setCurrentView('player_profile');
      } else if (teamMatch) {
        setActiveEntityId(teamMatch[1]);
        setCurrentView('team_profile');
      } else if (p === '/how-it-works' || p === '/how-it-works/') {
        setCurrentView('how_it_works');
      } else if (p === '/about' || p === '/about/') {
        setCurrentView('about');
      } else if (p === '/contact' || p === '/contact/') {
        setCurrentView('contact');
      } else if (p === '/faq' || p === '/faq/') {
        setCurrentView('faq');
      } else if (p === '/fair-play' || p === '/fair-play/') {
        setCurrentView('fair_play');
      } else if (p === '/community' || p === '/community/') {
        setCurrentView('community');
      } else if (p === '/support' || p === '/support/') {
        setCurrentView('support');
      } else if (p === '/terms' || p === '/terms/') {
        setCurrentView('terms');
      } else if (p === '/privacy' || p === '/privacy/') {
        setCurrentView('privacy');
      } else if (p === '/cookies' || p === '/cookies/') {
        setCurrentView('cookies');
      } else if (p === '/community-guidelines' || p === '/community-guidelines/') {
        setCurrentView('community_guidelines');
      } else if (p === '/organisers' || p === '/organisers/') {
        setCurrentView('organisers');
      } else if (p === '/players' || p === '/players/') {
        setCurrentView('players');
      } else if (p === '/rankings' || p === '/rankings/') {
        setCurrentView('rankings');
      } else if (p === '/teams' || p === '/teams/') {
        setCurrentView('teams');
      } else if (p === '/matches' || p === '/matches/') {
        setCurrentView('matches');
      } else if (p === '/bracket' || p === '/bracket/') {
        setCurrentView('bracket');
      } else if (p === '/tournaments' || p === '/tournaments/') {
        setCurrentView('tournaments');
      } else if (p === '/admin' || p === '/admin/') {
        setCurrentView('admin_dashboard');
      } else if (p === '/') {
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('message', handleWindowMessage);
    };
  }, []);

  const handleNavigate = (view: ViewType, entityId?: string) => {
    setIsViewLoading(true);
    setCurrentView(view);
    setActiveEntityId(entityId);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update browser history URL cleanly without full reload
    if (typeof window !== 'undefined' && window.history) {
      try {
        if ((view === 'auction' || view === 'draft') && entityId) {
          window.history.pushState({ view, entityId }, '', `/tournaments/${entityId}/auction`);
        } else if (view === 'tournament_detail' && entityId) {
          window.history.pushState({ view, entityId }, '', `/tournaments/${entityId}`);
        } else if (view === 'admin_dashboard') {
          window.history.pushState({ view }, '', '/admin');
        } else if (view === 'organiser_dashboard') {
          window.history.pushState({ view, entityId }, '', entityId ? `/tournaments/${entityId}?manage=true` : '/tournaments?manage=true');
        } else if (view === 'dota_match_detail' && entityId) {
          window.history.pushState({ view, entityId }, '', `/game/dota2/matches/${entityId}`);
        } else if (view === 'dota_game_profile' && entityId) {
          window.history.pushState({ view, entityId }, '', `/game/dota2/players/${entityId}`);
        } else if (view === 'home') {
          window.history.pushState({ view }, '', '/');
        } else if (view === 'tournaments') {
          window.history.pushState({ view }, '', '/tournaments');
        } else if (view === 'how_it_works') {
          window.history.pushState({ view }, '', '/how-it-works');
        } else if (view === 'about') {
          window.history.pushState({ view }, '', '/about');
        } else if (view === 'contact') {
          window.history.pushState({ view }, '', '/contact');
        } else if (view === 'faq') {
          window.history.pushState({ view }, '', '/faq');
        } else if (view === 'fair_play') {
          window.history.pushState({ view }, '', '/fair-play');
        } else if (view === 'community') {
          window.history.pushState({ view }, '', '/community');
        } else if (view === 'support') {
          window.history.pushState({ view }, '', '/support');
        } else if (view === 'terms') {
          window.history.pushState({ view }, '', '/terms');
        } else if (view === 'privacy') {
          window.history.pushState({ view }, '', '/privacy');
        } else if (view === 'cookies') {
          window.history.pushState({ view }, '', '/cookies');
        } else if (view === 'community_guidelines') {
          window.history.pushState({ view }, '', '/community-guidelines');
        } else if (view === 'organisers') {
          window.history.pushState({ view }, '', '/organisers');
        } else if (view === 'players') {
          window.history.pushState({ view }, '', '/players');
        } else if (view === 'player_profile' && entityId) {
          window.history.pushState({ view, entityId }, '', `/players/${entityId}`);
        } else if (view === 'teams') {
          window.history.pushState({ view }, '', '/teams');
        } else if (view === 'team_profile' && entityId) {
          window.history.pushState({ view, entityId }, '', `/teams/${entityId}`);
        } else if (view === 'rankings') {
          window.history.pushState({ view }, '', '/rankings');
        } else if (view === 'matches') {
          window.history.pushState({ view }, '', '/matches');
        } else if (view === 'bracket') {
          window.history.pushState({ view }, '', '/bracket');
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
      window.parent.postMessage({ 
        type: 'PB_VIEW_CHANGED', 
        view, 
        entityId,
        url: (view === 'auction' || view === 'draft') && entityId
          ? `/tournaments/${entityId}/auction`
          : (view === 'tournament_detail' || view === 'organiser_dashboard') && entityId
            ? `/tournaments/${entityId}`
            : view === 'tournaments'
              ? '/tournaments'
              : '/'
      }, '*');
    }
  };

  const handleCycleTheme = () => {
    themeManager.cyclePalette();
  };

  const handleToggleDarkMode = () => {
    themeManager.toggleMode();
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
      className={`min-h-screen w-full transition-colors duration-200 ${
        colorMode === 'dark' ? currentPalette.darkBg : currentPalette.lightBg
      } ${colorMode === 'dark' ? 'text-stone-100' : 'text-black'} selection:bg-[#FFE600] selection:text-black flex flex-col`}
      style={{
        backgroundImage: colorMode === 'dark'
          ? `radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)`
          : `radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)`,
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
        onOpenCreateTournament={() => setIsCreateTournamentOpen(true)}
        onOpenOnboarding={() => {
          const acc = tournamentService.getCurrentPBGAccount() || pbgAccountRegistry.getAccountByPbgId('PBG-000184');
          if (acc) setOnboardingAccount(acc);
          setIsOnboardingOpen(true);
        }}
        activeThemeName={currentPalette.name}
        onCycleTheme={handleCycleTheme}
        isDarkMode={colorMode === 'dark'}
        onToggleDarkMode={handleToggleDarkMode}
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
                  onOpenCreateTournament={() => setIsCreateTournamentOpen(true)}
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

              {currentView === 'bracket' && (() => {
                const tourneyId = activeEntityId || (tournamentService.getTournaments()[0]?.id || '');
                const struct = dotaCompetitionEngine.getStructure(tourneyId);
                const activeStage = struct?.stages?.[0];

                return (
                  <div className="space-y-6">
                    <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-2">
                      <span className="font-mono text-xs font-black uppercase text-[#7C3AED] block">
                        PURPLE BEAN TOURNAMENT ENGINE · INDIA
                      </span>
                      <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
                        {struct?.tournamentName || 'OFFICIAL COMPETITION'} BRACKET
                      </h1>
                      <p className="font-mono text-xs text-stone-600">
                        {activeStage?.type === 'SINGLE_ELIMINATION' 
                          ? 'Official Single Elimination Knockout bracket. Solid lines indicate progression to finals.'
                          : activeStage?.type === 'SWISS'
                          ? 'Official Swiss System tournament. Contenders paired dynamically round-by-round.'
                          : activeStage?.type === 'GROUP_STAGE'
                          ? 'Official Round-Robin Group Stage standings and fixtures.'
                          : 'Official double elimination bracket. Solid black lines denote winner advancement; dotted red lines demonstrate upper bracket losers dropping directly to lower bracket survival deciders.'}
                      </p>
                    </div>

                    {activeStage?.type === 'SINGLE_ELIMINATION' ? (
                      <SingleEliminationBracket
                        tournamentId={tourneyId}
                        stageConfig={activeStage}
                        onSelectMatch={(mId) => handleNavigate('match_detail', mId)}
                      />
                    ) : activeStage?.type === 'SWISS' ? (
                      <SwissStageView
                        stage={activeStage}
                        tournamentId={tourneyId}
                        onSelectMatch={(mId) => handleNavigate('match_detail', mId)}
                      />
                    ) : activeStage?.type === 'GROUP_STAGE' ? (
                      <GroupStageView
                        stage={activeStage}
                        tournamentId={tourneyId}
                        onSelectMatch={(mId) => handleNavigate('match_detail', mId)}
                      />
                    ) : (
                      <DoubleEliminationBracket 
                        tournamentId={tourneyId} 
                        stageConfig={activeStage}
                        onSelectMatch={(mId) => handleNavigate('match_detail', mId)} 
                      />
                    )}
                  </div>
                );
              })()}

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

              {currentView === 'dota_game_profile' && (
                <DotaGameProfileView
                  pbgId={activeEntityId}
                  onNavigateBack={() => handleNavigate('player_profile', activeEntityId)}
                  onNavigateToTournament={(tId) => handleNavigate('tournament_detail', tId)}
                  onSelectPlayer={(accId) => handleNavigate('dota_game_profile', accId)}
                  onNavigateToPbgProfile={(pId) => handleNavigate('player_profile', pId)}
                  onOpenMatchDetail={(matchId) => handleNavigate('dota_match_detail', matchId)}
                />
              )}

              {currentView === 'dota_match_detail' && (
                <DotaMatchDetailView
                  matchId={activeEntityId}
                  onNavigate={handleNavigate}
                />
              )}

              {currentView === 'rankings' && (
                <RankingsView onNavigate={handleNavigate} />
              )}

              {currentView === 'registered_players' && (
                <RegisteredPlayersView onNavigate={handleNavigate} tournamentId={activeEntityId} />
              )}

              {currentView === 'captain_selection' && (
                <CaptainSelectionView onNavigate={handleNavigate} tournamentId={activeEntityId} />
              )}

              {(currentView === 'auction' || currentView === 'draft' || currentView === 'draft_results') && (
                <AuctionDraft onNavigate={handleNavigate} tournamentId={activeEntityId} />
              )}

              {currentView === 'auction_report' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleNavigate('tournament_detail', activeEntityId || 'pb-game-dota2-1791361091142')}
                      className="bg-white hover:bg-stone-100 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Tournament
                    </button>
                  </div>
                  <AuctionReport tournamentId={activeEntityId || 'pb-game-dota2-1791361091142'} onNavigate={handleNavigate} />
                </div>
              )}

              {currentView === 'organiser_dashboard' && (
                <OrganiserDashboardView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                  onOpenCreateTournament={() => setIsCreateTournamentOpen(true)}
                  initialTournamentId={activeEntityId}
                />
              )}

              {currentView === 'admin_dashboard' && (
                <AdminDashboardView onNavigate={handleNavigate} />
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

              {currentView === 'how_it_works' && (
                <HowItWorksView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                />
              )}

              {currentView === 'about' && (
                <AboutView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                />
              )}

              {currentView === 'contact' && (
                <ContactView onNavigate={handleNavigate} />
              )}

              {currentView === 'faq' && (
                <FaqView onNavigate={handleNavigate} />
              )}

              {currentView === 'fair_play' && (
                <FairPlayView onNavigate={handleNavigate} />
              )}

              {currentView === 'community' && (
                <CommunityView 
                  onNavigate={handleNavigate} 
                  onOpenRegister={handleOpenRegister} 
                />
              )}

              {currentView === 'support' && (
                <SupportView onNavigate={handleNavigate} />
              )}

              {currentView === 'terms' && (
                <TermsView onNavigate={handleNavigate} />
              )}

              {currentView === 'privacy' && (
                <PrivacyView onNavigate={handleNavigate} />
              )}

              {currentView === 'cookies' && (
                <CookiesView onNavigate={handleNavigate} />
              )}

              {currentView === 'community_guidelines' && (
                <CommunityGuidelinesView onNavigate={handleNavigate} />
              )}

              {currentView === 'organisers' && (
                <OrganisersView 
                  onNavigate={handleNavigate} 
                  onOpenCreateTournament={() => setIsCreateTournamentOpen(true)} 
                />
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
                'admin_dashboard',
                'register',
                'dota_game_profile',
                'dota_match_detail',
                'not_found',
                'how_it_works',
                'about',
                'contact',
                'faq',
                'fair_play',
                'community',
                'support',
                'terms',
                'privacy',
                'cookies',
                'community_guidelines',
                'organisers'
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

      {isRegisterOpen && (
        <RegistrationModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          tournamentId={registerTournamentId || activeEntityId || (tournamentService.getTournaments()[0]?.id || '')}
          tournamentName={tournamentService.getTournamentBySlug(registerTournamentId || activeEntityId || '')?.name || tournamentService.getTournaments()[0]?.name || 'Tournament'}
        />
      )}

      {isBrandKitOpen && (
        <BrandKitModal
          isOpen={isBrandKitOpen}
          onClose={() => setIsBrandKitOpen(false)}
        />
      )}

      {/* Reference Loading Screen System Modal */}
      {isLoadingShowcaseOpen && (
        <LoadingScreenSystemModal
          isOpen={isLoadingShowcaseOpen}
          onClose={() => setIsLoadingShowcaseOpen(false)}
        />
      )}

      {/* Admin Access & Credentials Modal (Strictly Restricted to Primary Project Admin) */}
      {isAdminModalOpen && (
        <AdminCredentialsModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onOpenBrandKit={() => setIsBrandKitOpen(true)}
        />
      )}

      {/* Create Tournament Modal (Organiser & Admin Only) */}
      {isCreateTournamentOpen && (
        <CreateTournamentModal
          isOpen={isCreateTournamentOpen}
          onClose={() => setIsCreateTournamentOpen(false)}
          onSuccess={(newTournamentId) => {
            handleNavigate('tournament_detail', newTournamentId);
          }}
        />
      )}

      {/* First-Time PBG Player Onboarding Walkthrough Modal */}
      {isOnboardingOpen && onboardingAccount && (
        <FirstTimeOnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => {
            if (onboardingAccount?.googleUid) {
              pbgAccountRegistry.completeOnboarding(onboardingAccount.googleUid);
              tournamentService.markOnboardingCompleted(onboardingAccount.googleUid);
            }
            setIsOnboardingOpen(false);
          }}
          account={onboardingAccount}
          onComplete={(acc) => {
            if (acc.googleUid) {
              pbgAccountRegistry.completeOnboarding(acc.googleUid);
              tournamentService.markOnboardingCompleted(acc.googleUid);
            }
            setOnboardingAccount(acc);
            setIsOnboardingOpen(false);
          }}
        />
      )}

      {/* Neo-brutalist Footer */}
      <footer className="w-full border-t-[3.5px] border-black bg-white dark:bg-[#141222] mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
            {/* Brand column */}
            <div className="lg:col-span-2 space-y-3">
              <div 
                onClick={() => handleNavigate('home')}
                className="inline-block cursor-pointer group"
                title="Purple Bean Gaming Esports Circuit"
              >
                <PurpleBeanLogo size="md" showText={true} />
              </div>
              <p className="font-mono text-xs text-stone-600 dark:text-stone-300 max-w-sm leading-relaxed">
                India’s premier esports tournament infrastructure featuring real-time captain purse auctions, double-elimination routing, OpenDota verification, and anti-cheat referee auditing for competitive Dota 2.
              </p>
              <div className="pt-1 flex items-center gap-2 font-mono text-[11px] text-stone-500">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-black" />
                <span>SERVER RELAYS ONLINE · MUMBAI &amp; BENGALURU</span>
              </div>
            </div>

            {/* Column 1: PLATFORM */}
            <div className="space-y-3 font-mono">
              <h4 className="font-sans font-black text-xs uppercase tracking-wider text-black dark:text-white">
                PLATFORM
              </h4>
              <ul className="space-y-2 text-xs font-bold text-stone-600 dark:text-stone-300">
                <li>
                  <button onClick={() => handleNavigate('tournaments')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Tournaments
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('players')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Players
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('teams')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Teams
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('rankings')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Rankings
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('how_it_works')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    How It Works
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: COMMUNITY */}
            <div className="space-y-3 font-mono">
              <h4 className="font-sans font-black text-xs uppercase tracking-wider text-black dark:text-white">
                COMMUNITY
              </h4>
              <ul className="space-y-2 text-xs font-bold text-stone-600 dark:text-stone-300">
                <li>
                  <a href="https://discord.gg/w8h6Jv8wsq" target="_blank" rel="noreferrer" className="hover:text-black dark:hover:text-white hover:underline inline-flex items-center gap-1">
                    <span>Discord</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <button onClick={() => handleNavigate('faq')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    FAQ
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('fair_play')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Fair Play
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('support')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Support
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('community')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Community Hub
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: COMPANY */}
            <div className="space-y-3 font-mono">
              <h4 className="font-sans font-black text-xs uppercase tracking-wider text-black dark:text-white">
                COMPANY
              </h4>
              <ul className="space-y-2 text-xs font-bold text-stone-600 dark:text-stone-300">
                <li>
                  <button onClick={() => handleNavigate('about')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    About
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('contact')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Contact
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('organisers')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Organisers
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: LEGAL */}
            <div className="space-y-3 font-mono">
              <h4 className="font-sans font-black text-xs uppercase tracking-wider text-black dark:text-white">
                LEGAL
              </h4>
              <ul className="space-y-2 text-xs font-bold text-stone-600 dark:text-stone-300">
                <li>
                  <button onClick={() => handleNavigate('terms')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Terms
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('privacy')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Privacy
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('cookies')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Cookies
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigate('community_guidelines')} className="hover:text-black dark:hover:text-white hover:underline cursor-pointer">
                    Community Guidelines
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t-2 border-black dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 text-center sm:text-left">
            <div>
              <span>DESIGNED FOR INDIAN ESPORTS</span>
              <span className="mx-2">·</span>
              <span>© 2026 PURPLE BEAN GAMING</span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <button
                onClick={handleToggleDarkMode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 hover:bg-[#FFE600] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all font-mono text-[10px] font-black uppercase"
                title={colorMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {colorMode === 'dark' ? (
                  <>
                    <Sun className="w-3 h-3 text-[#FFE600] fill-[#FFE600]" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3 h-3 text-black fill-black" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
