import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  UserCheck,
  ShieldAlert,
  Users,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Gavel,
  Crown,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Edit3
} from 'lucide-react';
import {
  DUMMY_TEST_PLAYERS,
  DUMMY_TEST_CAPTAINS,
  TEST_TOURNAMENT_ID,
  TestCaptainActionAudit,
  isTournamentInTestMode
} from '../domain/auctionTestFixtures';
import { auctionTestClient, TestIdentitiesState } from '../services/auctionTestClient';
import { tournamentService } from '../services/firebaseService';

interface OrganizerTestToolsPanelProps {
  tournamentId?: string;
  onRefresh?: () => void;
}

export const OrganizerTestToolsPanel: React.FC<OrganizerTestToolsPanelProps> = ({
  tournamentId = TEST_TOURNAMENT_ID,
  onRefresh
}) => {
  const currentUser = tournamentService.getCurrentUser();
  const isAdminOrOrganizer = currentUser.isAdmin || currentUser.role === 'organizer';

  const [activeTab, setActiveTab] = useState<'control' | 'identities' | 'integrity' | 'audit'>('control');
  const [selectedCaptainUid, setSelectedCaptainUid] = useState<'pbg-test-captain-02' | 'pbg-test-captain-03'>('pbg-test-captain-02');
  const [bidIncrement, setBidIncrement] = useState<number>(10);
  const [customBidAmount, setCustomBidAmount] = useState<number>(20);
  const [selectedNomineeId, setSelectedNomineeId] = useState<string>('');
  const [nomineeOpeningBid, setNomineeOpeningBid] = useState<number>(10);

  // Custom team branding inputs
  const [customTeamName, setCustomTeamName] = useState('Test Team Alpha');
  const [customTeamTag, setCustomTeamTag] = useState('TTA');
  const [customColor, setCustomColor] = useState('#3B82F6');

  // Full reset toggle
  const [fullResetConfirmed, setFullResetConfirmed] = useState(false);

  // Status & notifications
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [integrityReport, setIntegrityReport] = useState<any>(null);

  // Reactive state from client service
  const [testState, setTestState] = useState<TestIdentitiesState>(() =>
    auctionTestClient.getLocalIdentities(tournamentId)
  );

  const refreshState = async () => {
    try {
      const data = await auctionTestClient.getIdentities(tournamentId);
      setTestState(data);
    } catch {
      setTestState(auctionTestClient.getLocalIdentities(tournamentId));
    }
  };

  useEffect(() => {
    refreshState();
  }, [tournamentId]);

  const participantsList = testState.participants || [];
  const registrationsList = testState.registrations || [];
  const session = testState.session;

  // Detect real registration
  const realRegistration = registrationsList.find(
    (r: any) => !r.isTestAccount && r.source !== 'TEST_SEED' && !r.userId.startsWith('pbg-test-')
  );
  const realParticipant = realRegistration
    ? participantsList.find((p: any) => p.userId === realRegistration.userId)
    : null;

  // Test captains status
  const captain02Part = participantsList.find((p: any) => p.userId === 'pbg-test-captain-02');
  const captain03Part = participantsList.find((p: any) => p.userId === 'pbg-test-captain-03');

  // Auction teams
  const team02 = session ? Object.values(session.teams || {}).find((t: any) => t.captainUserId === 'pbg-test-captain-02') : null;
  const team03 = session ? Object.values(session.teams || {}).find((t: any) => t.captainUserId === 'pbg-test-captain-03') : null;
  const currentTeam = selectedCaptainUid === 'pbg-test-captain-02' ? team02 : team03;

  // Available players for nomination
  const availablePlayers = session && session.players && Object.keys(session.players).length > 0
    ? Object.values(session.players).filter((p: any) => p.status === 'AVAILABLE')
    : participantsList.filter((p: any) => p.tournamentRole === 'PLAYER' && p.auctionStatus === 'AVAILABLE');

  const audits = testState.audits || [];

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSeedPlayers = async () => {
    setBusyAction('seed_players');
    try {
      const res = await auctionTestClient.seedPlayers(tournamentId);
      showNotice(`Successfully seeded ${res.count || 15} balanced dummy test players (PBG-TEST-001 to PBG-TEST-015).`);
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSeedCaptains = async () => {
    setBusyAction('seed_captains');
    try {
      const res = await auctionTestClient.seedCaptains(tournamentId);
      const capNames = res.captains?.map((c: any) => c.pbgId).join(', ') || 'PBG-TEST-CAPTAIN-02, PBG-TEST-CAPTAIN-03';
      showNotice(`Successfully seeded 2 test captain candidates (${capNames}).`);
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAssignCaptains = async () => {
    setBusyAction('assign_captains');
    try {
      await auctionTestClient.assignCaptains(tournamentId);
      showNotice(`Test captains assigned: Slot 2 → Test Captain 02, Slot 3 → Test Captain 03. Slot 1 preserved for your real account.`);
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunIntegrityCheck = async () => {
    setBusyAction('integrity');
    try {
      const report = await auctionTestClient.runIntegrityCheck(tournamentId);
      setIntegrityReport(report);
      setActiveTab('integrity');
      if (report && report.valid) {
        showNotice('Auction Integrity Check PASSED. All purses, slot limits, and rosters are valid.');
      } else {
        showNotice(`Auction Integrity Check reported ${report?.errors?.length || 0} issue(s).`, 'error');
      }
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm(
      fullResetConfirmed
        ? 'WARNING: This will purge ALL data for this tournament INCLUDING your real second account registration. Are you sure?'
        : 'Reset auction runtime, dummy teams, bids, and test state? (Your real second account registration will be preserved).'
    )) {
      return;
    }

    setBusyAction('reset');
    try {
      const res = await auctionTestClient.resetTestData(tournamentId, fullResetConfirmed);
      showNotice(res.message || 'Auction test data reset.');
      setFullResetConfirmed(false);
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteFixtures = async () => {
    if (!window.confirm('Delete all dummy test players and dummy captains from this tournament? Real registrations are preserved.')) {
      return;
    }

    setBusyAction('delete_fixtures');
    try {
      const res = await auctionTestClient.deleteFixtures(tournamentId);
      showNotice(`Removed ${res.deletedCount || 0} dummy test identities from this tournament.`);
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleExecuteBid = async () => {
    if (!session || !session.currentNomination) {
      showNotice('No player is currently on the auction block to bid on.', 'error');
      return;
    }

    const currentBid = session.currentNomination.currentBid;
    const bidAmount = customBidAmount > currentBid ? customBidAmount : currentBid + bidIncrement;

    setBusyAction('bid');
    try {
      await auctionTestClient.controlCaptainAction(tournamentId, selectedCaptainUid, {
        type: 'BID',
        bidAmount
      });
      showNotice(`Placed bid of ${bidAmount} CR on behalf of ${selectedCaptainUid === 'pbg-test-captain-02' ? 'Test Captain 02' : 'Test Captain 03'}.`);
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleExecuteNomination = async () => {
    if (!selectedNomineeId) {
      showNotice('Please select an available player to nominate.', 'error');
      return;
    }

    setBusyAction('nominate');
    try {
      await auctionTestClient.controlCaptainAction(tournamentId, selectedCaptainUid, {
        type: 'NOMINATE',
        playerId: selectedNomineeId,
        openingBid: nomineeOpeningBid || 10
      });
      showNotice(`Nominated player ${selectedNomineeId} on behalf of ${selectedCaptainUid === 'pbg-test-captain-02' ? 'Test Captain 02' : 'Test Captain 03'}.`);
      setSelectedNomineeId('');
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateTeamBranding = async () => {
    setBusyAction('brand');
    try {
      await auctionTestClient.controlCaptainAction(tournamentId, selectedCaptainUid, {
        type: 'CUSTOMIZE_TEAM',
        teamName: customTeamName,
        teamTag: customTeamTag,
        color: customColor
      });
      showNotice(`Updated dummy team branding to ${customTeamName} (${customTeamTag}).`);
      await refreshState();
      onRefresh?.();
    } catch (err: any) {
      showNotice(err.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  if (!isAdminOrOrganizer) {
    return (
      <div className="bg-red-50 border-4 border-black p-6 font-mono text-xs text-red-900 shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2 font-black uppercase text-sm mb-2 text-red-950">
          <ShieldAlert className="w-5 h-5" />
          <span>Access Denied</span>
        </div>
        <p>Organizer Test Tools are strictly restricted to verified tournament administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#FFE600] text-black border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-black uppercase bg-black text-[#FFE600] px-3 py-1 border border-black flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>TEST TOURNAMENT · testMode: active</span>
            </span>
            <span className="font-mono text-xs font-black uppercase bg-white text-black px-2.5 py-1 border border-black">
              Production-Safe Sandbox
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs font-black">
            <span className="bg-purple-900 text-white px-2.5 py-1 border border-black">
              3 Teams / 3 Captains
            </span>
            <span className="bg-purple-900 text-white px-2.5 py-1 border border-black">
              Purse: 1000 CR
            </span>
            <span className="bg-purple-900 text-white px-2.5 py-1 border border-black">
              Roster: 5+1
            </span>
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-sans">
          Organizer Test Controls &amp; Simulation Suite
        </h2>
        <p className="font-mono text-xs text-stone-900 max-w-3xl mt-1.5 leading-relaxed">
          Dedicated validation environment for testing PBG player registration, captain approval, Discord role synchronization (Tournament Player, Captain, Team Role, Elimination cleanup), and live auction bidding with real vs dummy identities.
        </p>

        <div className="mt-4 p-3 bg-white border-2 border-black font-mono text-xs text-stone-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0" />
          <span>
            <strong>Isolated Safety Guarantee:</strong> Matches in this tournament will never alter public ratings, seasonal leaderboards, or permanent career statistics.
          </span>
        </div>
      </div>

      {/* Action Notification */}
      {notice && (
        <div className={`p-4 border-4 border-black font-mono text-xs font-black flex items-center justify-between shadow-[4px_4px_0px_0px_#000] animate-in fade-in ${
          notice.type === 'error' ? 'bg-red-100 text-red-950 border-red-950' : 'bg-[#70FFAF] text-black'
        }`}>
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="px-2 py-0.5 border border-black hover:bg-black hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Real Account Flow Status Card */}
      <div className="bg-white border-4 border-black p-5 shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-700" />
            <h3 className="font-sans text-lg font-black uppercase">
              Real Account Verification Status (Second PBG Account)
            </h3>
          </div>
          <span className="font-mono text-xs font-bold text-stone-500">
            Target Slot: Captain Slot 1
          </span>
        </div>

        {realRegistration ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="bg-stone-50 border-2 border-black p-3">
              <span className="text-stone-500 uppercase font-bold block mb-1">Registration</span>
              <span className="font-black text-sm text-black block">{realRegistration.ign}</span>
              <span className={`inline-block px-1.5 py-0.5 mt-1 border border-black font-bold uppercase text-[10px] ${
                realRegistration.status === 'APPROVED' ? 'bg-[#70FFAF] text-black' : 'bg-yellow-200 text-black'
              }`}>
                {realRegistration.status}
              </span>
            </div>

            <div className="bg-stone-50 border-2 border-black p-3">
              <span className="text-stone-500 uppercase font-bold block mb-1">Discord Status</span>
              <span className="font-black text-sm block">
                {realRegistration.identitySnapshot?.discordUserId ? 'CONNECTED' : 'NOT LINKED'}
              </span>
              <span className="text-stone-500 text-[10px] block mt-1">
                {realRegistration.identitySnapshot?.discordUserId ? 'Real role pipeline active' : 'Link via PBG Profile'}
              </span>
            </div>

            <div className="bg-stone-50 border-2 border-black p-3">
              <span className="text-stone-500 uppercase font-bold block mb-1">Captain Application</span>
              <span className="font-black text-sm block">
                {realRegistration.interestedInCaptaincy || realRegistration.applyingAsCaptain ? 'APPLIED' : 'REGULAR PLAYER'}
              </span>
              <span className="text-stone-500 text-[10px] block mt-1">
                {realParticipant?.tournamentRole === 'CAPTAIN' ? '✓ Assigned to Slot 1' : 'Pending Selection'}
              </span>
            </div>

            <div className="bg-stone-50 border-2 border-black p-3">
              <span className="text-stone-500 uppercase font-bold block mb-1">Desired Discord Roles</span>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="px-1.5 py-0.5 bg-black text-white text-[10px] font-bold">PBG Member</span>
                {realRegistration.status === 'APPROVED' && (
                  <span className="px-1.5 py-0.5 bg-purple-700 text-white text-[10px] font-bold">Tournament Player</span>
                )}
                {realParticipant?.tournamentRole === 'CAPTAIN' && (
                  <span className="px-1.5 py-0.5 bg-[#FFE600] text-black text-[10px] font-bold">Captain</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFFDE8] border-2 border-black p-4 font-mono text-xs">
            <div className="flex items-center gap-2 font-black uppercase text-amber-900 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>Awaiting Registration from Your Second PBG Account</span>
            </div>
            <p className="text-stone-700 leading-relaxed">
              Open another browser window or incognito session, log in with your second PBG account, ensure Discord is connected, and register for <strong>Purple Bean Auction Test</strong> with "I want to be considered as Captain".
            </p>
          </div>
        )}
      </div>

      {/* Main Test Tools Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b-4 border-black pb-2">
        <button
          onClick={() => setActiveTab('control')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
            activeTab === 'control'
              ? 'bg-black text-[#FFE600] shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          <Gavel className="w-3.5 h-3.5 inline mr-1.5" />
          Control Test Captains
        </button>

        <button
          onClick={() => setActiveTab('identities')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
            activeTab === 'identities'
              ? 'bg-black text-[#FFE600] shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          View Test Identities (15 Players / 2 Captains)
        </button>

        <button
          onClick={() => setActiveTab('integrity')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
            activeTab === 'integrity'
              ? 'bg-black text-[#FFE600] shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
          Auction Integrity Check
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-black text-[#FFE600] shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
          Audit Trail ({audits.length})
        </button>
      </div>

      {/* Tab 1: Control Test Captains */}
      {activeTab === 'control' && (
        <div className="space-y-6">
          {/* Quick Actions Bar */}
          <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={Boolean(busyAction)}
                onClick={handleSeedPlayers}
                className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
              >
                1. Seed 15 Dummy Players
              </button>

              <button
                disabled={Boolean(busyAction)}
                onClick={handleSeedCaptains}
                className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
              >
                2. Seed 2 Dummy Captains
              </button>

              <button
                disabled={Boolean(busyAction)}
                onClick={handleAssignCaptains}
                className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-purple-600 text-white border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
              >
                3. Assign Dummy Captains (Slots 2 &amp; 3)
              </button>

              <button
                disabled={Boolean(busyAction)}
                onClick={handleRunIntegrityCheck}
                className="px-3 py-1.5 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
              >
                Run Integrity Check
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-stone-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fullResetConfirmed}
                  onChange={(e) => setFullResetConfirmed(e.target.checked)}
                  className="rounded border-black text-red-600 focus:ring-0"
                />
                <span className="text-[11px] font-bold">Include Real Registrations</span>
              </label>

              <button
                disabled={Boolean(busyAction)}
                onClick={handleResetData}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Auction Data</span>
              </button>

              <button
                disabled={Boolean(busyAction)}
                onClick={handleDeleteFixtures}
                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
                title="Delete only dummy test players/captains"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Captain Selector Switcher */}
          <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-6">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div>
                <h3 className="font-sans text-xl font-black uppercase">
                  Impersonate / Control Dummy Captain
                </h3>
                <p className="font-mono text-xs text-stone-600 mt-0.5">
                  Allows tournament admin to bid, nominate, and configure team branding for test captains without bypassing auction business rules.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedCaptainUid('pbg-test-captain-02');
                    setCustomTeamName('Test Team Alpha');
                    setCustomTeamTag('TTA');
                    setCustomColor('#3B82F6');
                  }}
                  className={`px-3.5 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
                    selectedCaptainUid === 'pbg-test-captain-02'
                      ? 'bg-[#3B82F6] text-white shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-white hover:bg-stone-100 text-black'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 inline mr-1" />
                  Test Captain 02 (Alpha)
                </button>

                <button
                  onClick={() => {
                    setSelectedCaptainUid('pbg-test-captain-03');
                    setCustomTeamName('Test Team Beta');
                    setCustomTeamTag('TTB');
                    setCustomColor('#EC4899');
                  }}
                  className={`px-3.5 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
                    selectedCaptainUid === 'pbg-test-captain-03'
                      ? 'bg-[#EC4899] text-white shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-white hover:bg-stone-100 text-black'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 inline mr-1" />
                  Test Captain 03 (Beta)
                </button>
              </div>
            </div>

            {/* Captain Snapshot Card */}
            <div className="bg-stone-50 border-2 border-black p-4 font-mono text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-stone-500 uppercase font-bold block mb-1">Acting As</span>
                <span className="font-black text-sm text-black block">
                  {selectedCaptainUid === 'pbg-test-captain-02' ? 'Test Captain 02' : 'Test Captain 03'}
                </span>
                <span className="text-[10px] text-purple-700 font-bold block">
                  {selectedCaptainUid === 'pbg-test-captain-02' ? 'CaptainAlpha (Slot 2)' : 'CaptainBeta (Slot 3)'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 uppercase font-bold block mb-1">Purse Balance</span>
                <span className="font-black text-base text-emerald-700 block">
                  {currentTeam ? `${(currentTeam as any).purseRemaining ?? 1000} / ${(currentTeam as any).purseTotal ?? 1000} CR` : '1000 CR (Pending Start)'}
                </span>
                <span className="text-[10px] text-stone-500 block">
                  Min bid increment: 10 CR
                </span>
              </div>

              <div>
                <span className="text-stone-500 uppercase font-bold block mb-1">Roster Progress</span>
                <span className="font-black text-sm block">
                  {currentTeam ? `${(currentTeam as any).primaryRosterUserIds?.length ?? (currentTeam as any).rosterCount ?? 1}/5 Primary` : '1/5 (Captain Assigned)'}
                </span>
                <span className="text-[10px] text-stone-500 block">
                  {(currentTeam as any)?.standInUserIds?.length || 0}/1 Stand-in
                </span>
              </div>

              <div>
                <span className="text-stone-500 uppercase font-bold block mb-1">Security Audit</span>
                <span className="text-[10px] bg-black text-[#FFE600] px-2 py-0.5 border border-black inline-block font-black">
                  AUDITED ADMIN ACTION
                </span>
                <span className="text-[10px] text-stone-500 block mt-1">
                  Actor: {currentUser.email || currentUser.id}
                </span>
              </div>
            </div>

            {/* Bidding & Nomination Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box 1: Bidding on Active Player */}
              <div className="bg-[#F8F9FA] border-2 border-black p-4 space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-black pb-2">
                  <Gavel className="w-4 h-4 text-purple-700" />
                  <h4 className="font-sans font-black text-sm uppercase">Place Bid on Active Lot</h4>
                </div>

                {session && session.currentNomination ? (
                  <div className="space-y-3">
                    <div className="bg-white border border-black p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-stone-500 font-bold uppercase">Nominated Player:</span>
                        <span className="font-black text-black">
                          {session.players[session.currentNomination.nominatedPlayerId]?.displayName || session.currentNomination.nominatedPlayerId}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-stone-500 font-bold uppercase">Current High Bid:</span>
                        <span className="font-black text-base text-purple-700">
                          {session.currentNomination.currentBid} Credits
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 font-bold uppercase">Leading Team:</span>
                        <span className="font-bold text-black">
                          {session.teams[session.currentNomination.currentLeaderTeamId || '']?.name || 'None'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={Boolean(busyAction)}
                        onClick={() => { setBidIncrement(10); handleExecuteBid(); }}
                        className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
                      >
                        Bid +10 Credits
                      </button>

                      <button
                        disabled={Boolean(busyAction)}
                        onClick={() => { setBidIncrement(50); handleExecuteBid(); }}
                        className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
                      >
                        Bid +50 Credits
                      </button>

                      <button
                        disabled={Boolean(busyAction)}
                        onClick={() => { setBidIncrement(100); handleExecuteBid(); }}
                        className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
                      >
                        Bid +100 Credits
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-stone-100 border border-stone-300 p-4 text-center text-stone-500">
                    No active nomination in auction room right now. Nominate a player below to start bidding.
                  </div>
                )}
              </div>

              {/* Box 2: Nominate Player */}
              <div className="bg-[#F8F9FA] border-2 border-black p-4 space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-black pb-2">
                  <ChevronRight className="w-4 h-4 text-purple-700" />
                  <h4 className="font-sans font-black text-sm uppercase">Nominate Player on Behalf of Captain</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-stone-700 uppercase block mb-1">
                      Select Available Player:
                    </label>
                    <select
                      value={selectedNomineeId}
                      onChange={(e) => setSelectedNomineeId(e.target.value)}
                      className="w-full p-2 bg-white border-2 border-black font-mono text-xs font-bold"
                    >
                      <option value="">-- Choose player from auction pool --</option>
                      {availablePlayers.map(p => (
                        <option key={(p as any).id || (p as any).userId} value={(p as any).id || (p as any).userId}>
                          {(p as any).displayName || (p as any).ign} ({(p as any).tournamentMMR || (p as any).mmr || '5000'} MMR · {(p as any).primaryRole || 'Carry'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <label className="font-bold text-stone-700 uppercase block mb-1">Opening Bid</label>
                      <input
                        type="number"
                        min="10"
                        step="10"
                        value={nomineeOpeningBid}
                        onChange={(e) => setNomineeOpeningBid(Number(e.target.value))}
                        className="w-full p-2 bg-white border-2 border-black font-mono text-xs font-bold"
                      />
                    </div>

                    <button
                      disabled={Boolean(busyAction) || !selectedNomineeId}
                      onClick={handleExecuteNomination}
                      className="mt-5 px-4 py-2 bg-black hover:bg-stone-800 text-white border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Gavel className="w-3.5 h-3.5 text-[#FFE600]" />
                      <span>Nominate Now</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 3: Placeholder Team Customization */}
            <div className="bg-stone-50 border-2 border-black p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 border-b border-black pb-2">
                <Edit3 className="w-4 h-4 text-purple-700" />
                <h4 className="font-sans font-black text-sm uppercase">Placeholder Team Customization</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-stone-700 uppercase block mb-1">Team Name</label>
                  <input
                    type="text"
                    value={customTeamName}
                    onChange={(e) => setCustomTeamName(e.target.value)}
                    className="w-full p-2 bg-white border-2 border-black font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 uppercase block mb-1">Team Tag (3-4 chars)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={customTeamTag}
                    onChange={(e) => setCustomTeamTag(e.target.value.toUpperCase())}
                    className="w-full p-2 bg-white border-2 border-black font-bold uppercase"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    disabled={Boolean(busyAction)}
                    onClick={handleUpdateTeamBranding}
                    className="w-full py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
                  >
                    Save Dummy Branding
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Test Identities List */}
      {activeTab === 'identities' && (
        <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div>
              <h3 className="font-sans text-xl font-black uppercase">
                Seeded Test Identities Inspector
              </h3>
              <p className="text-stone-600 mt-0.5">
                Explicit test accounts bypassing Discord &amp; Dota verification in testMode. Notice: NO fake Discord badges.
              </p>
            </div>
            <span className="font-bold px-2 py-1 bg-stone-100 border border-black">
              15 Players · 2 Captains
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-2 border-black text-left">
              <thead className="bg-black text-white text-[11px] uppercase font-black">
                <tr>
                  <th className="p-2.5 border border-black">PBG ID</th>
                  <th className="p-2.5 border border-black">Display Name</th>
                  <th className="p-2.5 border border-black">Tournament MMR</th>
                  <th className="p-2.5 border border-black">Role (Primary / Secondary)</th>
                  <th className="p-2.5 border border-black">Identity Verification</th>
                  <th className="p-2.5 border border-black">Auction Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {/* 2 Captains */}
                {DUMMY_TEST_CAPTAINS.map(c => {
                  const part = participantsList.find((pt: any) => pt.userId === c.uid);
                  return (
                    <tr key={c.uid} className="bg-purple-50 font-bold">
                      <td className="p-2.5 border border-black font-black text-purple-900">{c.pbgId}</td>
                      <td className="p-2.5 border border-black flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-purple-700" />
                        <span>{c.displayName} ({c.inGameName})</span>
                      </td>
                      <td className="p-2.5 border border-black text-purple-900">{c.mmr}</td>
                      <td className="p-2.5 border border-black">{c.primaryRole} / {c.secondaryRole}</td>
                      <td className="p-2.5 border border-black">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-yellow-200 text-black text-[10px] font-black border border-black">
                            TEST IDENTITY
                          </span>
                          <span className="px-1.5 py-0.5 bg-stone-200 text-stone-700 text-[10px] border border-black">
                            External checks bypassed
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 border border-black">
                        <span className="px-2 py-0.5 bg-purple-700 text-white text-[10px] uppercase font-black">
                          {part?.captainSlotId ? `CAPTAIN (${part.captainSlotId})` : 'CANDIDATE'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* 15 Regular Players */}
                {DUMMY_TEST_PLAYERS.map(p => {
                  const part = participantsList.find((pt: any) => pt.userId === p.uid);
                  return (
                    <tr key={p.uid} className="hover:bg-stone-50">
                      <td className="p-2.5 border border-black font-black text-stone-800">{p.pbgId}</td>
                      <td className="p-2.5 border border-black">{p.displayName}</td>
                      <td className="p-2.5 border border-black font-black">{p.mmr}</td>
                      <td className="p-2.5 border border-black">{p.primaryRole} / {p.secondaryRole}</td>
                      <td className="p-2.5 border border-black">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-yellow-200 text-black text-[10px] font-black border border-black">
                            TEST IDENTITY
                          </span>
                          <span className="px-1.5 py-0.5 bg-stone-200 text-stone-700 text-[10px] border border-black">
                            External checks bypassed
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 border border-black">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                          part?.auctionStatus === 'SOLD' ? 'bg-[#70FFAF] text-black' :
                          (part?.auctionStatus as any) === 'NOMINATED' ? 'bg-purple-600 text-white' :
                          part?.auctionStatus === 'UNSOLD' ? 'bg-rose-200 text-rose-900' :
                          'bg-stone-100 text-black'
                        }`}>
                          {part?.auctionStatus || 'AVAILABLE'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Auction Integrity Check */}
      {activeTab === 'integrity' && (
        <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div>
              <h3 className="font-sans text-xl font-black uppercase">
                Auction Integrity &amp; Contract Audit
              </h3>
              <p className="text-stone-600 mt-0.5">
                Verifies purse consistency, roster bounds (5 primary, 1 stand-in), uniqueness, and real vs dummy identity eligibility.
              </p>
            </div>
            <button
              onClick={handleRunIntegrityCheck}
              className="px-3 py-1.5 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-run Audit</span>
            </button>
          </div>

          {integrityReport ? (
            <div className="space-y-4">
              <div className={`p-4 border-2 border-black ${integrityReport.valid ? 'bg-emerald-50 text-emerald-950' : 'bg-red-50 text-red-950'}`}>
                <div className="flex items-center gap-2 font-black text-sm uppercase">
                  {integrityReport.valid ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Integrity Audit Passed — All Invariants Valid</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span>Integrity Audit Failed ({integrityReport.errors.length} Errors Found)</span>
                    </>
                  )}
                </div>

                {integrityReport.errors.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-red-900 font-bold">
                    {integrityReport.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}

                {integrityReport.warnings.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-black/20">
                    <span className="font-black text-amber-900 uppercase block mb-1">Warnings:</span>
                    <ul className="list-disc list-inside space-y-1 text-amber-800">
                      {integrityReport.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-50 border-2 border-black">
                  <span className="text-stone-500 font-bold uppercase block">Teams</span>
                  <span className="text-lg font-black block">{integrityReport.summary.totalTeams} / 3</span>
                </div>
                <div className="p-3 bg-stone-50 border-2 border-black">
                  <span className="text-stone-500 font-bold uppercase block">Drafted</span>
                  <span className="text-lg font-black block">{integrityReport.summary.totalPlayersDrafted}</span>
                </div>
                <div className="p-3 bg-stone-50 border-2 border-black">
                  <span className="text-stone-500 font-bold uppercase block">Real Captains</span>
                  <span className="text-lg font-black block">{integrityReport.summary.realCaptainsCount}</span>
                </div>
                <div className="p-3 bg-stone-50 border-2 border-black">
                  <span className="text-stone-500 font-bold uppercase block">Test Captains</span>
                  <span className="text-lg font-black block">{integrityReport.summary.testCaptainsCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-stone-500 bg-stone-50 border-2 border-black">
              Click "Re-run Audit" above to inspect purse balances and roster integrity.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div>
              <h3 className="font-sans text-xl font-black uppercase">
                Audited Impersonation Trail
              </h3>
              <p className="text-stone-600 mt-0.5">
                Every action executed by an admin on behalf of a dummy test captain is permanently logged.
              </p>
            </div>
            <span className="px-2 py-1 bg-stone-100 border border-black font-bold">
              {audits.length} Logged Action(s)
            </span>
          </div>

          {audits.length > 0 ? (
            <div className="space-y-2">
              {audits.map((a, i) => (
                <div key={i} className="p-3 bg-stone-50 border-2 border-black flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 bg-black text-[#FFE600] font-black text-[10px] mr-2">
                      {a.actionType}
                    </span>
                    <span className="font-bold text-black">
                      Acting as: {a.testCaptainName} ({a.actingAsTestCaptainUserId})
                    </span>
                    <span className="text-stone-500 text-[10px] block mt-0.5">
                      Actor Admin UID: {a.actorAdminUserId} · {new Date(a.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <pre className="text-[10px] bg-white border border-stone-300 p-1.5 max-w-xs overflow-x-auto">
                    {JSON.stringify(a.details, null, 1)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-stone-500 bg-stone-50 border-2 border-black">
              No impersonated actions executed yet in this session.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
