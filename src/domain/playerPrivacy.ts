/**
 * Purple Bean Gaming — Player Privacy & Sensitive Information Boundary
 * 
 * Strict architectural separation of:
 * 1. Public Player Profiles (viewable by spectators, captains, public leaderboards)
 * 2. Private KYC / Verification Records (only owner + authorized tournament organizers)
 * 3. Sensitive Prize Payment Data (only owner + finance organizers)
 */

export interface PublicPlayerProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  city?: string;
  region?: string;
  primaryGame: string;
  primaryRole: string;
  secondaryRole?: string;
  rating: number;
  tournamentMmr: number;
  verifiedBadge: boolean;
  careerHighlights?: Array<{
    tournamentName: string;
    placement: string;
    game: string;
    year: number;
  }>;
}

export interface PrivateKycRecord {
  playerId: string;
  legalFullName: string;
  dateOfBirth?: string;
  governmentIdType: 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE';
  idNumberMasked: string; // e.g. "XXXX-XXXX-1234"
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  reviewedByStaffId?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface PrizePaymentRecord {
  playerId: string;
  upiId?: string; // e.g. "player@okhdfcbank"
  bankAccountMasked?: string; // e.g. "•••• •••• 9812"
  ifscCode?: string;
  panNumberMasked?: string; // e.g. "ABCDE••••F"
  lastPayoutAt?: string;
  totalEarningsINR: number;
}

export interface UserAuthContext {
  userId: string;
  roles: Array<'player' | 'captain' | 'organiser' | 'admin'>;
}

export class PlayerPrivacyGuard {
  public static sanitizeForPublic(
    fullRecord: PublicPlayerProfile & Partial<PrivateKycRecord> & Partial<PrizePaymentRecord>
  ): PublicPlayerProfile {
    return {
      id: fullRecord.id,
      username: fullRecord.username,
      displayName: fullRecord.displayName,
      avatar: fullRecord.avatar,
      city: fullRecord.city,
      region: fullRecord.region,
      primaryGame: fullRecord.primaryGame,
      primaryRole: fullRecord.primaryRole,
      secondaryRole: fullRecord.secondaryRole,
      rating: fullRecord.rating,
      tournamentMmr: fullRecord.tournamentMmr,
      verifiedBadge: fullRecord.verifiedBadge,
      careerHighlights: fullRecord.careerHighlights
    };
  }

  public static canAccessKyc(user: UserAuthContext, targetPlayerId: string): boolean {
    if (user.userId === targetPlayerId) return true;
    return user.roles.includes('organiser') || user.roles.includes('admin');
  }

  public static canAccessPaymentData(user: UserAuthContext, targetPlayerId: string): boolean {
    if (user.userId === targetPlayerId) return true;
    return user.roles.includes('admin');
  }
}
