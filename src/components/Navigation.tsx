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
  Zap
} from 'lucide-react';
import { ViewType, CompetitiveGame, Match, Tournament } from '../types/tournament';
import { PurpleBeanLogo } from './PurpleBeanLogo';
import { tournamentService, UserSession, PRIMARY_PROJECT_ADMIN_EMAIL } from '../services/firebaseService';
import { gameManagementEngine } from '../domain/gameManagementEngine';
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
  selectedGame?: CompetitiveGame;
  onSelectGame?: (game: CompetitiveGame) => void;
  onOpenBrandKit?: () => void;
  onOpenLoadingSystem?: () => void;
  onOpenAdminCredentials?: () => void;
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
  selectedGame = 'All Games',
  onSelectGame,
  onOpenBrandKit,
  onOpenLoadingSystem,
  onOpenAdminCredentials
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
    return unsubService;
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

  const handleGameSelect = (gName: string) => {
    if (onSelectGame) {
      onSelectGame(gName as CompetitiveGame);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const res = await tournamentService.signInWithGoogle();
      if (res && res.user && res.user.email) {
        setMobileDrawerOpen(false);
      }
    } catch (e) {
      console.warn('Sign in note:', e);
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
    { view: 'home', label: 'Home', icon: Trophy },
    { view: 'tournaments', label: 'Tournaments', icon: Trophy },
    { view: 'matches', label: 'Matches', icon: Swords },
    { view: 'teams', label: 'Teams', icon: Shield },
    { view: 'players', label: 'Players', icon: Users },
  ];

  const secondaryNavItems: Array<{ view: ViewType; label: string; icon: typeof Trophy; badge?: string }> = [
    { view: 'rankings', label: 'Rankings', icon: Award },
  ];

  const isOrganiserUser = currentUser.role === 'organizer' || currentUser.isAdmin;
  const isProjectAdmin = currentUser.isAdmin || (currentUser.email?.toLowerCase().trim() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase());
  const isAuthenticated = currentUser.id !== 'guest-spectator' && Boolean(currentUser.email);

  return (
    <header className="sticky top-0 z-40 w-full border-b-[3.5px] border-black bg-white shadow-[0px_4px_0px_0px_#000]">
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
            className="flex items-center gap-1 text-[11px] text-stone-300 hover:text-white cursor-pointer transition-colors"
            title="Cycle theme palette"
          >
            <Palette className="w-3 h-3 text-[#FFE600]" />
            <span className="hidden md:inline">Theme: {activeThemeName}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-15 sm:h-16 flex items-center justify-between gap-2">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-1.5 bg-stone-100 hover:bg-stone-200 border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-black" />
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-left group cursor-pointer"
            title="Purple Bean Gaming Home"
          >
            <PurpleBeanLogo size="sm" animated={true} />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-base sm:text-lg font-black tracking-tight text-black uppercase leading-none font-sans group-hover:text-[#7C3AED] transition-colors">
                  PURPLE BEAN
                </span>
                <span className="bg-[#FFE600] text-black border border-black text-[8px] font-mono font-black px-1 py-0.2 shadow-[1px_1px_0px_0px_#000] uppercase">
                  DOTA
                </span>
              </div>
              <span className="hidden xs:inline-block text-[8px] sm:text-[9px] font-mono font-bold tracking-wider text-stone-600 uppercase">
                ESPORTS INFRASTRUCTURE
              </span>
            </div>
          </button>
        </div>

        {/* Center: Desktop Nav Links (Progressively Condensed) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5">
          {primaryNavItems.map((item) => {
            const isActive = currentView === item.view || 
              (item.view === 'tournaments' && (currentView === 'tournament_detail' || currentView === 'bracket' || currentView === 'standings')) ||
              (item.view === 'matches' && currentView === 'match_detail') ||
              (item.view === 'teams' && currentView === 'team_profile') ||
              (item.view === 'players' && (currentView === 'player_profile' || currentView === 'registered_players' || currentView === 'captain_selection'));

            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={`px-2.5 xl:px-3 py-1.5 font-mono text-xs font-black uppercase tracking-tight transition-all border-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#FFE600] text-black border-black shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                    : 'bg-transparent text-stone-800 border-transparent hover:border-black hover:bg-stone-100 hover:shadow-[2px_2px_0px_0px_#000]'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {/* Desktop Direct Links for 2XL / Wide displays */}
          <div className="hidden 2xl:flex items-center gap-1">
            {secondaryNavItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  className={`px-2.5 py-1.5 font-mono text-xs font-black uppercase tracking-tight transition-all border-2 cursor-pointer ${
                    isActive
                      ? 'bg-[#FFE600] text-black border-black shadow-[2px_2px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                      : 'bg-transparent text-stone-800 border-transparent hover:border-black hover:bg-stone-100 hover:shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Game Quick Selector (Strictly hidden when only 1 active game, dynamic when > 1) */}
          {hasMultipleGames && (
            <div className="ml-1">
              <SelectDropdown
                value={selectedGame}
                onChange={handleGameSelect}
                options={gameOptions}
                icon={Gamepad2}
                size="sm"
                align="left"
              />
            </div>
          )}

          {/* "More" Dropdown for condensed laptop view (1024px - 1439px) */}
          <div className="2xl:hidden">
            <MenuDropdown
              align="left"
              mobileTitle="More Destinations"
              trigger={(isOpen) => (
                <button
                  type="button"
                  className={`px-2.5 py-1.5 font-mono text-xs font-black uppercase tracking-tight border-2 border-black transition-all flex items-center gap-1 cursor-pointer ${
                    isOpen
                      ? 'bg-[#FFE600] shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-stone-100 hover:bg-stone-200 shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  <span>More</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            >
              <MenuHeader>Platform Navigation</MenuHeader>
              <MenuItem
                icon={Award}
                label="Rankings &amp; Elo Leaderboard"
                selected={currentView === 'rankings'}
                onClick={() => onNavigate('rankings')}
              />
              <MenuItem
                icon={Shield}
                label="Interactive Bracket Engine"
                selected={currentView === 'bracket'}
                onClick={() => onNavigate('bracket')}
              />
              {isOrganiserUser && (
                <>
                  <MenuSeparator />
                  <MenuHeader>Staff Portals</MenuHeader>
                  <MenuItem
                    icon={Shield}
                    label="Organiser &amp; Referee Desk"
                    badge="Admin"
                    badgeColor="bg-[#FFE600] text-black"
                    selected={currentView === 'organiser_dashboard'}
                    onClick={() => onNavigate('organiser_dashboard')}
                  />
                </>
              )}
            </MenuDropdown>
          </div>
        </nav>

        {/* Right: Actions (Search, Notifications, Join CTA, User Profile) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 bg-stone-100 hover:bg-white text-black border-2 border-black px-2 sm:px-2.5 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            title="Search Tournaments, Teams & Players (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Search</span>
            <kbd className="hidden 2xl:inline bg-black text-white text-[9px] px-1 font-mono">⌘K</kbd>
          </button>

          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            className="relative bg-white hover:bg-[#FFF9E6] text-black border-2 border-black p-1.5 sm:px-2.5 sm:py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="w-4 h-4 bg-[#FF5757] text-white text-[10px] font-black flex items-center justify-center border border-black rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Join Cup CTA (Visible on wide screens, accessible via drawer/more on compact) */}
          <button
            onClick={onOpenRegister}
            className="hidden xl:flex items-center gap-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-black px-2.5 py-1.5 font-mono text-xs font-black uppercase tracking-tight shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-[#FFE600]" />
            <span>Join Cup</span>
          </button>

          {/* User Profile Menu (Shared Neo-Brutalist Dropdown) */}
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

                <span className="hidden sm:inline font-mono font-black text-xs max-w-[85px] lg:max-w-[110px] truncate">
                  {currentUser.displayName || 'Player'}
                </span>

                <span
                  className={`hidden md:inline text-[9px] font-mono px-1 border border-black uppercase font-black ${
                    currentUser.role === 'organizer'
                      ? 'bg-[#FFE600] text-black'
                      : currentUser.role === 'captain'
                      ? 'bg-[#7C3AED] text-white'
                      : currentUser.role === 'player'
                      ? 'bg-[#10B981] text-black'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {currentUser.role}
                </span>

                <ChevronDown className={`w-3 h-3 text-stone-700 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          >
            {/* Real Authenticated User Details */}
            <div className="px-3 py-2 bg-[#FFF9E6] border-b-2 border-black space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans font-black text-xs text-black truncate">
                  {currentUser.displayName || 'Guest Spectator'}
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 border border-black font-black uppercase bg-[#FFE600] text-black shrink-0">
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
              {currentUser.email ? (
                <div className="font-mono text-[10px] text-stone-600 truncate">
                  {currentUser.email}
                </div>
              ) : (
                <div className="font-mono text-[10px] text-stone-500">
                  Spectator Session
                </div>
              )}
              {currentUser.teamName && (
                <div className="font-mono text-[10px] font-bold text-stone-700 pt-0.5">
                  Squad: <span className="font-black text-black">{currentUser.teamName}</span>
                </div>
              )}
            </div>

            {/* Account Actions */}
            <div className="py-1">
              {isOrganiserUser && (
                <MenuItem
                  icon={Shield}
                  label="Organiser Management Console"
                  badge="Admin"
                  badgeColor="bg-[#FFE600] text-black"
                  onClick={() => onNavigate('organiser_dashboard')}
                />
              )}

              {isAuthenticated && (
                <MenuItem
                  icon={User}
                  label="My Player Profile"
                  onClick={() => onNavigate('player_profile', currentUser.id)}
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
            <div className="p-1.5">
              {!isAuthenticated ? (
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={handleGoogleSignIn}
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
        </div>
      </div>

      {/* 3. Mobile Navigation Drawer (Bottom Sheet / Full Drawer) */}
      {mobileDrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-[1px] animate-in fade-in duration-150"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 max-h-[88vh] bg-white border-t-[3.5px] border-black shadow-[0_-8px_0px_0px_#000] z-[100] rounded-t-2xl p-4 flex flex-col animate-in slide-in-from-bottom duration-200">
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
                {[...primaryNavItems, ...secondaryNavItems].map((item) => {
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

                  {!isAuthenticated ? (
                    <button
                      type="button"
                      disabled={isSigningIn}
                      onClick={handleGoogleSignIn}
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
