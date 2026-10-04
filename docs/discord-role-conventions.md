# Purple Bean Gaming — Discord Role Environment & Config Naming Conventions

## Overview
This document outlines the standardized Discord role environment and configuration naming convention across the Purple Bean Gaming platform.

## Canonical Environment Variables

Every component of the PBG ecosystem (Node.js Express API server, Vite frontend proxy, Discord synchronization engine, and Firebase Cloud Functions) uses these exact variable names:

| Environment Variable | Role Name | Default Snowflake ID | Persistence / Lifecycle |
|---|---|---|---|
| `DISCORD_PBG_MEMBER_ROLE_ID` | **PBG Member** | `1555885374713237524` | **Persistent Platform Role**. Granted upon Discord OAuth linking. Never removed during tournament sync. |
| `DISCORD_PBG_PLAYER_ROLE_ID` | **PBG Player** | `1555884061111746651` | **Temporary Tournament Role**. Granted to active tournament participants. Stripped on team elimination or tournament completion. |
| `DISCORD_PBG_CAPTAIN_ROLE_ID` | **PBG Captain** | `1556338549807259658` | **Temporary Tournament Role**. Granted to designated franchise captains. Stripped on captain replacement, elimination, or completion. |

## Dynamic Team Roles
- Each finalized team receives a dynamically generated Discord role matching the team name (e.g., `Phoenix Esports`).
- Team roles are created on-demand using the Discord REST API (`POST /guilds/{guildId}/roles`) during auction finalization or team creation.
- The returned Discord `roleId` is saved directly in PBG Firestore (`team.discord.roleId`).
- Team roles are assigned to active team roster members and automatically deleted upon tournament completion.

## Desired Role State Mapping Engine

The PBG Discord engine calculates the desired role state purely from authoritative database state:

1. **PBG Member**:
   - Condition: Discord account is linked to PBG profile (`discordLink.discordLinked === true`)
   - Mapping: `→ DISCORD_PBG_MEMBER_ROLE_ID`
   - Preservation: Invariant 8 guarantees `DISCORD_PBG_MEMBER_ROLE_ID` is never in `rolesToRemove`.

2. **PBG Player**:
   - Condition: Participant is active in an ongoing tournament (`participantStatus === 'ACTIVE'` and `tournament.status !== 'COMPLETED'`)
   - Mapping: `→ DISCORD_PBG_PLAYER_ROLE_ID`

3. **PBG Captain**:
   - Condition: Participant is designated as team captain (`tournamentRole === 'CAPTAIN'`)
   - Mapping: `→ DISCORD_PBG_CAPTAIN_ROLE_ID`

4. **Dynamic Team Role**:
   - Condition: Active member of a finalized team (`team.status === 'ACTIVE'`)
   - Mapping: `→ team.discord.roleId`

## Replaced Legacy Variables
All occurrences of the following legacy / inconsistent variable names have been replaced:
- `PBG_PLAYER_ROLE_ID` → `DISCORD_PBG_PLAYER_ROLE_ID`
- `PBG_CAPTAIN_ROLE_ID` → `DISCORD_PBG_CAPTAIN_ROLE_ID`
- `TOURNAMENT_PLAYER_ROLE_ID` → `DISCORD_PBG_PLAYER_ROLE_ID`
- `CAPTAIN_ROLE_ID` → `DISCORD_PBG_CAPTAIN_ROLE_ID`

## Firebase Cloud Functions Deployment
The Firebase Cloud Functions gateway in `functions/` reads environment variables from `functions/.env`.
When changes are made to role IDs or environment variables:
1. Update `functions/.env` with the new variables.
2. Re-bundle functions using `npm --prefix functions run build`.
3. Deploy to Firebase using `firebase deploy --only functions`.
