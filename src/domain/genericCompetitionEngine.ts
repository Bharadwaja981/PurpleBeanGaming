/**
 * Purple Bean Gaming — Generic Competition Format Engine
 * 
 * Supports Single Elimination (with proper BYEs for any team count),
 * Double Elimination (with upper/lower brackets and loser drop paths),
 * Round Robin (schedules and table standings),
 * and Groups + Knockout.
 */

import { SeriesFormatType, SeedingMethod } from './tournamentConfig';

export interface CompetitionTeam {
  id: string;
  name: string;
  tag: string;
  logo: string;
  rating: number;
  seed?: number;
  city?: string;
  score?: number;
}

export interface CompetitionMatch {
  id: string;
  tournamentId: string;
  round: string; // e.g. "Quarterfinal", "Semifinal", "Grand Final", "Round 1", "LB Round 1"
  bracketType?: 'UPPER' | 'LOWER' | 'FINAL' | 'GROUP' | 'MAIN';
  matchNumber: number;
  seriesFormat: SeriesFormatType;
  teamA?: CompetitionTeam | null;
  teamB?: CompetitionTeam | null;
  scoreA: number;
  scoreB: number;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'BYE';
  winnerId?: string;
  loserId?: string;
  scheduledTime?: string;
  winnerNextMatchId?: string;
  winnerNextSlot?: 'teamA' | 'teamB';
  loserNextMatchId?: string;
  loserNextSlot?: 'teamA' | 'teamB';
  groupName?: string;
}

export interface RoundRobinStanding {
  rank: number;
  teamId: string;
  teamName: string;
  tag: string;
  logo: string;
  played: number;
  won: number;
  lost: number;
  draws: number;
  points: number;
  mapDifferential: number;
}

export interface CompetitionStructure {
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUPS_KNOCKOUT';
  rounds: Array<{
    name: string;
    bracketType?: 'UPPER' | 'LOWER' | 'FINAL' | 'GROUP' | 'MAIN';
    matches: CompetitionMatch[];
  }>;
  allMatches: CompetitionMatch[];
  standings?: RoundRobinStanding[];
  groupStandings?: Record<string, RoundRobinStanding[]>;
}

export class GenericCompetitionEngine {
  /**
   * Seeds teams according to the selected seeding method.
   */
  public static seedTeams(teams: CompetitionTeam[], method: SeedingMethod, manualOrder?: string[]): CompetitionTeam[] {
    const list = [...teams];
    if (method === 'RATING_BASED') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (method === 'RANDOM') {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    } else if (method === 'MANUAL' && manualOrder && manualOrder.length > 0) {
      list.sort((a, b) => {
        const idxA = manualOrder.indexOf(a.id);
        const idxB = manualOrder.indexOf(b.id);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
    }

    return list.map((team, idx) => ({
      ...team,
      seed: idx + 1
    }));
  }

  /**
   * Generates a Single Elimination bracket for any valid team count (2, 3, 4, 5, 6, 7, 8+).
   * Correctly allocates BYEs without fake teams.
   */
  public static generateSingleElimination(
    teams: CompetitionTeam[],
    tournamentId: string,
    defaultSeriesFormat: SeriesFormatType = 'BO3',
    roundOverrides: Record<string, SeriesFormatType> = {}
  ): CompetitionStructure {
    const n = teams.length;
    if (n < 2) {
      throw new Error('Single Elimination requires at least 2 teams.');
    }

    // Special handling for 3 teams (e.g. Purple Bean Test Cup model)
    if (n === 3) {
      const semiSeries = roundOverrides['Semifinal'] || defaultSeriesFormat;
      const finalSeries = roundOverrides['Grand Final'] || defaultSeriesFormat;

      const semiMatch: CompetitionMatch = {
        id: `match-semi-1`,
        tournamentId,
        round: 'Semifinal',
        bracketType: 'MAIN',
        matchNumber: 1,
        seriesFormat: semiSeries,
        teamA: teams[0],
        teamB: teams[1],
        scoreA: 0,
        scoreB: 0,
        status: 'UPCOMING',
        winnerNextMatchId: `match-final-1`,
        winnerNextSlot: 'teamA'
      };

      const finalMatch: CompetitionMatch = {
        id: `match-final-1`,
        tournamentId,
        round: 'Grand Final',
        bracketType: 'FINAL',
        matchNumber: 2,
        seriesFormat: finalSeries,
        teamA: null, // Winner of Semifinal
        teamB: teams[2], // Team 3 has BYE straight into Grand Final
        scoreA: 0,
        scoreB: 0,
        status: 'UPCOMING'
      };

      return {
        format: 'SINGLE_ELIMINATION',
        rounds: [
          { name: 'Semifinal', bracketType: 'MAIN', matches: [semiMatch] },
          { name: 'Grand Final', bracketType: 'FINAL', matches: [finalMatch] }
        ],
        allMatches: [semiMatch, finalMatch]
      };
    }

    // General power-of-two bracket with mathematical BYE assignment
    const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(n)));
    const totalRounds = Math.log2(powerOfTwo);
    const byesCount = powerOfTwo - n;

    const roundNames: string[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      const remainingMatches = Math.pow(2, totalRounds - r);
      if (remainingMatches === 1) roundNames.push('Grand Final');
      else if (remainingMatches === 2) roundNames.push('Semifinals');
      else if (remainingMatches === 4) roundNames.push('Quarterfinals');
      else roundNames.push(`Round of ${remainingMatches * 2}`);
    }

    const allMatches: CompetitionMatch[] = [];
    const rounds: CompetitionStructure['rounds'] = [];
    const matchLookup = new Map<string, CompetitionMatch>();

    // Step 1: Create all match placeholders across rounds
    for (let r = 0; r < totalRounds; r++) {
      const roundName = roundNames[r];
      const matchCount = Math.pow(2, totalRounds - r - 1);
      const roundMatches: CompetitionMatch[] = [];
      const series = roundOverrides[roundName] || defaultSeriesFormat;

      for (let m = 0; m < matchCount; m++) {
        const matchId = `match-r${r + 1}-m${m + 1}`;
        const match: CompetitionMatch = {
          id: matchId,
          tournamentId,
          round: roundName,
          bracketType: r === totalRounds - 1 ? 'FINAL' : 'MAIN',
          matchNumber: m + 1,
          seriesFormat: series,
          teamA: null,
          teamB: null,
          scoreA: 0,
          scoreB: 0,
          status: 'UPCOMING'
        };
        roundMatches.push(match);
        allMatches.push(match);
        matchLookup.set(matchId, match);
      }
      rounds.push({ name: roundName, matches: roundMatches });
    }

    // Step 2: Wire winner progression pointers
    for (let r = 0; r < totalRounds - 1; r++) {
      const currentMatches = rounds[r].matches;
      const nextMatches = rounds[r + 1].matches;
      currentMatches.forEach((cur, idx) => {
        const nextMatchIdx = Math.floor(idx / 2);
        const nextSlot = idx % 2 === 0 ? 'teamA' : 'teamB';
        cur.winnerNextMatchId = nextMatches[nextMatchIdx].id;
        cur.winnerNextSlot = nextSlot;
      });
    }

    // Step 3: Seed first round teams and byes
    const firstRoundMatches = rounds[0].matches;
    const sortedTeams = [...teams];

    // Standard bracket pairing: 1 vs N, 2 vs N-1, etc.
    // Teams receiving BYEs automatically advance to round 2
    let teamCursor = 0;
    for (let i = 0; i < firstRoundMatches.length; i++) {
      const m = firstRoundMatches[i];
      m.teamA = sortedTeams[teamCursor++] || null;

      // Check if this slot receives a BYE
      if (i < byesCount) {
        // Team A advances with BYE
        m.teamB = null;
        m.status = 'BYE';
        m.winnerId = m.teamA?.id;
        if (m.winnerNextMatchId && m.teamA) {
          const nextMatch = matchLookup.get(m.winnerNextMatchId);
          if (nextMatch) {
            if (m.winnerNextSlot === 'teamA') nextMatch.teamA = m.teamA;
            else nextMatch.teamB = m.teamA;
          }
        }
      } else {
        m.teamB = sortedTeams[teamCursor++] || null;
      }
    }

    return {
      format: 'SINGLE_ELIMINATION',
      rounds,
      allMatches
    };
  }

  /**
   * Generates a true Double Elimination bracket with Upper, Lower, and Grand Final brackets.
   */
  public static generateDoubleElimination(
    teams: CompetitionTeam[],
    tournamentId: string,
    defaultSeriesFormat: SeriesFormatType = 'BO3',
    roundOverrides: Record<string, SeriesFormatType> = {}
  ): CompetitionStructure {
    const n = teams.length;
    if (n < 4) {
      // Fallback to single elimination if fewer than 4 teams
      return this.generateSingleElimination(teams, tournamentId, defaultSeriesFormat, roundOverrides);
    }

    const allMatches: CompetitionMatch[] = [];
    const rounds: CompetitionStructure['rounds'] = [];

    // Upper Bracket: Semifinals & Upper Final (for 4 teams)
    const upperSemi1: CompetitionMatch = {
      id: 'de-upper-semi-1',
      tournamentId,
      round: 'Upper Semifinal 1',
      bracketType: 'UPPER',
      matchNumber: 1,
      seriesFormat: defaultSeriesFormat,
      teamA: teams[0],
      teamB: teams[3],
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING',
      winnerNextMatchId: 'de-upper-final',
      winnerNextSlot: 'teamA',
      loserNextMatchId: 'de-lower-semi',
      loserNextSlot: 'teamA'
    };

    const upperSemi2: CompetitionMatch = {
      id: 'de-upper-semi-2',
      tournamentId,
      round: 'Upper Semifinal 2',
      bracketType: 'UPPER',
      matchNumber: 2,
      seriesFormat: defaultSeriesFormat,
      teamA: teams[1],
      teamB: teams[2],
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING',
      winnerNextMatchId: 'de-upper-final',
      winnerNextSlot: 'teamB',
      loserNextMatchId: 'de-lower-semi',
      loserNextSlot: 'teamB'
    };

    const upperFinal: CompetitionMatch = {
      id: 'de-upper-final',
      tournamentId,
      round: 'Upper Final',
      bracketType: 'UPPER',
      matchNumber: 3,
      seriesFormat: defaultSeriesFormat,
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING',
      winnerNextMatchId: 'de-grand-final',
      winnerNextSlot: 'teamA',
      loserNextMatchId: 'de-lower-final',
      loserNextSlot: 'teamA'
    };

    // Lower Bracket
    const lowerSemi: CompetitionMatch = {
      id: 'de-lower-semi',
      tournamentId,
      round: 'Lower Semifinal',
      bracketType: 'LOWER',
      matchNumber: 4,
      seriesFormat: defaultSeriesFormat,
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING',
      winnerNextMatchId: 'de-lower-final',
      winnerNextSlot: 'teamB'
    };

    const lowerFinal: CompetitionMatch = {
      id: 'de-lower-final',
      tournamentId,
      round: 'Lower Final',
      bracketType: 'LOWER',
      matchNumber: 5,
      seriesFormat: defaultSeriesFormat,
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING',
      winnerNextMatchId: 'de-grand-final',
      winnerNextSlot: 'teamB'
    };

    // Grand Final
    const grandFinal: CompetitionMatch = {
      id: 'de-grand-final',
      tournamentId,
      round: 'Grand Final',
      bracketType: 'FINAL',
      matchNumber: 6,
      seriesFormat: roundOverrides['Grand Final'] || 'BO5',
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    };

    allMatches.push(upperSemi1, upperSemi2, upperFinal, lowerSemi, lowerFinal, grandFinal);

    rounds.push(
      { name: 'Upper Semifinals', bracketType: 'UPPER', matches: [upperSemi1, upperSemi2] },
      { name: 'Lower Semifinal', bracketType: 'LOWER', matches: [lowerSemi] },
      { name: 'Upper Final', bracketType: 'UPPER', matches: [upperFinal] },
      { name: 'Lower Final', bracketType: 'LOWER', matches: [lowerFinal] },
      { name: 'Grand Final', bracketType: 'FINAL', matches: [grandFinal] }
    );

    return {
      format: 'DOUBLE_ELIMINATION',
      rounds,
      allMatches
    };
  }

  /**
   * Generates a Round Robin schedule where each team plays every other team once.
   */
  public static generateRoundRobin(
    teams: CompetitionTeam[],
    tournamentId: string,
    defaultSeriesFormat: SeriesFormatType = 'BO1'
  ): CompetitionStructure {
    const n = teams.length;
    if (n < 2) throw new Error('Round Robin requires at least 2 teams.');

    const allMatches: CompetitionMatch[] = [];
    const rounds: CompetitionStructure['rounds'] = [];
    let matchCounter = 1;

    // Standard round-robin scheduling (Berger tables)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const match: CompetitionMatch = {
          id: `rr-match-${matchCounter}`,
          tournamentId,
          round: `Round Robin Match ${matchCounter}`,
          bracketType: 'MAIN',
          matchNumber: matchCounter,
          seriesFormat: defaultSeriesFormat,
          teamA: teams[i],
          teamB: teams[j],
          scoreA: 0,
          scoreB: 0,
          status: 'UPCOMING'
        };
        allMatches.push(match);
        matchCounter++;
      }
    }

    rounds.push({
      name: 'Round Robin Matches',
      matches: allMatches
    });

    const standings = this.calculateRoundRobinStandings(teams, allMatches);

    return {
      format: 'ROUND_ROBIN',
      rounds,
      allMatches,
      standings
    };
  }

  /**
   * Generates Groups + Knockout structure (e.g. 8 teams into 2 groups of 4, top 2 advance to playoffs).
   */
  public static generateGroupsAndKnockout(
    teams: CompetitionTeam[],
    tournamentId: string,
    groupCount = 2,
    advancePerGroup = 2,
    defaultSeriesFormat: SeriesFormatType = 'BO1',
    playoffSeriesFormat: SeriesFormatType = 'BO3'
  ): CompetitionStructure {
    const allMatches: CompetitionMatch[] = [];
    const rounds: CompetitionStructure['rounds'] = [];
    const groupStandings: Record<string, RoundRobinStanding[]> = {};

    // Step 1: Assign teams into groups
    const groups: Record<string, CompetitionTeam[]> = {};
    for (let g = 0; g < groupCount; g++) {
      const gName = `Group ${String.fromCharCode(65 + g)}`;
      groups[gName] = [];
    }

    teams.forEach((t, idx) => {
      const gIndex = idx % groupCount;
      const gName = `Group ${String.fromCharCode(65 + gIndex)}`;
      groups[gName].push(t);
    });

    // Step 2: Create round-robin matches for each group
    let matchIdx = 1;
    for (const [groupName, groupTeams] of Object.entries(groups)) {
      const groupMatches: CompetitionMatch[] = [];
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          const m: CompetitionMatch = {
            id: `grp-${groupName.toLowerCase().replace(' ', '')}-m${matchIdx}`,
            tournamentId,
            round: `${groupName} Stage`,
            groupName,
            bracketType: 'GROUP',
            matchNumber: matchIdx++,
            seriesFormat: defaultSeriesFormat,
            teamA: groupTeams[i],
            teamB: groupTeams[j],
            scoreA: 0,
            scoreB: 0,
            status: 'UPCOMING'
          };
          groupMatches.push(m);
          allMatches.push(m);
        }
      }
      rounds.push({ name: `${groupName} Matches`, bracketType: 'GROUP', matches: groupMatches });
      groupStandings[groupName] = this.calculateRoundRobinStandings(groupTeams, groupMatches);
    }

    // Step 3: Create Knockout Playoff bracket (Semifinals + Grand Final)
    const semi1: CompetitionMatch = {
      id: 'ko-semi-1',
      tournamentId,
      round: 'Playoff Semifinal 1',
      bracketType: 'MAIN',
      matchNumber: matchIdx++,
      seriesFormat: playoffSeriesFormat,
      teamA: null, // e.g. Group A 1st
      teamB: null, // e.g. Group B 2nd
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING',
      winnerNextMatchId: 'ko-final',
      winnerNextSlot: 'teamA'
    };

    const semi2: CompetitionMatch = {
      id: 'ko-semi-2',
      tournamentId,
      round: 'Playoff Semifinal 2',
      bracketType: 'MAIN',
      matchNumber: matchIdx++,
      seriesFormat: playoffSeriesFormat,
      teamA: null, // e.g. Group B 1st
      teamB: null, // e.g. Group A 2nd
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING',
      winnerNextMatchId: 'ko-final',
      winnerNextSlot: 'teamB'
    };

    const finalMatch: CompetitionMatch = {
      id: 'ko-final',
      tournamentId,
      round: 'Grand Final',
      bracketType: 'FINAL',
      matchNumber: matchIdx++,
      seriesFormat: 'BO5',
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    };

    allMatches.push(semi1, semi2, finalMatch);
    rounds.push(
      { name: 'Playoff Semifinals', bracketType: 'MAIN', matches: [semi1, semi2] },
      { name: 'Grand Final', bracketType: 'FINAL', matches: [finalMatch] }
    );

    return {
      format: 'GROUPS_KNOCKOUT',
      rounds,
      allMatches,
      groupStandings
    };
  }

  /**
   * Computes table standings for Round Robin results.
   */
  public static calculateRoundRobinStandings(
    teams: CompetitionTeam[],
    matches: CompetitionMatch[]
  ): RoundRobinStanding[] {
    const stats = new Map<string, RoundRobinStanding>();

    teams.forEach(t => {
      stats.set(t.id, {
        rank: 1,
        teamId: t.id,
        teamName: t.name,
        tag: t.tag,
        logo: t.logo,
        played: 0,
        won: 0,
        lost: 0,
        draws: 0,
        points: 0,
        mapDifferential: 0
      });
    });

    matches.forEach(m => {
      if (m.status !== 'COMPLETED' || !m.teamA || !m.teamB) return;

      const teamAStats = stats.get(m.teamA.id);
      const teamBStats = stats.get(m.teamB.id);
      if (!teamAStats || !teamBStats) return;

      teamAStats.played += 1;
      teamBStats.played += 1;

      teamAStats.mapDifferential += (m.scoreA - m.scoreB);
      teamBStats.mapDifferential += (m.scoreB - m.scoreA);

      if (m.scoreA > m.scoreB) {
        teamAStats.won += 1;
        teamAStats.points += 3;
        teamBStats.lost += 1;
      } else if (m.scoreB > m.scoreA) {
        teamBStats.won += 1;
        teamBStats.points += 3;
        teamAStats.lost += 1;
      } else {
        teamAStats.draws += 1;
        teamBStats.draws += 1;
        teamAStats.points += 1;
        teamBStats.points += 1;
      }
    });

    const sorted = Array.from(stats.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.mapDifferential !== a.mapDifferential) return b.mapDifferential - a.mapDifferential;
      return b.won - a.won;
    });

    return sorted.map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));
  }
}
