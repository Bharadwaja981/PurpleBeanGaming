/**
 * Purple Bean Gaming — Player Privacy Guard & Data Isolation
 */

export interface PublicPlayerProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  city?: string;
  region?: string;
  primaryGame?: string;
  primaryRole?: string;
  rating?: number;
  tournamentMmr?: number;
  verifiedBadge?: boolean;
}

export interface PrivateKycRecord {
  userId: string;
  legalFullName: string;
  idNumberMasked: string;
  panNumberMasked?: string;
  verifiedAt: string;
}

export interface PrizePaymentRecord {
  userId: string;
  upiId: string;
  bankAccountNumberMasked?: string;
  ifscCode?: string;
}

export class PlayerPrivacyGuard {
  public static sanitizeForPublic(record: any): PublicPlayerProfile {
    const {
      legalFullName,
      idNumberMasked,
      upiId,
      panNumberMasked,
      bankAccountNumberMasked,
      ifscCode,
      email,
      phone,
      ...safeFields
    } = record;

    return safeFields as PublicPlayerProfile;
  }

  public static canAccessKyc(caller: { userId: string; roles: string[] }, targetUserId: string): boolean {
    if (caller.userId === targetUserId) return true;
    return caller.roles.includes('admin') || caller.roles.includes('organizer') || caller.roles.includes('organiser');
  }

  public static canAccessPaymentData(caller: { userId: string; roles: string[] }, targetUserId: string): boolean {
    return caller.roles.includes('admin');
  }
}
