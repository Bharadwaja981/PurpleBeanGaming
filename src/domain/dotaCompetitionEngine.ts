/**
 * Purple Bean Gaming — Dota 2 Phase 4 Engine
 * Competition Structure + Seeding + Single/Double Elimination Brackets + Round Robin + Groups
 * 
 * Strict Domain Invariants:
 * 1. Only finalized / verified tournament teams can be seeded and placed into competition structures.
 * 2. Seeding modes: 'manual', 'random', 'rating' (using roster MMR/rating).
 * 3. Seed numbers must be 1..N without duplicates or missing slots.
 * 4. Single Elimination supports sizes 2, 3, 4, 5, 6, 7, 8, 16 with pure BYEs (no fake TBD matches for byes).
 *    In 3-team Single Elimination (Test Cup), Seed 1 receives a direct BYE to the Grand Final; Seeds 2 and 3 play the Semifinal.
 * 5. Double Elimination has explicit winner progression (SOLID) and upper-loser drop destinations (DOTTED).
 *    Every match contains winnerNextMatchId, winnerNextSlot, loserNextMatchId, loserNextSlot.
 * 6. Round Robin generates unique pairings once with full standings (P, W, L, series, games, diff, pts, form).
 * 7. Deterministic tiebreak ordering (Points -> Head-to-Head -> Game Diff -> Game Wins -> Seed).
 * 8. Series format (BO1, BO3, BO5) supports tournament defaults and round overrides.
 * 9. Structure states: 'UNINITIALIZED' -> 'PREVIEW' -> 'LOCKED'. Once locked, no client direct modification.
 */

import { dotaPremadeTeamEngine, PremadeTeamRegistration } from './dotaPremadeTeamEngine';
import { dotaPlayerRegistry } from './dotaPlayerEngine';
import { testCupEngine } from './testCupEngine';
import { DotaTiebreakEngine, HeadToHeadRecord, TiebreakTeamStats } from './dotaTiebreakEngine';

export type SeedingMode = 'manual' | 'random' | 'rating';

export type CompetitionFormat = 
  | 'single_elimination' 
  | 'double_elimination' 
  | 'round_robin' 
  | 'groups_playoffs';

export type SeriesFormat = 'BO1' | 'BO3' | 'BO5';

export interface SeededTeam {
  teamId: string;
  teamName: string;
  tag: string;
  logo: string;
  seed: number;
  color?: string;
  rosterStrengthRating: number; // Calculated average tournament MMR / rating
}

export interface CompetitionMatchSlot {
  teamId?: string;
  name: string;
  tag?: string;
  logo?: string;
  seed?: number;
  score: number;
  sourceLabel?: string; // e.g. "Seed 1", "Winner of ub-r1-m1", "Loser of ub-r2-m1", "A1", "BYE"
  isBye?: boolean;
}

export interface CompetitionMatchNode {
  id: string; // e.g. 'ub-r1-m1', 'lb-r1-m1', 'gf-m1', 'grp-a-m1'
  tournamentId: string;
  stage: 'upper' | 'lower' | 'grand_final' | 'group' | 'semifinal' | 'final';
  roundKey: string; // e.g. 'ub-r1', 'lb-r1', 'gf', 'grp-a'
  roundTitle: string;
  matchNumber: number;
  seriesFormat: SeriesFormat;
  teamA: CompetitionMatchSlot;
  teamB: CompetitionMatchSlot;
  winnerId?: string;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  isBye?: boolean;
  
  // Explicit progression graph
  winnerNextMatchId?: string;
  winnerNextSlot?: 'teamA' | 'teamB';
  loserNextMatchId?: string;
  loserNextSlot?: 'teamA' | 'teamB';
  loserDestinationLabel?: string;

  // Visual layout hints for grid/connectors
  column: number;
  row: number;
}

export interface GroupStandingRow {
  teamId: string;
  teamName: string;
  tag: string;
  logo: string;
  seed: number;
  played: number;
  won: number;
  lost: number;
  seriesRecord: string; // "2-1"
  gameWins: number;
  gameLosses: number;
  gameDiff: number;
  points: number;
  form: Array<'W' | 'L'>;
  headToHeadWins: Record<string, number>;
  rank: number;
  qualified: boolean;
}

export interface GroupStageRecord {
  groupId: string; // 'group-a', 'group-b'
  groupName: string;
  teams: SeededTeam[];
  matches: CompetitionMatchNode[];
  standings: GroupStandingRow[];
}

export interface CompetitionStructureConfig {
  tournamentId: string;
  tournamentName: string;
  format: CompetitionFormat;
  teamCount: number;
  seedingMode: SeedingMode;
  defaultSeriesFormat: SeriesFormat;
  roundSeriesOverrides?: Record<string, SeriesFormat>; // e.g. { 'gf': 'BO5', 'ub-final': 'BO3', 'lb-final': 'BO3' }
  groupsConfig?: {
    groupCount: number; // e.g. 2
    teamsPerGroup: number; // e.g. 4
    qualifiersPerGroup: number; // e.g. 2
  };
}

export interface CompetitionStructureState {
  tournamentId: string;
  status: 'UNINITIALIZED' | 'PREVIEW' | 'LOCKED';
  config: CompetitionStructureConfig;
  seededTeams: SeededTeam[];
  matches: CompetitionMatchNode[];
  groups?: Record<string, GroupStageRecord>;
  lockedAt?: string;
  lockedBy?: string;
  version: number;
  auditTrail: Array<{
    action: string;
    actor: string;
    details: string;
    timestamp: string;
  }>;
}

export class DotaCompetitionEngine {
  private structures = new Map<string, CompetitionStructureState>();
  private listeners: Array<() => void> = [];

  constructor() {
    this.seedDefaultConfigurations();
  }

  private seedDefaultConfigurations() {
    // 1. India Dota Open (8 Teams, Double Elimination)
    this.initStructure({
      tournamentId: 'india-dota-open-2026',
      tournamentName: 'India Dota Open 2026',
      format: 'double_elimination',
      teamCount: 8,
      seedingMode: 'rating',
      defaultSeriesFormat: 'BO3',
      roundSeriesOverrides: {
        'gf': 'BO5'
      }
    });

    // 2. Purple Bean Challenger (8 Teams, 2 Groups of 4, Top 2 Advance)
    this.initStructure({
      tournamentId: 'pb-challenger-2026',
      tournamentName: 'Purple Bean Challenger',
      format: 'groups_playoffs',
      teamCount: 8,
      seedingMode: 'rating',
      defaultSeriesFormat: 'BO1',
      roundSeriesOverrides: {
        'semifinal': 'BO3',
        'final': 'BO5'
      },
      groupsConfig: {
        groupCount: 2,
        teamsPerGroup: 4,
        qualifiersPerGroup: 2
      }
    });

    // 3. Purple Bean Test Cup (3 Teams, Single Elimination with BYE)
    this.initStructure({
      tournamentId: 'purple-bean-test-cup',
      tournamentName: 'Purple Bean Test Cup',
      format: 'single_elimination',
      teamCount: 3,
      seedingMode: 'rating',
      defaultSeriesFormat: 'BO3'
    });
  }

  public initStructure(config: CompetitionStructureConfig): CompetitionStructureState {
    const state: CompetitionStructureState = {
      tournamentId: config.tournamentId,
      status: 'UNINITIALIZED',
      config,
      seededTeams: [],
      matches: [],
      version: 1,
      auditTrail: [
        {
          action: 'structure_initialized',
          actor: 'system',
          details: `Structure initialized for format: ${config.format} (${config.teamCount} teams).`,
          timestamp: new Date().toISOString()
        }
      ]
    };
    this.structures.set(config.tournamentId, state);
    return state;
  }

  public getStructure(tournamentId: string): CompetitionStructureState | undefined {
    return this.structures.get(tournamentId);
  }

  // ---------------------------------------------------------------------------
  // 1. SEEDING LOGIC (Manual, Random, Rating-Based)
  // ---------------------------------------------------------------------------

  /**
   * Generates or validates seeds for finalized tournament teams.
   */
  public generateSeeds(params: {
    tournamentId: string;
    seedingMode: SeedingMode;
    manualSeeds?: Array<{ teamId: string; seed: number }>;
    staffActorId: string;
    candidateTeams?: PremadeTeamRegistration[];
  }): { success: boolean; error?: string; seededTeams?: SeededTeam[] } {
    const { tournamentId, seedingMode, manualSeeds, staffActorId } = params;
    const structure = this.structures.get(tournamentId);
    if (!structure) return { success: false, error: 'Tournament structure not found.' };

    if (structure.status === 'LOCKED') {
      return { success: false, error: 'DENIED: Cannot regenerate seeds: Tournament structure is already LOCKED.' };
    }

    // Retrieve teams: check params override, premade engine, or test cup engine
    let candidateTeams = params.candidateTeams || dotaPremadeTeamEngine.getTournamentTeams(tournamentId);

    // If candidate teams not in premade engine, check Test Cup
    if (candidateTeams.length === 0 && tournamentId === 'purple-bean-test-cup') {
      const tcTeams = testCupEngine.getTeams();
      candidateTeams = tcTeams.map(t => {
        // Ensure canonical seeding for 3-team cup: Bengaluru (Seed 1 BYE), Mumbai (Seed 2), Hyderabad (Seed 3)
        const teamMmr = t.id === 'tc-team-3' ? 8800 : t.id === 'tc-team-1' ? 8600 : 8400;
        return {
          id: t.id,
          tournamentId,
          tournamentName: 'Purple Bean Test Cup',
          teamId: t.id,
          teamName: t.name,
          tag: t.tag,
          logo: t.logo,
          color: t.color || '#FFE600',
          captainId: t.captainId,
          captainIgn: t.captainName,
          status: 'LOCKED',
          primaryRoster: t.primaryRoster.map(p => ({
            userId: p.id,
            ign: p.username,
            avatar: p.avatar,
            tournamentMmr: teamMmr,
            declaredMmr: teamMmr,
            primaryRole: (p.primaryRole || 'Position 1 — Hard Carry') as any,
            pbRating: (p as any).rating || 1500,
            isCaptain: p.id === t.captainId,
            isStandIn: false,
            consentStatus: 'ACCEPTED' as const,
            invitedAt: new Date().toISOString()
          })),
          standIns: [],
          registeredAt: new Date().toISOString(),
          snapshotVersion: 1,
          auditTrail: []
        };
      });
    }

    // Default 8-team pool for India Dota Open if not seeded in premade engine
    if (candidateTeams.length === 0 && tournamentId === 'india-dota-open-2026') {
      const idoTeams = [
        { id: 'team-ido-1', name: 'Mumbai Glitch', tag: 'MG', mmr: 8800, logo: '⚡' },
        { id: 'team-ido-2', name: 'Delhi Dragons', tag: 'DD', mmr: 8600, logo: '🐉' },
        { id: 'team-ido-3', name: 'Bengaluru Bytes', tag: 'BB', mmr: 8400, logo: '💻' },
        { id: 'team-ido-4', name: 'Hyderabad Hawks', tag: 'HH', mmr: 8200, logo: '🦅' },
        { id: 'team-ido-5', name: 'Chennai Cobras', tag: 'CC', mmr: 8000, logo: '🐍' },
        { id: 'team-ido-6', name: 'Kolkata Knights', tag: 'KK', mmr: 7800, logo: '⚔️' },
        { id: 'team-ido-7', name: 'Pune Panthers', tag: 'PP', mmr: 7600, logo: '🐾' },
        { id: 'team-ido-8', name: 'Ahmedabad Aces', tag: 'AA', mmr: 7400, logo: '♠️' },
      ];
      candidateTeams = idoTeams.map(t => ({
        id: t.id,
        tournamentId,
        tournamentName: 'India Dota Open 2026',
        teamId: t.id,
        teamName: t.name,
        tag: t.tag,
        logo: t.logo,
        color: '#8A2BE2',
        captainId: `${t.id}-captain`,
        captainIgn: `${t.name} Captain`,
        status: 'LOCKED',
        primaryRoster: Array.from({ length: 5 }, (_, idx) => ({
          userId: `${t.id}-p${idx + 1}`,
          ign: `${t.tag}_Player${idx + 1}`,
          avatar: t.logo,
          tournamentMmr: t.mmr,
          declaredMmr: t.mmr,
          primaryRole: 'Position 1 — Hard Carry' as any,
          pbRating: 1500,
          isCaptain: idx === 0,
          isStandIn: false,
          consentStatus: 'ACCEPTED' as const,
          invitedAt: new Date().toISOString()
        })),
        standIns: [],
        registeredAt: new Date().toISOString(),
        snapshotVersion: 1,
        auditTrail: []
      }));
    }

    // Negative Invariant: Unfinalized teams check
    // Teams must have APPROVED or LOCKED status
    const invalidTeams = candidateTeams.filter(t => t.status !== 'APPROVED' && t.status !== 'LOCKED');
    if (invalidTeams.length > 0) {
      return { 
        success: false, 
        error: `DENIED: Cannot seed tournament. ${invalidTeams.length} unfinalized team(s) included (status must be APPROVED or LOCKED).` 
      };
    }

    if (candidateTeams.length < 2) {
      return { success: false, error: 'Tournament must have at least 2 teams to seed and generate competition structure.' };
    }

    let seededTeams: SeededTeam[] = [];

    // Calculate roster strength ratings
    const teamsWithRating = candidateTeams.map(t => {
      const totalMmr = t.primaryRoster.reduce((sum, p) => sum + (p.tournamentMmr || 7000), 0);
      const avgMmr = t.primaryRoster.length > 0 ? Math.round(totalMmr / t.primaryRoster.length) : 7000;
      return {
        teamId: t.teamId,
        teamName: t.teamName,
        tag: t.tag,
        logo: t.logo,
        color: t.color,
        rosterStrengthRating: avgMmr
      };
    });

    if (seedingMode === 'manual') {
      if (!manualSeeds || manualSeeds.length !== teamsWithRating.length) {
        return { success: false, error: `Manual seeding requires exactly ${teamsWithRating.length} seed entries.` };
      }

      // Check duplicates & missing seeds 1..N
      const seedNums = manualSeeds.map(s => s.seed);
      const uniqueSeeds = new Set(seedNums);
      if (uniqueSeeds.size !== manualSeeds.length) {
        return { success: false, error: 'DENIED: Duplicate seed detected in manual seeds.' };
      }
      const uniqueTeams = new Set(manualSeeds.map(s => s.teamId));
      if (uniqueTeams.size !== manualSeeds.length) {
        return { success: false, error: 'DENIED: Duplicate team detected in manual seeds.' };
      }
      const sortedSeeds = [...seedNums].sort((a, b) => a - b);
      for (let i = 1; i <= teamsWithRating.length; i++) {
        if (!uniqueSeeds.has(i) || sortedSeeds[i - 1] !== i) {
          return { success: false, error: `DENIED: Missing seed #${i}. Seeds must be complete 1..${teamsWithRating.length} permutation without gaps.` };
        }
      }

      seededTeams = manualSeeds.map(s => {
        const team = teamsWithRating.find(t => t.teamId === s.teamId);
        if (!team) throw new Error(`Team '${s.teamId}' not found in tournament team pool.`);
        return {
          ...team,
          seed: s.seed
        };
      }).sort((a, b) => a.seed - b.seed);
    } else if (seedingMode === 'rating') {
      // Sort descending by average roster MMR / rating
      const sorted = [...teamsWithRating].sort((a, b) => b.rosterStrengthRating - a.rosterStrengthRating);
      seededTeams = sorted.map((t, idx) => ({
        ...t,
        seed: idx + 1
      }));
    } else if (seedingMode === 'random') {
      // Deterministic shuffle using seed or random
      const shuffled = [...teamsWithRating].sort(() => Math.random() - 0.5);
      seededTeams = shuffled.map((t, idx) => ({
        ...t,
        seed: idx + 1
      }));
    }

    structure.seededTeams = seededTeams;
    structure.config.seedingMode = seedingMode;
    structure.status = 'PREVIEW';
    structure.version += 1;

    structure.auditTrail.unshift({
      action: 'teams_seeded',
      actor: staffActorId,
      details: `Generated ${seedingMode} seeds for ${seededTeams.length} teams.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, seededTeams };
  }

  // ---------------------------------------------------------------------------
  // 2. COMPETITION STRUCTURE GENERATION
  // ---------------------------------------------------------------------------

  /**
   * Generates the schedule-ready matches and progression graph based on format and seeds.
   */
  public generateCompetitionStructure(params: {
    tournamentId: string;
    staffActorId: string;
  }): { success: boolean; error?: string; structure?: CompetitionStructureState } {
    const { tournamentId, staffActorId } = params;
    const structure = this.structures.get(tournamentId);
    if (!structure) return { success: false, error: 'Structure not found.' };

    if (structure.status === 'LOCKED') {
      return { success: false, error: 'DENIED: Cannot regenerate structure: Tournament structure is already LOCKED.' };
    }

    if (structure.seededTeams.length < 2) {
      return { success: false, error: 'Teams must be seeded before competition structure can be generated.' };
    }

    const { format } = structure.config;
    let matches: CompetitionMatchNode[] = [];
    let groups: Record<string, GroupStageRecord> | undefined = undefined;

    if (format === 'single_elimination') {
      matches = this.buildSingleEliminationBracket(structure);
    } else if (format === 'double_elimination') {
      matches = this.buildDoubleEliminationBracket(structure);
    } else if (format === 'round_robin') {
      matches = this.buildRoundRobinMatches(structure.tournamentId, structure.seededTeams, structure.config.defaultSeriesFormat);
    } else if (format === 'groups_playoffs') {
      const res = this.buildGroupsAndPlayoffs(structure);
      matches = res.matches;
      groups = res.groups;
    }

    structure.matches = matches;
    structure.groups = groups;
    structure.status = 'PREVIEW';
    structure.version += 1;

    structure.auditTrail.unshift({
      action: 'structure_generated',
      actor: staffActorId,
      details: `Generated ${format} structure with ${matches.length} matches.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, structure };
  }

  /**
   * Locks the structure permanently so no casual regeneration can occur.
   */
  public lockCompetitionStructure(
    tournamentId: string,
    staffActorId: string
  ): { success: boolean; error?: string; structure?: CompetitionStructureState } {
    const structure = this.structures.get(tournamentId);
    if (!structure) return { success: false, error: 'Structure not found.' };

    if (structure.matches.length === 0) {
      return { success: false, error: 'Cannot lock empty structure. Generate structure matches first.' };
    }

    structure.status = 'LOCKED';
    structure.lockedAt = new Date().toISOString();
    structure.lockedBy = staffActorId;

    structure.auditTrail.unshift({
      action: 'structure_locked',
      actor: staffActorId,
      details: `Competition structure and match progression graph officially LOCKED by ${staffActorId}.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, structure };
  }

  /**
   * Authoritative progression modification.
   * Client edits without organizer role or edits after lock are strictly DENIED.
   */
  public updateMatchProgression(params: {
    tournamentId: string;
    matchId: string;
    updates: Partial<CompetitionMatchNode>;
    staffActorId: string;
    userRole?: string;
  }): { success: boolean; error?: string } {
    if (params.userRole && params.userRole !== 'organizer' && params.userRole !== 'admin') {
      return { success: false, error: 'DENIED: Client cannot edit bracket progression. Organizer authorization required.' };
    }

    const structure = this.structures.get(params.tournamentId);
    if (!structure) return { success: false, error: 'Tournament structure not found.' };

    if (structure.status === 'LOCKED') {
      return { success: false, error: 'DENIED: Cannot edit progression on a LOCKED competition structure.' };
    }

    const match = structure.matches.find(m => m.id === params.matchId);
    if (!match) return { success: false, error: `Match '${params.matchId}' not found.` };

    if (params.updates.seriesFormat) {
      const sfVal = this.validateSeriesFormat(params.updates.seriesFormat);
      if (!sfVal.valid) return { success: false, error: sfVal.error };
    }

    if (params.updates.loserNextMatchId) {
      const dest = structure.matches.find(m => m.id === params.updates.loserNextMatchId);
      if (!dest) {
        return { success: false, error: `DENIED: Invalid loser destination match '${params.updates.loserNextMatchId}'. Destination match does not exist.` };
      }
      if (dest.stage === 'upper') {
        return { success: false, error: `DENIED: Invalid loser destination: Loser cannot drop into Upper Bracket match '${dest.id}'.` };
      }
    }

    Object.assign(match, params.updates);
    structure.version += 1;
    this.notify();
    return { success: true };
  }

  public validateProgressionGraph(matches: CompetitionMatchNode[]): { valid: boolean; error?: string } {
    const matchMap = new Map<string, CompetitionMatchNode>();
    matches.forEach(m => matchMap.set(m.id, m));

    for (const m of matches) {
      if (m.winnerNextMatchId) {
        const dest = matchMap.get(m.winnerNextMatchId);
        if (!dest) {
          return { valid: false, error: `DENIED: Invalid winner destination match '${m.winnerNextMatchId}' for match '${m.id}'.` };
        }
      }
      if (m.loserNextMatchId) {
        const dest = matchMap.get(m.loserNextMatchId);
        if (!dest) {
          return { valid: false, error: `DENIED: Invalid loser destination match '${m.loserNextMatchId}' for match '${m.id}'. Destination does not exist.` };
        }
        if (dest.stage === 'upper') {
          return { valid: false, error: `DENIED: Invalid loser destination: Loser cannot drop into Upper Bracket match '${dest.id}'.` };
        }
        if (m.loserNextSlot && m.loserNextSlot !== 'teamA' && m.loserNextSlot !== 'teamB') {
          return { valid: false, error: `DENIED: Invalid loser destination slot '${m.loserNextSlot}'. Must be 'teamA' or 'teamB'.` };
        }
      }
    }
    return { valid: true };
  }

  public validateSeriesFormat(format: string): { valid: boolean; error?: string } {
    const validFormats: SeriesFormat[] = ['BO1', 'BO3', 'BO5'];
    if (!validFormats.includes(format as SeriesFormat)) {
      return { valid: false, error: `DENIED: Invalid series format '${format}'. Supported formats are 'BO1', 'BO3', 'BO5'.` };
    }
    return { valid: true };
  }

  public validateMatchPairing(teamAId: string, teamBId: string): { valid: boolean; error?: string } {
    if (teamAId && teamBId && teamAId === teamBId) {
      return { valid: false, error: `DENIED: Invalid match pairing: Same team '${teamAId}' cannot be scheduled against itself.` };
    }
    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // 3. SINGLE ELIMINATION BUILDER (2, 3, 4, 5, 6, 7, 8, 16 TEAMS + BYES)
  // ---------------------------------------------------------------------------

  private buildSingleEliminationBracket(structure: CompetitionStructureState): CompetitionMatchNode[] {
    const teams = structure.seededTeams;
    const count = teams.length;
    const defaultBO = structure.config.defaultSeriesFormat;
    const overrides = structure.config.roundSeriesOverrides || {};

    const matches: CompetitionMatchNode[] = [];

    // Special Case: 3 Teams (Purple Bean Test Cup)
    // Semifinal (Seed 2 vs Seed 3) + Grand Final (Seed 1 bye vs Winner SF)
    if (count === 3) {
      const t1 = teams.find(t => t.seed === 1)!;
      const t2 = teams.find(t => t.seed === 2)!;
      const t3 = teams.find(t => t.seed === 3)!;

      const semiMatchId = `${structure.tournamentId}-m-semi-1`;
      const gfMatchId = `${structure.tournamentId}-m-gf`;

      const semiMatch: CompetitionMatchNode = {
        id: semiMatchId,
        tournamentId: structure.tournamentId,
        stage: 'semifinal',
        roundKey: 'semifinal',
        roundTitle: 'Semifinal',
        matchNumber: 1,
        seriesFormat: overrides['semifinal'] || defaultBO,
        teamA: {
          teamId: t2.teamId,
          name: t2.teamName,
          tag: t2.tag,
          logo: t2.logo,
          seed: 2,
          score: 0,
          sourceLabel: 'Seed #2'
        },
        teamB: {
          teamId: t3.teamId,
          name: t3.teamName,
          tag: t3.tag,
          logo: t3.logo,
          seed: 3,
          score: 0,
          sourceLabel: 'Seed #3'
        },
        status: 'UPCOMING',
        winnerNextMatchId: gfMatchId,
        winnerNextSlot: 'teamB',
        column: 1,
        row: 1
      };

      const gfMatch: CompetitionMatchNode = {
        id: gfMatchId,
        tournamentId: structure.tournamentId,
        stage: 'grand_final',
        roundKey: 'gf',
        roundTitle: 'Grand Final',
        matchNumber: 2,
        seriesFormat: overrides['gf'] || overrides['grand_final'] || defaultBO,
        teamA: {
          teamId: t1.teamId,
          name: t1.teamName,
          tag: t1.tag,
          logo: t1.logo,
          seed: 1,
          score: 0,
          sourceLabel: 'Seed #1 (BYE)'
        },
        teamB: {
          name: 'Winner of Semifinal',
          score: 0,
          sourceLabel: `Winner of ${semiMatchId}`
        },
        status: 'UPCOMING',
        column: 2,
        row: 1
      };

      matches.push(semiMatch, gfMatch);
      return matches;
    }

    // General Power-of-Two and BYE algorithm
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(count))); // 2, 4, 8, 16
    const totalRounds = Math.log2(bracketSize);
    const byesCount = bracketSize - count;

    // Standard bracket pairing order for bracket size
    const seedPairs = this.getStandardBracketPairings(bracketSize);

    // Build Round 1
    const r1Matches: CompetitionMatchNode[] = [];
    const roundTitles = this.getRoundTitles(totalRounds);

    let matchCounter = 1;
    for (let i = 0; i < seedPairs.length; i++) {
      const [seedA, seedB] = seedPairs[i];
      const teamA = teams.find(t => t.seed === seedA);
      const teamB = teams.find(t => t.seed === seedB);

      const mId = `${structure.tournamentId}-r1-m${i + 1}`;
      const nextMatchIndex = Math.floor(i / 2) + 1;
      const nextSlot: 'teamA' | 'teamB' = (i % 2 === 0) ? 'teamA' : 'teamB';
      const nextRoundKey = totalRounds === 2 ? 'gf' : 'r2';
      const nextMatchId = `${structure.tournamentId}-${nextRoundKey}-m${nextMatchIndex}`;

      // Check BYE
      if (!teamB) {
        // Team A has a BYE in Round 1
        // We do NOT create a fake match; Team A advances directly to next round!
        // We will seed Team A into the next round match slot directly.
      } else {
        r1Matches.push({
          id: mId,
          tournamentId: structure.tournamentId,
          stage: totalRounds === 1 ? 'grand_final' : 'upper',
          roundKey: totalRounds === 1 ? 'gf' : 'r1',
          roundTitle: roundTitles[0],
          matchNumber: matchCounter++,
          seriesFormat: totalRounds === 1 ? (overrides['gf'] || overrides['grand_final'] || 'BO5') : (overrides['r1'] || defaultBO),
          teamA: {
            teamId: teamA?.teamId,
            name: teamA?.teamName || `Seed #${seedA}`,
            tag: teamA?.tag,
            logo: teamA?.logo || '🛡️',
            seed: seedA,
            score: 0,
            sourceLabel: `Seed #${seedA}`
          },
          teamB: {
            teamId: teamB.teamId,
            name: teamB.teamName,
            tag: teamB.tag,
            logo: teamB.logo,
            seed: seedB,
            score: 0,
            sourceLabel: `Seed #${seedB}`
          },
          status: 'UPCOMING',
          winnerNextMatchId: totalRounds > 1 ? nextMatchId : undefined,
          winnerNextSlot: totalRounds > 1 ? nextSlot : undefined,
          column: 1,
          row: i + 1
        });
      }
    }

    matches.push(...r1Matches);

    // Build Subsequent Rounds
    let currentRoundMatches = r1Matches;
    for (let r = 2; r <= totalRounds; r++) {
      const numMatchesInRound = bracketSize / Math.pow(2, r);
      const nextRMatches: CompetitionMatchNode[] = [];
      const isGF = r === totalRounds;
      const rKey = isGF ? 'gf' : `r${r}`;
      const rTitle = roundTitles[r - 1];

      for (let m = 1; m <= numMatchesInRound; m++) {
        const mId = `${structure.tournamentId}-${rKey}-m${m}`;
        const nextMatchIndex = Math.floor((m - 1) / 2) + 1;
        const nextSlot: 'teamA' | 'teamB' = ((m - 1) % 2 === 0) ? 'teamA' : 'teamB';
        const nextRoundKey = (r + 1 === totalRounds) ? 'gf' : `r${r + 1}`;
        const nextMatchId = `${structure.tournamentId}-${nextRoundKey}-m${nextMatchIndex}`;

        // Check if incoming source had a direct BYE from round 1
        const incomingASeed = seedPairs[(m - 1) * 2] ? seedPairs[(m - 1) * 2][0] : undefined;
        const incomingBSeed = seedPairs[(m - 1) * 2 + 1] ? seedPairs[(m - 1) * 2 + 1][0] : undefined;

        let slotA: CompetitionMatchSlot = {
          name: `Winner of ${structure.tournamentId}-r${r - 1}-m${(m - 1) * 2 + 1}`,
          score: 0,
          sourceLabel: `Winner of Round ${r - 1}`
        };

        let slotB: CompetitionMatchSlot = {
          name: `Winner of ${structure.tournamentId}-r${r - 1}-m${(m - 1) * 2 + 2}`,
          score: 0,
          sourceLabel: `Winner of Round ${r - 1}`
        };

        // If round 2 and seed was a BYE recipient:
        if (r === 2) {
          const pairA = seedPairs[(m - 1) * 2];
          const pairB = seedPairs[(m - 1) * 2 + 1];
          if (pairA && pairA[1] > count) {
            const team = teams.find(t => t.seed === pairA[0]);
            if (team) {
              slotA = {
                teamId: team.teamId,
                name: team.teamName,
                tag: team.tag,
                logo: team.logo,
                seed: team.seed,
                score: 0,
                sourceLabel: `Seed #${team.seed} (BYE)`
              };
            }
          }
          if (pairB && pairB[1] > count) {
            const team = teams.find(t => t.seed === pairB[0]);
            if (team) {
              slotB = {
                teamId: team.teamId,
                name: team.teamName,
                tag: team.tag,
                logo: team.logo,
                seed: team.seed,
                score: 0,
                sourceLabel: `Seed #${team.seed} (BYE)`
              };
            }
          }
        }

        const matchNode: CompetitionMatchNode = {
          id: mId,
          tournamentId: structure.tournamentId,
          stage: isGF ? 'grand_final' : 'upper',
          roundKey: rKey,
          roundTitle: rTitle,
          matchNumber: matchCounter++,
          seriesFormat: overrides[rKey] || (isGF ? 'BO5' : defaultBO),
          teamA: slotA,
          teamB: slotB,
          status: 'UPCOMING',
          winnerNextMatchId: !isGF ? nextMatchId : undefined,
          winnerNextSlot: !isGF ? nextSlot : undefined,
          column: r,
          row: m
        };

        nextRMatches.push(matchNode);
      }

      matches.push(...nextRMatches);
      currentRoundMatches = nextRMatches;
    }

    return matches;
  }

  // ---------------------------------------------------------------------------
  // 4. DOUBLE ELIMINATION BUILDER (8 TEAMS — INDIA DOTA OPEN)
  // ---------------------------------------------------------------------------

  private buildDoubleEliminationBracket(structure: CompetitionStructureState): CompetitionMatchNode[] {
    const teams = structure.seededTeams;
    const defaultBO = structure.config.defaultSeriesFormat; // e.g. BO3
    const overrides = structure.config.roundSeriesOverrides || {};

    const t = (seedNum: number): SeededTeam => {
      const found = teams.find(team => team.seed === seedNum);
      return found || {
        teamId: `t-placeholder-${seedNum}`,
        teamName: `Seed #${seedNum}`,
        tag: `S${seedNum}`,
        logo: '🛡️',
        seed: seedNum,
        rosterStrengthRating: 7000
      };
    };

    const matches: CompetitionMatchNode[] = [];
    const tid = structure.tournamentId;

    // Match IDs
    const ub1 = `${tid}-ub-r1-m1`;
    const ub2 = `${tid}-ub-r1-m2`;
    const ub3 = `${tid}-ub-r1-m3`;
    const ub4 = `${tid}-ub-r1-m4`;

    const ubSF1 = `${tid}-ub-sf-1`;
    const ubSF2 = `${tid}-ub-sf-2`;

    const ubFinal = `${tid}-ub-final`;

    const lbR1M1 = `${tid}-lb-r1-m1`;
    const lbR1M2 = `${tid}-lb-r1-m2`;

    const lbR2M1 = `${tid}-lb-r2-m1`;
    const lbR2M2 = `${tid}-lb-r2-m2`;

    const lbSF = `${tid}-lb-sf`;
    const lbFinal = `${tid}-lb-final`;

    const grandFinal = `${tid}-gf`;

    // ================= UPPER BRACKET ROUND 1 (Quarterfinals) =================
    // UB QF 1: Seed 1 vs Seed 8
    matches.push({
      id: ub1,
      tournamentId: tid,
      stage: 'upper',
      roundKey: 'ub-r1',
      roundTitle: 'Upper Quarterfinal 1',
      matchNumber: 1,
      seriesFormat: overrides['ub-r1'] || defaultBO,
      teamA: { teamId: t(1).teamId, name: t(1).teamName, tag: t(1).tag, logo: t(1).logo, seed: 1, score: 0, sourceLabel: 'Seed #1' },
      teamB: { teamId: t(8).teamId, name: t(8).teamName, tag: t(8).tag, logo: t(8).logo, seed: 8, score: 0, sourceLabel: 'Seed #8' },
      status: 'UPCOMING',
      winnerNextMatchId: ubSF1,
      winnerNextSlot: 'teamA',
      loserNextMatchId: lbR1M1,
      loserNextSlot: 'teamA',
      loserDestinationLabel: 'LB Round 1 Match 1 Slot A',
      column: 1,
      row: 1
    });

    // UB QF 2: Seed 4 vs Seed 5
    matches.push({
      id: ub2,
      tournamentId: tid,
      stage: 'upper',
      roundKey: 'ub-r1',
      roundTitle: 'Upper Quarterfinal 2',
      matchNumber: 2,
      seriesFormat: overrides['ub-r1'] || defaultBO,
      teamA: { teamId: t(4).teamId, name: t(4).teamName, tag: t(4).tag, logo: t(4).logo, seed: 4, score: 0, sourceLabel: 'Seed #4' },
      teamB: { teamId: t(5).teamId, name: t(5).teamName, tag: t(5).tag, logo: t(5).logo, seed: 5, score: 0, sourceLabel: 'Seed #5' },
      status: 'UPCOMING',
      winnerNextMatchId: ubSF1,
      winnerNextSlot: 'teamB',
      loserNextMatchId: lbR1M1,
      loserNextSlot: 'teamB',
      loserDestinationLabel: 'LB Round 1 Match 1 Slot B',
      column: 1,
      row: 2
    });

    // UB QF 3: Seed 2 vs Seed 7
    matches.push({
      id: ub3,
      tournamentId: tid,
      stage: 'upper',
      roundKey: 'ub-r1',
      roundTitle: 'Upper Quarterfinal 3',
      matchNumber: 3,
      seriesFormat: overrides['ub-r1'] || defaultBO,
      teamA: { teamId: t(2).teamId, name: t(2).teamName, tag: t(2).tag, logo: t(2).logo, seed: 2, score: 0, sourceLabel: 'Seed #2' },
      teamB: { teamId: t(7).teamId, name: t(7).teamName, tag: t(7).tag, logo: t(7).logo, seed: 7, score: 0, sourceLabel: 'Seed #7' },
      status: 'UPCOMING',
      winnerNextMatchId: ubSF2,
      winnerNextSlot: 'teamA',
      loserNextMatchId: lbR1M2,
      loserNextSlot: 'teamA',
      loserDestinationLabel: 'LB Round 1 Match 2 Slot A',
      column: 1,
      row: 3
    });

    // UB QF 4: Seed 3 vs Seed 6
    matches.push({
      id: ub4,
      tournamentId: tid,
      stage: 'upper',
      roundKey: 'ub-r1',
      roundTitle: 'Upper Quarterfinal 4',
      matchNumber: 4,
      seriesFormat: overrides['ub-r1'] || defaultBO,
      teamA: { teamId: t(3).teamId, name: t(3).teamName, tag: t(3).tag, logo: t(3).logo, seed: 3, score: 0, sourceLabel: 'Seed #3' },
      teamB: { teamId: t(6).teamId, name: t(6).teamName, tag: t(6).tag, logo: t(6).logo, seed: 6, score: 0, sourceLabel: 'Seed #6' },
      status: 'UPCOMING',
      winnerNextMatchId: ubSF2,
      winnerNextSlot: 'teamB',
      loserNextMatchId: lbR1M2,
      loserNextSlot: 'teamB',
      loserDestinationLabel: 'LB Round 1 Match 2 Slot B',
      column: 1,
      row: 4
    });

    // ================= LOWER BRACKET ROUND 1 =================
    // LB R1 M1: Loser UB1 vs Loser UB2
    matches.push({
      id: lbR1M1,
      tournamentId: tid,
      stage: 'lower',
      roundKey: 'lb-r1',
      roundTitle: 'Lower Round 1 Match 1',
      matchNumber: 5,
      seriesFormat: overrides['lb-r1'] || defaultBO,
      teamA: { name: 'Loser of UB QF 1', score: 0, sourceLabel: `Loser of ${ub1}` },
      teamB: { name: 'Loser of UB QF 2', score: 0, sourceLabel: `Loser of ${ub2}` },
      status: 'UPCOMING',
      winnerNextMatchId: lbR2M1,
      winnerNextSlot: 'teamB',
      column: 2,
      row: 5
    });

    // LB R1 M2: Loser UB3 vs Loser UB4
    matches.push({
      id: lbR1M2,
      tournamentId: tid,
      stage: 'lower',
      roundKey: 'lb-r1',
      roundTitle: 'Lower Round 1 Match 2',
      matchNumber: 6,
      seriesFormat: overrides['lb-r1'] || defaultBO,
      teamA: { name: 'Loser of UB QF 3', score: 0, sourceLabel: `Loser of ${ub3}` },
      teamB: { name: 'Loser of UB QF 4', score: 0, sourceLabel: `Loser of ${ub4}` },
      status: 'UPCOMING',
      winnerNextMatchId: lbR2M2,
      winnerNextSlot: 'teamB',
      column: 2,
      row: 6
    });

    // ================= UPPER BRACKET ROUND 2 (Semifinals) =================
    // UB SF 1: Winner UB1 vs Winner UB2
    matches.push({
      id: ubSF1,
      tournamentId: tid,
      stage: 'upper',
      roundKey: 'ub-r2',
      roundTitle: 'Upper Semifinal 1',
      matchNumber: 7,
      seriesFormat: overrides['ub-r2'] || defaultBO,
      teamA: { name: 'Winner of UB QF 1', score: 0, sourceLabel: `Winner of ${ub1}` },
      teamB: { name: 'Winner of UB QF 2', score: 0, sourceLabel: `Winner of ${ub2}` },
      status: 'UPCOMING',
      winnerNextMatchId: ubFinal,
      winnerNextSlot: 'teamA',
      loserNextMatchId: lbR2M1,
      loserNextSlot: 'teamA',
      loserDestinationLabel: 'LB Round 2 Match 1 Slot A',
      column: 2,
      row: 1
    });

    // UB SF 2: Winner UB3 vs Winner UB4
    matches.push({
      id: ubSF2,
      tournamentId: tid,
      stage: 'upper',
      roundKey: 'ub-r2',
      roundTitle: 'Upper Semifinal 2',
      matchNumber: 8,
      seriesFormat: overrides['ub-r2'] || defaultBO,
      teamA: { name: 'Winner of UB QF 3', score: 0, sourceLabel: `Winner of ${ub3}` },
      teamB: { name: 'Winner of UB QF 4', score: 0, sourceLabel: `Winner of ${ub4}` },
      status: 'UPCOMING',
      winnerNextMatchId: ubFinal,
      winnerNextSlot: 'teamB',
      loserNextMatchId: lbR2M2,
      loserNextSlot: 'teamA',
      loserDestinationLabel: 'LB Round 2 Match 2 Slot A',
      column: 2,
      row: 2
    });

    // ================= LOWER BRACKET ROUND 2 =================
    // LB R2 M1: Loser UB SF1 vs Winner LB R1 M1
    matches.push({
      id: lbR2M1,
      tournamentId: tid,
      stage: 'lower',
      roundKey: 'lb-r2',
      roundTitle: 'Lower Round 2 Match 1',
      matchNumber: 9,
      seriesFormat: overrides['lb-r2'] || defaultBO,
      teamA: { name: 'Loser of UB SF 1', score: 0, sourceLabel: `Loser of ${ubSF1}` },
      teamB: { name: 'Winner of LB R1 M1', score: 0, sourceLabel: `Winner of ${lbR1M1}` },
      status: 'UPCOMING',
      winnerNextMatchId: lbSF,
      winnerNextSlot: 'teamA',
      column: 3,
      row: 5
    });

    // LB R2 M2: Loser UB SF2 vs Winner LB R1 M2
    matches.push({
      id: lbR2M2,
      tournamentId: tid,
      stage: 'lower',
      roundKey: 'lb-r2',
      roundTitle: 'Lower Round 2 Match 2',
      matchNumber: 10,
      seriesFormat: overrides['lb-r2'] || defaultBO,
      teamA: { name: 'Loser of UB SF 2', score: 0, sourceLabel: `Loser of ${ubSF2}` },
      teamB: { name: 'Winner of LB R1 M2', score: 0, sourceLabel: `Winner of ${lbR1M2}` },
      status: 'UPCOMING',
      winnerNextMatchId: lbSF,
      winnerNextSlot: 'teamB',
      column: 3,
      row: 6
    });

    // ================= UPPER BRACKET ROUND 3 (Upper Final) =================
    // UB Final: Winner UB SF1 vs Winner UB SF2
    matches.push({
      id: ubFinal,
      tournamentId: tid,
      stage: 'upper',
      roundKey: 'ub-final',
      roundTitle: 'Upper Bracket Final',
      matchNumber: 11,
      seriesFormat: overrides['ub-final'] || defaultBO,
      teamA: { name: 'Winner of UB SF 1', score: 0, sourceLabel: `Winner of ${ubSF1}` },
      teamB: { name: 'Winner of UB SF 2', score: 0, sourceLabel: `Winner of ${ubSF2}` },
      status: 'UPCOMING',
      winnerNextMatchId: grandFinal,
      winnerNextSlot: 'teamA',
      loserNextMatchId: lbFinal,
      loserNextSlot: 'teamA',
      loserDestinationLabel: 'Lower Final Slot A',
      column: 3,
      row: 1
    });

    // ================= LOWER BRACKET ROUND 3 (Lower Semifinal) =================
    // LB SF: Winner LB R2 M1 vs Winner LB R2 M2
    matches.push({
      id: lbSF,
      tournamentId: tid,
      stage: 'lower',
      roundKey: 'lb-sf',
      roundTitle: 'Lower Semifinal',
      matchNumber: 12,
      seriesFormat: overrides['lb-sf'] || defaultBO,
      teamA: { name: 'Winner of LB R2 M1', score: 0, sourceLabel: `Winner of ${lbR2M1}` },
      teamB: { name: 'Winner of LB R2 M2', score: 0, sourceLabel: `Winner of ${lbR2M2}` },
      status: 'UPCOMING',
      winnerNextMatchId: lbFinal,
      winnerNextSlot: 'teamB',
      column: 4,
      row: 5
    });

    // ================= LOWER BRACKET ROUND 4 (Lower Final) =================
    // LB Final: Loser UB Final vs Winner LB SF
    matches.push({
      id: lbFinal,
      tournamentId: tid,
      stage: 'lower',
      roundKey: 'lb-final',
      roundTitle: 'Lower Bracket Final',
      matchNumber: 13,
      seriesFormat: overrides['lb-final'] || defaultBO,
      teamA: { name: 'Loser of Upper Final', score: 0, sourceLabel: `Loser of ${ubFinal}` },
      teamB: { name: 'Winner of Lower Semifinal', score: 0, sourceLabel: `Winner of ${lbSF}` },
      status: 'UPCOMING',
      winnerNextMatchId: grandFinal,
      winnerNextSlot: 'teamB',
      column: 5,
      row: 5
    });

    // ================= GRAND FINAL =================
    // GF: Winner Upper Final vs Winner Lower Final
    matches.push({
      id: grandFinal,
      tournamentId: tid,
      stage: 'grand_final',
      roundKey: 'gf',
      roundTitle: 'Grand Final (Championship)',
      matchNumber: 14,
      seriesFormat: overrides['gf'] || 'BO5',
      teamA: { name: 'Upper Bracket Champion', score: 0, sourceLabel: `Winner of ${ubFinal}` },
      teamB: { name: 'Lower Bracket Champion', score: 0, sourceLabel: `Winner of ${lbFinal}` },
      status: 'UPCOMING',
      column: 6,
      row: 2
    });

    return matches;
  }

  // ---------------------------------------------------------------------------
  // 5. ROUND ROBIN & STANDINGS CALCULATION WITH DETERMINISTIC TIEBREAKS
  // ---------------------------------------------------------------------------

  public buildRoundRobinMatches(
    tournamentId: string,
    teams: SeededTeam[],
    seriesFormat: SeriesFormat = 'BO1',
    groupPrefix: string = 'grp'
  ): CompetitionMatchNode[] {
    const matches: CompetitionMatchNode[] = [];
    let matchCounter = 1;

    // Generate every pairing once
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const teamA = teams[i];
        const teamB = teams[j];

        // Negative check: same team scheduled against itself
        if (teamA.teamId === teamB.teamId) {
          throw new Error(`Invalid schedule: Team '${teamA.teamName}' cannot be scheduled against itself.`);
        }

        matches.push({
          id: `${tournamentId}-${groupPrefix}-m${matchCounter}`,
          tournamentId,
          stage: 'group',
          roundKey: groupPrefix,
          roundTitle: `${groupPrefix.toUpperCase()} Match ${matchCounter}`,
          matchNumber: matchCounter,
          seriesFormat,
          teamA: {
            teamId: teamA.teamId,
            name: teamA.teamName,
            tag: teamA.tag,
            logo: teamA.logo,
            seed: teamA.seed,
            score: 0,
            sourceLabel: `Seed #${teamA.seed}`
          },
          teamB: {
            teamId: teamB.teamId,
            name: teamB.teamName,
            tag: teamB.tag,
            logo: teamB.logo,
            seed: teamB.seed,
            score: 0,
            sourceLabel: `Seed #${teamB.seed}`
          },
          status: 'UPCOMING',
          column: 1,
          row: matchCounter++
        });
      }
    }

    return matches;
  }

  /**
   * Deterministic tiebreaker standings calculation.
   * Priority:
   * 1. Points (3 pts per win, or match wins)
   * 2. Head-to-Head record between tied teams
   * 3. Game Differential (gameWins - gameLosses)
   * 4. Total Game Wins
   * 5. Lower tournament seed number (best seed)
   */
  public calculateGroupStandings(
    teams: SeededTeam[],
    matches: CompetitionMatchNode[],
    qualifierCount: number = 2
  ): GroupStandingRow[] {
    // Initialize rows
    const rows = new Map<string, GroupStandingRow>();
    for (const team of teams) {
      rows.set(team.teamId, {
        teamId: team.teamId,
        teamName: team.teamName,
        tag: team.tag,
        logo: team.logo,
        seed: team.seed,
        played: 0,
        won: 0,
        lost: 0,
        seriesRecord: '0-0',
        gameWins: 0,
        gameLosses: 0,
        gameDiff: 0,
        points: 0,
        form: [],
        headToHeadWins: {},
        rank: 0,
        qualified: false
      });
    }

    // Process completed match results
    for (const match of matches) {
      if (match.status === 'COMPLETED' && match.teamA.teamId && match.teamB.teamId) {
        const rowA = rows.get(match.teamA.teamId);
        const rowB = rows.get(match.teamB.teamId);
        if (!rowA || !rowB) continue;

        rowA.played += 1;
        rowB.played += 1;

        rowA.gameWins += match.teamA.score;
        rowA.gameLosses += match.teamB.score;
        rowB.gameWins += match.teamB.score;
        rowB.gameLosses += match.teamA.score;

        if (match.winnerId === rowA.teamId || match.teamA.score > match.teamB.score) {
          rowA.won += 1;
          rowA.points += 3;
          rowA.form.push('W');
          rowB.lost += 1;
          rowB.form.push('L');
          rowA.headToHeadWins[rowB.teamId] = (rowA.headToHeadWins[rowB.teamId] || 0) + 1;
        } else if (match.winnerId === rowB.teamId || match.teamB.score > match.teamA.score) {
          rowB.won += 1;
          rowB.points += 3;
          rowB.form.push('W');
          rowA.lost += 1;
          rowA.form.push('L');
          rowB.headToHeadWins[rowA.teamId] = (rowB.headToHeadWins[rowA.teamId] || 0) + 1;
        }
      }
    }

    // Update differentials and series records
    for (const row of rows.values()) {
      row.gameDiff = row.gameWins - row.gameLosses;
      row.seriesRecord = `${row.won}-${row.lost}`;
    }

    // Sort deterministically
    const sorted = Array.from(rows.values()).sort((a, b) => {
      // 1. Points / Match Wins
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;

      // 2. Head-to-Head between tied teams
      const aBeatB = a.headToHeadWins[b.teamId] || 0;
      const bBeatA = b.headToHeadWins[a.teamId] || 0;
      if (aBeatB !== bBeatA) return bBeatA - aBeatB;

      // 3. Game Differential
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;

      // 4. Game Wins
      if (b.gameWins !== a.gameWins) return b.gameWins - a.gameWins;

      // 5. Seed rank (lower seed number = higher original rank)
      return a.seed - b.seed;
    });

    // Assign final ranks and qualification status
    sorted.forEach((row, idx) => {
      row.rank = idx + 1;
      row.qualified = idx < qualifierCount;
    });

    return sorted;
  }

  // ---------------------------------------------------------------------------
  // 6. GROUPS -> PLAYOFFS BUILDER (PURPLE BEAN CHALLENGER)
  // ---------------------------------------------------------------------------

  private buildGroupsAndPlayoffs(structure: CompetitionStructureState): {
    matches: CompetitionMatchNode[];
    groups: Record<string, GroupStageRecord>;
  } {
    const teams = structure.seededTeams;
    const tid = structure.tournamentId;
    const groupCount = structure.config.groupsConfig?.groupCount || 2;
    const qualifiersPerGroup = structure.config.groupsConfig?.qualifiersPerGroup || 2;
    const overrides = structure.config.roundSeriesOverrides || {};

    // Snake seed distribution into groups:
    // Group A: Seeds 1, 4, 5, 8
    // Group B: Seeds 2, 3, 6, 7
    const groupATeams = teams.filter(t => t.seed === 1 || t.seed === 4 || t.seed === 5 || t.seed === 8);
    const groupBTeams = teams.filter(t => t.seed === 2 || t.seed === 3 || t.seed === 6 || t.seed === 7);

    // If teams count is different, distribute by modulo
    if (groupATeams.length === 0 || groupBTeams.length === 0) {
      teams.forEach((t, i) => {
        if (i % 2 === 0) groupATeams.push(t);
        else groupBTeams.push(t);
      });
    }

    const groupAMatches = this.buildRoundRobinMatches(tid, groupATeams, 'BO1', 'grp-a');
    const groupBMatches = this.buildRoundRobinMatches(tid, groupBTeams, 'BO1', 'grp-b');

    const groupAStandings = this.calculateGroupStandings(groupATeams, groupAMatches, qualifiersPerGroup);
    const groupBStandings = this.calculateGroupStandings(groupBTeams, groupBMatches, qualifiersPerGroup);

    const groups: Record<string, GroupStageRecord> = {
      'group-a': {
        groupId: 'group-a',
        groupName: 'Group A',
        teams: groupATeams,
        matches: groupAMatches,
        standings: groupAStandings
      },
      'group-b': {
        groupId: 'group-b',
        groupName: 'Group B',
        teams: groupBTeams,
        matches: groupBMatches,
        standings: groupBStandings
      }
    };

    // Playoff matches (Semifinals & Final)
    const sf1MatchId = `${tid}-po-sf-1`;
    const sf2MatchId = `${tid}-po-sf-2`;
    const finalMatchId = `${tid}-po-final`;

    const sf1: CompetitionMatchNode = {
      id: sf1MatchId,
      tournamentId: tid,
      stage: 'semifinal',
      roundKey: 'semifinal',
      roundTitle: 'Playoff Semifinal 1 (A1 vs B2)',
      matchNumber: groupAMatches.length + groupBMatches.length + 1,
      seriesFormat: overrides['semifinal'] || 'BO3',
      teamA: {
        name: 'Group A #1 Seed (A1)',
        score: 0,
        sourceLabel: 'A1'
      },
      teamB: {
        name: 'Group B #2 Seed (B2)',
        score: 0,
        sourceLabel: 'B2'
      },
      status: 'UPCOMING',
      winnerNextMatchId: finalMatchId,
      winnerNextSlot: 'teamA',
      column: 2,
      row: 1
    };

    const sf2: CompetitionMatchNode = {
      id: sf2MatchId,
      tournamentId: tid,
      stage: 'semifinal',
      roundKey: 'semifinal',
      roundTitle: 'Playoff Semifinal 2 (B1 vs A2)',
      matchNumber: groupAMatches.length + groupBMatches.length + 2,
      seriesFormat: overrides['semifinal'] || 'BO3',
      teamA: {
        name: 'Group B #1 Seed (B1)',
        score: 0,
        sourceLabel: 'B1'
      },
      teamB: {
        name: 'Group A #2 Seed (A2)',
        score: 0,
        sourceLabel: 'A2'
      },
      status: 'UPCOMING',
      winnerNextMatchId: finalMatchId,
      winnerNextSlot: 'teamB',
      column: 2,
      row: 2
    };

    const finalMatch: CompetitionMatchNode = {
      id: finalMatchId,
      tournamentId: tid,
      stage: 'final',
      roundKey: 'final',
      roundTitle: 'Playoff Grand Final',
      matchNumber: groupAMatches.length + groupBMatches.length + 3,
      seriesFormat: overrides['final'] || 'BO5',
      teamA: {
        name: 'Winner of SF 1',
        score: 0,
        sourceLabel: `Winner of ${sf1MatchId}`
      },
      teamB: {
        name: 'Winner of SF 2',
        score: 0,
        sourceLabel: `Winner of ${sf2MatchId}`
      },
      status: 'UPCOMING',
      column: 3,
      row: 1
    };

    const allMatches = [
      ...groupAMatches,
      ...groupBMatches,
      sf1,
      sf2,
      finalMatch
    ];

    return { matches: allMatches, groups };
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  private getStandardBracketPairings(size: number): Array<[number, number]> {
    if (size === 2) return [[1, 2]];
    if (size === 4) return [[1, 4], [2, 3]];
    if (size === 8) return [[1, 8], [4, 5], [2, 7], [3, 6]];
    if (size === 16) {
      return [
        [1, 16], [8, 9], [4, 13], [5, 12],
        [2, 15], [7, 10], [3, 14], [6, 11]
      ];
    }
    // Generic fallback for any power of 2
    const pairs: Array<[number, number]> = [];
    for (let i = 1; i <= size / 2; i++) {
      pairs.push([i, size - i + 1]);
    }
    return pairs;
  }

  private getRoundTitles(totalRounds: number): string[] {
    if (totalRounds === 1) return ['Grand Final'];
    if (totalRounds === 2) return ['Semifinals', 'Grand Final'];
    if (totalRounds === 3) return ['Quarterfinals', 'Semifinals', 'Grand Final'];
    if (totalRounds === 4) return ['Round of 16', 'Quarterfinals', 'Semifinals', 'Grand Final'];
    const titles: string[] = [];
    for (let i = 1; i <= totalRounds; i++) {
      titles.push(`Round ${i}`);
    }
    return titles;
  }

  // ---------------------------------------------------------------------------
  // MATCH EXECUTION & CANONICAL PROGRESSION (Phase 5)
  // ---------------------------------------------------------------------------

  /**
   * Applies canonical match result and automatically executes progression.
   * Progresses winner to winnerNextMatchId/winnerNextSlot.
   * In double elimination, drops loser to loserNextMatchId/loserNextSlot.
   * Updates group standings and activates playoffs when group stage completes.
   */
  public applyCanonicalMatchResult(params: {
    tournamentId: string;
    matchId: string;
    winnerTeamId: string;
    loserTeamId: string;
    scoreA: number;
    scoreB: number;
    staffActorId?: string;
  }): { success: boolean; error?: string; structure?: CompetitionStructureState } {
    const { tournamentId, matchId, winnerTeamId, loserTeamId, scoreA, scoreB, staffActorId = 'system' } = params;
    const structure = this.structures.get(tournamentId);
    if (!structure) return { success: false, error: 'Tournament structure not found.' };

    const match = structure.matches.find(m => m.id === matchId);
    if (!match) return { success: false, error: `Match '${matchId}' not found in competition structure.` };

    match.status = 'COMPLETED';
    match.winnerId = winnerTeamId;
    match.teamA.score = scoreA;
    match.teamB.score = scoreB;

    // Helper to find team details (name, tag, logo, seed)
    const findTeam = (teamId: string) => {
      const fromSeeds = structure.seededTeams.find(t => t.teamId === teamId);
      if (fromSeeds) {
        return {
          teamId: fromSeeds.teamId,
          name: fromSeeds.teamName,
          tag: fromSeeds.tag,
          logo: fromSeeds.logo,
          seed: fromSeeds.seed
        };
      }
      if (match.teamA.teamId === teamId) {
        return {
          teamId: match.teamA.teamId,
          name: match.teamA.name,
          tag: match.teamA.tag,
          logo: match.teamA.logo,
          seed: match.teamA.seed
        };
      }
      if (match.teamB.teamId === teamId) {
        return {
          teamId: match.teamB.teamId,
          name: match.teamB.name,
          tag: match.teamB.tag,
          logo: match.teamB.logo,
          seed: match.teamB.seed
        };
      }
      return {
        teamId,
        name: teamId,
        tag: 'DOTA',
        logo: '🛡️',
        seed: undefined
      };
    };

    const winnerInfo = findTeam(winnerTeamId);
    const loserInfo = findTeam(loserTeamId);

    // 1. Advance Winner
    if (match.winnerNextMatchId) {
      const destMatch = structure.matches.find(m => m.id === match.winnerNextMatchId);
      if (destMatch) {
        const slotKey = match.winnerNextSlot || 'teamA';
        destMatch[slotKey] = {
          teamId: winnerInfo.teamId,
          name: winnerInfo.name,
          tag: winnerInfo.tag,
          logo: winnerInfo.logo,
          seed: winnerInfo.seed,
          score: 0,
          sourceLabel: `Winner of ${match.roundTitle || match.id}`
        };
      }
    }

    // 2. Drop Loser (Double Elimination)
    if (match.loserNextMatchId) {
      const destLoserMatch = structure.matches.find(m => m.id === match.loserNextMatchId);
      if (destLoserMatch) {
        const loserSlotKey = match.loserNextSlot || 'teamB';
        destLoserMatch[loserSlotKey] = {
          teamId: loserInfo.teamId,
          name: loserInfo.name,
          tag: loserInfo.tag,
          logo: loserInfo.logo,
          seed: loserInfo.seed,
          score: 0,
          sourceLabel: `Loser of ${match.roundTitle || match.id}`
        };
      }
    }

    // 3. Group Standings Update & Playoffs Qualification Check
    if (match.stage === 'group' && structure.groups) {
      this.recalculateGroupStandings(structure);
    }

    structure.version += 1;
    structure.auditTrail.unshift({
      action: 'canonical_result_applied',
      actor: staffActorId,
      details: `Match ${matchId} finalized: ${winnerInfo.name} defeated ${loserInfo.name} (${scoreA}-${scoreB}). Progression updated.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, structure };
  }

  public recalculateGroupStandings(structure: CompetitionStructureState) {
    if (!structure.groups) return;

    for (const group of Object.values(structure.groups)) {
      const tiebreakStats: TiebreakTeamStats[] = [];
      const h2hRecords: HeadToHeadRecord[] = [];

      for (const team of group.teams) {
        const teamMatches = group.matches.filter(m => 
          (m.teamA.teamId === team.teamId || m.teamB.teamId === team.teamId) && m.status === 'COMPLETED'
        );

        let matchWins = 0;
        let matchLosses = 0;
        let gamesWon = 0;
        let gamesLost = 0;

        for (const tm of teamMatches) {
          const isA = tm.teamA.teamId === team.teamId;
          const myScore = isA ? tm.teamA.score : tm.teamB.score;
          const oppScore = isA ? tm.teamB.score : tm.teamA.score;
          gamesWon += myScore;
          gamesLost += oppScore;

          if (tm.winnerId === team.teamId) {
            matchWins++;
          } else if (tm.winnerId) {
            matchLosses++;
          }
        }

        tiebreakStats.push({
          teamId: team.teamId,
          teamName: team.teamName,
          seed: team.seed,
          matchWins,
          matchLosses,
          seriesWins: matchWins,
          seriesLosses: matchLosses,
          gamesWon,
          gamesLost,
          points: matchWins * 3
        });
      }

      // Collect H2H
      for (const m of group.matches) {
        if (m.status === 'COMPLETED' && m.winnerId && m.teamA.teamId && m.teamB.teamId) {
          h2hRecords.push({
            teamAId: m.teamA.teamId,
            teamBId: m.teamB.teamId,
            winnerTeamId: m.winnerId
          });
        }
      }

      const sorted = DotaTiebreakEngine.sortStandings(tiebreakStats, h2hRecords);
      const qualCount = structure.config.groupsConfig?.qualifiersPerGroup || 2;

      group.standings = sorted.map(st => {
        const teamInfo = group.teams.find(t => t.teamId === st.teamId)!;
        const teamMatches = group.matches.filter(m => 
          (m.teamA.teamId === st.teamId || m.teamB.teamId === st.teamId) && m.status === 'COMPLETED'
        );
        const form: Array<'W' | 'L'> = teamMatches.map(m => m.winnerId === st.teamId ? 'W' : 'L');
        const h2hWins: Record<string, number> = {};
        for (const h of h2hRecords) {
          if (h.winnerTeamId === st.teamId) {
            const opp = h.teamAId === st.teamId ? h.teamBId : h.teamAId;
            h2hWins[opp] = (h2hWins[opp] || 0) + 1;
          }
        }

        return {
          teamId: st.teamId,
          teamName: st.teamName,
          tag: teamInfo.tag,
          logo: teamInfo.logo,
          seed: st.seed,
          played: st.matchWins + st.matchLosses,
          won: st.matchWins,
          lost: st.matchLosses,
          seriesRecord: `${st.matchWins}-${st.matchLosses}`,
          gameWins: st.gamesWon,
          gameLosses: st.gamesLost,
          gameDiff: st.gamesWon - st.gamesLost,
          points: st.points,
          form,
          headToHeadWins: h2hWins,
          rank: st.rank,
          qualified: st.rank <= qualCount
        };
      });
    }

    // Check if ALL group matches are completed across all groups
    const allGroupsDone = Object.values(structure.groups).every(g => 
      g.matches.every(m => m.status === 'COMPLETED')
    );

    if (allGroupsDone) {
      this.advanceGroupsToPlayoffs(structure.tournamentId);
    }
  }

  public advanceGroupsToPlayoffs(tournamentId: string): { success: boolean; error?: string } {
    const structure = this.structures.get(tournamentId);
    if (!structure || !structure.groups) return { success: false, error: 'Structure or groups not found.' };

    const groupA = structure.groups['group-a'];
    const groupB = structure.groups['group-b'];

    if (!groupA || !groupB) {
      return { success: false, error: 'Group A or Group B not found.' };
    }

    const aRanked = [...groupA.standings].sort((a, b) => a.rank - b.rank);
    const bRanked = [...groupB.standings].sort((a, b) => a.rank - b.rank);

    if (aRanked.length < 2 || bRanked.length < 2) {
      return { success: false, error: 'Insufficient qualifiers in group standings.' };
    }

    const A1 = aRanked[0];
    const A2 = aRanked[1];
    const B1 = bRanked[0];
    const B2 = bRanked[1];

    // Semifinal 1: A1 vs B2
    const sf1 = structure.matches.find(m => m.stage === 'semifinal' && (m.id.includes('sf-1') || m.matchNumber === groupA.matches.length + groupB.matches.length + 1));
    if (sf1) {
      sf1.teamA = {
        teamId: A1.teamId,
        name: A1.teamName,
        tag: A1.tag,
        logo: A1.logo,
        seed: A1.seed,
        score: 0,
        sourceLabel: `Group A #1 (${A1.teamName})`
      };
      sf1.teamB = {
        teamId: B2.teamId,
        name: B2.teamName,
        tag: B2.tag,
        logo: B2.logo,
        seed: B2.seed,
        score: 0,
        sourceLabel: `Group B #2 (${B2.teamName})`
      };
      sf1.status = 'UPCOMING';
    }

    // Semifinal 2: B1 vs A2
    const sf2 = structure.matches.find(m => m.stage === 'semifinal' && (m.id.includes('sf-2') || m.matchNumber === groupA.matches.length + groupB.matches.length + 2));
    if (sf2) {
      sf2.teamA = {
        teamId: B1.teamId,
        name: B1.teamName,
        tag: B1.tag,
        logo: B1.logo,
        seed: B1.seed,
        score: 0,
        sourceLabel: `Group B #1 (${B1.teamName})`
      };
      sf2.teamB = {
        teamId: A2.teamId,
        name: A2.teamName,
        tag: A2.tag,
        logo: A2.logo,
        seed: A2.seed,
        score: 0,
        sourceLabel: `Group A #2 (${A2.teamName})`
      };
      sf2.status = 'UPCOMING';
    }

    structure.version += 1;
    structure.auditTrail.unshift({
      action: 'groups_advanced_to_playoffs',
      actor: 'system',
      details: `Groups completed! Advanced A1 (${A1.teamName}) vs B2 (${B2.teamName}) into SF1, and B1 (${B1.teamName}) vs A2 (${A2.teamName}) into SF2.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true };
  }

  public getTiebreakRulesDescription(): string[] {
    return [
      '1. Total Match Wins / Points (3 points per series victory)',
      '2. Head-to-Head series result between tied teams',
      '3. Net Game Differential (Game Wins minus Game Losses)',
      '4. Total Individual Game Wins',
      '5. Original Tournament Seed Rank (determined prior to competition start)'
    ];
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (err) { console.error('Competition engine listener error:', err); }
    });
  }
}

// Global Singleton
export const dotaCompetitionEngine = new DotaCompetitionEngine();
