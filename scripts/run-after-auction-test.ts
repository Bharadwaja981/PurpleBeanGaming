import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);

const TOURNAMENT_ID = 'pb-game-dota2-1791361091142';

interface Contender {
  id: string;
  userId: string;
  ign: string;
  primaryRole: string;
  secondaryRole?: string;
  mmr: number;
  city: string;
  region: string;
  isCaptain: boolean;
}

const NINE_ADDITIONAL_PLAYERS: Contender[] = [
  { id: 'p-user-ironwraith-extra-31', userId: 'p-user-ironwraith-extra-31', ign: 'IronWraith', primaryRole: 'Position 1 — Carry', mmr: 7150, city: 'Pune', region: 'West India', isCaptain: false },
  { id: 'p-user-solarisblade-extra-32', userId: 'p-user-solarisblade-extra-32', ign: 'SolarisBlade', primaryRole: 'Position 2 — Mid', mmr: 6900, city: 'Mumbai', region: 'West India', isCaptain: false },
  { id: 'p-user-viperknight-extra-33', userId: 'p-user-viperknight-extra-33', ign: 'ViperKnight', primaryRole: 'Position 3 — Offlane', mmr: 7350, city: 'Bengaluru', region: 'South India', isCaptain: false },
  { id: 'p-user-titanforge-extra-34', userId: 'p-user-titanforge-extra-34', ign: 'TitanForge', primaryRole: 'Position 4 — Soft Support', mmr: 6200, city: 'Hyderabad', region: 'South India', isCaptain: false },
  { id: 'p-user-echobreaker-extra-35', userId: 'p-user-echobreaker-extra-35', ign: 'EchoBreaker', primaryRole: 'Position 5 — Hard Support', mmr: 6850, city: 'Kolkata', region: 'East India', isCaptain: false },
  { id: 'p-user-kinesisstrike-extra-36', userId: 'p-user-kinesisstrike-extra-36', ign: 'KinesisStrike', primaryRole: 'Position 2 — Mid', mmr: 7600, city: 'Delhi NCR', region: 'North India', isCaptain: false },
  { id: 'p-user-pulseranger-extra-37', userId: 'p-user-pulseranger-extra-37', ign: 'PulseRanger', primaryRole: 'Position 3 — Offlane', mmr: 7100, city: 'Ahmedabad', region: 'West India', isCaptain: false },
  { id: 'p-user-aerofury-extra-38', userId: 'p-user-aerofury-extra-38', ign: 'AeroFury', primaryRole: 'Position 4 — Soft Support', mmr: 6400, city: 'Kochi', region: 'South India', isCaptain: false },
  { id: 'p-user-onyxsoul-extra-39', userId: 'p-user-onyxsoul-extra-39', ign: 'OnyxSoul', primaryRole: 'Position 5 — Hard Support', mmr: 7300, city: 'Chennai', region: 'South India', isCaptain: false },
];

function sanitizeForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }));
}

async function main() {
  console.log(`[1] Fetching tournament "${TOURNAMENT_ID}" and existing registrations...`);
  const tourneyDocRef = doc(db, 'tournaments', TOURNAMENT_ID);
  const tourneySnap = await getDoc(tourneyDocRef);
  if (!tourneySnap.exists()) {
    throw new Error(`Tournament ${TOURNAMENT_ID} not found in Firestore.`);
  }
  const tourneyData = tourneySnap.data();
  console.log(`Found tournament: "${tourneyData.name}"`);

  // Fetch all 31 existing registrations
  const regSnap = await getDocs(collection(db, 'tournaments', TOURNAMENT_ID, 'registrations'));
  const existingContenders: Contender[] = [];
  regSnap.forEach(d => {
    const dt = d.data();
    existingContenders.push({
      id: d.id,
      userId: dt.userId || d.id,
      ign: dt.ign || dt.playerName,
      primaryRole: dt.primaryRole || 'Position 1 — Carry',
      secondaryRole: dt.secondaryRole,
      mmr: Number(dt.mmr || dt.tournamentMmr || dt.declaredMmr || 6000),
      city: dt.city || 'Bengaluru',
      region: dt.region || 'Pan India',
      isCaptain: Boolean(dt.isCaptain || dt.applyingAsCaptain || dt.interestedInCaptaincy)
    });
  });

  console.log(`Loaded ${existingContenders.length} existing contenders.`);

  // Write the 9 additional players to Firestore so total = 40 players
  for (const extra of NINE_ADDITIONAL_PLAYERS) {
    const regPayload = {
      id: `reg-${TOURNAMENT_ID}-${extra.userId}`,
      tournamentId: TOURNAMENT_ID,
      userId: extra.userId,
      playerName: extra.ign,
      ign: extra.ign,
      primaryRole: extra.primaryRole,
      declaredMmr: extra.mmr,
      tournamentMmr: extra.mmr,
      mmr: extra.mmr,
      city: extra.city,
      region: extra.region,
      status: 'verified',
      applyingAsCaptain: false,
      interestedInCaptaincy: false,
      isCaptainApproved: false,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'tournaments', TOURNAMENT_ID, 'registrations', extra.userId), sanitizeForFirestore(regPayload), { merge: true });
    await setDoc(doc(db, 'registrations', regPayload.id), sanitizeForFirestore(regPayload), { merge: true });
    if (!existingContenders.find(c => c.userId === extra.userId)) {
      existingContenders.push(extra);
    }
  }

  console.log(`Total contenders now: ${existingContenders.length}`);

  // Separate 8 captains and 32 regular contenders
  const captains = existingContenders.filter(c => c.isCaptain);
  const regularPlayers = existingContenders.filter(c => !c.isCaptain);

  console.log(`Captains count: ${captains.length}`);
  console.log(`Regular players count: ${regularPlayers.length}`);

  if (captains.length !== 8) {
    throw new Error(`Expected 8 captains, got ${captains.length}`);
  }
  if (regularPlayers.length !== 32) {
    throw new Error(`Expected 32 regular players, got ${regularPlayers.length}`);
  }

  // 2. Define the 8 franchise teams matching each captain IGN
  const captainTeamConfig: Record<string, { tag: string; color: string; logo: string }> = {
    'BlazeShift': { tag: 'BLZ', color: '#E11D48', logo: '🔥' },
    'SpectreWard': { tag: 'SPC', color: '#7C3AED', logo: '👁️' },
    'MirageFang': { tag: 'MRG', color: '#2563EB', logo: '🐺' },
    'ZenithFang': { tag: 'ZNT', color: '#059669', logo: '⚡' },
    'VoidSniper': { tag: 'VOI', color: '#9333EA', logo: '🎯' },
    'TempestViper': { tag: 'TMP', color: '#D97706', logo: '🌪️' },
    'HyperDrift': { tag: 'HYP', color: '#0891B2', logo: '🚀' },
    'CrimsonWard': { tag: 'CRW', color: '#DC2626', logo: '🛡️' }
  };

  interface AuctionTeam {
    id: string;
    name: string;
    tag: string;
    logo: string;
    color: string;
    captainId: string;
    captainIgn: string;
    startingCredits: number;
    remainingCredits: number;
    creditsUsed: number;
    primaryRoster: any[];
    standIns: any[];
  }

  const teams: AuctionTeam[] = captains.map((cap) => {
    const meta = captainTeamConfig[cap.ign] || { tag: cap.ign.slice(0, 3).toUpperCase(), color: '#7C3AED', logo: '🛡️' };
    const teamName = `${cap.ign}'s Squad`;
    const teamId = `team-${TOURNAMENT_ID}-${cap.userId}`;
    const captainPlayerObj = {
      id: cap.userId,
      userId: cap.userId,
      username: cap.ign,
      displayName: cap.ign,
      avatar: '👑',
      city: cap.city,
      region: cap.region,
      tournamentMmr: cap.mmr,
      primaryRole: cap.primaryRole,
      rating: Math.round(cap.mmr / 4),
      isCaptain: true,
      status: 'SOLD',
      teamId,
      teamName,
      soldAmount: 0
    };
    return {
      id: teamId,
      name: teamName,
      tag: meta.tag,
      logo: meta.logo,
      color: meta.color,
      captainId: cap.userId,
      captainIgn: cap.ign,
      startingCredits: 1000,
      remainingCredits: 1000,
      creditsUsed: 0,
      primaryRoster: [captainPlayerObj],
      standIns: []
    };
  });

  console.log(`[2] Initialized 8 franchise teams matching each captain:`);
  teams.forEach(t => console.log(`  - ${t.name} (${t.tag}) | Captain: ${t.captainIgn} [1/5 roster]`));

  const UNSOLD_CANDIDATE_NAMES = ['AetherFang', 'PhantomViper', 'SavageSurge'];
  const unsoldCandidates = regularPlayers.filter(p => UNSOLD_CANDIDATE_NAMES.includes(p.ign));
  const round1SoldCandidates = regularPlayers.filter(p => !UNSOLD_CANDIDATE_NAMES.includes(p.ign));

  const allPlayersAuctionMap = new Map<string, any>();
  
  // Add captains to auction player map
  for (const t of teams) {
    const c = t.primaryRoster[0];
    allPlayersAuctionMap.set(c.id, { ...c });
  }

  // Add all 32 regular players as AVAILABLE initially
  for (const p of regularPlayers) {
    allPlayersAuctionMap.set(p.userId, {
      id: p.userId,
      userId: p.userId,
      username: p.ign,
      displayName: p.ign,
      avatar: '🎮',
      city: p.city,
      region: p.region,
      tournamentMmr: p.mmr,
      primaryRole: p.primaryRole,
      rating: Math.round(p.mmr / 4),
      isCaptain: false,
      status: 'AVAILABLE'
    });
  }

  const bidHistory: any[] = [];
  const nominationAudits: any[] = [];
  let baseTimestamp = Date.now() - 3600 * 1000; // 1 hour ago
  let bidCounter = 1;

  function advanceTime(seconds: number): string {
    baseTimestamp += seconds * 1000;
    return new Date(baseTimestamp).toISOString();
  }

  // Helper to place realistic bids for a player
  function runBiddingLot(
    player: Contender,
    targetTeam: AuctionTeam,
    competingTeams: AuctionTeam[],
    finalPrice: number,
    isUnsold: boolean,
    isReauction: boolean = false
  ) {
    const nomineeObj = allPlayersAuctionMap.get(player.userId);
    nomineeObj.status = 'NOMINATED';

    if (isUnsold) {
      // 0 bids placed, timer expires
      advanceTime(30);
      nomineeObj.status = 'UNSOLD';
      nominationAudits.push({
        nomineeId: player.userId,
        nomineeUsername: player.ign,
        tournamentMmr: player.mmr,
        role: player.primaryRole,
        outcome: 'UNSOLD',
        winningTeamId: null,
        winningTeamName: null,
        winningBid: null,
        bidsCount: 0,
        timestamp: advanceTime(2)
      });
      console.log(`  [LOT PASS] ${player.ign} passed as UNSOLD.`);
      return;
    }

    // Generate competitive bids
    const minBid = 10;
    const bidLadder = [minBid];
    let curr = minBid;
    const steps = Math.min(5, Math.max(2, Math.floor(finalPrice / 30)));
    const inc = Math.max(10, Math.round((finalPrice - minBid) / steps / 10) * 10);

    while (curr + inc < finalPrice) {
      curr += inc;
      bidLadder.push(curr);
    }
    bidLadder.push(finalPrice);

    // Distribute bids between competing teams and targetTeam
    bidLadder.forEach((amount, idx) => {
      const isFinal = idx === bidLadder.length - 1;
      const bidderTeam = isFinal ? targetTeam : competingTeams[idx % competingTeams.length];
      const bidRecord = {
        id: `bid-${TOURNAMENT_ID}-${bidCounter++}`,
        nomineeId: player.userId,
        teamId: bidderTeam.id,
        teamName: bidderTeam.name,
        amount,
        timestamp: advanceTime(4),
        captainUserId: bidderTeam.captainId,
        reverted: false
      };
      bidHistory.unshift(bidRecord);
    });

    // Conclude lot as SOLD
    targetTeam.remainingCredits -= finalPrice;
    targetTeam.creditsUsed += finalPrice;
    nomineeObj.status = 'SOLD';
    nomineeObj.teamId = targetTeam.id;
    nomineeObj.teamName = targetTeam.name;
    nomineeObj.soldAmount = finalPrice;
    nomineeObj.isStandIn = false;
    targetTeam.primaryRoster.push({ ...nomineeObj });

    nominationAudits.unshift({
      nomineeId: player.userId,
      nomineeUsername: player.ign,
      tournamentMmr: player.mmr,
      role: player.primaryRole,
      outcome: 'SOLD',
      winningTeamId: targetTeam.id,
      winningTeamName: targetTeam.name,
      winningBid: finalPrice,
      bidsCount: bidLadder.length,
      timestamp: advanceTime(2),
      isReauctionLot: isReauction
    });

    console.log(`  [LOT SOLD] ${player.ign} (${player.primaryRole}) -> ${targetTeam.name} for ${finalPrice} credits (${bidLadder.length} bids). Roster: ${targetTeam.primaryRoster.length}/5`);
  }

  // --- ROUND 1 EXECUTION ---
  console.log('\n--- STARTING AUCTION ROUND 1 ---');

  const pricesRound1 = [
    180, 240, 150, 120, 210, 160, 190, 140, 220, 130,
    170, 200, 110, 160, 250, 140, 180, 130, 190, 150,
    210, 120, 160, 140, 170, 130, 180, 150, 120
  ];

  // Distribute 29 acquisitions across the 8 teams:
  // 5 teams get 4 drafted players (full 5/5)
  // 3 teams get 3 drafted players (4/5, waiting for 3 re-auction lots)
  const teamSlotDistribution: number[] = [4, 4, 4, 4, 3, 3, 3, 4];

  const round1TeamAssignments: AuctionTeam[] = [];
  teamSlotDistribution.forEach((slotsNeeded, teamIdx) => {
    for (let s = 0; s < slotsNeeded; s++) {
      round1TeamAssignments.push(teams[teamIdx]);
    }
  });

  let priceIdx = 0;
  for (let i = 0; i < round1SoldCandidates.length; i++) {
    const p = round1SoldCandidates[i];
    const targetTeam = round1TeamAssignments[i];
    const compTeams = teams.filter(t => t.id !== targetTeam.id);
    const price = pricesRound1[priceIdx++];

    runBiddingLot(p, targetTeam, compTeams, price, false);

    // After lot 10, insert first UNSOLD lot (AetherFang)
    if (i === 10) {
      console.log('\n>>> NOMINATING UNCONTESTED LOT 1: AetherFang');
      runBiddingLot(unsoldCandidates[0], targetTeam, compTeams, 0, true);
    }
    // After lot 18, insert second UNSOLD lot (PhantomViper)
    if (i === 18) {
      console.log('\n>>> NOMINATING UNCONTESTED LOT 2: PhantomViper');
      runBiddingLot(unsoldCandidates[1], targetTeam, compTeams, 0, true);
    }
    // After lot 25, insert third UNSOLD lot (SavageSurge)
    if (i === 25) {
      console.log('\n>>> NOMINATING UNCONTESTED LOT 3: SavageSurge');
      runBiddingLot(unsoldCandidates[2], targetTeam, compTeams, 0, true);
    }
  }

  console.log('\n--- ROUND 1 FINISHED ---');
  console.log('Nomination Audits Count:', nominationAudits.length);
  console.log('Unsold in Round 1:', unsoldCandidates.map(c => c.ign).join(', '));
  teams.forEach(t => console.log(`  ${t.name}: ${t.primaryRoster.length}/5 roster | Remaining Credits: ${t.remainingCredits}`));

  // --- ROUND 2: RE-AUCTION OF UNSOLD CONTENDERS ---
  console.log('\n--- STARTING ROUND 2: RE-AUCTION OF UNSOLD CONTENDERS ---');
  const needingTeams = teams.filter(t => t.primaryRoster.length < 5);
  console.log('Teams participating in Re-Auction:', needingTeams.map(t => t.name).join(', '));

  // Re-auction AetherFang -> HyperDrift's Squad (80 credits)
  console.log(`\n>>> RE-AUCTIONING LOT: ${unsoldCandidates[0].ign} (Soft Support)`);
  allPlayersAuctionMap.get(unsoldCandidates[0].userId).status = 'AVAILABLE';
  runBiddingLot(unsoldCandidates[0], needingTeams[2] || teams[6], teams.filter(t => t.id !== (needingTeams[2]?.id || teams[6].id)), 80, false, true);

  // Re-auction PhantomViper -> TempestViper's Squad (60 credits)
  console.log(`\n>>> RE-AUCTIONING LOT: ${unsoldCandidates[1].ign} (Soft Support)`);
  allPlayersAuctionMap.get(unsoldCandidates[1].userId).status = 'AVAILABLE';
  runBiddingLot(unsoldCandidates[1], needingTeams[1] || teams[5], teams.filter(t => t.id !== (needingTeams[1]?.id || teams[5].id)), 60, false, true);

  // Re-auction SavageSurge -> VoidSniper's Squad (70 credits)
  console.log(`\n>>> RE-AUCTIONING LOT: ${unsoldCandidates[2].ign} (Soft Support)`);
  allPlayersAuctionMap.get(unsoldCandidates[2].userId).status = 'AVAILABLE';
  runBiddingLot(unsoldCandidates[2], needingTeams[0] || teams[4], teams.filter(t => t.id !== (needingTeams[0]?.id || teams[4].id)), 70, false, true);

  console.log('\n--- AUCTION COMPLETE: ALL TEAMS REACHED 5/5 ROSTER ---');
  teams.forEach(t => {
    console.log(`✓ ${t.name} (${t.tag}): 5/5 full roster | Starting: 1000 | Spent: ${t.creditsUsed} | Remaining: ${t.remainingCredits}`);
    console.log(`   Roster: ${t.primaryRoster.map(p => `${p.username}${p.isCaptain ? ' [C]' : ` (${p.soldAmount} pts)`}`).join(', ')}`);
  });

  // Finalize all players status to SOLD
  for (const playerObj of allPlayersAuctionMap.values()) {
    playerObj.status = 'SOLD';
  }

  // Build the complete auction snapshot
  const auctionSnapshot = {
    tournamentId: TOURNAMENT_ID,
    tournamentName: tourneyData.name,
    config: {
      tournamentId: TOURNAMENT_ID,
      tournamentName: tourneyData.name,
      startingCredits: 1000,
      creditAllocationMode: 'EQUAL',
      baseCredits: 1000,
      adjustmentRate: 0,
      minimumCredits: 500,
      maximumCredits: 1500,
      creditRounding: 10,
      minimumBid: 10,
      bidIncrement: 10,
      reservePerSlot: 10,
      primaryRosterSize: 5,
      optionalStandInLimit: 1,
      numberOfTeams: 8,
      nominationTimerSeconds: 30,
      bidTimerSeconds: 25,
      bidExtensionEnabled: true,
      extensionWindowSeconds: 5,
      extensionTimeSeconds: 5
    },
    state: {
      tournamentId: TOURNAMENT_ID,
      status: 'COMPLETED',
      roundPhase: 'INTERMISSION',
      nominee: null,
      currentBid: 10,
      leadingTeamId: '',
      leadingTeamName: '',
      secondsRemaining: 0,
      soldCount: 32,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      primaryRostersComplete: true,
      standInRoundActive: false,
      revision: bidCounter + 10,
      lastLotResult: nominationAudits[0] ? {
        outcome: nominationAudits[0].outcome,
        player: allPlayersAuctionMap.get(nominationAudits[0].nomineeId),
        winningTeamName: nominationAudits[0].winningTeamName,
        winningTeamId: nominationAudits[0].winningTeamId,
        winningBid: nominationAudits[0].winningBid,
        timestamp: nominationAudits[0].timestamp
      } : null
    },
    teams: teams.map(t => ({
      id: t.id,
      name: t.name,
      tag: t.tag,
      logo: t.logo,
      color: t.color,
      captainId: t.captainId,
      captainIgn: t.captainIgn,
      startingCredits: t.startingCredits,
      remainingCredits: t.remainingCredits,
      creditsUsed: t.creditsUsed,
      primaryRoster: t.primaryRoster,
      standIns: t.standIns
    })),
    players: Array.from(allPlayersAuctionMap.values()),
    bidHistory,
    nominationAudits,
    purseAllocationAudit: {
      tournamentId: TOURNAMENT_ID,
      mode: 'EQUAL',
      baseCredits: 1000,
      totalCreditsAllocated: 8000,
      totalCreditsSpent: teams.reduce((acc, t) => acc + t.creditsUsed, 0),
      teamPurses: teams.map(t => ({
        teamId: t.id,
        teamName: t.name,
        captainId: t.captainId,
        captainIgn: t.captainIgn,
        startingCredits: t.startingCredits,
        creditsUsed: t.creditsUsed,
        remainingCredits: t.remainingCredits,
        rosterCount: 5
      }))
    },
    lastPersistedAt: new Date().toISOString()
  };

  console.log('\n[3] Writing authoritative records to Firestore...');
  
  // 1. Write auction snapshot
  await setDoc(doc(db, 'auctions', TOURNAMENT_ID), sanitizeForFirestore(auctionSnapshot), { merge: true });
  console.log('✓ Written auctions/' + TOURNAMENT_ID);

  // 2. Write teams to top-level "teams" collection and scoped "tournaments/{id}/teams"
  for (const t of teams) {
    const teamDocData = {
      id: t.id,
      name: t.name,
      tag: t.tag,
      logo: t.logo,
      color: t.color,
      captainId: t.captainId,
      captainName: t.captainIgn,
      captainIgn: t.captainIgn,
      tournamentId: TOURNAMENT_ID,
      startingCredits: t.startingCredits,
      remainingCredits: t.remainingCredits,
      creditsUsed: t.creditsUsed,
      lockedTournamentMmr: t.primaryRoster[0]?.tournamentMmr || 0,
      primaryRoster: t.primaryRoster,
      standIns: [],
      city: t.primaryRoster[0]?.city || 'India',
      primaryGame: 'Dota 2',
      status: 'Confirmed',
      rosterCount: 5,
      rating: 1500,
      record: { wins: 0, losses: 0 },
      tournamentWins: 0,
      mapsRecord: { won: 0, lost: 0 },
      players: t.primaryRoster.map(p => p.userId || p.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'teams', t.id), sanitizeForFirestore(teamDocData), { merge: true });
    await setDoc(doc(db, 'tournaments', TOURNAMENT_ID, 'teams', t.id), sanitizeForFirestore(teamDocData), { merge: true });
  }
  console.log('✓ Written all 8 teams to teams/ and tournaments/' + TOURNAMENT_ID + '/teams');

  // 3. Update all player registrations with their assigned teams and status SOLD
  for (const t of teams) {
    for (const p of t.primaryRoster) {
      const regId = `reg-${TOURNAMENT_ID}-${p.userId}`;
      const regUpdate = {
        teamId: t.id,
        teamName: t.name,
        auctionStatus: 'SOLD',
        status: 'verified',
        isCaptainApproved: Boolean(p.isCaptain),
        soldAmount: p.soldAmount || 0,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'tournaments', TOURNAMENT_ID, 'registrations', p.userId), sanitizeForFirestore(regUpdate), { merge: true });
      await setDoc(doc(db, 'registrations', regId), sanitizeForFirestore(regUpdate), { merge: true });
    }
  }
  console.log('✓ Updated all 40 player registrations with final team assignments');

  // 4. Update tournament document: mark auction completed, stages updated, teams and captains list populated!
  const updatedStages = [
    { id: 'reg', name: 'Registration', date: tourneyData.startDate || '2026-10-07', status: 'completed' },
    { id: 'draft', name: 'Auction Draft', date: tourneyData.startDate || '2026-10-07', status: 'completed' },
    { id: 'matches', name: 'Main Bracket', date: tourneyData.endDate || '2026-10-21', status: 'current' }
  ];

  const captainsList = teams.map(t => ({
    userId: t.captainId,
    ign: t.captainIgn,
    teamId: t.id,
    teamName: t.name,
    tag: t.tag,
    color: t.color,
    logo: t.logo,
    lockedTournamentMmr: t.primaryRoster[0]?.tournamentMmr || 0,
    startingCredits: t.startingCredits,
    remainingCredits: t.remainingCredits,
    rosterCount: 5,
    assignedAt: new Date().toISOString()
  }));

  await setDoc(doc(db, 'tournaments', TOURNAMENT_ID), sanitizeForFirestore({
    status: 'STAGE_TRANSITION',
    lifecycle: 'STAGE_TRANSITION',
    stages: updatedStages,
    captainsConfirmed: 8,
    teamCount: 8,
    playerCount: 40,
    captains: captainsList,
    teams: teams.map(t => ({
      id: t.id,
      name: t.name,
      tag: t.tag,
      logo: t.logo,
      color: t.color,
      captainId: t.captainId,
      captainName: t.captainIgn,
      primaryRoster: t.primaryRoster,
      rosterCount: 5,
      remainingCredits: t.remainingCredits,
      creditsUsed: t.creditsUsed
    })),
    updatedAt: new Date().toISOString()
  }), { merge: true });

  console.log('✓ Updated tournament ' + TOURNAMENT_ID + ' document to STAGE_TRANSITION with completed auction stages and finalized teams!');
  console.log('\n================ ALL AUCTION OPERATIONS COMPLETED SUCCESSFULLY ================');
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal execution error:', e);
  process.exit(1);
});
