/**
 * Purple Bean Gaming — Dota 2 Completion Phase 1B Test Suite
 * Tournament MMR, Organiser Verification & Eligibility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaPlayerRegistry, 
  DotaTournamentRegistration,
  MmrIntegrityCaseType
} from '../../src/domain/dotaPlayerEngine';
import { trustedTournamentOps } from '../../src/server/trustedTournamentOperations';
import { tournamentService } from '../../src/services/firebaseService';
import { testCupEngine } from '../../src/domain/testCupEngine';

describe('Dota 2 Phase 1B — Tournament MMR, Organiser Verification & Eligibility', () => {

  const TOURNAMENT_ID = 'test-phase1b-cup';
  const ORGANISER_ID = 'staff-admin-99';
  const PLAYER_ID = 'user-phase1b-player-1';
  const CAPTAIN_ID = 'user-phase1b-captain-2';
  const OTHER_PLAYER_ID = 'user-phase1b-player-3';

  beforeEach(() => {
    // Reset/seed registry state for clean testing
    dotaPlayerRegistry.seedInitialPlayers();
  });

  // =========================================================================
  // 1. Full Real-Flow Lifecycle Test
  // =========================================================================
  it('executes real flow: register (7550) -> review -> request evidence -> submit evidence -> calibrate (7600) -> verify -> locked -> eligible in auction', () => {
    // Step 1: Player registers with declared MMR 7550
    const regRes = dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId: TOURNAMENT_ID,
      userId: PLAYER_ID,
      ign: 'MiranaSniper',
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      declaredMmr: 7550,
      rulesAccepted: true,
      steamId64: '76561198000000099',
      city: 'Bengaluru'
    });
    expect(regRes.success).toBe(true);
    expect(regRes.registration).toBeDefined();
    expect(regRes.registration?.status).toBe('REGISTERED');
    expect(regRes.registration?.declaredMmr).toBe(7550);

    // Initial eligibility check: NOT yet verified, so MUST NOT be in auction pool
    let eligible = dotaPlayerRegistry.getEligibleAuctionPlayers(TOURNAMENT_ID);
    expect(eligible.some(r => r.userId === PLAYER_ID)).toBe(false);

    // Step 2: Organiser initiates review -> UNDER_REVIEW
    const reviewRes = dotaPlayerRegistry.startReview(TOURNAMENT_ID, PLAYER_ID, ORGANISER_ID);
    expect(reviewRes.success).toBe(true);
    expect(reviewRes.registration?.status).toBe('UNDER_REVIEW');

    // Still excluded from auction pool
    eligible = dotaPlayerRegistry.getEligibleAuctionPlayers(TOURNAMENT_ID);
    expect(eligible.some(r => r.userId === PLAYER_ID)).toBe(false);

    // Step 3: Organiser requests evidence
    const reqPrompt = 'Please submit screenshot of your in-game medals tab showing rank calibration.';
    const evReqRes = dotaPlayerRegistry.requestEvidence(TOURNAMENT_ID, PLAYER_ID, reqPrompt, ORGANISER_ID);
    expect(evReqRes.success).toBe(true);
    expect(evReqRes.registration?.status).toBe('EVIDENCE_REQUESTED');
    expect(evReqRes.registration?.evidenceRequestPrompt).toBe(reqPrompt);

    // Verify player notification created
    const notifsAfterReq = dotaPlayerRegistry.getNotifications(PLAYER_ID);
    expect(notifsAfterReq.some(n => n.type === 'EVIDENCE_REQUESTED')).toBe(true);

    // Step 4: Player submits private evidence
    const submitEvRes = dotaPlayerRegistry.submitEvidence(TOURNAMENT_ID, PLAYER_ID, {
      type: 'MMR_SCREENSHOT',
      fileUrl: 'https://cdn.purplebean.gg/evidence/screenshot-7600.png',
      description: 'Divine 5 badge screenshot from in-game client showing 7600 solo MMR.'
    });
    expect(submitEvRes.success).toBe(true);
    expect(submitEvRes.registration?.status).toBe('UNDER_REVIEW');
    expect(submitEvRes.registration?.evidence?.length).toBe(1);
    expect(submitEvRes.registration?.evidence?.[0].type).toBe('MMR_SCREENSHOT');

    // Verify evidence received notification
    const notifsAfterSubmit = dotaPlayerRegistry.getNotifications(PLAYER_ID);
    expect(notifsAfterSubmit.some(n => n.type === 'EVIDENCE_RECEIVED')).toBe(true);

    // Step 5: Organiser calibrates Tournament MMR to 7600 with mandatory justification
    const calibrateRes = dotaPlayerRegistry.setCorrectedTournamentMmr(
      TOURNAMENT_ID,
      PLAYER_ID,
      7600,
      'Validated in-game screenshot showing recent calibration at 7600.',
      ORGANISER_ID
    );
    expect(calibrateRes.success).toBe(true);
    expect(calibrateRes.registration?.tournamentMmr).toBe(7600);
    expect(calibrateRes.registration?.historicalMmrChanges?.length).toBe(1);
    expect(calibrateRes.registration?.historicalMmrChanges?.[0].newValue).toBe(7600);

    // Step 6: Organiser marks VERIFIED -> Tournament MMR is LOCKED
    const verifyRes = dotaPlayerRegistry.verifyRegistration(TOURNAMENT_ID, PLAYER_ID, ORGANISER_ID);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.registration?.status).toBe('VERIFIED');
    expect(verifyRes.registration?.isMmrLocked).toBe(true);
    expect(verifyRes.registration?.tournamentMmr).toBe(7600);
    expect(verifyRes.registration?.verifiedBy).toBe(ORGANISER_ID);

    // Step 7: Refresh/re-fetch registration state — 7600 remains locked
    const fetchedReg = dotaPlayerRegistry.getRegistration(TOURNAMENT_ID, PLAYER_ID);
    expect(fetchedReg).toBeDefined();
    expect(fetchedReg?.status).toBe('VERIFIED');
    expect(fetchedReg?.tournamentMmr).toBe(7600);
    expect(fetchedReg?.isMmrLocked).toBe(true);

    // Player profile also records locked tournament MMR and historical entry
    const playerRecord = dotaPlayerRegistry.getPlayer(PLAYER_ID);
    expect(playerRecord?.tournamentMmr).toBe(7600);
    expect(playerRecord?.isMmrLocked).toBe(true);
    expect(playerRecord?.historicalTournamentMmrs?.length).toBeGreaterThanOrEqual(1);

    // Step 8: VERIFIED player now appears in eligible auction pool
    eligible = dotaPlayerRegistry.getEligibleAuctionPlayers(TOURNAMENT_ID);
    expect(eligible.some(r => r.userId === PLAYER_ID)).toBe(true);
    const eligibleEntry = eligible.find(r => r.userId === PLAYER_ID);
    expect(eligibleEntry?.tournamentMmr).toBe(7600);
  });

  // =========================================================================
  // 2. Permission & Authority Hardening Tests
  // =========================================================================
  describe('Permissions & Server-Authoritative Enforcement', () => {
    it('denies self-verification when a player attempts to verify their own registration', () => {
      // Register player
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: PLAYER_ID,
        ign: 'MiranaPlayer',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 6500,
        rulesAccepted: true
      });

      const playerCaller = {
        userId: PLAYER_ID,
        role: 'player' as const,
        isAdmin: false
      };

      // Calling server authoritative verifyRegistration with player role must fail
      expect(() => {
        trustedTournamentOps.executeVerifyRegistration(playerCaller, {
          tournamentId: TOURNAMENT_ID,
          userId: PLAYER_ID
        });
      }).toThrow(/Unauthorized/i);
    });

    it('denies regular player or captain from setting Tournament MMR', () => {
      const captainCaller = {
        userId: CAPTAIN_ID,
        role: 'captain' as const,
        isAdmin: false
      };

      expect(() => {
        trustedTournamentOps.executeSetTournamentMmr(captainCaller, {
          tournamentId: TOURNAMENT_ID,
          userId: PLAYER_ID,
          correctedMmr: 9000,
          reason: 'I am a captain and I want to set this player MMR'
        });
      }).toThrow(/Unauthorized/i);
    });

    it('denies captains and spectators from reading private player evidence', () => {
      // Setup player registration with private evidence
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: PLAYER_ID,
        ign: 'PrivatePlayer',
        primaryRole: 'Position 3 — Offlane',
        secondaryRole: 'Position 4 — Soft Support',
        declaredMmr: 6800,
        rulesAccepted: true
      });

      const evSubmit = dotaPlayerRegistry.submitEvidence(TOURNAMENT_ID, PLAYER_ID, {
        type: 'MMR_SCREENSHOT',
        fileUrl: 'https://secure.img/private.png',
        description: 'Private calibration proof'
      });
      const regId = evSubmit.registration!.id;

      // 1. Captain caller must be REJECTED
      const captainCaller = {
        userId: CAPTAIN_ID,
        role: 'captain' as const,
        isAdmin: false
      };
      expect(() => {
        trustedTournamentOps.getRegistrationEvidenceAuthoritative(captainCaller, {
          registrationId: regId,
          targetUserId: PLAYER_ID
        });
      }).toThrow(/Unauthorized.*Captains.*cannot view private evidence/i);

      // 2. Spectator / other player must be REJECTED
      const otherCaller = {
        userId: OTHER_PLAYER_ID,
        role: 'player' as const,
        isAdmin: false
      };
      expect(() => {
        trustedTournamentOps.getRegistrationEvidenceAuthoritative(otherCaller, {
          registrationId: regId,
          targetUserId: PLAYER_ID
        });
      }).toThrow(/Unauthorized/i);

      // 3. Submitting player THEMSELVES can view
      const ownerCaller = {
        userId: PLAYER_ID,
        role: 'player' as const,
        isAdmin: false
      };
      const ownerEvidence = trustedTournamentOps.getRegistrationEvidenceAuthoritative(ownerCaller, {
        registrationId: regId,
        targetUserId: PLAYER_ID
      });
      expect(ownerEvidence.length).toBe(1);
      expect(ownerEvidence[0].description).toBe('Private calibration proof');

      // 4. Organiser CAN view
      const organiserCaller = {
        userId: ORGANISER_ID,
        role: 'organizer' as const,
        isAdmin: true
      };
      const orgEvidence = trustedTournamentOps.getRegistrationEvidenceAuthoritative(organiserCaller, {
        registrationId: regId,
        targetUserId: PLAYER_ID
      });
      expect(orgEvidence.length).toBe(1);
    });
  });

  // =========================================================================
  // 3. Eligibility Invariants
  // =========================================================================
  describe('Strict Tournament Eligibility Filtering', () => {
    it('excludes REJECTED players from the auction pool and captain pool', () => {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: 'user-rejected-candidate',
        ign: 'SmurfCandidate',
        primaryRole: 'Position 2 — Mid',
        secondaryRole: 'Position 1 — Carry',
        declaredMmr: 8000,
        rulesAccepted: true
      });

      // Organiser rejects player
      dotaPlayerRegistry.rejectRegistration(
        TOURNAMENT_ID,
        'user-rejected-candidate',
        'Smurf detection confirmed via alt account analysis.',
        ORGANISER_ID
      );

      const auctionPool = dotaPlayerRegistry.getEligibleAuctionPlayers(TOURNAMENT_ID);
      expect(auctionPool.some(p => p.userId === 'user-rejected-candidate')).toBe(false);

      const captainPool = dotaPlayerRegistry.getEligibleCaptains(TOURNAMENT_ID);
      expect(captainPool.some(p => p.userId === 'user-rejected-candidate')).toBe(false);
    });

    it('excludes EVIDENCE_REQUESTED, UNDER_REVIEW, and REGISTERED players from auction pool', () => {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: 'user-pending-1',
        ign: 'PendingOne',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 6000,
        rulesAccepted: true
      });
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: 'user-pending-2',
        ign: 'PendingTwo',
        primaryRole: 'Position 3 — Offlane',
        secondaryRole: 'Position 4 — Soft Support',
        declaredMmr: 6200,
        rulesAccepted: true
      });
      dotaPlayerRegistry.startReview(TOURNAMENT_ID, 'user-pending-2', ORGANISER_ID);

      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: 'user-pending-3',
        ign: 'PendingThree',
        primaryRole: 'Position 5 — Hard Support',
        secondaryRole: 'Position 4 — Soft Support',
        declaredMmr: 5900,
        rulesAccepted: true
      });
      dotaPlayerRegistry.requestEvidence(TOURNAMENT_ID, 'user-pending-3', 'Provide proof', ORGANISER_ID);

      const eligible = dotaPlayerRegistry.getEligibleAuctionPlayers(TOURNAMENT_ID);
      expect(eligible.some(p => p.userId === 'user-pending-1')).toBe(false);
      expect(eligible.some(p => p.userId === 'user-pending-2')).toBe(false);
      expect(eligible.some(p => p.userId === 'user-pending-3')).toBe(false);
    });

    it('requires captains themselves to be VERIFIED to be eligible', () => {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: 'user-captain-candidate',
        ign: 'Tactician',
        primaryRole: 'Position 5 — Hard Support',
        secondaryRole: 'Position 4 — Soft Support',
        declaredMmr: 7000,
        rulesAccepted: true
      });

      // Before verification
      let captains = dotaPlayerRegistry.getEligibleCaptains(TOURNAMENT_ID);
      expect(captains.some(c => c.userId === 'user-captain-candidate')).toBe(false);

      // Verify captain candidate
      dotaPlayerRegistry.verifyRegistration(TOURNAMENT_ID, 'user-captain-candidate', ORGANISER_ID);

      captains = dotaPlayerRegistry.getEligibleCaptains(TOURNAMENT_ID);
      expect(captains.some(c => c.userId === 'user-captain-candidate')).toBe(true);
    });
  });

  // =========================================================================
  // 4. Locked Tournament MMR Correction & Audit Integrity
  // =========================================================================
  describe('Locked Tournament MMR & Historical Preservation', () => {
    it('allows authorised referee to correct locked Tournament MMR with mandatory justification', () => {
      // Register and verify
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: PLAYER_ID,
        ign: 'LockedHero',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 7000,
        rulesAccepted: true
      });
      dotaPlayerRegistry.verifyRegistration(TOURNAMENT_ID, PLAYER_ID, ORGANISER_ID);

      // Referee discovers new calibration evidence: corrects locked MMR to 7150
      const correctRes = dotaPlayerRegistry.correctLockedTournamentMmr(
        TOURNAMENT_ID,
        PLAYER_ID,
        7150,
        'Official Valve recalibration patch updated live MMR from 7000 to 7150.',
        ORGANISER_ID
      );
      expect(correctRes.success).toBe(true);
      expect(correctRes.registration?.tournamentMmr).toBe(7150);
      expect(correctRes.registration?.isMmrLocked).toBe(true);

      // Audit history captured
      const audit = correctRes.registration?.historicalMmrChanges;
      expect(audit).toBeDefined();
      expect(audit?.length).toBeGreaterThanOrEqual(1);
      const lastAudit = audit![audit!.length - 1];
      expect(lastAudit.oldValue).toBe(7000);
      expect(lastAudit.newValue).toBe(7150);
      expect(lastAudit.actor).toBe(ORGANISER_ID);
      expect(lastAudit.reason).toContain('Official Valve recalibration patch');
    });

    it('rejects correction of locked MMR without justification reason', () => {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: PLAYER_ID,
        ign: 'LockedHero2',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 7000,
        rulesAccepted: true
      });
      dotaPlayerRegistry.verifyRegistration(TOURNAMENT_ID, PLAYER_ID, ORGANISER_ID);

      const correctRes = dotaPlayerRegistry.correctLockedTournamentMmr(
        TOURNAMENT_ID,
        PLAYER_ID,
        7200,
        '', // Empty reason
        ORGANISER_ID
      );
      expect(correctRes.success).toBe(false);
      expect(correctRes.error).toContain('justification reason is required');
    });

    it('preserves historical Tournament MMR records per tournament across events', () => {
      // Event 1
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: 'cup-season-1',
        userId: PLAYER_ID,
        ign: 'Hero',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 6800,
        rulesAccepted: true
      });
      dotaPlayerRegistry.verifyRegistration('cup-season-1', PLAYER_ID, ORGANISER_ID, 6800);

      // Event 2
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: 'cup-season-2',
        userId: PLAYER_ID,
        ign: 'Hero',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 7100,
        rulesAccepted: true
      });
      dotaPlayerRegistry.verifyRegistration('cup-season-2', PLAYER_ID, ORGANISER_ID, 7100);

      const player = dotaPlayerRegistry.getPlayer(PLAYER_ID);
      expect(player?.historicalTournamentMmrs?.length).toBe(2);

      const season1 = player?.historicalTournamentMmrs?.find(h => h.tournamentId === 'cup-season-1');
      const season2 = player?.historicalTournamentMmrs?.find(h => h.tournamentId === 'cup-season-2');
      expect(season1?.tournamentMmr).toBe(6800);
      expect(season2?.tournamentMmr).toBe(7100);
    });
  });

  // =========================================================================
  // 5. Integrity Cases
  // =========================================================================
  describe('Skill & Account Integrity Cases', () => {
    it('supports opening and managing integrity cases without automatic disqualification', () => {
      const caseTypes: MmrIntegrityCaseType[] = [
        'Possible Smurf',
        'MMR Mismatch',
        'Account Mismatch',
        'Duplicate Account',
        'Insufficient Evidence',
        'Suspicious Historical MMR',
        'Other'
      ];

      // Test each supported case category
      for (const cat of caseTypes) {
        const caseRecord = dotaPlayerRegistry.createIntegrityCase(
          PLAYER_ID,
          cat,
          7500,
          `Testing case category: ${cat}`,
          TOURNAMENT_ID,
          ORGANISER_ID
        );
        expect(caseRecord.caseType).toBe(cat);
        expect(caseRecord.status).toBe('OPEN');
      }

      // Opening a case does NOT change registration to REJECTED automatically
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: PLAYER_ID,
        ign: 'Hero',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 7500,
        rulesAccepted: true
      });
      const openCase = dotaPlayerRegistry.createIntegrityCase(
        PLAYER_ID,
        'MMR Mismatch',
        7500,
        'Declared 7500 but medal indicates divine 1',
        TOURNAMENT_ID,
        ORGANISER_ID
      );
      
      const reg = dotaPlayerRegistry.getRegistration(TOURNAMENT_ID, PLAYER_ID);
      expect(reg?.status).not.toBe('REJECTED');

      // Organiser can resolve by requesting evidence
      dotaPlayerRegistry.resolveIntegrityCase(
        openCase.id,
        'REQUEST_EVIDENCE',
        'Please clarify your medal calibration',
        ORGANISER_ID
      );
      expect(dotaPlayerRegistry.getIntegrityCases().find(c => c.id === openCase.id)?.status).toBe('EVIDENCE_REQUESTED');

      // Or escalate
      dotaPlayerRegistry.resolveIntegrityCase(
        openCase.id,
        'ESCALATE',
        'Escalated to senior referee panel',
        ORGANISER_ID
      );
      expect(dotaPlayerRegistry.getIntegrityCases().find(c => c.id === openCase.id)?.status).toBe('ESCALATED');

      // Or approve
      dotaPlayerRegistry.resolveIntegrityCase(
        openCase.id,
        'APPROVE',
        'Evidence reviewed and cleared',
        ORGANISER_ID
      );
      expect(dotaPlayerRegistry.getIntegrityCases().find(c => c.id === openCase.id)?.status).toBe('APPROVED');
    });
  });

  // =========================================================================
  // 6. Test Cup Regression Safety
  // =========================================================================
  describe('Purple Bean Test Cup Regression Safety', () => {
    it('ensures Test Cup auction engine, captains, and teams remain fully operational', () => {
      if (testCupEngine.getTeams().length === 0) {
        testCupEngine.confirmCaptainsAndTeams();
      }
      const teams = testCupEngine.getTeams();
      expect(teams.length).toBeGreaterThanOrEqual(2);

      const players = testCupEngine.getPlayers();
      expect(players.length).toBeGreaterThan(0);

      const captains = players.filter(p => p.isCaptain);
      expect(captains.length).toBeGreaterThanOrEqual(2);

      // Verify Test Cup player verification works seamlessly
      const targetPlayer = players.find(p => !p.isCaptain);
      expect(targetPlayer).toBeDefined();

      testCupEngine.verifyPlayer(targetPlayer!.id, true);
      const updated = testCupEngine.getPlayers().find(p => p.id === targetPlayer!.id);
      expect(updated?.registrationStatus).toBe('Verified');
    });
  });
});
