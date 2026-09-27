import type { TournamentRole,TournamentStatus } from "@/types/domain";
export interface PermissionContext{userId:string|null;roles:readonly TournamentRole[];status:TournamentStatus;ownsResource?:boolean}
const has=(c:PermissionContext,r:TournamentRole)=>Boolean(c.userId)&&c.roles.includes(r);
export const canManageTournament=(c:PermissionContext)=>has(c,"organizer");
export const canEditRegistration=(c:PermissionContext)=>Boolean(c.userId)&&c.status==="registration";
export const canReviewRatings=(c:PermissionContext)=>["organizer","moderator","captain"].some(r=>has(c,r as TournamentRole))&&["verification","rating_review"].includes(c.status);
export const canAccessCaptainTools=(c:PermissionContext)=>has(c,"captain");
export const canAccessOrganizerTools=(c:PermissionContext)=>has(c,"organizer");
export const canViewPrivateScouting=(c:PermissionContext)=>has(c,"captain")&&c.ownsResource===true;
export const canEnterAuctionRoom=(c:PermissionContext)=>Boolean(c.userId)&&["auction_ready","auction_live","auction_paused"].includes(c.status);
