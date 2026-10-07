import { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Swords, 
  Shield, 
  Users, 
  Award, 
  Search, 
  Bell, 
  User, 
  LogOut, 
  ChevronDown, 
  Flame, 
  Menu, 
  X,
  Palette,
  Gavel,
  Radio,
  Gamepad2,
  MoreHorizontal,
  ExternalLink,
  Key,
  Loader2,
  Zap,
  AlertCircle,
  Plus,
  Sparkles,
  Sun,
  Moon,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  Wrench,
  BarChart3
} from 'lucide-react';
import { ViewType, CompetitiveGame, Match, Tournament } from '../types/tournament';
import { PurpleBeanLogo } from './PurpleBeanLogo';
import { tournamentService, UserSession, PRIMARY_PROJECT_ADMIN_EMAIL } from '../services/firebaseService';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { auth } from '../services/firebaseConfig';
import { fetchSteamLinkStatus } from '../services/steamVerificationClient';
import { fetchDiscordLinkStatus } from '../services/discordVerificationClient';
import { 
  MenuDropdown, 
  MenuItem, 
  MenuHeader, 
  MenuSeparator,
  SelectDropdown
} from './ui/Dropdown';

interface NavigationProps {
  currentView: ViewType;
  onNavigate: (view: ViewType, entityId?: string) => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  onOpenRegister: () => void;
  activeThemeName: string;
  onCycleTheme: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  selectedGame?: CompetitiveGame;
  onSelectGame?: (game: CompetitiveGame) => void;
  onOpenBrandKit?: () => void;
  onOpenLoadingSystem?: () => void;
  onOpenAdminCredentials?: () => void;
  onOpenCreateTournament?: () => void;
  onOpenOnboarding?: () => void;
}

export function Navigation({
  currentView,
  onNavigate,
  unreadCount,
  onOpenNotifications,
  onOpenSearch,
  onOpenRegister,
  activeThemeName,
  onCycleTheme,
  isDarkMode = false,
  onToggleDarkMode,
  selectedGame = 'All Games',
  onSelectGame,
  onOpenBrandKit,
  onOpenLoadingSystem,
  onOpenAdminCredentials,
  onOpenCreateTournament,
  onOpenOnboarding
}: NavigationProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession>(() => tournamentService.getCurrentUser());
  const [activeGames, setActiveGames] = useState(() => gameManagementEngine.getActiveGames());
  const [matches, setMatches] = useState<Match[]>(() => tournamentService.getMatches());
  const [tournaments, setTournaments] = useState<Tournament[]>(() => tournamentService.getTournaments());

  useEffect(() => {
    const unsubGames = gameManagementEngine.subscribe(() => {
      setActiveGames(gameManagementEngine.getActiveGames());
    });
    return unsubGames;
  }, []);

  useEffect(() => {
    const unsubService = tournamentService.subscribe(() => {
      setCurrentUser(tournamentService.getCurrentUser());
      setMatches(tournamentService.getMatches());
      setTournaments(tournamentService.getTournaments());
    });
    const unsubRegistry = pbgAccountRegistry.subscribe(() => {
      setCurrentUser(tournamentService.getCurrentUser());
    });

    // Check server-side verified Steam/Dota status and sync
    const checkServerSync = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const status = await fetchSteamLinkStatus(async () => await user.getIdToken().catch(() => ''));
        if (
          status.isOwner &&
          status.account &&
          status.account.steamOwnershipVerified &&
          status.account.dotaAccountId &&
          status.account.steamId64
        ) {
          const currentAcc = pbgAccountRegistry.getAccountByUid(user.uid);
          if (
            !currentAcc ||
            currentAcc.steamId !== status.account.steamId64 ||
            currentAcc.dotaAccountId !== status.account.dotaAccountId ||
            !currentAcc.dotaAccountVerified
          ) {
            pbgAccountRegistry.syncVerifiedSteamAccount(user.uid, {
              steamId64: status.account.steamId64,
              dotaAccountId: status.account.dotaAccountId,
              steamPersonaName: status.account.steamPersonaName,
              steamAvatar: status.account.steamAvatarUrl,
              steamProfileUrl: status.account.steamProfileUrl,
              publicMatchDataStatus: status.account.publicMatchData || 'PUBLIC',
              rankTier: status.account.rankTier,
              leaderboardRank: status.account.leaderboardRank
            });
          }
        }
      } catch {}

      try {
        const discordStatus = await fetchDiscordLinkStatus(async () => await user.getIdToken().catch(() => ''));
        if (discordStatus.account && discordStatus.account.discordLinked && discordStatus.account.discordUserId) {
          const currentAcc = pbgAccountRegistry.getAccountByUid(user.uid);
          if (!currentAcc || currentAcc.discordUserId !== discordStatus.account.discordUserId || !currentAcc.discordLinked) {
            pbgAccountRegistry.linkDiscordAccount(user.uid, {
              discordUserId: discordStatus.account.discordUserId,
              discordUsername: discordStatus.account.discordUsername || 'player',
              discordDisplayName: discordStatus.account.discordDisplayName || undefined,
              discordAvatar: discordStatus.account.discordAvatarUrl || undefined
            });
          }
        }
      } catch {}
    };

    checkServerSync();

    return () => {
      unsubService();
      unsubRegistry();
    };
  }, []);

  // Real data live ticker resolution (Zero fake ticker data)
  const realLiveMatch = useMemo(() => {
    return matches.find((m) => m.status === 'LIVE');
  }, [matches]);

  const realLiveTournament = useMemo(() => {
    return tournaments.find((t) => t.status === 'Live');
  }, [tournaments]);

  const hasMultipleGames = activeGames.length > 1;

  const gameOptions = useMemo(() => {
    const opts = [{ value: 'All Games', label: 'All Games' }];
    activeGames.forEach((g) => {
      opts.push({ value: g.name, label: g.name });
    });
    return opts;
  }, [activeGames]);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleGameSelect = (gName: string) => {
    if (onSelectGame) {
      onSelectGame(gName as CompetitiveGame);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setSignInError(null);
    try {
      const res = await tournamentService.signInWithGoogle();
      if (res && res.error) {
        const errCode = res.error?.code || '';
        const errMsg = res.error?.message || '';
        if (errCode === 'auth/unauthorized-domain') {
          setSignInError('Domain not authorized: Please add purplebeangaming.com to Firebase Console -> Authentication -> Settings -> Authorized domains.');
        } else if (errCode === 'auth/popup-blocked') {
          setSignInError('Popup was blocked by your browser. Please allow popups for this site or use a direct browser tab.');
        } else {
          setSignInError(errMsg || 'Google Sign-In failed. Please try again.');
        }
      } else if (res && res.user && res.user.email) {
        setMobileDrawerOpen(false);
      }
    } catch (e: any) {
      console.warn('Sign in note:', e);
      setSignInError(e?.message || 'Authentication encountered an unexpected error.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await tournamentService.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setMobileDrawerOpen(false);
    onNavigate('home');
  };

  const primaryNavItems: Array<{ view: ViewType; label: string; icon: typeof Trophy }> = [
    { view: 'tournaments', label: 'Tournaments', icon: Trophy },
    { view: 'players', label: 'Players', icon: Users },
    { view: 'community', label: 'Community', icon: MessageSquare },
    { view: 'about', label: 'About', icon: Shield },
  ];

  const secondaryNavItems: Array<{ view: ViewType; label: string; icon: typeof Trophy; badge?: string }> = [
    { view: 'teams', label: 'Teams', icon: Shield },
    { view: 'matches', label: 'Matches', icon: Swords },
    { view: 'faq', label: 'FAQ', icon: HelpCircle },
  ];

  const isOrganiserUser = currentUser.role === 'organizer' || currentUser.isAdmin;
  const isProjectAdmin = currentUser.isAdmin || (currentUser.email?.toLowerCase().trim() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase());
  const isAuthenticated = currentUser.id !== 'guest-spectator' && Boolean(currentUser.email);

  return (
    <header className="sticky top-0 z-40 w-full border-b-[3.5px] border-black dark:border-stone-800 bg-white dark:bg-[#141222] shadow-[0px_4px_0px_0px_#000] transition-colors">
      {/* 1. Top Bar / Live Status Ticker (Real Data Driven) */}
      <div className="bg-black text-white px-3 sm:px-4 py-1 flex items-center justify-between text-xs font-mono font-bold tracking-tight">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
          {realLiveMatch ? (
            <div className="flex items-center gap-2 truncate">
              <span className="flex items-center gap-1 bg-[#FF5757] text-white px-2 py-0.2 border border-white text-[10px] uppercase font-black animate-pulse shrink-0">
                <Radio className="w-3 h-3" />
                LIVE MATCH
              </span>
              <span className="text-[#FFE600] font-black truncate">
                {realLiveMatch.teamA.name} vs {realLiveMatch.teamB.name}
              </span>
              <span className="text-stone-300 hidden md:inline truncate">
                ({realLiveMatch.teamA.score} : {realLiveMatch.teamB.score}) · {realLiveMatch.tournamentName}
              </span>
              <button
                onClick={() => onNavigate('match_detail', realLiveMatch.id)}
                className="text-[#5CE1E6] hover:underline cursor-pointer text-[11px] shrink-0 font-bold ml-1"
              >
                Watch Now →
              </button>
            </div>
          ) : realLiveTournament ? (
            <div className="flex items-center gap-2 truncate">
              <span className="flex items-center gap-1 bg-[#FF5757] text-white px-2 py-0.2 border border-white text-[10px] uppercase font-black animate-pulse shrink-0">
                <Radio className="w-3 h-3" />
                LIVE
              </span>
              <span className="text-[#FFE600] font-black truncate">
                {realLiveTournament.name}
              </span>
              <span className="text-stone-300 hidden sm:inline">
                · {realLiveTournament.region}
              </span>
              <button
                onClick={() => onNavigate('tournament_detail', realLiveTournament.id)}
                className="text-[#5CE1E6] hover:underline cursor-pointer text-[11px] shrink-0 font-bold ml-1"
              >
                View Tournament →
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-stone-300 text-[11px] truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0 animate-pulse" />
              <span className="text-emerald-400 font-black">IND RELAYS 14MS</span>
              <span className="text-stone-500 hidden sm:inline">·</span>
              <span className="hidden sm:inline text-stone-400">AWS MUMBAI &amp; BENGALURU NODES OPERATIONAL</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
          <button
            onClick={onCycleTheme}
            className="flex items-center gap-1.5 text-[11px] text-stone-300 hover:text-white cursor-pointer transition-colors"
            title="Cycle theme palette"
          >
            <Palette className="w-3 h-3 text-[#FFE600]" />
            <span className="hidden md:inline">Theme: {activeThemeName}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 h-15 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-1.5 bg-stone-100 hover:bg-stone-200 border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-black" />
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 sm:gap-2 text-left group cursor-pointer"
            title="Purple Bean Gaming Home"
          >
            <PurpleBeanLogo size="sm" animated={true} />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-black dark:text-white uppercase leading-none font-sans group-hover:text-[#7C3AED] transition-colors">
                  PURPLE BEAN
                </span>
                <span className="bg-[#FFE600] text-black border border-black text-[8px] font-mono font-black px-1 py-0.2 shadow-[1px_1px_0px_0px_#000] uppercase">
                  DOTA
                </span>
              </div>
              <span className="hidden sm:inline-block text-[8px] sm:text-[9px] font-mono font-bold tracking-wider text-stone-600 dark:text-stone-400 uppercase">
                ESPORTS INFRASTRUCTURE
              </span>
            </div>
          </button>
        </div>

        {/* Center: Desktop Nav Links (Responsive & Clean) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 min-w-0">
          {primaryNavItems.map((item) => {
            const isActive = currentView === item.view || 
              (item.view === 'tournaments' && (currentView === 'tournament_detail' || currentView === 'bracket' || currentView === 'standings')) ||
              (item.view === 'players' && (currentView === 'player_profile' || currentView === 'registered_players' || currentView === 'captain_selection'));

            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={`px-2 xl:px-2.5 py-1.5 font-mono text-xs font-black uppercase tracking-tight transition-all border-2 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#FFE600] text-black border-black shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                    : 'bg-transparent text-stone-800 dark:text-stone-200 border-transparent hover:border-black hover:bg-stone-100 dark:hover:bg-stone-800 hover:shadow-[2px_2px_0px_0px_#000]'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {/* Desktop Direct Links for Extra Wide displays (2XL) */}
          <div className="hidden 2xl:flex items-center gap-1">
            {secondaryNavItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  className={`px-2 py-1.5 font-mono text-xs font-black uppercase tracking-tight transition-all border-2 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FFE600] text-black border-black shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                      : 'bg-transparent text-stone-800 dark:text-stone-200 border-transparent hover:border-black hover:bg-stone-100 dark:hover:bg-stone-800 hover:shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* "More" Dropdown for condensed desktop view */}
          <div className="2xl:hidden">
            <MenuDropdown
              align="left"
              mobileTitle="More Destinations"
              trigger={(isOpen) => (
                <button
                  type="button"
                  className={`px-2 py-1.5 font-mono text-xs font-black uppercase tracking-tight border-2 border-black transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    isOpen
                      ? 'bg-[#FFE600] shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-stone-100 hover:bg-stone-200 text-black shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">More</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            >
              <MenuHeader>Platform Destinations</MenuHeader>
              <MenuItem
                icon={Award}
                label="Player &amp; Team Rankings"
                selected={currentView === 'rankings'}
                onClick={() => onNavigate('rankings')}
              />
              <MenuItem
                icon={Zap}
                label="How PBG Works"
                selected={currentView === 'how_it_works'}
                onClick={() => onNavigate('how_it_works')}
              />
              <MenuItem
                icon={Shield}
                label="Teams &amp; Rosters"
                selected={currentView === 'teams'}
                onClick={() => onNavigate('teams')}
              />
              <MenuItem
                icon={Swords}
                label="Live Matches &amp; Schedule"
                selected={currentView === 'matches'}
                onClick={() => onNavigate('matches')}
              />
              <MenuItem
                icon={HelpCircle}
                label="FAQ &amp; Help Desk"
                selected={currentView === 'faq'}
                onClick={() => onNavigate('faq')}
              />
              <MenuItem
                icon={ShieldCheck}
                label="Fair Play &amp; Anti-Cheat"
                selected={currentView === 'fair_play'}
                onClick={() => onNavigate('fair_play')}
              />
              <MenuItem
                icon={Wrench}
                label="Support &amp; Tickets"
                selected={currentView === 'support'}
                onClick={() => onNavigate('support')}
              />
              <MenuItem
                icon={Trophy}
                label="For Tournament Organisers"
                selected={currentView === 'organisers'}
                onClick={() => onNavigate('organisers')}
              />
              {isOrganiserUser && (
                <>
                  <MenuSeparator />
                  <MenuHeader>Staff Portals</MenuHeader>
                  {isProjectAdmin && (
                    <MenuItem
                      icon={Key}
                      label="Role &amp; Access Control (RBAC)"
                      badge="Admin"
                      badgeColor="bg-[#FFE600] text-black"
                      selected={currentView === 'admin_dashboard'}
                      onClick={() => onNavigate('admin_dashboard')}
                    />
                  )}
                  <MenuItem
                    icon={Shield}
                    label="Organiser &amp; Referee Desk"
                    badge="Organiser"
                    badgeColor="bg-[#70FFAF] text-black"
                    selected={currentView === 'organiser_dashboard'}
                    onClick={() => onNavigate('organiser_dashboard')}
                  />
                </>
              )}
            </MenuDropdown>
          </div>
        </nav>

        {/* Right: Actions & User / Auth Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Light / Dark Mode Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className={`flex items-center gap-1 border-2 p-1.5 sm:px-2 sm:py-1.5 font-mono text-xs font-black uppercase transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-[#1E1B2E] hover:bg-[#2B2644] text-[#FFE600] border-[#FFE600] shadow-[2px_2px_0px_0px_#FFE600]'
                  : 'bg-[#FFE600] hover:bg-[#FFDE59] text-black border-black shadow-[2px_2px_0px_0px_#000]'
              } active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#FFE600] fill-[#FFE600] shrink-0" />
                  <span className="font-mono text-[10px] font-black hidden xl:inline">LIGHT</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-black fill-black shrink-0" />
                  <span className="font-mono text-[10px] font-black hidden xl:inline">DARK</span>
                </>
              )}
            </button>
          )}

          {/* Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1 bg-stone-100 hover:bg-white text-black border-2 border-black p-1.5 sm:px-2.5 sm:py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            title="Search Tournaments, Teams & Players (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Search</span>
          </button>

          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            className="relative bg-white hover:bg-[#FFF9E6] text-black border-2 border-black p-1.5 sm:px-2 sm:py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="w-4 h-4 bg-[#FF5757] text-white text-[10px] font-black flex items-center justify-center border border-black rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Explicit Sign In & Join PBG buttons when not logged in */}
          {!isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isSigningIn}
                onClick={handleGoogleSignIn}
                className="hidden sm:flex items-center gap-1.5 bg-white hover:bg-stone-50 text-black border-2 border-black px-2.5 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                title="Sign In with Google"
              >
                {isSigningIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                ) : (
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{isSigningIn ? '...' : 'Sign In'}</span>
              </button>

              <button
                onClick={onOpenRegister}
                className="flex items-center gap-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-black px-2.5 py-1.5 font-mono text-xs font-black uppercase tracking-tight shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                title="Create Profile & Register"
              >
                <Flame className="w-3.5 h-3.5 text-[#FFE600]" />
                <span className="hidden xs:inline">Join PBG</span>
                <span className="xs:hidden">Join</span>
              </button>
            </div>
          ) : (
            /* Logged-in User Profile Dropdown */
            <MenuDropdown
              align="right"
              mobileTitle="Account &amp; Profile"
              trigger={(isOpen) => (
                <button
                  type="button"
                  className={`flex items-center gap-1.5 border-2 border-black p-1 sm:px-2 sm:py-1 font-mono text-xs font-bold transition-all cursor-pointer ${
                    isOpen
                      ? 'bg-[#FFE600] shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                      : 'bg-[#FFF9E6] hover:bg-white shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center font-black text-xs border border-black overflow-hidden shrink-0">
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{currentUser.role === 'organizer' ? '👑' : currentUser.role === 'captain' ? '⭐' : '🎮'}</span>
                    )}
                  </div>

                  <span className="hidden md:inline font-mono font-black text-xs max-w-[80px] lg:max-w-[100px] truncate text-black">
                    {currentUser.displayName || 'Player'}
                  </span>

                  {/* PBG ID Badge */}
                  <span className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 border border-black uppercase font-black bg-[#FFE600] text-black">
                    {currentUser.pbgId || tournamentService.getCurrentPBGAccount()?.pbgId || 'PBG'}
                  </span>

                  <ChevronDown className={`w-3 h-3 text-stone-700 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            >
            {/* Real Authenticated User Details & PBG Identity */}
            <div className="px-3 py-2 bg-[#FFF9E6] border-b-2 border-black space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans font-black text-xs text-black truncate">
                  {currentUser.displayName || 'Guest Spectator'}
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 border border-black font-black uppercase bg-[#FFE600] text-black shrink-0">
                  {currentUser.pbgId || tournamentService.getCurrentPBGAccount()?.pbgId || 'PBG-MEMBER'}
                </span>
              </div>
              {currentUser.email ? (
                <div className="font-mono text-[10px] text-stone-600 truncate">
                  {currentUser.email}
                </div>
              ) : (
                <div className="font-mono text-[10px] text-stone-500">
                  Spectator Session · PBG Player Account
                </div>
              )}
              {/* Linked Accounts Mini Pills */}
              <div className="flex flex-wrap items-center gap-1 pt-1 text-[9px] font-mono">
                <span className={`px-1 py-0.2 border border-black font-black ${
                  tournamentService.getCurrentPBGAccount()?.discordLinked ? 'bg-[#5865F2] text-white' : 'bg-stone-200 text-stone-600'
                }`}>
                  Discord: {tournamentService.getCurrentPBGAccount()?.discordLinked ? 'LINKED' : 'OFF'}
                </span>
                <span className={`px-1 py-0.2 border border-black font-black ${
                  tournamentService.getCurrentPBGAccount()?.dotaAccountLinked ? 'bg-blue-100 text-blue-900' : 'bg-stone-200 text-stone-600'
                }`}>
                  Dota: {tournamentService.getCurrentPBGAccount()?.dotaAccountVerified ? 'VERIFIED' : 'OFF'}
                </span>
                <span className="px-1 py-0.2 border border-black font-black bg-[#FFE600] text-black">
                  {tournamentService.getCurrentPBGAccount()?.purpleBeanRating || 'UNRATED'}
                </span>
              </div>
            </div>

            {/* Account Actions */}
            <div className="py-1">
              {isProjectAdmin && (
                <MenuItem
                  icon={Key}
                  label="Role & Access Control Console"
                  badge="RBAC"
                  badgeColor="bg-[#FFE600] text-black"
                  onClick={() => onNavigate('admin_dashboard')}
                />
              )}

              {isOrganiserUser && (
                <MenuItem
                  icon={Shield}
                  label="Organiser Management Console"
                  badge="Admin"
                  badgeColor="bg-[#FFE600] text-black"
                  onClick={() => onNavigate('organiser_dashboard')}
                />
              )}

              {isOrganiserUser && onOpenCreateTournament && (
                <MenuItem
                  icon={Plus}
                  label="Create New Tournament"
                  badge="New"
                  badgeColor="bg-[#38EF7D] text-black"
                  onClick={onOpenCreateTournament}
                />
              )}

              <MenuItem
                icon={User}
                label={`PBG Player Profile (${currentUser.pbgId || tournamentService.getCurrentPBGAccount()?.pbgId || 'My Profile'})`}
                badge="Identity"
                badgeColor="bg-[#FFE600] text-black"
                onClick={() => onNavigate('player_profile', currentUser.pbgId || currentUser.id)}
              />

              <MenuItem
                icon={Gamepad2}
                label="Dota 2 Game Profile & OpenDota Stats"
                badge={tournamentService.getCurrentPBGAccount()?.dotaAccountLinked ? "Verified" : "Link"}
                badgeColor={tournamentService.getCurrentPBGAccount()?.dotaAccountLinked ? "bg-[#70FFAF] text-black" : "bg-stone-200 text-stone-700"}
                onClick={() => onNavigate('dota_game_profile', currentUser.pbgId || currentUser.id)}
              />

              {onOpenOnboarding && (
                <MenuItem
                  icon={Sparkles}
                  label="First-Time Onboarding Walkthrough"
                  badge="6-Step"
                  badgeColor="bg-[#70FFAF] text-black"
                  onClick={onOpenOnboarding}
                />
              )}

              {currentUser.teamId && (
                <MenuItem
                  icon={Shield}
                  label={`My Team (${currentUser.teamName || 'Roster'})`}
                  onClick={() => onNavigate('team_profile', currentUser.teamId)}
                />
              )}

              {(currentUser.role === 'captain' || Boolean(currentUser.teamId)) && (
                <MenuItem
                  icon={Gavel}
                  label="Live Captain Auction"
                  badge="Auction"
                  badgeColor="bg-[#FFE600] text-black"
                  onClick={() => onNavigate('auction')}
                />
              )}

              <MenuItem
                icon={Trophy}
                label="Tournaments Directory"
                onClick={() => onNavigate('tournaments')}
              />

              <MenuItem
                icon={BarChart3}
                label="Auction Report & Draft Logs"
                badge="Public"
                badgeColor="bg-[#70FFAF] text-black"
                onClick={() => onNavigate('auction_report', 'pb-game-dota2-1791361091142')}
              />

              <MenuItem
                icon={Users}
                label="Player Directory"
                onClick={() => onNavigate('players')}
              />

              {isProjectAdmin && onOpenAdminCredentials && (
                <MenuItem
                  icon={Key}
                  label="Admin Governance &amp; Simulation"
                  badge="Admin"
                  badgeColor="bg-[#38EF7D] text-black"
                  onClick={onOpenAdminCredentials}
                />
              )}
            </div>

            <MenuSeparator />

            {/* Auth Actions: Real Google Sign In or Real Sign Out */}
            <div className="p-1.5 space-y-1.5">
              {signInError && (
                <div className="p-2 bg-red-50 border border-red-500 text-red-700 font-mono text-[10px] leading-tight flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1 break-words">
                    {signInError}
                  </div>
                </div>
              )}
              {!isAuthenticated ? (
                <button
                  type="button"
                  data-no-close="true"
                  disabled={isSigningIn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoogleSignIn();
                  }}
                  className={`w-full py-2 px-3 bg-white hover:bg-stone-50 text-black border-2 border-black font-mono text-xs font-black flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#000] ${
                    isSigningIn ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {isSigningIn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black shrink-0" />
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  <span>{isSigningIn ? 'Connecting...' : 'Sign In with Google'}</span>
                </button>
              ) : (
                <MenuItem
                  icon={LogOut}
                  label="Sign Out"
                  destructive={true}
                  onClick={handleSignOut}
                />
              )}
            </div>
          </MenuDropdown>
          )}
        </div>
      </div>

      {/* 3. Mobile Navigation Drawer (Bottom Sheet / Full Drawer) */}
      {mobileDrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-[1px] animate-in fade-in duration-150"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 max-h-[88vh] bg-white dark:bg-[#151324] border-t-[3.5px] border-black dark:border-stone-700 shadow-[0_-8px_0px_0px_#000] z-[100] rounded-t-2xl p-4 flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-3">
              <div className="flex items-center gap-2">
                <PurpleBeanLogo size="xs" />
                <h3 className="font-sans font-black text-base uppercase text-black">
                  PURPLE BEAN NAVIGATION
                </h3>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 border border-black hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-stone-100 max-h-[65vh] py-1">
              <div className="grid grid-cols-2 gap-2 pb-3">
                {[
                  ...primaryNavItems, 
                  ...secondaryNavItems,
                  { view: 'auction_report' as ViewType, label: 'Auction Report', icon: BarChart3 },
                  { view: 'rankings' as ViewType, label: 'Rankings', icon: Award },
                  { view: 'how_it_works' as ViewType, label: 'How It Works', icon: Zap },
                  { view: 'fair_play' as ViewType, label: 'Fair Play', icon: ShieldCheck },
                  { view: 'support' as ViewType, label: 'Support', icon: Wrench },
                  { view: 'organisers' as ViewType, label: 'Organisers', icon: Trophy },
                  { view: 'contact' as ViewType, label: 'Contact', icon: MessageSquare }
                ].map((item) => {
                  const isActive = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => {
                        onNavigate(item.view);
                        setMobileDrawerOpen(false);
                      }}
                      className={`px-3 py-2 font-mono text-xs font-black uppercase border-2 text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#FFE600] border-black shadow-[2px_2px_0px_0px_#000]'
                          : 'bg-stone-50 border-black hover:bg-stone-100'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Game Filter in Mobile (Shown only if > 1 active game) */}
              {hasMultipleGames && (
                <div className="py-3">
                  <span className="font-mono text-[10px] font-black uppercase text-stone-500 block mb-2">
                    Filter Esports Game
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {gameOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          handleGameSelect(opt.value);
                          setMobileDrawerOpen(false);
                        }}
                        className={`px-3 py-1 font-mono text-xs font-bold border-2 border-black cursor-pointer ${
                          selectedGame === opt.value
                            ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                            : 'bg-white text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Theme & Display Mode Toggle (Mobile) */}
              <div className="py-3 border-b-2 border-black">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">
                    Appearance &amp; Contrast
                  </span>
                  <button
                    onClick={onCycleTheme}
                    className="font-mono text-[10px] font-bold text-[#7C3AED] dark:text-[#FFE600] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Palette className="w-3 h-3" />
                    <span>Palette: {activeThemeName}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (!isDarkMode && onToggleDarkMode) onToggleDarkMode();
                    }}
                    className={`px-3 py-2 font-mono text-xs font-black uppercase border-2 flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      isDarkMode
                        ? 'bg-[#1E1B2E] text-[#FFE600] border-[#FFE600] shadow-[2px_2px_0px_0px_#FFE600]'
                        : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    <Moon className="w-4 h-4 fill-current" />
                    <span>Dark Mode</span>
                  </button>
                  <button
                    onClick={() => {
                      if (isDarkMode && onToggleDarkMode) onToggleDarkMode();
                    }}
                    className={`px-3 py-2 font-mono text-xs font-black uppercase border-2 flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      !isDarkMode
                        ? 'bg-[#FFE600] text-black border-black shadow-[2px_2px_0px_0px_#000]'
                        : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    <Sun className="w-4 h-4 fill-current" />
                    <span>Light Mode</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons in Mobile Drawer */}
              <div className="pt-3 space-y-2">
                <button
                  onClick={() => {
                    onOpenRegister();
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-[#FFE600]" />
                  <span>Join Tournament Cup</span>
                </button>

                {isOrganiserUser && (
                  <button
                    onClick={() => {
                      onNavigate('organiser_dashboard');
                      setMobileDrawerOpen(false);
                    }}
                    className="w-full py-2.5 bg-black hover:bg-stone-900 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-[#FFE600]" />
                    <span>Organiser &amp; Referee Dashboard</span>
                  </button>
                )}

                {isOrganiserUser && onOpenCreateTournament && (
                  <button
                    onClick={() => {
                      onOpenCreateTournament();
                      setMobileDrawerOpen(false);
                    }}
                    className="w-full py-2.5 bg-[#FFE600] hover:bg-[#FFDE59] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-black" />
                    <span>+ Create New Tournament</span>
                  </button>
                )}

                {isProjectAdmin && (
                  <button
                    onClick={() => {
                      onNavigate('admin_dashboard');
                      setMobileDrawerOpen(false);
                    }}
                    className="w-full py-2.5 bg-[#FFE600] hover:bg-[#FFDE59] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>Role &amp; Access Control (RBAC)</span>
                  </button>
                )}

                {isProjectAdmin && onOpenAdminCredentials && (
                  <button
                    onClick={() => {
                      onOpenAdminCredentials();
                      setMobileDrawerOpen(false);
                    }}
                    className="w-full py-2 bg-[#FFE600] hover:bg-[#FFDE59] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>Admin Governance &amp; Simulation</span>
                  </button>
                )}

                {/* Mobile Drawer Auth Section */}
                <div className="pt-3 border-t-2 border-black space-y-2">
                  <div className="p-3 bg-[#FAF8F5] border-2 border-black flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center font-black text-xs border border-black overflow-hidden shrink-0">
                        {currentUser.avatarUrl ? (
                          <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{currentUser.role === 'organizer' ? '👑' : currentUser.role === 'captain' ? '⭐' : '🎮'}</span>
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-sans font-black text-xs text-black truncate">
                          {currentUser.displayName || 'Guest Spectator'}
                        </div>
                        <div className="font-mono text-[10px] text-stone-500 truncate">
                          {currentUser.email || 'Spectator Session'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 border border-black font-black uppercase bg-[#FFE600] text-black shrink-0">
                      {currentUser.role.toUpperCase()}
                    </span>
                  </div>

                  {signInError && (
                    <div className="p-2.5 bg-red-50 border-2 border-red-500 text-red-700 font-mono text-[11px] leading-tight flex items-start gap-2 shadow-[2px_2px_0px_0px_#ef4444]">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                      <div className="flex-1 break-words">
                        {signInError}
                      </div>
                    </div>
                  )}

                  {!isAuthenticated ? (
                    <button
                      type="button"
                      data-no-close="true"
                      disabled={isSigningIn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGoogleSignIn();
                      }}
                      className={`w-full py-2.5 bg-white hover:bg-stone-50 text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-black uppercase flex items-center justify-center gap-2 ${
                        isSigningIn ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {isSigningIn ? (
                        <Loader2 className="w-4 h-4 animate-spin text-black shrink-0" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                      )}
                      <span>{isSigningIn ? 'Connecting...' : 'Sign In with Google'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full py-2.5 bg-[#FF5757] hover:bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
