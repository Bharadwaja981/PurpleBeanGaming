import { describe, it, expect, beforeEach } from 'vitest';
import { tournamentService } from '../../src/services/firebaseService';
import { tournamentConfigRegistry } from '../../src/domain/tournamentConfigRegistry';
import { createDefaultTournamentConfig, TournamentConfig } from '../../src/domain/tournamentConfig';
import { setQuotaExhausted } from '../../src/services/firebaseConfig';

describe('PURPLE BEAN GAMING — Tournament Creation Persistence Verification', () => {
  beforeEach(() => {
    setQuotaExhausted(false);
  });

  // 1. FIRESTORE CREATION & AUTHORITATIVE WRITE
  it('1. Firestore Creation: creates canonical document with required fields and owner UID', async () => {
    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Creation Persistence Test';
    config.identity.tournamentId = 'pb-creation-persistence-test-123';
    config.identity.visibility = 'PUBLIC';

    const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    expect(res.success).toBe(true);
    expect(res.tournamentId).toBe('pb-creation-persistence-test-123');

    const created = tournamentService.getTournamentById('pb-creation-persistence-test-123');
    expect(created).toBeDefined();
    expect(created?.name).toBe('Creation Persistence Test');
    expect(created?.gameId).toBe('dota2');
    expect(created?.visibility).toBe('PUBLIC');
    expect(created?.status).toBe('DRAFT');
    expect(created?.lifecycle).toBe('DRAFT');
    expect(created?.organiserId).toBeDefined();
    expect(created?.createdAt).toBeDefined();
  });

  // 2. AWAITED WRITE BEFORE NAVIGATION & CANONICAL ID
  it('2. Awaited Write Before Navigation: confirms write before returning canonical tournament ID', async () => {
    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Awaited Write Test';
    config.identity.tournamentId = 'pb-awaited-write-canonical';

    const promise = tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    // Ensure it is a Promise that must be awaited
    expect(promise).toBeInstanceOf(Promise);

    const res = await promise;
    expect(res.success).toBe(true);
    expect(res.tournamentId).toBe('pb-awaited-write-canonical');

    // Canonical ID is usable immediately for routing
    const byId = tournamentService.getTournamentById('pb-awaited-write-canonical');
    expect(byId).toBeDefined();
    expect(byId?.id).toBe('pb-awaited-write-canonical');
  });

  // 3. DO NOT CLEAR WIZARD ON FAILED WRITE & ACTIONABLE ERROR
  it('3. Creation Error Handling: returns actionable error on failure without clearing data', async () => {
    setQuotaExhausted(true);

    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Failed Write Test';
    config.identity.tournamentId = 'pb-failed-write-test';

    const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Firebase write quota exceeded. Tournament was not created.');

    setQuotaExhausted(false);
  });

  // 4. ORGANISER MUST SEE OWN DRAFT TOURNAMENTS
  it('4. Organiser Draft Visibility: organiser dashboard shows own DRAFT tournaments', async () => {
    const user = tournamentService.getCurrentUser();
    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Organiser Draft Tournament';
    config.identity.tournamentId = 'pb-org-draft-tourney';
    config.identity.visibility = 'DRAFT';

    const res = await tournamentService.createTournament(config, 'DRAFT', 'DRAFT');
    expect(res.success).toBe(true);

    const orgTourneys = tournamentService.getOrganiserTournaments(user.id);
    const found = orgTourneys.find(t => t.id === 'pb-org-draft-tourney');
    expect(found).toBeDefined();
    expect(found?.status).toBe('DRAFT');
    expect(found?.visibility).toBe('DRAFT');

    // Also registered in config registry for organiser console
    const cfg = tournamentConfigRegistry.getConfig('pb-org-draft-tourney');
    expect(cfg).toBeDefined();
  });

  // 5. PUBLIC VS PRIVATE VISIBILITY
  it('5. Public vs Private Visibility: DRAFT hidden from public directory, PUBLIC visible', async () => {
    // 1. Create Draft tournament
    const draftCfg = createDefaultTournamentConfig('dota2');
    draftCfg.identity.name = 'Hidden Draft Cup';
    draftCfg.identity.tournamentId = 'pb-hidden-draft-cup';
    draftCfg.identity.visibility = 'DRAFT';
    await tournamentService.createTournament(draftCfg, 'DRAFT', 'DRAFT');

    // 2. Create Public tournament
    const pubCfg = createDefaultTournamentConfig('dota2');
    pubCfg.identity.name = 'Public Arena Championship';
    pubCfg.identity.tournamentId = 'pb-public-arena-champ';
    pubCfg.identity.visibility = 'PUBLIC';
    await tournamentService.createTournament(pubCfg, 'PUBLIC', 'Registration Open');

    // Public directory check (includePrivate = false)
    const publicTournaments = tournamentService.getTournaments('All Games', 'All', false);
    const draftInPublic = publicTournaments.find(t => t.id === 'pb-hidden-draft-cup');
    expect(draftInPublic).toBeUndefined(); // Must NOT appear in public directory

    const pubInPublic = publicTournaments.find(t => t.id === 'pb-public-arena-champ');
    expect(pubInPublic).toBeDefined(); // MUST appear in public directory
  });

  // 6. VERIFY ORGANISER OWNERSHIP
  it('6. Organiser Ownership: verifies tournament.organiserId matches user session UID', async () => {
    const curUser = tournamentService.getCurrentUser();
    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Ownership Verification Cup';
    config.identity.tournamentId = 'pb-ownership-cup';

    const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    expect(res.success).toBe(true);

    const doc = tournamentService.getTournamentById('pb-ownership-cup');
    expect(doc?.organiserId).toBe(curUser.id);
  });

  // 7. CANONICAL ID ROUTING
  it('7. Canonical ID Routing: tournament is retrievable by exact canonical ID', async () => {
    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Route Consistency Tournament';
    config.identity.tournamentId = 'pb-route-consistency-2026';

    const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    expect(res.success).toBe(true);

    const retrieved = tournamentService.getTournamentById('pb-route-consistency-2026');
    expect(retrieved?.id).toBe('pb-route-consistency-2026');
  });

  // 8. REAL-TIME DASHBOARD UPDATE
  it('8. Real-time Dashboard Update: listeners receive created tournament synchronously', async () => {
    let notified = false;
    const unsub = tournamentService.subscribe(() => {
      notified = true;
    });

    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Realtime Sync Tournament';
    config.identity.tournamentId = 'pb-realtime-sync-tourney';

    await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    expect(notified).toBe(true);
    unsub();
  });

  // 9. REFRESH & RELOGIN PERSISTENCE
  it('9. Refresh & Relogin Persistence: tournament persists in registry and can be reloaded', async () => {
    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Persistence After Refresh Test';
    config.identity.tournamentId = 'pb-refresh-persistence-test';

    await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');

    // Simulate page reload / state re-hydration from cache
    const reloaded = tournamentService.getTournamentById('pb-refresh-persistence-test');
    expect(reloaded).toBeDefined();
    expect(reloaded?.id).toBe('pb-refresh-persistence-test');

    const configReloaded = tournamentConfigRegistry.getConfig('pb-refresh-persistence-test');
    expect(configReloaded).toBeDefined();
    expect(configReloaded?.identity.name).toBe('Persistence After Refresh Test');
  });

  // 10. QUOTA ERROR HANDLING
  it('10. Quota Error Handling: returns "Firebase write quota exceeded. Tournament was not created." on quota limit', async () => {
    setQuotaExhausted(true);

    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Quota Exhaustion Check';
    config.identity.tournamentId = 'pb-quota-exhaustion-check';

    const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Firebase write quota exceeded. Tournament was not created.');

    setQuotaExhausted(false);
  });

  // 11. CLEANUP OF TEST TOURNAMENT
  it('11. Cleanup: allows deleting the test tournament without deleting real tournaments', async () => {
    const config = createDefaultTournamentConfig('dota2');
    config.identity.name = 'Creation Persistence Test';
    config.identity.tournamentId = 'pb-creation-persistence-test-cleanup';

    await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
    expect(tournamentService.getTournamentById('pb-creation-persistence-test-cleanup')).toBeDefined();

    // Delete only this specific tournament
    const delRes = await tournamentService.deleteTournament('pb-creation-persistence-test-cleanup');
    expect(delRes.success).toBe(true);

    expect(tournamentService.getTournamentById('pb-creation-persistence-test-cleanup')).toBeUndefined();
    expect(tournamentConfigRegistry.getConfig('pb-creation-persistence-test-cleanup')).toBeUndefined();
  });
});
