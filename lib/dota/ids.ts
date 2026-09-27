const STEAM_ID64_OFFSET = BigInt("76561197960265728");
const MAX_ACCOUNT_ID = BigInt("4294967295");

export class DotaIdError extends Error { constructor() { super("INVALID_DOTA_ACCOUNT"); } }

export function steamId64FromAccountId(value: string | bigint): string {
  const id = parseUnsigned(value, 10);
  if (id > MAX_ACCOUNT_ID) throw new DotaIdError();
  return (STEAM_ID64_OFFSET + id).toString();
}

export function accountIdFromSteamId64(value: string | bigint): string {
  const id = parseUnsigned(value, 17);
  const account = id - STEAM_ID64_OFFSET;
  if (account < BigInt(0) || account > MAX_ACCOUNT_ID) throw new DotaIdError();
  return account.toString();
}

export function normalizeDotaIdentity(input: string) {
  const value = input.trim();
  const match = /^https:\/\/steamcommunity\.com\/profiles\/([0-9]{17})\/?$/.exec(value);
  const numeric = match?.[1] ?? value;
  if (/^[0-9]{17}$/.test(numeric)) return { steamId64: numeric, accountId: accountIdFromSteamId64(numeric), profileUrl: `https://steamcommunity.com/profiles/${numeric}` };
  if (/^[0-9]{1,10}$/.test(numeric)) { const steamId64 = steamId64FromAccountId(numeric); return { steamId64, accountId: BigInt(numeric).toString(), profileUrl: `https://steamcommunity.com/profiles/${steamId64}` }; }
  throw new DotaIdError();
}

function parseUnsigned(value: string | bigint, digits: number) {
  const text = value.toString();
  if (!new RegExp(`^[0-9]{1,${digits}}$`).test(text)) throw new DotaIdError();
  return BigInt(text);
}
