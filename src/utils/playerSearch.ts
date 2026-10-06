import { Player } from '../types/tournament';

export function matchesPlayerSearch(p: Player, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;
  const rawLower = rawQuery.trim().toLowerCase();
  
  // Normalize PGB typo to PBG (e.g. "pgb-000188" -> "pbg-000188")
  const q = rawLower.replace(/\bpgb\b/g, 'pbg').replace(/pgb-/g, 'pbg-').replace(/pgb\s+/g, 'pbg ');
  const qAlphaNum = q.replace(/[^a-z0-9]/g, '');
  const qNum = q.replace(/[^0-9]/g, '');

  // 1. Direct PBG / PGB ID matching (e.g. "PBG-000188", "PGB-000188", "188", "000188", "pbg-188", "pbg 188")
  const pbgId = p.pbgId || (p.id && String(p.id).startsWith('PBG-') ? String(p.id) : undefined);
  if (pbgId) {
    const pbgLower = String(pbgId).toLowerCase();
    const pbgAlphaNum = pbgLower.replace(/[^a-z0-9]/g, '');
    const pbgNum = String(pbgId).replace(/[^0-9]/g, '');

    if (pbgLower.includes(q)) return true;
    if (qAlphaNum && pbgAlphaNum.includes(qAlphaNum)) return true;
    if (qNum && (pbgNum.includes(qNum) || parseInt(pbgNum, 10) === parseInt(qNum, 10))) {
      return true;
    }
    // Handle "pbg" search query matching any PBG player
    if (q === 'pbg' || rawLower === 'pgb') return true;
  }

  // Also check if p.id has a numeric component (e.g. "p-1", "p-188")
  if (p.id) {
    const idStr = String(p.id);
    const idLower = idStr.toLowerCase();
    const idAlphaNum = idLower.replace(/[^a-z0-9]/g, '');
    const idNum = idStr.replace(/[^0-9]/g, '');

    if (idLower.includes(q)) return true;
    if (qAlphaNum && idAlphaNum.includes(qAlphaNum)) return true;
    if (qNum && idNum && (idNum.includes(qNum) || (parseInt(idNum, 10) === parseInt(qNum, 10) && parseInt(qNum, 10) > 0))) {
      return true;
    }
  }

  // 2. Names: Display Name, Username, Real Name, IGN
  const names = [
    p.displayName,
    p.username,
    p.realName,
    (p as any).ign,
    (p as any).gamerTag,
    (p as any).steamPersonaName
  ].filter(Boolean) as string[];

  for (const name of names) {
    const nLower = name.toLowerCase();
    if (nLower.includes(rawLower) || nLower.includes(q)) return true;
  }

  // Multi-word name search (e.g. "Santhosh Myana")
  const queryTokens = q.split(/\s+/).filter(t => t.length > 1);
  if (queryTokens.length > 1) {
    const allNamesJoined = names.join(' ').toLowerCase();
    if (queryTokens.every(tok => allNamesJoined.includes(tok))) return true;
  }

  // 3. Email
  if (p.email && (p.email.toLowerCase().includes(rawLower) || p.email.toLowerCase().includes(q))) return true;

  // 4. Gaming IDs: Dota Friend ID (AccountId) & Steam ID64
  if (p.dotaAccountId && (p.dotaAccountId.includes(q) || p.dotaAccountId.includes(qNum))) return true;
  if (p.steamId && (p.steamId.includes(q) || p.steamId.includes(qNum))) return true;

  // 5. Discord username & display name
  const discordUser = (p as any).discordUsername;
  const discordDisplay = (p as any).discordDisplayName;
  if (discordUser && discordUser.toLowerCase().includes(rawLower)) return true;
  if (discordDisplay && discordDisplay.toLowerCase().includes(rawLower)) return true;

  // 6. City, Region, Country
  if (p.city && (p.city.toLowerCase().includes(rawLower) || p.city.toLowerCase().includes(q))) return true;
  if (p.region && (p.region.toLowerCase().includes(rawLower) || p.region.toLowerCase().includes(q))) return true;
  if (p.country && (p.country.toLowerCase().includes(rawLower) || p.country.toLowerCase().includes(q))) return true;

  // 7. Competitive Roles & Role Shortcuts
  const roles = [p.primaryRole, p.secondaryRole].filter(Boolean).map(r => r!.toLowerCase());
  for (const r of roles) {
    if (r.includes(rawLower) || r.includes(q)) return true;
  }

  // Role shortcut alias matching (e.g. "pos 1", "carry", "mid", "support", "offlane", "core")
  if (q.includes('pos 1') || q.includes('carry')) {
    if (roles.some(r => r.includes('position 1') || r.includes('carry'))) return true;
  }
  if (q.includes('pos 2') || q.includes('mid')) {
    if (roles.some(r => r.includes('position 2') || r.includes('mid'))) return true;
  }
  if (q.includes('pos 3') || q.includes('offlane')) {
    if (roles.some(r => r.includes('position 3') || r.includes('offlane'))) return true;
  }
  if (q.includes('pos 4') || (q.includes('support') && !q.includes('hard'))) {
    if (roles.some(r => r.includes('position 4') || r.includes('support'))) return true;
  }
  if (q.includes('pos 5') || q.includes('hard support')) {
    if (roles.some(r => r.includes('position 5') || r.includes('hard support'))) return true;
  }

  // 8. Franchise / Team Name
  if (p.teamName && (p.teamName.toLowerCase().includes(rawLower) || p.teamName.toLowerCase().includes(q))) return true;
  if (p.teamId && p.teamId.toLowerCase().includes(q)) return true;

  // 9. Verification status
  if (p.status && (p.status.toLowerCase().includes(rawLower) || p.status.toLowerCase().includes(q))) return true;

  // 10. Primary Game Title
  if (p.primaryGame && (p.primaryGame.toLowerCase().includes(rawLower) || p.primaryGame.toLowerCase().includes(q))) return true;

  // 11. MMR & Platform Rating matching
  if (qNum && (String(p.mmr) === qNum || String(p.platformRating) === qNum || String(p.tournamentMmr) === qNum)) {
    return true;
  }

  // 12. Hero pool & Bio
  if (p.bio && p.bio.toLowerCase().includes(rawLower)) return true;
  if (Array.isArray(p.heroPool)) {
    if (p.heroPool.some(h => h.hero && h.hero.toLowerCase().includes(rawLower))) return true;
  }

  return false;
}
