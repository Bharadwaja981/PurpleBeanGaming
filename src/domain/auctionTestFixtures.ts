/**
 * Purple Bean Gaming — Auction Test Fixtures & Constants
 * 
 * Isolated, pure domain fixtures for the "Purple Bean Auction Test" tournament (testMode = true).
 * Contains ZERO server-side imports so it can be safely used in browser components.
 */

import { tournamentConfigRegistry } from './tournamentConfigRegistry';
import { tournamentService } from '../services/firebaseService';

export const TEST_TOURNAMENT_ID = 'purple-bean-auction-test';

export interface DummyTestPlayerDefinition {
  uid: string;
  pbgId: string;
  displayName: string;
  inGameName: string;
  mmr: number;
  primaryRole: string;
  secondaryRole: string;
  isTestAccount: true;
  source: 'TEST_SEED';
}

export const DUMMY_TEST_PLAYERS: DummyTestPlayerDefinition[] = [
  // 3x Position 1 — Carry
  {
    uid: 'pbg-test-001',
    pbgId: 'PBG-TEST-001',
    displayName: 'PBG-TEST-001 (ApexCarry)',
    inGameName: 'ApexCarry',
    mmr: 5950,
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 2 — Mid',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-006',
    pbgId: 'PBG-TEST-006',
    displayName: 'PBG-TEST-006 (IronVanguard)',
    inGameName: 'IronVanguard',
    mmr: 5450,
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 3 — Offlane',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-011',
    pbgId: 'PBG-TEST-011',
    displayName: 'PBG-TEST-011 (PhantomStrike)',
    inGameName: 'PhantomStrike',
    mmr: 4900,
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 4 — Soft Support',
    isTestAccount: true,
    source: 'TEST_SEED'
  },

  // 3x Position 2 — Mid
  {
    uid: 'pbg-test-002',
    pbgId: 'PBG-TEST-002',
    displayName: 'PBG-TEST-002 (VortexMid)',
    inGameName: 'VortexMid',
    mmr: 5800,
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 1 — Carry',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-007',
    pbgId: 'PBG-TEST-007',
    displayName: 'PBG-TEST-007 (SolarFlare)',
    inGameName: 'SolarFlare',
    mmr: 5350,
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 4 — Soft Support',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-012',
    pbgId: 'PBG-TEST-012',
    displayName: 'PBG-TEST-012 (RuneSeeker)',
    inGameName: 'RuneSeeker',
    mmr: 4850,
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 3 — Offlane',
    isTestAccount: true,
    source: 'TEST_SEED'
  },

  // 3x Position 3 — Offlane
  {
    uid: 'pbg-test-003',
    pbgId: 'PBG-TEST-003',
    displayName: 'PBG-TEST-003 (Colossus)',
    inGameName: 'Colossus',
    mmr: 5700,
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 4 — Soft Support',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-008',
    pbgId: 'PBG-TEST-008',
    displayName: 'PBG-TEST-008 (StoneWall)',
    inGameName: 'StoneWall',
    mmr: 5200,
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 5 — Hard Support',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-013',
    pbgId: 'PBG-TEST-013',
    displayName: 'PBG-TEST-013 (AegisBane)',
    inGameName: 'AegisBane',
    mmr: 4750,
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 1 — Carry',
    isTestAccount: true,
    source: 'TEST_SEED'
  },

  // 3x Position 4 — Soft Support
  {
    uid: 'pbg-test-004',
    pbgId: 'PBG-TEST-004',
    displayName: 'PBG-TEST-004 (TempoShift)',
    inGameName: 'TempoShift',
    mmr: 5600,
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 5 — Hard Support',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-009',
    pbgId: 'PBG-TEST-009',
    displayName: 'PBG-TEST-009 (ShadowWeaver)',
    inGameName: 'ShadowWeaver',
    mmr: 5100,
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 2 — Mid',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-014',
    pbgId: 'PBG-TEST-014',
    displayName: 'PBG-TEST-014 (StaticLink)',
    inGameName: 'StaticLink',
    mmr: 4600,
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 3 — Offlane',
    isTestAccount: true,
    source: 'TEST_SEED'
  },

  // 3x Position 5 — Hard Support
  {
    uid: 'pbg-test-005',
    pbgId: 'PBG-TEST-005',
    displayName: 'PBG-TEST-005 (GraceWard)',
    inGameName: 'GraceWard',
    mmr: 5500,
    primaryRole: 'Position 5 — Hard Support',
    secondaryRole: 'Position 4 — Soft Support',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-010',
    pbgId: 'PBG-TEST-010',
    displayName: 'PBG-TEST-010 (EchoSentry)',
    inGameName: 'EchoSentry',
    mmr: 5000,
    primaryRole: 'Position 5 — Hard Support',
    secondaryRole: 'Position 3 — Offlane',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-015',
    pbgId: 'PBG-TEST-015',
    displayName: 'PBG-TEST-015 (GlacialWard)',
    inGameName: 'GlacialWard',
    mmr: 4450,
    primaryRole: 'Position 5 — Hard Support',
    secondaryRole: 'Position 2 — Mid',
    isTestAccount: true,
    source: 'TEST_SEED'
  }
];

export interface DummyTestCaptainDefinition {
  uid: string;
  pbgId: string;
  displayName: string;
  inGameName: string;
  mmr: number;
  primaryRole: string;
  secondaryRole: string;
  targetSlot: string;
  defaultTeamName: string;
  defaultTeamTag: string;
  color: string;
  logo: string;
  isTestAccount: true;
  source: 'TEST_SEED';
}

export const DUMMY_TEST_CAPTAINS: DummyTestCaptainDefinition[] = [
  {
    uid: 'pbg-test-captain-02',
    pbgId: 'PBG-TEST-CAPTAIN-02',
    displayName: 'Test Captain 02',
    inGameName: 'CaptainAlpha',
    mmr: 5750,
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 2 — Mid',
    targetSlot: 'slot-2',
    defaultTeamName: 'Test Team Alpha',
    defaultTeamTag: 'TTA',
    color: '#3B82F6',
    logo: '⚡',
    isTestAccount: true,
    source: 'TEST_SEED'
  },
  {
    uid: 'pbg-test-captain-03',
    pbgId: 'PBG-TEST-CAPTAIN-03',
    displayName: 'Test Captain 03',
    inGameName: 'CaptainBeta',
    mmr: 5500,
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 3 — Offlane',
    targetSlot: 'slot-3',
    defaultTeamName: 'Test Team Beta',
    defaultTeamTag: 'TTB',
    color: '#EC4899',
    logo: '🔥',
    isTestAccount: true,
    source: 'TEST_SEED'
  }
];

export interface TestCaptainActionAudit {
  auditId: string;
  timestamp: string;
  actorAdminUserId: string;
  actingAsTestCaptainUserId: string;
  testCaptainName: string;
  actionType: 'BID' | 'NOMINATE' | 'CUSTOMIZE_TEAM' | 'PASS_LOT';
  details: Record<string, any>;
  testMode: true;
}

/**
 * Validates that tournament has testMode === true
 */
export function isTournamentInTestMode(tournamentId: string): boolean {
  if (tournamentId === TEST_TOURNAMENT_ID) return true;
  const cfg = tournamentConfigRegistry.getConfig(tournamentId);
  if (cfg?.identity?.testMode || (cfg as any)?.testMode) return true;
  const t = tournamentService.getTournamentById(tournamentId);
  return Boolean(t?.testMode || (t as any)?.isDevelopment);
}
