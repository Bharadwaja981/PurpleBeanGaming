import "server-only";
import {OpenDotaProvider} from "./opendota";
import {SteamProvider} from "./steam";
export const openDotaProvider=()=>new OpenDotaProvider(process.env.OPENDOTA_API_KEY);
export const steamProvider=()=>new SteamProvider(process.env.STEAM_WEB_API_KEY);
