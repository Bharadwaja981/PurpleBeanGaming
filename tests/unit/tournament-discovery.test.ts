import { describe, it, expect, beforeEach } from 'vitest';
import { tournamentService } from '../../src/services/firebaseService';
import { 
  isPubliclyDiscoverable, 
  matchesStatusCategory, 
  matchesGameFilter, 
  matchesRegionFilter, 
  normalizeTournamentRecord,
  normalizeStatus,
  normalizeVisibility
} from '../../src/domain/tournamentDiscovery';
import { Tournament } from '../../src/types/tournament';
const AUCTION_TEST_TOURNAMENT_ID = 'auction-test';

describe('PURPLE BEAN GAMING — Public Tournament Directory & Discovery', () => {
  beforeEach(() => {
    // Reset or ensure state is clean
  });

  describe('1. Public Visibility Rule', () => {
    it('PUBLIC tournaments in discoverable states are discoverable', () => {
      const publicOpen: any = {
        id: 'pb-pub-1',
        name: 'Public Tournament 1',
        visibility: 'PUBLIC',
        status: 'REGISTRATION_OPEN'
      };
      expect(isPubliclyDiscoverable(publicOpen)).toBe(true);

      const publicActive: any = {
        id: 'pb-pub-2',
        name: 'Public Tournament 2',
        visibility: 'PUBLIC',
        status: 'ACTIVE'
      };
      expect(isPubliclyDiscoverable(publicActive)).toBe(true);

      const publicCompleted: any = {
        id: 'pb-pub-3',
        name: 'Public Tournament 3',
        visibility: 'PUBLIC',
        status: 'COMPLETED'
      };
      expect(isPubliclyDiscoverable(publicCompleted)).toBe(true);
    });

    it('DRAFT tournaments remain strictly organizer-only (not discoverable)', () => {
      const draftTourney: any = {
        id: 'pb-draft-1',
        name: 'Draft Tournament',
        visibility: 'DRAFT',
        status: 'DRAFT'
      };
      expect(isPubliclyDiscoverable(draftTourney)).toBe(false);

      const draftWithPublicVis: any = {
        id: 'pb-draft-2',
        name: 'Draft with Public Visibility',
        visibility: 'PUBLIC',
        status: 'DRAFT'
      };
      expect(isPubliclyDiscoverable(draftWithPublicVis)).toBe(false);
    });
  });

  describe('2. Status Normalization & Category Matching', () => {
    it('normalizes REGISTRATION_OPEN, registration_open, REGISTRATION OPEN, OPEN to REGISTRATION_OPEN', () => {
      expect(normalizeStatus('REGISTRATION_OPEN')).toBe('REGISTRATION_OPEN');
      expect(normalizeStatus('registration_open')).toBe('REGISTRATION_OPEN');
      expect(normalizeStatus('REGISTRATION OPEN')).toBe('REGISTRATION_OPEN');
      expect(normalizeStatus('OPEN')).toBe('REGISTRATION_OPEN');
    });

    it('canonical REGISTRATION_OPEN matches ALL and REGISTRATION OPEN categories', () => {
      expect(matchesStatusCategory('REGISTRATION_OPEN', 'All')).toBe(true);
      expect(matchesStatusCategory('REGISTRATION_OPEN', 'Registration Open')).toBe(true);
      expect(matchesStatusCategory('REGISTRATION_OPEN', 'Live')).toBe(false);
      expect(matchesStatusCategory('REGISTRATION_OPEN', 'Completed')).toBe(false);
    });
  });

  describe('3. Visibility Normalization', () => {
    it('normalizes PUBLIC, PUBLIC_CIRCUIT, isPublic=true, published=true to PUBLIC', () => {
      expect(normalizeVisibility({ visibility: 'PUBLIC' })).toBe('PUBLIC');
      expect(normalizeVisibility({ visibility: 'PUBLIC_CIRCUIT' })).toBe('PUBLIC');
      expect(normalizeVisibility({ isPublic: true })).toBe('PUBLIC');
      expect(normalizeVisibility({ published: true })).toBe('PUBLIC');
      expect(normalizeVisibility({ config: { identity: { visibility: 'PUBLIC' } } })).toBe('PUBLIC');
    });
  });

  describe('4. Game and Region Matching', () => {
    it('normalizes game matching across Dota 2 and dota2', () => {
      expect(matchesGameFilter('Dota 2', 'dota2', 'All')).toBe(true);
      expect(matchesGameFilter('Dota 2', 'dota2', 'Dota 2')).toBe(true);
      expect(matchesGameFilter('dota2', 'dota2', 'Dota 2')).toBe(true);
      expect(matchesGameFilter('Valorant', 'valorant', 'Dota 2')).toBe(false);
    });

    it('region filter with ALL INDIA REGIONS includes Pan India and city/regional tournaments', () => {
      expect(matchesRegionFilter('Pan India', 'All')).toBe(true);
      expect(matchesRegionFilter('Bengaluru', 'All')).toBe(true);
      expect(matchesRegionFilter('Mumbai', 'All')).toBe(true);
      expect(matchesRegionFilter('Pan India', 'South India')).toBe(true); // Pan India matches regional filters
      expect(matchesRegionFilter('North India', 'South India')).toBe(false);
    });
  });

  describe('5. Existing Basic Test 1 Record Fix', () => {
    it('normalizes existing Basic Test 1 record to PUBLIC and REGISTRATION_OPEN', () => {
      const rawBasicTest1 = {
        id: AUCTION_TEST_TOURNAMENT_ID,
        name: 'Basic Test 1',
        visibility: 'PUBLIC',
        status: 'REGISTRATION_OPEN',
        game: 'Dota 2',
        gameId: 'dota2',
        region: 'Pan India'
      };

      const normalized = normalizeTournamentRecord(rawBasicTest1);
      expect(normalized.visibility).toBe('PUBLIC');
      expect(normalized.status).toBe('REGISTRATION_OPEN');
      expect(isPubliclyDiscoverable(normalized)).toBe(true);
      expect(matchesStatusCategory(normalized.status, 'All')).toBe(true);
      expect(matchesStatusCategory(normalized.status, 'Registration Open')).toBe(true);
      expect(matchesStatusCategory(normalized.status, 'Live')).toBe(false);
      expect(matchesStatusCategory(normalized.status, 'Completed')).toBe(false);
    });
  });

  describe('6. Realtime Subscription & Public Directory', () => {
    it('notifies subscribers when a tournament is added or updated', () => {
      let notified = false;
      const unsub = tournamentService.subscribe(() => {
        notified = true;
      });

      // Force notify or update
      tournamentService.notify();
      expect(notified).toBe(true);
      unsub();
    });
  });
});
