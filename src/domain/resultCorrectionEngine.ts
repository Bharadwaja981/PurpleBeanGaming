/**
 * Purple Bean Gaming — Authoritative Result Correction Engine
 * 
 * When a match result is corrected by an organizer/referee,
 * this engine deterministically recalculates:
 * 1. Match score & winner
 * 2. Standings, group points, map won/lost, and differential
 * 3. Bracket progression (Single & Double Elimination winner/loser paths)
 * 4. Competitive rating adjustments (rolling back old delta, applying corrected delta)
 * 5. Authoritative audit event entry
 */

import { Match, Team, BracketNode } from '../types/tournament';
import { ratingLedger, RatingAdjustmentRecord } from './competitiveRatingEngine';

export interface GroupStandingRow {
  teamId: string;
  teamName: string;
  tag: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  mapsWon: number;
  mapsLost: number;
  mapDiff: number;
  points: number;
}

export interface MatchCorrectionResult {
  matchId: string;
  previousWinnerId?: string;
  correctedWinnerId: string;
  scoreA: number;
  scoreB: number;
  ratingRecord: RatingAdjustmentRecord;
  updatedStandings: GroupStandingRow[];
  bracketUpdates: Array<{ nodeId: string; advancingTeamId: string; slot: 'teamA' | 'teamB' }>;
  auditEvent: {
    action: string;
    entityId: string;
    details: string;
    timestamp: string;
  };
}

/**
 * Deterministically recompiles group standings from scratch given all completed matches.
 */
export function recompileGroupStandings(teams: Team[], matches: Match[]): GroupStandingRow[] {
  const standingsMap = new Map<string, GroupStandingRow>();

  for (const team of teams) {
    standingsMap.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      tag: team.tag,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      mapsWon: 0,
      mapsLost: 0,
      mapDiff: 0,
      points: 0
    });
  }

  for (const match of matches) {
    if (match.status !== 'COMPLETED' || !match.winnerId) continue;

    const rowA = standingsMap.get(match.teamA.id);
    const rowB = standingsMap.get(match.teamB.id);
    if (!rowA || !rowB) continue;

    rowA.played += 1;
    rowB.played += 1;

    const scoreA = match.teamA.score || 0;
    const scoreB = match.teamB.score || 0;

    rowA.mapsWon += scoreA;
    rowA.mapsLost += scoreB;
    rowB.mapsWon += scoreB;
    rowB.mapsLost += scoreA;

    if (match.winnerId === match.teamA.id) {
      rowA.won += 1;
      rowA.points += 3; // 3 points for match victory
      rowB.lost += 1;
    } else if (match.winnerId === match.teamB.id) {
      rowB.won += 1;
      rowB.points += 3;
      rowA.lost += 1;
    } else {
      rowA.drawn += 1;
      rowB.drawn += 1;
      rowA.points += 1;
      rowB.points += 1;
    }

    rowA.mapDiff = rowA.mapsWon - rowA.mapsLost;
    rowB.mapDiff = rowB.mapsWon - rowB.mapsLost;
  }

  // Sort by Points > Map Diff > Maps Won
  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.mapDiff !== a.mapDiff) return b.mapDiff - a.mapDiff;
    return b.mapsWon - a.mapsWon;
  });
}

/**
 * Propagates corrected match outcome across single/double elimination bracket nodes.
 */
export function updateBracketProgression(
  brackets: BracketNode[],
  matchNumber: number,
  newWinnerTeam: { id: string; name: string; logo: string },
  newLoserTeam: { id: string; name: string; logo: string }
): Array<{ nodeId: string; advancingTeamId: string; slot: 'teamA' | 'teamB' }> {
  const updates: Array<{ nodeId: string; advancingTeamId: string; slot: 'teamA' | 'teamB' }> = [];

  const currentNode = brackets.find(b => b.matchNumber === matchNumber);
  if (!currentNode) return updates;

  // 1. Advance winner along winnerDestinationId
  if (currentNode.winnerDestinationId) {
    const dest = brackets.find(b => b.id === currentNode.winnerDestinationId);
    if (dest) {
      // Determine slot
      const slot = dest.teamA.id === 'tbd' || dest.teamA.id === currentNode.teamA.id || dest.teamA.id === currentNode.teamB.id ? 'teamA' : 'teamB';
      dest[slot] = {
        id: newWinnerTeam.id,
        name: newWinnerTeam.name,
        logo: newWinnerTeam.logo,
        seed: 1,
        score: 0
      };
      updates.push({ nodeId: dest.id, advancingTeamId: newWinnerTeam.id, slot });
    }
  }

  // 2. Advance loser along loserDestinationId (Lower Bracket drop path)
  if (currentNode.loserDestinationId) {
    const lbDest = brackets.find(b => b.id === currentNode.loserDestinationId);
    if (lbDest) {
      const slot = lbDest.teamA.id === 'tbd' || lbDest.teamA.id === currentNode.teamA.id || lbDest.teamA.id === currentNode.teamB.id ? 'teamA' : 'teamB';
      lbDest[slot] = {
        id: newLoserTeam.id,
        name: newLoserTeam.name,
        logo: newLoserTeam.logo,
        seed: 2,
        score: 0
      };
      updates.push({ nodeId: lbDest.id, advancingTeamId: newLoserTeam.id, slot });
    }
  }

  return updates;
}

/**
 * Master Result Correction Function
 */
export function executeResultCorrection(params: {
  match: Match;
  newScoreA: number;
  newScoreB: number;
  newWinnerId: string;
  teams: Team[];
  allMatches: Match[];
  brackets: BracketNode[];
  reason: string;
  refereeUserId: string;
}): MatchCorrectionResult {
  const { match, newScoreA, newScoreB, newWinnerId, teams, allMatches, brackets, reason, refereeUserId } = params;
  const previousWinnerId = match.winnerId;

  // 1. Mutate canonical match
  match.teamA.score = newScoreA;
  match.teamB.score = newScoreB;
  match.winnerId = newWinnerId;
  match.status = 'COMPLETED';

  // 2. Recalculate Ratings
  const winnerTeam = teams.find(t => t.id === newWinnerId);
  const loserTeamId = newWinnerId === match.teamA.id ? match.teamB.id : match.teamA.id;
  const loserTeam = teams.find(t => t.id === loserTeamId);
  const winnerRating = winnerTeam?.rating || 1800;
  const loserRating = loserTeam?.rating || 1800;

  const existingRatingRecord = ratingLedger.getRecord(`rating-${match.id}`);
  let ratingRecord: RatingAdjustmentRecord;

  if (existingRatingRecord) {
    ratingRecord = ratingLedger.correctMatchResult(
      match.id,
      existingRatingRecord,
      newWinnerId,
      loserTeamId,
      winnerRating,
      loserRating
    ).record;
  } else {
    ratingRecord = ratingLedger.applyMatchResult(
      match.id,
      newWinnerId,
      loserTeamId,
      winnerRating,
      loserRating
    ).record;
  }

  if (winnerTeam) winnerTeam.rating = ratingRecord.winnerNewRating;
  if (loserTeam) loserTeam.rating = ratingRecord.loserNewRating;

  // 3. Recompute Group Standings
  const updatedStandings = recompileGroupStandings(teams, allMatches);

  // 4. Update Bracket Progression
  const matchNum = (match as any).matchNumber || 1;
  const bracketUpdates = updateBracketProgression(
    brackets,
    matchNum,
    { id: winnerTeam?.id || newWinnerId, name: winnerTeam?.name || match.teamA.name, logo: winnerTeam?.logo || match.teamA.logo },
    { id: loserTeam?.id || loserTeamId, name: loserTeam?.name || match.teamB.name, logo: loserTeam?.logo || match.teamB.logo }
  );

  // 5. Generate Authoritative Audit Event
  const auditEvent = {
    action: 'match_result_corrected',
    entityId: match.id,
    details: `Referee (${refereeUserId}) corrected Match #${matchNum}: score ${newScoreA}-${newScoreB}, winner ${winnerTeam?.name || newWinnerId}. Reason: ${reason}. Rating adjusted.`,
    timestamp: new Date().toISOString()
  };

  return {
    matchId: match.id,
    previousWinnerId,
    correctedWinnerId: newWinnerId,
    scoreA: newScoreA,
    scoreB: newScoreB,
    ratingRecord,
    updatedStandings,
    bracketUpdates,
    auditEvent
  };
}
