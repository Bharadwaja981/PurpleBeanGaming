/**
 * Purple Bean Gaming — Server-Side Discord Provisioning Service
 * 
 * Handles Discord REST API interactions:
 * - User profile retrieval (strictly from /users/@me response.id)
 * - Guild membership provisioning (PUT /guilds/{guildId}/members/{discordUserId})
 * - Role assignment (PUT /guilds/{guildId}/members/{discordUserId}/roles/{roleId})
 * - Authoritative follow-up role verification (GET /guilds/{guildId}/members/{discordUserId})
 * - Safe role revocation on unlink (DELETE /guilds/{guildId}/members/{discordUserId}/roles/{roleId})
 * - Zero token/secret leakage in error responses
 */

export interface DiscordUserProfileResponse {
  id: string; // Discord Immutable Snowflake ID
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator?: string;
}

export interface DiscordProvisioningResult {
  success: boolean;
  guildMember: boolean;
  pbgMemberRole: boolean;
  alreadyMember?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Fetches authenticated Discord user profile.
 * Strictly guarantees discord.userId comes from GET https://discord.com/api/v10/users/@me response.id.
 */
export async function fetchDiscordUserProfile(accessToken: string): Promise<DiscordUserProfileResponse> {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Access token is required to fetch Discord user profile');
  }

  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401) {
      const err = new Error('Discord access token is invalid or expired.');
      (err as any).code = 'DISCORD_INVALID_TOKEN';
      throw err;
    }
    const err = new Error(`Discord API error while fetching user profile (HTTP ${status}).`);
    (err as any).code = 'DISCORD_API_UNAVAILABLE';
    throw err;
  }

  const data = await res.json();
  if (!data || !data.id || typeof data.id !== 'string') {
    const err = new Error('Discord API returned an invalid user profile without a user ID.');
    (err as any).code = 'DISCORD_MALFORMED_PROFILE';
    throw err;
  }

  return {
    id: data.id,
    username: data.username || 'discord_user',
    global_name: data.global_name || null,
    avatar: data.avatar || null,
    discriminator: data.discriminator
  };
}

/**
 * Provisions a Discord user into the PBG Discord Guild, assigns PBG Member role,
 * and executes a follow-up query to VERIFY the actual Discord member role.
 */
export async function provisionDiscordGuildAndRole(params: {
  guildId: string;
  botToken: string;
  roleId?: string;
  discordUserId: string;
  accessToken: string;
  fetchFn?: typeof fetch;
}): Promise<DiscordProvisioningResult> {
  const { guildId, botToken, roleId, discordUserId, accessToken, fetchFn = fetch } = params;

  if (!guildId || typeof guildId !== 'string') {
    return {
      success: false,
      guildMember: false,
      pbgMemberRole: false,
      errorCode: 'DISCORD_INVALID_GUILD_ID',
      errorMessage: 'Official PBG Discord guild ID is missing or invalid.'
    };
  }

  if (!botToken || typeof botToken !== 'string') {
    return {
      success: false,
      guildMember: false,
      pbgMemberRole: false,
      errorCode: 'DISCORD_MISSING_BOT_TOKEN',
      errorMessage: 'Discord bot token is missing in server environment.'
    };
  }

  try {
    let alreadyMember = false;

    // 1. Add Guild Member via PUT /guilds/{guildId}/members/{discordUserId}
    const addMemberUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
    const addMemberRes = await fetchFn(addMemberUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: accessToken,
        roles: roleId ? [roleId] : []
      })
    });

    let verifiedRole = false;
    let memberConfirmed = false;

    if (addMemberRes.status === 201) {
      // 201 Created: user joined server. Discord returns the Guild Member object in the response.
      alreadyMember = false;
      memberConfirmed = true;

      // Check Discord guild member response directly
      const newMemberData = typeof addMemberRes.json === 'function' ? await addMemberRes.json().catch(() => null) : null;
      if (newMemberData && Array.isArray(newMemberData.roles)) {
        if (!roleId || newMemberData.roles.includes(roleId)) {
          verifiedRole = true;
        }
      }
    } else if (addMemberRes.status === 204) {
      // 204 No Content: user was ALREADY a member in the server
      alreadyMember = true;
      memberConfirmed = true;

      if (roleId) {
        // Explicitly assign PBG Member role
        const addRoleUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
        const addRoleRes = await fetchFn(addRoleUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bot ${botToken}`
          }
        });

        if (addRoleRes.status !== 204 && !addRoleRes.ok) {
          const roleErrorBody = typeof addRoleRes.json === 'function' ? await addRoleRes.json().catch(() => ({})) : {};
          const code = (roleErrorBody as any)?.code;

          if (addRoleRes.status === 403 || code === 50013) {
            return {
              success: false,
              guildMember: true,
              pbgMemberRole: false,
              errorCode: 'DISCORD_ROLE_HIERARCHY_FAILURE',
              errorMessage: 'Bot lacks permission to assign the PBG Member role or the role is higher in hierarchy than the bot.'
            };
          }

          if (addRoleRes.status === 404 || code === 10011) {
            return {
              success: false,
              guildMember: true,
              pbgMemberRole: false,
              errorCode: 'DISCORD_INVALID_ROLE_ID',
              errorMessage: 'Configured PBG Member role ID does not exist in the Discord guild.'
            };
          }

          return {
            success: false,
            guildMember: true,
            pbgMemberRole: false,
            errorCode: 'DISCORD_ROLE_ASSIGNMENT_FAILED',
            errorMessage: 'Failed to assign PBG Member role in official Discord server.'
          };
        }
      }
    } else {
      const errorBody = typeof addMemberRes.json === 'function' ? await addMemberRes.json().catch(() => ({})) : {};
      const code = (errorBody as any)?.code;

      if (addMemberRes.status === 404 || code === 10004) {
        return {
          success: false,
          guildMember: false,
          pbgMemberRole: false,
          errorCode: 'DISCORD_INVALID_GUILD_ID',
          errorMessage: 'Official PBG Discord server (Guild ID) was not found.'
        };
      }

      if (addMemberRes.status === 403 || code === 50013) {
        return {
          success: false,
          guildMember: false,
          pbgMemberRole: false,
          errorCode: 'DISCORD_BOT_MISSING_PERMISSIONS',
          errorMessage: 'Discord bot lacks "Manage Roles" or "Create Instant Invite" permission to add members.'
        };
      }

      return {
        success: false,
        guildMember: false,
        pbgMemberRole: false,
        errorCode: 'DISCORD_GUILD_JOIN_FAILED',
        errorMessage: `Failed to join official Discord server (HTTP ${addMemberRes.status}).`
      };
    }

    // 2. AUTHORITATIVE ROLE & MEMBERSHIP VERIFICATION
    // If not already verified via the 201 guild member response, perform follow-up GET /guilds/{guildId}/members/{discordUserId}
    if (!verifiedRole && roleId) {
      const verifyMemberUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
      const verifyMemberRes = await fetchFn(verifyMemberUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bot ${botToken}`,
          Accept: 'application/json'
        }
      });

      if (!verifyMemberRes.ok) {
        return {
          success: false,
          guildMember: memberConfirmed,
          pbgMemberRole: false,
          errorCode: 'DISCORD_MEMBER_VERIFICATION_FAILED',
          errorMessage: 'Failed to verify member status on official PBG Discord server.'
        };
      }

      const memberData = typeof verifyMemberRes.json === 'function' ? await verifyMemberRes.json().catch(() => ({})) : {};
      const actualRoles: string[] = Array.isArray((memberData as any)?.roles) ? (memberData as any).roles : [];
      if (actualRoles.includes(roleId)) {
        verifiedRole = true;
      }
    }

    if (roleId && !verifiedRole) {
      // Incomplete provisioning: member is in server, but role was not verified
      return {
        success: false,
        guildMember: true,
        pbgMemberRole: false,
        alreadyMember,
        errorCode: 'DISCORD_ROLE_VERIFICATION_FAILED',
        errorMessage: 'Member is present in Discord server, but the PBG Member role could not be verified on the account.'
      };
    }

    return {
      success: true,
      guildMember: true,
      pbgMemberRole: Boolean(verifiedRole || !roleId),
      alreadyMember
    };
  } catch (err: any) {
    return {
      success: false,
      guildMember: false,
      pbgMemberRole: false,
      errorCode: 'DISCORD_API_UNAVAILABLE',
      errorMessage: 'Discord API is currently unreachable. Please try again.'
    };
  }
}

/**
 * Removes the PBG Member role from a user in the Discord guild without kicking them.
 * Used during account unlinking when role represents verified PBG identity.
 */
export async function removeDiscordMemberRole(params: {
  guildId: string;
  botToken: string;
  roleId: string;
  discordUserId: string;
  fetchFn?: typeof fetch;
}): Promise<{ success: boolean; error?: string }> {
  const { guildId, botToken, roleId, discordUserId, fetchFn = fetch } = params;

  if (!guildId || !botToken || !roleId || !discordUserId) {
    return { success: false, error: 'MISSING_PARAMETERS' };
  }

  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });

    if (res.status === 204 || res.status === 404 || res.ok) {
      // 204 No Content: role removed
      // 404 Not Found: user or role already absent
      return { success: true };
    }

    return { success: false, error: `HTTP_${res.status}` };
  } catch (err: any) {
    console.warn('[removeDiscordMemberRole] Role removal warning:', err.message);
    return { success: false, error: err.message };
  }
}
