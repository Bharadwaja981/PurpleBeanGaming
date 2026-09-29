import { describe, it, expect, beforeEach } from 'vitest';
import { tournamentService } from '../../src/services/firebaseService';
import { 
  createDefaultTournamentConfig, 
  validateTournamentConfig, 
  normalizeTournamentConfig,
  TournamentConfig 
} from '../../src/domain/tournamentConfig';
import { removeUndefinedDeep, sanitizeFirestorePayload } from '../../src/utils/sanitizeFirestore';
import { setQuotaExhausted } from '../../src/services/firebaseConfig';

// Helper to assert recursively that an object has zero undefined fields
function assertNoUndefinedRecursively(obj: any, path = ''): void {
  if (obj === null || obj === undefined) {
    if (obj === undefined) {
      throw new Error(`Found undefined value at path "${path}"`);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      if (item === undefined) {
        throw new Error(`Found undefined array item at path "${path}[${idx}]"`);
      }
      if (typeof item === 'object') {
        assertNoUndefinedRecursively(item, `${path}[${idx}]`);
      }
    });
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) {
        throw new Error(`Found undefined value at path "${path ? path + '.' : ''}${key}"`);
      }
      if (typeof val === 'object' && val !== null) {
        assertNoUndefinedRecursively(val, `${path ? path + '.' : ''}${key}`);
      }
    }
  }
}

describe('PURPLE BEAN GAMING — Tournament Creation Undefined Field & City Validation', () => {
  beforeEach(() => {
    setQuotaExhausted(false);
  });

  // 1. ONLINE CITY HANDLING
  describe('1. Online City Handling', () => {
    it('ONLINE + city undefined: tournament successfully created with city omitted or null (never undefined)', async () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.tournamentId = 'pb-online-no-city-' + Date.now();
      config.identity.name = 'Online Championship No City';
      config.identity.locationType = 'ONLINE';
      config.identity.city = undefined;

      const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
      expect(res.success).toBe(true);
      expect(res.tournament).toBeDefined();

      const tournament = res.tournament!;
      // City should be omitted or null, NOT undefined
      expect(tournament.city === undefined || tournament.city === null).toBe(true);
      expect(tournament.config?.identity?.city === undefined || tournament.config?.identity?.city === null).toBe(true);

      // Verify that no undefined exists in the entire persisted document
      assertNoUndefinedRecursively(tournament);
    });

    it('ONLINE + city provided: valid according to schema and city is preserved', async () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.tournamentId = 'pb-online-with-city-' + Date.now();
      config.identity.name = 'Online Mumbai Open';
      config.identity.locationType = 'ONLINE';
      config.identity.city = 'Mumbai';

      const validation = validateTournamentConfig(config);
      expect(validation.valid).toBe(true);

      const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
      expect(res.success).toBe(true);
      expect(res.tournament?.city).toBe('Mumbai');
      expect(res.tournament?.config?.identity?.city).toBe('Mumbai');
      assertNoUndefinedRecursively(res.tournament);
    });
  });

  // 2. LAN CITY VALIDATION
  describe('2. LAN City Validation', () => {
    it('LAN + city missing / undefined: blocked before Firestore with actionable error', async () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.tournamentId = 'pb-lan-no-city-' + Date.now();
      config.identity.name = 'LAN Bangalore Major';
      config.identity.locationType = 'LAN';
      config.identity.city = undefined;

      const validation = validateTournamentConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('City is required for LAN tournaments.');

      // Server-side createTournament must also reject it
      const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
      expect(res.success).toBe(false);
      expect(res.error).toContain('City is required for LAN tournaments.');
    });

    it('LAN + empty city string: blocked before Firestore', async () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.tournamentId = 'pb-lan-empty-city-' + Date.now();
      config.identity.name = 'LAN Major Empty City';
      config.identity.locationType = 'LAN';
      config.identity.city = '   ';

      const validation = validateTournamentConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('City is required for LAN tournaments.');

      const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
      expect(res.success).toBe(false);
      expect(res.error).toContain('City is required for LAN tournaments.');
    });

    it('LAN + city provided: created successfully with host city recorded', async () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.tournamentId = 'pb-lan-with-city-' + Date.now();
      config.identity.name = 'LAN Bengaluru Arena';
      config.identity.locationType = 'LAN';
      config.identity.city = 'Bengaluru';

      const validation = validateTournamentConfig(config);
      expect(validation.valid).toBe(true);

      const res = await tournamentService.createTournament(config, 'PUBLIC', 'DRAFT');
      expect(res.success).toBe(true);
      expect(res.tournament?.city).toBe('Bengaluru');
      expect(res.tournament?.config?.identity?.city).toBe('Bengaluru');
      assertNoUndefinedRecursively(res.tournament);
    });
  });

  // 3. RECURSIVE UNDEFINED SANITIZATION
  describe('3. Recursive Undefined Sanitization', () => {
    it('recursively removes undefined from nested objects', () => {
      const testPayload = {
        name: 'PB Masters',
        emptyVal: undefined,
        config: {
          identity: {
            tournamentId: 'pb-test-1',
            city: undefined,
            name: 'PB Masters',
          },
          registration: {
            eligibilityRules: {
              minMmr: 5000,
              optionalField: undefined
            }
          },
          roster: {
            primaryRosterSize: 5,
            optionalSub: undefined
          },
          auction: undefined,
          competition: {
            format: 'SINGLE_ELIMINATION',
            groupsConfig: undefined
          },
          prizes: {
            totalPrizePoolINR: 50000,
            bonus: undefined
          },
          integrity: {
            requireKyc: false,
            extra: undefined
          }
        }
      };

      const sanitized = removeUndefinedDeep(testPayload);
      expect(sanitized.emptyVal).toBeUndefined();
      expect('emptyVal' in sanitized).toBe(false);
      expect('city' in sanitized.config.identity).toBe(false);
      expect('optionalField' in sanitized.config.registration.eligibilityRules).toBe(false);
      expect('optionalSub' in sanitized.config.roster).toBe(false);
      expect('auction' in sanitized.config).toBe(false);
      expect('groupsConfig' in sanitized.config.competition).toBe(false);
      expect('bonus' in sanitized.config.prizes).toBe(false);
      expect('extra' in sanitized.config.integrity).toBe(false);

      assertNoUndefinedRecursively(sanitized);
    });

    it('strictly preserves false, 0, empty arrays, valid empty strings, and null values', () => {
      const testPayload = {
        booleanFalse: false,
        numberZero: 0,
        emptyArray: [],
        emptyString: '',
        nullValue: null,
        nested: {
          subFalse: false,
          subZero: 0,
          subEmptyArr: [],
          subEmptyStr: '',
          subNull: null,
          mustBeRemoved: undefined
        },
        arrayWithFalsy: [false, 0, '', null, undefined, { deepVal: 0, deepUndefined: undefined }]
      };

      const sanitized = removeUndefinedDeep(testPayload);

      // Verify exact preservation
      expect(sanitized.booleanFalse).toBe(false);
      expect(sanitized.numberZero).toBe(0);
      expect(sanitized.emptyArray).toEqual([]);
      expect(sanitized.emptyString).toBe('');
      expect(sanitized.nullValue).toBeNull();

      expect(sanitized.nested.subFalse).toBe(false);
      expect(sanitized.nested.subZero).toBe(0);
      expect(sanitized.nested.subEmptyArr).toEqual([]);
      expect(sanitized.nested.subEmptyStr).toBe('');
      expect(sanitized.nested.subNull).toBeNull();
      expect('mustBeRemoved' in sanitized.nested).toBe(false);

      // Array sanitization
      expect(sanitized.arrayWithFalsy).toHaveLength(5); // undefined removed, 5 items remain
      expect(sanitized.arrayWithFalsy[0]).toBe(false);
      expect(sanitized.arrayWithFalsy[1]).toBe(0);
      expect(sanitized.arrayWithFalsy[2]).toBe('');
      expect(sanitized.arrayWithFalsy[3]).toBeNull();
      expect(sanitized.arrayWithFalsy[4]).toEqual({ deepVal: 0 });

      assertNoUndefinedRecursively(sanitized);
    });
  });

  // 4. SERVER VALIDATION & PAYLOAD NORMALIZATION
  describe('4. Server Validation', () => {
    it('trusted createTournament operation validates and normalizes payload before write', async () => {
      // Create a raw config where city is undefined on ONLINE
      const rawConfig: any = createDefaultTournamentConfig('dota2');
      rawConfig.identity.tournamentId = 'pb-server-val-norm-' + Date.now();
      rawConfig.identity.locationType = 'ONLINE';
      rawConfig.identity.city = undefined;
      rawConfig.teamFormation.mode = 'ORGANIZER_ASSIGNMENT';
      rawConfig.auction = undefined;

      const res = await tournamentService.createTournament(rawConfig);
      expect(res.success).toBe(true);

      const saved = tournamentService.getTournamentById(rawConfig.identity.tournamentId);
      expect(saved).toBeDefined();
      expect('city' in (saved?.config?.identity || {})).toBe(false);
      assertNoUndefinedRecursively(saved);
    });

    it('rejects invalid configuration with missing required name', async () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.name = '';

      const res = await tournamentService.createTournament(config);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Tournament name is required.');
    });

    it('rejects invalid configuration with fewer than 2 teams', async () => {
      const config = createDefaultTournamentConfig('dota2');
      config.teamFormation.numberOfTeams = 1;

      const res = await tournamentService.createTournament(config);
      expect(res.success).toBe(false);
      expect(res.error).toContain('A tournament must feature at least 2 teams.');
    });
  });

  // 5. REVIEW SCREEN VALIDATION
  describe('5. Review Validation', () => {
    it('Review validation returns valid=true for a normalized valid config', () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.name = 'Valid Tournament Review';
      config.identity.locationType = 'ONLINE';
      config.identity.city = undefined;

      const normalized = normalizeTournamentConfig(config);
      const val = validateTournamentConfig(normalized);
      expect(val.valid).toBe(true);
      expect(val.errors).toHaveLength(0);
    });

    it('Review validation returns valid=false for LAN without city', () => {
      const config = createDefaultTournamentConfig('dota2');
      config.identity.name = 'LAN Tournament Missing City';
      config.identity.locationType = 'LAN';
      config.identity.city = '';

      const normalized = normalizeTournamentConfig(config);
      const val = validateTournamentConfig(normalized);
      expect(val.valid).toBe(false);
      expect(val.errors).toContain('City is required for LAN tournaments.');
    });
  });

  // 6. TEST EVERY OPTIONAL TOURNAMENT-CREATION FIELD FOR UNDEFINED
  describe('6. Optional Tournament Creation Fields', () => {
    it('sanitizes all optional tournament-creation fields without sending undefined to Firestore', async () => {
      const rawConfig: any = {
        identity: {
          tournamentId: 'pb-optional-fields-' + Date.now(),
          name: 'Optional Fields Sanitization Test',
          gameId: 'dota2',
          gameName: 'Dota 2',
          description: undefined, // optional
          region: 'Pan India',
          locationType: 'ONLINE',
          city: undefined, // optional
          bannerUrl: undefined, // optional
          isDevelopment: undefined, // optional
          visibility: 'PUBLIC'
        },
        registration: {
          registrationMode: 'INDIVIDUAL',
          openDate: '2026-10-01',
          closeDate: '2026-10-05',
          maxParticipants: 16,
          eligibilityRules: {
            minMmrOrRank: undefined, // optional
            regionLocked: undefined, // optional
            requireKyc: undefined // optional
          }
        },
        teamFormation: {
          mode: 'ORGANIZER_ASSIGNMENT',
          numberOfTeams: 2
        },
        roster: {
          primaryRosterSize: 5,
          captainCountsTowardRoster: true,
          substituteSlots: 1,
          substituteRequired: false
        },
        auction: undefined, // optional
        competition: {
          format: 'SINGLE_ELIMINATION',
          defaultSeriesFormat: 'BO3',
          roundOverrides: undefined, // optional
          seedingMethod: 'RANDOM',
          groupsConfig: undefined // optional
        },
        prizes: {
          totalPrizePoolINR: 10000,
          placementDistribution: [
            { placement: '1st Place', percentage: 100, amountINR: 10000 }
          ]
        },
        integrity: {
          verificationRequired: true,
          organizerApprovalRequired: true
        }
      };

      const res = await tournamentService.createTournament(rawConfig);
      expect(res.success).toBe(true);
      expect(res.tournament).toBeDefined();

      const tournament = res.tournament!;
      // Absolutely NO undefined anywhere in the document
      assertNoUndefinedRecursively(tournament);
    });
  });
});
