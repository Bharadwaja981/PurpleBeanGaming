import dotenv from 'dotenv';
dotenv.config({ path: 'functions/.env' });

import { getAdminDb } from '../src/server/firebaseAdmin';

const TOURNAMENT_ID = 'purple-bean-auction-test';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '631715510631006219';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const PBG_MEMBER_ROLE_ID = process.env.DISCORD_PBG_MEMBER_ROLE_ID || '1555885374713237524';
const PBG_PLAYER_ROLE_ID = process.env.DISCORD_PBG_PLAYER_ROLE_ID || '1555884061111746651';
const PBG_CAPTAIN_ROLE_ID = process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || '1556338549807259658';

async function fetchDiscordGuildRoles(): Promise<any[]> {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Failed to fetch guild roles: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function fetchMember(discordUserId: string): Promise<any> {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Failed to fetch member ${discordUserId}: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function addRoleToMember(discordUserId: string, roleId: string, roleName: string): Promise<boolean> {
  console.log(`[Discord API] Adding role ${roleName} (${roleId}) to Discord User ${discordUserId}...`);
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUserId}/roles/${roleId}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${BOT_TOKEN}` }
  });
  if (!res.ok && res.status !== 204) {
    console.error(`[Discord API] Error adding role: ${res.status} ${await res.text()}`);
    return false;
  }
  console.log(`[Discord API] Role ${roleName} successfully PUT.`);
  return true;
}

async function getOrCreateTeamRole(existingRoles: any[], teamName: string, colorHex: string): Promise<{ id: string; name: string }> {
  const match = existingRoles.find(r => r.name.toLowerCase().trim() === teamName.toLowerCase().trim());
  if (match) {
    console.log(`[Discord API] Team role "${teamName}" already exists on Discord: ${match.id}`);
    return { id: match.id, name: match.name };
  }

  console.log(`[Discord API] Creating team role "${teamName}" in guild ${GUILD_ID}...`);
  const colorInt = parseInt(colorHex.replace('#', ''), 16) || 0x5CE1E6;
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: teamName,
      color: colorInt,
      hoist: false,
      mentionable: true
    })
  });
  if (!res.ok) {
    throw new Error(`Failed to create team role "${teamName}": ${res.status} ${await res.text()}`);
  }
  const created = await res.json();
  console.log(`[Discord API] Team role created: ${created.id} ("${created.name}")`);
  return { id: created.id, name: created.name };
}

async function runRepair() {
  console.log('=== STARTING REPAIR FOR PURPLE BEAN AUCTION TEST ===');
  console.log('Environment:', {
    GUILD_ID,
    PBG_MEMBER_ROLE_ID,
    PBG_PLAYER_ROLE_ID,
    PBG_CAPTAIN_ROLE_ID,
    BOT_TOKEN_PRESENT: Boolean(BOT_TOKEN)
  });

  const db = getAdminDb();

  // 1. Inspect NovaRanger state before repair
  const aucRef = db.collection('auctions').doc(TOURNAMENT_ID);
  const aucDoc = await aucRef.get();
  const aucData = aucDoc.data() || {};
  const playersBefore: any[] = aucData.players || [];
  const novaBefore = playersBefore.find(p => p.username === 'NovaRanger' || p.id?.includes('novaranger'));

  console.log('\n--- 1. NOVARANGER BEFORE REPAIR ---');
  console.log('Stored player in auction document:', JSON.stringify(novaBefore, null, 2));
  console.log('Auction state before:', {
    status: aucData.state?.status,
    isCompleted: aucData.state?.isCompleted,
    soldCount: aucData.state?.soldCount,
    unsoldCount: aucData.state?.unsoldCount,
    unselectedCount: aucData.state?.unselectedCount,
    lastLotResultOutcome: aucData.state?.lastLotResult?.outcome,
    lastLotResultPlayer: aucData.state?.lastLotResult?.player?.username
  });

  // 2. Fetch Tournament doc & Teams
  const tourneyRef = db.collection('tournaments').doc(TOURNAMENT_ID);
  const tourneyDoc = await tourneyRef.get();
  const tourneyData = tourneyDoc.data() || {};

  // 3. Inspect Real Captains and their Discord state BEFORE repair
  console.log('\n--- 2. REAL CAPTAINS DISCORD STATE BEFORE REPAIR ---');
  const captains = [
    {
      userId: 's1syElW0XhWKGJENYAoBvh7btJt2',
      ign: 'Robinhood',
      discordUserId: '522114011307966464',
      teamId: 'team-s1syElW0XhWKGJENYAoBvh7btJt2-6530',
      teamName: "Robinhood's Squad",
      color: '#FFE600'
    },
    {
      userId: 'Q1yF1rzCwseFbkQHiHB3AeJRe6s1',
      ign: 'Naveen Kumar',
      discordUserId: '522110983670333460',
      teamId: 'team-Q1yF1rzCwseFbkQHiHB3AeJRe6s1-9126',
      teamName: "Naveen Kumar's Squad",
      color: '#EC4899'
    },
    {
      userId: 'ZES4p9OufpffkyETPRjdiYihuI42',
      ign: 'Ammu_Tab',
      discordUserId: '1399600877706149989',
      teamId: 'team-ZES4p9OufpffkyETPRjdiYihuI42-2132',
      teamName: "Ammu_Tab's Squad",
      color: '#70FFAF'
    }
  ];

  const beforeDiscordMembers: Record<string, any> = {};
  for (const cap of captains) {
    try {
      const member = await fetchMember(cap.discordUserId);
      beforeDiscordMembers[cap.userId] = member;
      console.log(`Captain ${cap.ign} (${cap.discordUserId}) current roles:`, member.roles);
    } catch (e: any) {
      console.error(`Failed to fetch captain ${cap.ign}:`, e.message);
    }
  }

  // 4. Create/Find Dynamic Discord Team Roles
  console.log('\n--- 3. DYNAMIC DISCORD TEAM ROLES ---');
  const existingGuildRoles = await fetchDiscordGuildRoles();
  const teamDiscordRoles: Record<string, { id: string; name: string }> = {};

  for (const cap of captains) {
    const roleInfo = await getOrCreateTeamRole(existingGuildRoles, cap.teamName, cap.color);
    teamDiscordRoles[cap.teamId] = roleInfo;
  }

  // 5. Update Canonical Tournament Teams in Firestore
  console.log('\n--- 4. PERSISTING CANONICAL TEAM RECORDS ---');
  const rawAuctionTeams = (aucData.teams && aucData.teams.length > 0 && aucData.teams.some((t: any) => t.primaryRoster?.length > 1))
    ? aucData.teams
    : (tourneyData.teams || []);

  const updatedTournamentTeams = rawAuctionTeams.map((t: any) => {
    const role = teamDiscordRoles[t.id];
    return {
      ...t,
      status: 'ACTIVE',
      source: 'AUCTION',
      discord: role ? { roleId: role.id, roleName: role.name } : t.discord
    };
  });

  await tourneyRef.set({
    teams: updatedTournamentTeams,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  for (const t of updatedTournamentTeams) {
    const role = teamDiscordRoles[t.id];
    // Save to tournament teams subcollection
    await tourneyRef.collection('teams').doc(t.id).set({
      ...t,
      teamId: t.id,
      tournamentId: TOURNAMENT_ID,
      status: 'ACTIVE',
      source: 'AUCTION',
      discord: role ? { roleId: role.id, roleName: role.name } : t.discord
    }, { merge: true });

    // Save to canonical root teams collection
    await db.collection('teams').doc(t.id).set({
      ...t,
      teamId: t.id,
      tournamentId: TOURNAMENT_ID,
      status: 'ACTIVE',
      source: 'AUCTION',
      primaryRosterUserIds: (t.primaryRoster || []).map((p: any) => p.userId || p.id),
      standInUserIds: (t.standIns || []).map((p: any) => p.userId || p.id),
      discord: role ? { roleId: role.id, roleName: role.name } : t.discord,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`Saved canonical team ${t.id} ("${t.name}") with Discord role ${role?.id}`);
  }

  // 6. Repair Auction Document State & Players
  console.log('\n--- 5. REPAIRING AUCTION DATA & NOVARANGER STATE ---');
  const nominationAudits: any[] = aucData.nominationAudits || [];
  const unsoldNominees = new Set(
    nominationAudits.filter(a => a.outcome === 'UNSOLD').map(a => a.nomineeId)
  );
  // Ensure NovaRanger, SavageEcho, ImmortalShift are explicitly in unsold set
  unsoldNominees.add('p-user-novaranger-muu1qqrj-10');
  unsoldNominees.add('p-user-savageecho-muu1qqri-7');
  unsoldNominees.add('p-user-immortalshift-muu1qqrg-4');

  const repairedPlayers = playersBefore.map(p => {
    // Check if player is on a team
    for (const t of updatedTournamentTeams) {
      if (t.captainId === p.id || t.captainId === p.userId) {
        return {
          ...p,
          status: 'SOLD',
          teamId: t.id,
          teamName: t.name,
          isCaptain: true
        };
      }
      const inRoster = (t.primaryRoster || []).find((rp: any) => rp.id === p.id || rp.userId === p.id);
      if (inRoster) {
        return {
          ...p,
          status: 'SOLD',
          teamId: t.id,
          teamName: t.name,
          soldAmount: inRoster.soldAmount || 100,
          isCaptain: false
        };
      }
    }

    if (unsoldNominees.has(p.id) || unsoldNominees.has(p.userId)) {
      const cleanP = { ...p, status: 'UNSOLD', isCaptain: false };
      delete cleanP.teamId;
      delete cleanP.teamName;
      return cleanP;
    }

    const fallbackP = { ...p, status: 'UNSOLD' };
    delete fallbackP.teamId;
    delete fallbackP.teamName;
    return fallbackP;
  });

  const soldCount = repairedPlayers.filter(p => p.status === 'SOLD').length;
  const unsoldCount = repairedPlayers.filter(p => p.status === 'UNSOLD').length;

  const repairedState = JSON.parse(JSON.stringify({
    ...aucData.state,
    status: 'COMPLETED',
    isCompleted: true,
    soldCount,
    unsoldCount,
    unselectedCount: 0,
    primaryRostersComplete: true,
    nominee: null,
    lastLotResult: {
      outcome: 'UNSOLD',
      winningTeamName: null,
      winningTeamId: null,
      winningBid: null,
      timestamp: '2026-10-04T16:51:31.576Z',
      player: repairedPlayers.find(p => p.username === 'NovaRanger') || {
        id: 'p-user-novaranger-muu1qqrj-10',
        userId: 'p-user-novaranger-muu1qqrj-10',
        username: 'NovaRanger',
        displayName: 'NovaRanger',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 4 — Soft Support',
        tournamentMmr: 8075,
        rating: 2119,
        avatar: '🎮',
        city: 'Ahmedabad',
        region: 'West India',
        status: 'UNSOLD'
      }
    },
    updatedAt: new Date().toISOString()
  }, (k, v) => v === undefined ? null : v));

  const cleanPayload = JSON.parse(JSON.stringify({
    players: repairedPlayers,
    state: repairedState,
    teams: updatedTournamentTeams,
    lastPersistedAt: new Date().toISOString()
  }, (k, v) => v === undefined ? null : v));

  await aucRef.set(cleanPayload, { merge: true });

  console.log('Auction document repaired. Authoritative counters:', {
    soldCount,
    unsoldCount,
    status: repairedState.status,
    isCompleted: repairedState.isCompleted
  });

  // 7. Repair Participants Subcollection
  console.log('\n--- 6. REPAIRING PARTICIPANTS SUBCOLLECTION ---');
  for (const p of repairedPlayers) {
    const isCap = captains.some(c => c.userId === p.id);
    const participantRecord = {
      userId: p.id,
      tournamentId: TOURNAMENT_ID,
      displayName: p.displayName || p.username,
      username: p.username,
      tournamentRole: isCap ? 'CAPTAIN' : 'PLAYER',
      captainSlotId: isCap ? `slot-${p.teamId}` : null,
      teamId: p.teamId || null,
      participantStatus: 'ACTIVE',
      auctionStatus: p.status, // 'SOLD' or 'UNSOLD'
      eliminated: false,
      source: p.id.startsWith('p-user-') ? 'TEST_SEED' : 'REGISTRATION',
      isTestAccount: p.id.startsWith('p-user-'),
      tournamentMMR: p.tournamentMmr || 0,
      primaryRole: p.primaryRole || 'Flexible',
      secondaryRole: p.secondaryRole || null,
      createdAt: '2026-10-04T16:39:52.831Z',
      updatedAt: new Date().toISOString()
    };

    const cleanParticipant = JSON.parse(JSON.stringify(participantRecord, (k, v) => v === undefined ? null : v));
    await tourneyRef.collection('participants').doc(p.id).set(cleanParticipant, { merge: true });
  }
  console.log(`Populated ${repairedPlayers.length} participants into tournaments/${TOURNAMENT_ID}/participants.`);

  // 8. Reconcile Real Discord Captains
  console.log('\n--- 7. RECONCILING REAL DISCORD CAPTAINS WITH DISCORD API ---');
  const reconciliationReport: any[] = [];

  for (const cap of captains) {
    const teamRole = teamDiscordRoles[cap.teamId];
    const desiredRoles = [
      PBG_MEMBER_ROLE_ID,
      PBG_PLAYER_ROLE_ID,
      PBG_CAPTAIN_ROLE_ID,
      teamRole?.id
    ].filter(Boolean) as string[];

    console.log(`\nReconciling Captain ${cap.ign} (${cap.discordUserId}):`);
    console.log('Desired roles:', desiredRoles);

    const currentMember = await fetchMember(cap.discordUserId);
    const currentRoles: string[] = currentMember.roles || [];
    console.log('Current roles before reconciliation:', currentRoles);

    const rolesToAdd = desiredRoles.filter(r => !currentRoles.includes(r));
    const addedRolesSuccess: string[] = [];

    for (const rId of rolesToAdd) {
      let roleName = 'Team Role';
      if (rId === PBG_MEMBER_ROLE_ID) roleName = 'PBG Member';
      if (rId === PBG_PLAYER_ROLE_ID) roleName = 'PBG Player';
      if (rId === PBG_CAPTAIN_ROLE_ID) roleName = 'PBG Captain';

      const success = await addRoleToMember(cap.discordUserId, rId, roleName);
      if (success) addedRolesSuccess.push(rId);
    }

    // Follow-up GET verification
    console.log(`Verifying follow-up GET for ${cap.ign}...`);
    const verifiedMember = await fetchMember(cap.discordUserId);
    console.log(`Verified roles on Discord after PUT:`, verifiedMember.roles);

    reconciliationReport.push({
      captainIgn: cap.ign,
      userId: cap.userId,
      discordUserId: cap.discordUserId,
      desiredRoles,
      rolesBefore: currentRoles,
      rolesToAdd,
      rolesAdded: addedRolesSuccess,
      rolesAfterFollowUpGet: verifiedMember.roles,
      hasPbgMember: verifiedMember.roles.includes(PBG_MEMBER_ROLE_ID),
      hasPbgPlayer: verifiedMember.roles.includes(PBG_PLAYER_ROLE_ID),
      hasPbgCaptain: verifiedMember.roles.includes(PBG_CAPTAIN_ROLE_ID),
      hasTeamRole: verifiedMember.roles.includes(teamRole.id)
    });

    // Record sync job / status
    await db.collection('discordSyncJobs').doc(`sync_${TOURNAMENT_ID}_${cap.userId}`).set({
      id: `sync_${TOURNAMENT_ID}_${cap.userId}`,
      tournamentId: TOURNAMENT_ID,
      userId: cap.userId,
      discordUserId: cap.discordUserId,
      status: 'SYNCED',
      rolesAdded: addedRolesSuccess,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  console.log('\n=== REPAIR COMPLETE ===');
  console.log(JSON.stringify(reconciliationReport, null, 2));
}

runRepair().catch(console.error);
