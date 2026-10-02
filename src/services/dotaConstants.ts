/**
 * Purple Bean Gaming — Dota 2 Constants & Asset Helpers
 *
 * Official hero mapping, item mapping, rank tier assets, and Valve/OpenDota CDN integrations.
 */

export interface DotaHeroMeta {
  id: number;
  name: string;
  cleanName: string;
  localizedName: string;
  primaryAttr: 'str' | 'agi' | 'int' | 'all';
  roles: string[];
}

export interface DotaItemMeta {
  id: number;
  name: string;
  cleanName: string;
  localizedName: string;
  cost?: number;
  isNeutral?: boolean;
  tier?: number;
}

// Complete Valve Hero Registry (125 heroes)
export const DOTA_HEROES_REGISTRY: Record<number, DotaHeroMeta> = {
  1: { id: 1, name: 'npc_dota_hero_antimage', cleanName: 'antimage', localizedName: 'Anti-Mage', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Nuker'] },
  2: { id: 2, name: 'npc_dota_hero_axe', cleanName: 'axe', localizedName: 'Axe', primaryAttr: 'str', roles: ['Initiator', 'Durable', 'Disabler', 'Carry'] },
  3: { id: 3, name: 'npc_dota_hero_bane', cleanName: 'bane', localizedName: 'Bane', primaryAttr: 'all', roles: ['Support', 'Disabler', 'Nuker', 'Durable'] },
  4: { id: 4, name: 'npc_dota_hero_bloodseeker', cleanName: 'bloodseeker', localizedName: 'Bloodseeker', primaryAttr: 'agi', roles: ['Carry', 'Disabler', 'Nuker', 'Initiator'] },
  5: { id: 5, name: 'npc_dota_hero_crystal_maiden', cleanName: 'crystal_maiden', localizedName: 'Crystal Maiden', primaryAttr: 'int', roles: ['Support', 'Disabler', 'Nuker'] },
  6: { id: 6, name: 'npc_dota_hero_drow_ranger', cleanName: 'drow_ranger', localizedName: 'Drow Ranger', primaryAttr: 'agi', roles: ['Carry', 'Disabler', 'Pusher'] },
  7: { id: 7, name: 'npc_dota_hero_earthshaker', cleanName: 'earthshaker', localizedName: 'Earthshaker', primaryAttr: 'str', roles: ['Support', 'Initiator', 'Disabler', 'Nuker'] },
  8: { id: 8, name: 'npc_dota_hero_juggernaut', cleanName: 'juggernaut', localizedName: 'Juggernaut', primaryAttr: 'agi', roles: ['Carry', 'Pusher', 'Escape'] },
  9: { id: 9, name: 'npc_dota_hero_mirana', cleanName: 'mirana', localizedName: 'Mirana', primaryAttr: 'all', roles: ['Carry', 'Support', 'Escape', 'Nuker', 'Disabler'] },
  10: { id: 10, name: 'npc_dota_hero_morphling', cleanName: 'morphling', localizedName: 'Morphling', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Durable', 'Nuker'] },
  11: { id: 11, name: 'npc_dota_hero_nevermore', cleanName: 'shadow_fiend', localizedName: 'Shadow Fiend', primaryAttr: 'agi', roles: ['Carry', 'Nuker'] },
  12: { id: 12, name: 'npc_dota_hero_phantom_lancer', cleanName: 'phantom_lancer', localizedName: 'Phantom Lancer', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Pusher'] },
  13: { id: 13, name: 'npc_dota_hero_puck', cleanName: 'puck', localizedName: 'Puck', primaryAttr: 'int', roles: ['Initiator', 'Disabler', 'Nuker', 'Escape'] },
  14: { id: 14, name: 'npc_dota_hero_pudge', cleanName: 'pudge', localizedName: 'Pudge', primaryAttr: 'str', roles: ['Disabler', 'Initiator', 'Durable', 'Nuker'] },
  15: { id: 15, name: 'npc_dota_hero_razor', cleanName: 'razor', localizedName: 'Razor', primaryAttr: 'agi', roles: ['Carry', 'Durable', 'Nuker', 'Pusher'] },
  16: { id: 16, name: 'npc_dota_hero_sand_king', cleanName: 'sand_king', localizedName: 'Sand King', primaryAttr: 'all', roles: ['Initiator', 'Disabler', 'Nuker', 'Escape'] },
  17: { id: 17, name: 'npc_dota_hero_storm_spirit', cleanName: 'storm_spirit', localizedName: 'Storm Spirit', primaryAttr: 'int', roles: ['Carry', 'Escape', 'Nuker', 'Initiator'] },
  18: { id: 18, name: 'npc_dota_hero_sven', cleanName: 'sven', localizedName: 'Sven', primaryAttr: 'str', roles: ['Carry', 'Disabler', 'Initiator', 'Durable'] },
  19: { id: 19, name: 'npc_dota_hero_tiny', cleanName: 'tiny', localizedName: 'Tiny', primaryAttr: 'str', roles: ['Initiator', 'Nuker', 'Carry', 'Durable'] },
  20: { id: 20, name: 'npc_dota_hero_vengefulspirit', cleanName: 'vengefulspirit', localizedName: 'Vengeful Spirit', primaryAttr: 'all', roles: ['Support', 'Initiator', 'Disabler', 'Nuker', 'Escape'] },
  21: { id: 21, name: 'npc_dota_hero_windrunner', cleanName: 'windranger', localizedName: 'Windranger', primaryAttr: 'all', roles: ['Carry', 'Support', 'Disabler', 'Nuker', 'Escape'] },
  22: { id: 22, name: 'npc_dota_hero_zuus', cleanName: 'zeus', localizedName: 'Zeus', primaryAttr: 'int', roles: ['Nuker', 'Carry'] },
  23: { id: 23, name: 'npc_dota_hero_kunkka', cleanName: 'kunkka', localizedName: 'Kunkka', primaryAttr: 'str', roles: ['Carry', 'Support', 'Disabler', 'Initiator', 'Durable'] },
  25: { id: 25, name: 'npc_dota_hero_lina', cleanName: 'lina', localizedName: 'Lina', primaryAttr: 'int', roles: ['Carry', 'Support', 'Nuker', 'Disabler'] },
  26: { id: 26, name: 'npc_dota_hero_lion', cleanName: 'lion', localizedName: 'Lion', primaryAttr: 'int', roles: ['Support', 'Disabler', 'Nuker', 'Initiator'] },
  27: { id: 27, name: 'npc_dota_hero_shadow_shaman', cleanName: 'shadow_shaman', localizedName: 'Shadow Shaman', primaryAttr: 'all', roles: ['Support', 'Pusher', 'Disabler', 'Nuker'] },
  28: { id: 28, name: 'npc_dota_hero_slardar', cleanName: 'slardar', localizedName: 'Slardar', primaryAttr: 'str', roles: ['Carry', 'Durable', 'Initiator', 'Disabler', 'Escape'] },
  29: { id: 29, name: 'npc_dota_hero_tidehunter', cleanName: 'tidehunter', localizedName: 'Tidehunter', primaryAttr: 'str', roles: ['Initiator', 'Durable', 'Disabler', 'Nuker'] },
  30: { id: 30, name: 'npc_dota_hero_witch_doctor', cleanName: 'witch_doctor', localizedName: 'Witch Doctor', primaryAttr: 'int', roles: ['Support', 'Nuker', 'Disabler'] },
  31: { id: 31, name: 'npc_dota_hero_lich', cleanName: 'lich', localizedName: 'Lich', primaryAttr: 'int', roles: ['Support', 'Nuker'] },
  32: { id: 32, name: 'npc_dota_hero_riki', cleanName: 'riki', localizedName: 'Riki', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Disabler'] },
  33: { id: 33, name: 'npc_dota_hero_enigma', cleanName: 'enigma', localizedName: 'Enigma', primaryAttr: 'all', roles: ['Disabler', 'Initiator', 'Pusher'] },
  34: { id: 34, name: 'npc_dota_hero_tinker', cleanName: 'tinker', localizedName: 'Tinker', primaryAttr: 'int', roles: ['Carry', 'Nuker', 'Pusher'] },
  35: { id: 35, name: 'npc_dota_hero_sniper', cleanName: 'sniper', localizedName: 'Sniper', primaryAttr: 'agi', roles: ['Carry', 'Nuker'] },
  36: { id: 36, name: 'npc_dota_hero_necrolyte', cleanName: 'necrophos', localizedName: 'Necrophos', primaryAttr: 'int', roles: ['Carry', 'Nuker', 'Durable', 'Disabler'] },
  37: { id: 37, name: 'npc_dota_hero_warlock', cleanName: 'warlock', localizedName: 'Warlock', primaryAttr: 'int', roles: ['Support', 'Initiator', 'Disabler'] },
  38: { id: 38, name: 'npc_dota_hero_beastmaster', cleanName: 'beastmaster', localizedName: 'Beastmaster', primaryAttr: 'all', roles: ['Initiator', 'Disabler', 'Durable', 'Nuker'] },
  39: { id: 39, name: 'npc_dota_hero_queenofpain', cleanName: 'queenofpain', localizedName: 'Queen of Pain', primaryAttr: 'int', roles: ['Carry', 'Nuker', 'Escape'] },
  40: { id: 40, name: 'npc_dota_hero_venomancer', cleanName: 'venomancer', localizedName: 'Venomancer', primaryAttr: 'all', roles: ['Support', 'Nuker', 'Initiator', 'Disabler', 'Pusher'] },
  41: { id: 41, name: 'npc_dota_hero_faceless_void', cleanName: 'faceless_void', localizedName: 'Faceless Void', primaryAttr: 'agi', roles: ['Carry', 'Initiator', 'Disabler', 'Escape', 'Durable'] },
  42: { id: 42, name: 'npc_dota_hero_skeleton_king', cleanName: 'wraith_king', localizedName: 'Wraith King', primaryAttr: 'str', roles: ['Carry', 'Support', 'Durable', 'Disabler', 'Initiator'] },
  43: { id: 43, name: 'npc_dota_hero_death_prophet', cleanName: 'death_prophet', localizedName: 'Death Prophet', primaryAttr: 'all', roles: ['Carry', 'Pusher', 'Nuker', 'Durable'] },
  44: { id: 44, name: 'npc_dota_hero_phantom_assassin', cleanName: 'phantom_assassin', localizedName: 'Phantom Assassin', primaryAttr: 'agi', roles: ['Carry', 'Escape'] },
  45: { id: 45, name: 'npc_dota_hero_pugna', cleanName: 'pugna', localizedName: 'Pugna', primaryAttr: 'int', roles: ['Nuker', 'Pusher'] },
  46: { id: 46, name: 'npc_dota_hero_templar_assassin', cleanName: 'templar_assassin', localizedName: 'Templar Assassin', primaryAttr: 'agi', roles: ['Carry', 'Escape'] },
  47: { id: 47, name: 'npc_dota_hero_viper', cleanName: 'viper', localizedName: 'Viper', primaryAttr: 'agi', roles: ['Carry', 'Durable', 'Initiator', 'Disabler'] },
  48: { id: 48, name: 'npc_dota_hero_luna', cleanName: 'luna', localizedName: 'Luna', primaryAttr: 'agi', roles: ['Carry', 'Nuker', 'Pusher'] },
  49: { id: 49, name: 'npc_dota_hero_dragon_knight', cleanName: 'dragon_knight', localizedName: 'Dragon Knight', primaryAttr: 'str', roles: ['Carry', 'Pusher', 'Durable', 'Disabler', 'Initiator'] },
  50: { id: 50, name: 'npc_dota_hero_dazzle', cleanName: 'dazzle', localizedName: 'Dazzle', primaryAttr: 'all', roles: ['Support', 'Nuker', 'Disabler'] },
  51: { id: 51, name: 'npc_dota_hero_rattletrap', cleanName: 'clockwerk', localizedName: 'Clockwerk', primaryAttr: 'all', roles: ['Initiator', 'Disabler', 'Durable', 'Nuker'] },
  52: { id: 52, name: 'npc_dota_hero_leshrac', cleanName: 'leshrac', localizedName: 'Leshrac', primaryAttr: 'int', roles: ['Carry', 'Nuker', 'Pusher', 'Disabler'] },
  53: { id: 53, name: 'npc_dota_hero_furion', cleanName: 'furion', localizedName: "Nature's Prophet", primaryAttr: 'int', roles: ['Carry', 'Pusher', 'Escape', 'Nuker'] },
  54: { id: 54, name: 'npc_dota_hero_life_stealer', cleanName: 'life_stealer', localizedName: 'Lifestealer', primaryAttr: 'str', roles: ['Carry', 'Durable', 'Escape', 'Disabler'] },
  55: { id: 55, name: 'npc_dota_hero_dark_seer', cleanName: 'dark_seer', localizedName: 'Dark Seer', primaryAttr: 'all', roles: ['Initiator', 'Escape', 'Disabler'] },
  56: { id: 56, name: 'npc_dota_hero_clinkz', cleanName: 'clinkz', localizedName: 'Clinkz', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Nuker'] },
  57: { id: 57, name: 'npc_dota_hero_omniknight', cleanName: 'omniknight', localizedName: 'Omniknight', primaryAttr: 'str', roles: ['Support', 'Durable', 'Nuker'] },
  58: { id: 58, name: 'npc_dota_hero_enchantress', cleanName: 'enchantress', localizedName: 'Enchantress', primaryAttr: 'int', roles: ['Support', 'Pusher', 'Durable', 'Disabler'] },
  59: { id: 59, name: 'npc_dota_hero_huskar', cleanName: 'huskar', localizedName: 'Huskar', primaryAttr: 'str', roles: ['Carry', 'Durable', 'Initiator'] },
  60: { id: 60, name: 'npc_dota_hero_night_stalker', cleanName: 'night_stalker', localizedName: 'Night Stalker', primaryAttr: 'str', roles: ['Carry', 'Initiator', 'Durable', 'Disabler', 'Nuker'] },
  61: { id: 61, name: 'npc_dota_hero_broodmother', cleanName: 'broodmother', localizedName: 'Broodmother', primaryAttr: 'all', roles: ['Carry', 'Pusher', 'Escape', 'Nuker'] },
  62: { id: 62, name: 'npc_dota_hero_bounty_hunter', cleanName: 'bounty_hunter', localizedName: 'Bounty Hunter', primaryAttr: 'agi', roles: ['Escape', 'Nuker'] },
  63: { id: 63, name: 'npc_dota_hero_weaver', cleanName: 'weaver', localizedName: 'Weaver', primaryAttr: 'agi', roles: ['Carry', 'Escape'] },
  64: { id: 64, name: 'npc_dota_hero_jakiro', cleanName: 'jakiro', localizedName: 'Jakiro', primaryAttr: 'int', roles: ['Support', 'Nuker', 'Pusher', 'Disabler'] },
  65: { id: 65, name: 'npc_dota_hero_batrider', cleanName: 'batrider', localizedName: 'Batrider', primaryAttr: 'all', roles: ['Initiator', 'Disabler', 'Escape'] },
  66: { id: 66, name: 'npc_dota_hero_chen', cleanName: 'chen', localizedName: 'Chen', primaryAttr: 'all', roles: ['Support', 'Pusher'] },
  67: { id: 67, name: 'npc_dota_hero_spectre', cleanName: 'spectre', localizedName: 'Spectre', primaryAttr: 'agi', roles: ['Carry', 'Durable', 'Escape'] },
  68: { id: 68, name: 'npc_dota_hero_ancient_apparition', cleanName: 'ancient_apparition', localizedName: 'Ancient Apparition', primaryAttr: 'int', roles: ['Support', 'Disabler', 'Nuker'] },
  69: { id: 69, name: 'npc_dota_hero_doom_bringer', cleanName: 'doom_bringer', localizedName: 'Doom', primaryAttr: 'str', roles: ['Carry', 'Disabler', 'Initiator', 'Durable', 'Nuker'] },
  70: { id: 70, name: 'npc_dota_hero_ursa', cleanName: 'ursa', localizedName: 'Ursa', primaryAttr: 'agi', roles: ['Carry', 'Durable', 'Disabler'] },
  71: { id: 71, name: 'npc_dota_hero_spirit_breaker', cleanName: 'spirit_breaker', localizedName: 'Spirit Breaker', primaryAttr: 'str', roles: ['Initiator', 'Disabler', 'Durable', 'Escape'] },
  72: { id: 72, name: 'npc_dota_hero_gyrocopter', cleanName: 'gyrocopter', localizedName: 'Gyrocopter', primaryAttr: 'agi', roles: ['Carry', 'Nuker', 'Disabler'] },
  73: { id: 73, name: 'npc_dota_hero_alchemist', cleanName: 'alchemist', localizedName: 'Alchemist', primaryAttr: 'str', roles: ['Carry', 'Support', 'Durable', 'Disabler', 'Nuker'] },
  74: { id: 74, name: 'npc_dota_hero_invoker', cleanName: 'invoker', localizedName: 'Invoker', primaryAttr: 'all', roles: ['Carry', 'Nuker', 'Disabler', 'Escape', 'Pusher'] },
  75: { id: 75, name: 'npc_dota_hero_silencer', cleanName: 'silencer', localizedName: 'Silencer', primaryAttr: 'int', roles: ['Carry', 'Support', 'Disabler', 'Nuker'] },
  76: { id: 76, name: 'npc_dota_hero_obsidian_destroyer', cleanName: 'obsidian_destroyer', localizedName: 'Outworld Destroyer', primaryAttr: 'int', roles: ['Carry', 'Nuker', 'Disabler'] },
  77: { id: 77, name: 'npc_dota_hero_lycan', cleanName: 'lycan', localizedName: 'Lycan', primaryAttr: 'all', roles: ['Carry', 'Pusher', 'Durable', 'Escape'] },
  78: { id: 78, name: 'npc_dota_hero_brewmaster', cleanName: 'brewmaster', localizedName: 'Brewmaster', primaryAttr: 'all', roles: ['Carry', 'Initiator', 'Durable', 'Disabler', 'Nuker'] },
  79: { id: 79, name: 'npc_dota_hero_shadow_demon', cleanName: 'shadow_demon', localizedName: 'Shadow Demon', primaryAttr: 'int', roles: ['Support', 'Disabler', 'Nuker'] },
  80: { id: 80, name: 'npc_dota_hero_lone_druid', cleanName: 'lone_druid', localizedName: 'Lone Druid', primaryAttr: 'all', roles: ['Carry', 'Pusher', 'Durable'] },
  81: { id: 81, name: 'npc_dota_hero_chaos_knight', cleanName: 'chaos_knight', localizedName: 'Chaos Knight', primaryAttr: 'str', roles: ['Carry', 'Disabler', 'Durable', 'Pusher', 'Initiator'] },
  82: { id: 82, name: 'npc_dota_hero_meepo', cleanName: 'meepo', localizedName: 'Meepo', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Nuker', 'Disabler', 'Initiator', 'Pusher'] },
  83: { id: 83, name: 'npc_dota_hero_treant', cleanName: 'treant', localizedName: 'Treant Protector', primaryAttr: 'str', roles: ['Support', 'Initiator', 'Durable', 'Disabler', 'Escape'] },
  84: { id: 84, name: 'npc_dota_hero_ogre_magi', cleanName: 'ogre_magi', localizedName: 'Ogre Magi', primaryAttr: 'str', roles: ['Support', 'Nuker', 'Disabler', 'Durable', 'Initiator'] },
  85: { id: 85, name: 'npc_dota_hero_undying', cleanName: 'undying', localizedName: 'Undying', primaryAttr: 'str', roles: ['Support', 'Durable', 'Disabler', 'Nuker'] },
  86: { id: 86, name: 'npc_dota_hero_rubick', cleanName: 'rubick', localizedName: 'Rubick', primaryAttr: 'int', roles: ['Support', 'Disabler', 'Nuker'] },
  87: { id: 87, name: 'npc_dota_hero_disruptor', cleanName: 'disruptor', localizedName: 'Disruptor', primaryAttr: 'int', roles: ['Support', 'Disabler', 'Nuker', 'Initiator'] },
  88: { id: 88, name: 'npc_dota_hero_nyx_assassin', cleanName: 'nyx_assassin', localizedName: 'Nyx Assassin', primaryAttr: 'all', roles: ['Disabler', 'Nuker', 'Initiator', 'Escape'] },
  89: { id: 89, name: 'npc_dota_hero_naga_siren', cleanName: 'naga_siren', localizedName: 'Naga Siren', primaryAttr: 'agi', roles: ['Carry', 'Support', 'Pusher', 'Disabler', 'Initiator', 'Escape'] },
  90: { id: 90, name: 'npc_dota_hero_keeper_of_the_light', cleanName: 'keeper_of_the_light', localizedName: 'Keeper of the Light', primaryAttr: 'int', roles: ['Support', 'Nuker', 'Disabler'] },
  91: { id: 91, name: 'npc_dota_hero_wisp', cleanName: 'wisp', localizedName: 'Io', primaryAttr: 'all', roles: ['Support', 'Escape', 'Nuker'] },
  92: { id: 92, name: 'npc_dota_hero_visage', cleanName: 'visage', localizedName: 'Visage', primaryAttr: 'all', roles: ['Support', 'Nuker', 'Durable', 'Disabler', 'Pusher'] },
  93: { id: 93, name: 'npc_dota_hero_slark', cleanName: 'slark', localizedName: 'Slark', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Disabler', 'Nuker'] },
  94: { id: 94, name: 'npc_dota_hero_medusa', cleanName: 'medusa', localizedName: 'Medusa', primaryAttr: 'agi', roles: ['Carry', 'Disabler', 'Durable'] },
  95: { id: 95, name: 'npc_dota_hero_troll_warlord', cleanName: 'troll_warlord', localizedName: 'Troll Warlord', primaryAttr: 'agi', roles: ['Carry', 'Pusher', 'Disabler', 'Durable'] },
  96: { id: 96, name: 'npc_dota_hero_centaur', cleanName: 'centaur', localizedName: 'Centaur Warrunner', primaryAttr: 'str', roles: ['Durable', 'Initiator', 'Disabler', 'Nuker'] },
  97: { id: 97, name: 'npc_dota_hero_magnataur', cleanName: 'magnataur', localizedName: 'Magnus', primaryAttr: 'all', roles: ['Initiator', 'Disabler', 'Nuker', 'Escape'] },
  98: { id: 98, name: 'npc_dota_hero_shredder', cleanName: 'timbersaw', localizedName: 'Timbersaw', primaryAttr: 'all', roles: ['Nuker', 'Durable', 'Escape'] },
  99: { id: 99, name: 'npc_dota_hero_bristleback', cleanName: 'bristleback', localizedName: 'Bristleback', primaryAttr: 'str', roles: ['Carry', 'Durable', 'Initiator', 'Nuker'] },
  100: { id: 100, name: 'npc_dota_hero_tusk', cleanName: 'tusk', localizedName: 'Tusk', primaryAttr: 'str', roles: ['Initiator', 'Disabler', 'Nuker'] },
  101: { id: 101, name: 'npc_dota_hero_skywrath_mage', cleanName: 'skywrath_mage', localizedName: 'Skywrath Mage', primaryAttr: 'int', roles: ['Support', 'Nuker', 'Disabler'] },
  102: { id: 102, name: 'npc_dota_hero_abaddon', cleanName: 'abaddon', localizedName: 'Abaddon', primaryAttr: 'all', roles: ['Support', 'Carry', 'Durable'] },
  103: { id: 103, name: 'npc_dota_hero_elder_titan', cleanName: 'elder_titan', localizedName: 'Elder Titan', primaryAttr: 'str', roles: ['Initiator', 'Disabler', 'Nuker', 'Durable'] },
  104: { id: 104, name: 'npc_dota_hero_legion_commander', cleanName: 'legion_commander', localizedName: 'Legion Commander', primaryAttr: 'str', roles: ['Carry', 'Disabler', 'Initiator', 'Durable', 'Nuker'] },
  105: { id: 105, name: 'npc_dota_hero_techies', cleanName: 'techies', localizedName: 'Techies', primaryAttr: 'all', roles: ['Nuker', 'Disabler'] },
  106: { id: 106, name: 'npc_dota_hero_ember_spirit', cleanName: 'ember_spirit', localizedName: 'Ember Spirit', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Nuker', 'Disabler', 'Initiator'] },
  107: { id: 107, name: 'npc_dota_hero_earth_spirit', cleanName: 'earth_spirit', localizedName: 'Earth Spirit', primaryAttr: 'str', roles: ['Nuker', 'Escape', 'Disabler', 'Initiator', 'Durable'] },
  108: { id: 108, name: 'npc_dota_hero_abyssal_underlord', cleanName: 'underlord', localizedName: 'Underlord', primaryAttr: 'str', roles: ['Support', 'Nuker', 'Durable', 'Disabler', 'Escape'] },
  109: { id: 109, name: 'npc_dota_hero_terrorblade', cleanName: 'terrorblade', localizedName: 'Terrorblade', primaryAttr: 'agi', roles: ['Carry', 'Pusher', 'Nuker'] },
  110: { id: 110, name: 'npc_dota_hero_phoenix', cleanName: 'phoenix', localizedName: 'Phoenix', primaryAttr: 'all', roles: ['Support', 'Nuker', 'Initiator', 'Escape', 'Disabler'] },
  111: { id: 111, name: 'npc_dota_hero_oracle', cleanName: 'oracle', localizedName: 'Oracle', primaryAttr: 'int', roles: ['Support', 'Nuker', 'Disabler', 'Escape'] },
  112: { id: 112, name: 'npc_dota_hero_winter_wyvern', cleanName: 'winter_wyvern', localizedName: 'Winter Wyvern', primaryAttr: 'all', roles: ['Support', 'Disabler', 'Nuker'] },
  113: { id: 113, name: 'npc_dota_hero_arc_warden', cleanName: 'arc_warden', localizedName: 'Arc Warden', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Nuker'] },
  114: { id: 114, name: 'npc_dota_hero_monkey_king', cleanName: 'monkey_king', localizedName: 'Monkey King', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Disabler', 'Initiator'] },
  119: { id: 119, name: 'npc_dota_hero_dark_willow', cleanName: 'dark_willow', localizedName: 'Dark Willow', primaryAttr: 'all', roles: ['Support', 'Nuker', 'Disabler', 'Escape'] },
  120: { id: 120, name: 'npc_dota_hero_pangolier', cleanName: 'pangolier', localizedName: 'Pangolier', primaryAttr: 'all', roles: ['Carry', 'Nuker', 'Disabler', 'Durable', 'Escape', 'Initiator'] },
  121: { id: 121, name: 'npc_dota_hero_grimstroke', cleanName: 'grimstroke', localizedName: 'Grimstroke', primaryAttr: 'int', roles: ['Support', 'Nuker', 'Disabler', 'Escape'] },
  123: { id: 123, name: 'npc_dota_hero_hoodwink', cleanName: 'hoodwink', localizedName: 'Hoodwink', primaryAttr: 'agi', roles: ['Support', 'Nuker', 'Escape', 'Disabler'] },
  126: { id: 126, name: 'npc_dota_hero_void_spirit', cleanName: 'void_spirit', localizedName: 'Void Spirit', primaryAttr: 'all', roles: ['Carry', 'Escape', 'Nuker', 'Disabler'] },
  128: { id: 128, name: 'npc_dota_hero_snapfire', cleanName: 'snapfire', localizedName: 'Snapfire', primaryAttr: 'all', roles: ['Support', 'Nuker', 'Disabler', 'Escape'] },
  129: { id: 129, name: 'npc_dota_hero_mars', cleanName: 'mars', localizedName: 'Mars', primaryAttr: 'str', roles: ['Initiator', 'Durable', 'Disabler', 'Nuker'] },
  135: { id: 135, name: 'npc_dota_hero_dawnbreaker', cleanName: 'dawnbreaker', localizedName: 'Dawnbreaker', primaryAttr: 'str', roles: ['Carry', 'Durable', 'Initiator'] },
  136: { id: 136, name: 'npc_dota_hero_marci', cleanName: 'marci', localizedName: 'Marci', primaryAttr: 'all', roles: ['Support', 'Carry', 'Initiator', 'Disabler', 'Escape'] },
  137: { id: 137, name: 'npc_dota_hero_primal_beast', cleanName: 'primal_beast', localizedName: 'Primal Beast', primaryAttr: 'str', roles: ['Initiator', 'Durable', 'Disabler'] },
  138: { id: 138, name: 'npc_dota_hero_muerta', cleanName: 'muerta', localizedName: 'Muerta', primaryAttr: 'int', roles: ['Carry', 'Nuker', 'Disabler'] },
  145: { id: 145, name: 'npc_dota_hero_kez', cleanName: 'kez', localizedName: 'Kez', primaryAttr: 'agi', roles: ['Carry', 'Escape', 'Disabler'] }
};

// Common Dota Items Mapping (Valve CDN filenames)
export const DOTA_ITEMS_MAP: Record<number | string, { name: string; cleanName: string; localizedName: string; cost?: number }> = {
  1: { name: 'blink', cleanName: 'blink', localizedName: 'Blink Dagger', cost: 2250 },
  2: { name: 'blades_of_attack', cleanName: 'blades_of_attack', localizedName: 'Blades of Attack', cost: 450 },
  3: { name: 'broadsword', cleanName: 'broadsword', localizedName: 'Broadsword', cost: 1000 },
  4: { name: 'chainmail', cleanName: 'chainmail', localizedName: 'Chainmail', cost: 550 },
  5: { name: 'claymore', cleanName: 'claymore', localizedName: 'Claymore', cost: 1350 },
  6: { name: 'helm_of_iron_will', cleanName: 'helm_of_iron_will', localizedName: 'Helm of Iron Will', cost: 975 },
  7: { name: 'javelin', cleanName: 'javelin', localizedName: 'Javelin', cost: 900 },
  8: { name: 'mithril_hammer', cleanName: 'mithril_hammer', localizedName: 'Mithril Hammer', cost: 1600 },
  9: { name: 'platemail', cleanName: 'platemail', localizedName: 'Platemail', cost: 1400 },
  10: { name: 'quarterstaff', cleanName: 'quarterstaff', localizedName: 'Quarterstaff', cost: 875 },
  11: { name: 'quelling_blade', cleanName: 'quelling_blade', localizedName: 'Quelling Blade', cost: 100 },
  12: { name: 'ring_of_protection', cleanName: 'ring_of_protection', localizedName: 'Ring of Protection', cost: 175 },
  13: { name: 'gauntlets', cleanName: 'gauntlets', localizedName: 'Gauntlets of Strength', cost: 140 },
  14: { name: 'slippers', cleanName: 'slippers', localizedName: 'Slippers of Agility', cost: 140 },
  15: { name: 'mantle', cleanName: 'mantle', localizedName: 'Mantle of Intelligence', cost: 140 },
  16: { name: 'magic_wand', cleanName: 'magic_wand', localizedName: 'Magic Wand', cost: 450 },
  17: { name: 'circlet', cleanName: 'circlet', localizedName: 'Circlet', cost: 155 },
  18: { name: 'belt_of_strength', cleanName: 'belt_of_strength', localizedName: 'Belt of Strength', cost: 450 },
  19: { name: 'boots_of_elves', cleanName: 'boots_of_elves', localizedName: 'Band of Elvenskin', cost: 450 },
  20: { name: 'robe', cleanName: 'robe', localizedName: 'Robe of the Magi', cost: 450 },
  21: { name: 'ogre_axe', cleanName: 'ogre_axe', localizedName: 'Ogre Axe', cost: 1000 },
  22: { name: 'blade_of_alacrity', cleanName: 'blade_of_alacrity', localizedName: 'Blade of Alacrity', cost: 1000 },
  23: { name: 'staff_of_wizardry', cleanName: 'staff_of_wizardry', localizedName: 'Staff of Wizardry', cost: 1000 },
  24: { name: 'ultimate_orb', cleanName: 'ultimate_orb', localizedName: 'Ultimate Orb', cost: 2050 },
  25: { name: 'gloves', cleanName: 'gloves', localizedName: 'Gloves of Haste', cost: 450 },
  26: { name: 'lifesteal', cleanName: 'lifesteal', localizedName: 'Morbid Mask', cost: 900 },
  27: { name: 'ring_of_regen', cleanName: 'ring_of_regen', localizedName: 'Ring of Regen', cost: 175 },
  28: { name: 'sobi_mask', cleanName: 'sobi_mask', localizedName: "Sage's Mask", cost: 175 },
  29: { name: 'boots', cleanName: 'boots', localizedName: 'Boots of Speed', cost: 500 },
  30: { name: 'gem', cleanName: 'gem', localizedName: 'Gem of True Sight', cost: 900 },
  31: { name: 'cloak', cleanName: 'cloak', localizedName: 'Cloak', cost: 800 },
  32: { name: 'talisman_of_evasion', cleanName: 'talisman_of_evasion', localizedName: 'Talisman of Evasion', cost: 1300 },
  33: { name: 'cheese', cleanName: 'cheese', localizedName: 'Cheese', cost: 1000 },
  34: { name: 'magic_stick', cleanName: 'magic_stick', localizedName: 'Magic Stick', cost: 200 },
  36: { name: 'magic_stick', cleanName: 'magic_stick', localizedName: 'Magic Stick', cost: 200 },
  38: { name: 'clarity', cleanName: 'clarity', localizedName: 'Clarity', cost: 50 },
  39: { name: 'flask', cleanName: 'flask', localizedName: 'Healing Salve', cost: 100 },
  40: { name: 'dust', cleanName: 'dust', localizedName: 'Dust of Appearance', cost: 80 },
  41: { name: 'bottle', cleanName: 'bottle', localizedName: 'Bottle', cost: 675 },
  42: { name: 'ward_observer', cleanName: 'ward_observer', localizedName: 'Observer Ward', cost: 0 },
  43: { name: 'ward_sentry', cleanName: 'ward_sentry', localizedName: 'Sentry Ward', cost: 50 },
  44: { name: 'tango', cleanName: 'tango', localizedName: 'Tango', cost: 90 },
  45: { name: 'courier', cleanName: 'courier', localizedName: 'Animal Courier', cost: 50 },
  46: { name: 'tpscroll', cleanName: 'tpscroll', localizedName: 'Town Portal Scroll', cost: 100 },
  48: { name: 'travel_boots', cleanName: 'travel_boots', localizedName: 'Boots of Travel', cost: 2500 },
  50: { name: 'phase_boots', cleanName: 'phase_boots', localizedName: 'Phase Boots', cost: 1500 },
  51: { name: 'demon_edge', cleanName: 'demon_edge', localizedName: 'Demon Edge', cost: 2200 },
  52: { name: 'eaglesong', cleanName: 'eaglesong', localizedName: 'Eaglesong', cost: 2800 },
  53: { name: 'reaver', cleanName: 'reaver', localizedName: 'Reaver', cost: 2800 },
  54: { name: 'relic', cleanName: 'relic', localizedName: 'Sacred Relic', cost: 3400 },
  55: { name: 'hyperstone', cleanName: 'hyperstone', localizedName: 'Hyperstone', cost: 2000 },
  56: { name: 'ring_of_health', cleanName: 'ring_of_health', localizedName: 'Ring of Health', cost: 700 },
  57: { name: 'void_stone', cleanName: 'void_stone', localizedName: 'Void Stone', cost: 700 },
  58: { name: 'mystic_staff', cleanName: 'mystic_staff', localizedName: 'Mystic Staff', cost: 2700 },
  59: { name: 'energy_booster', cleanName: 'energy_booster', localizedName: 'Energy Booster', cost: 800 },
  60: { name: 'point_booster', cleanName: 'point_booster', localizedName: 'Point Booster', cost: 1200 },
  61: { name: 'vitality_booster', cleanName: 'vitality_booster', localizedName: 'Vitality Booster', cost: 1000 },
  63: { name: 'power_treads', cleanName: 'power_treads', localizedName: 'Power Treads', cost: 1400 },
  65: { name: 'hand_of_midas', cleanName: 'hand_of_midas', localizedName: 'Hand of Midas', cost: 2200 },
  69: { name: 'oblivion_staff', cleanName: 'oblivion_staff', localizedName: 'Oblivion Staff', cost: 1500 },
  73: { name: 'bracer', cleanName: 'bracer', localizedName: 'Bracer', cost: 505 },
  75: { name: 'wraith_band', cleanName: 'wraith_band', localizedName: 'Wraith Band', cost: 505 },
  77: { name: 'null_talisman', cleanName: 'null_talisman', localizedName: 'Null Talisman', cost: 505 },
  79: { name: 'mekansm', cleanName: 'mekansm', localizedName: 'Mekansm', cost: 1775 },
  81: { name: 'vladmir', cleanName: 'vladmir', localizedName: "Vladmir's Offering", cost: 2450 },
  86: { name: 'buckler', cleanName: 'buckler', localizedName: 'Buckler', cost: 425 },
  90: { name: 'pipe', cleanName: 'pipe', localizedName: 'Pipe of Insight', cost: 3375 },
  92: { name: 'urn_of_shadows', cleanName: 'urn_of_shadows', localizedName: 'Urn of Shadows', cost: 880 },
  96: { name: 'headdress', cleanName: 'headdress', localizedName: 'Headdress', cost: 425 },
  98: { name: 'sheepstick', cleanName: 'sheepstick', localizedName: 'Scythe of Vyse', cost: 5550 },
  100: { name: 'orchid', cleanName: 'orchid', localizedName: 'Orchid Malevolence', cost: 3475 },
  102: { name: 'cyclone', cleanName: 'cyclone', localizedName: "Eul's Scepter of Divinity", cost: 2625 },
  104: { name: 'force_staff', cleanName: 'force_staff', localizedName: 'Force Staff', cost: 2200 },
  106: { name: 'dagon', cleanName: 'dagon', localizedName: 'Dagon', cost: 2850 },
  108: { name: 'ultimate_scepter', cleanName: 'ultimate_scepter', localizedName: "Aghanim's Scepter", cost: 4200 },
  110: { name: 'refresher', cleanName: 'refresher', localizedName: 'Refresher Orb', cost: 5000 },
  112: { name: 'assault', cleanName: 'assault', localizedName: 'Assault Cuirass', cost: 5125 },
  114: { name: 'heart', cleanName: 'heart', localizedName: 'Heart of Tarrasque', cost: 5000 },
  116: { name: 'black_king_bar', cleanName: 'black_king_bar', localizedName: 'Black King Bar', cost: 4050 },
  118: { name: 'aegis', cleanName: 'aegis', localizedName: 'Aegis of the Immortal', cost: 0 },
  121: { name: 'shivas_guard', cleanName: 'shivas_guard', localizedName: "Shiva's Guard", cost: 4825 },
  123: { name: 'bloodstone', cleanName: 'bloodstone', localizedName: 'Bloodstone', cost: 4400 },
  125: { name: 'sphere', cleanName: 'sphere', localizedName: "Linken's Sphere", cost: 4600 },
  127: { name: 'vanguard', cleanName: 'vanguard', localizedName: 'Vanguard', cost: 1700 },
  131: { name: 'blade_mail', cleanName: 'blade_mail', localizedName: 'Blade Mail', cost: 2100 },
  135: { name: 'monkey_king_bar', cleanName: 'monkey_king_bar', localizedName: 'Monkey King Bar', cost: 4900 },
  137: { name: 'radiance', cleanName: 'radiance', localizedName: 'Radiance', cost: 4700 },
  139: { name: 'butterfly', cleanName: 'butterfly', localizedName: 'Butterfly', cost: 4975 },
  141: { name: 'greater_crit', cleanName: 'greater_crit', localizedName: 'Daedalus', cost: 5100 },
  143: { name: 'basher', cleanName: 'basher', localizedName: 'Skull Basher', cost: 2875 },
  145: { name: 'bfury', cleanName: 'bfury', localizedName: 'Battle Fury', cost: 4100 },
  147: { name: 'manta', cleanName: 'manta', localizedName: 'Manta Style', cost: 4600 },
  149: { name: 'lesser_crit', cleanName: 'lesser_crit', localizedName: 'Crystalys', cost: 1950 },
  151: { name: 'armlet', cleanName: 'armlet', localizedName: 'Armlet of Mordiggian', cost: 2500 },
  152: { name: 'invis_sword', cleanName: 'invis_sword', localizedName: 'Shadow Blade', cost: 3000 },
  154: { name: 'sange_and_yasha', cleanName: 'sange_and_yasha', localizedName: 'Sange and Yasha', cost: 4100 },
  156: { name: 'satanic', cleanName: 'satanic', localizedName: 'Satanic', cost: 5050 },
  158: { name: 'mjollnir', cleanName: 'mjollnir', localizedName: 'Mjollnir', cost: 5500 },
  160: { name: 'skadi', cleanName: 'skadi', localizedName: 'Eye of Skadi', cost: 5300 },
  162: { name: 'sange', cleanName: 'sange', localizedName: 'Sange', cost: 2050 },
  164: { name: 'helm_of_the_dominator', cleanName: 'helm_of_the_dominator', localizedName: 'Helm of the Dominator', cost: 2625 },
  166: { name: 'maelstrom', cleanName: 'maelstrom', localizedName: 'Maelstrom', cost: 2700 },
  168: { name: 'desolator', cleanName: 'desolator', localizedName: 'Desolator', cost: 3500 },
  170: { name: 'yasha', cleanName: 'yasha', localizedName: 'Yasha', cost: 2050 },
  172: { name: 'mask_of_madness', cleanName: 'mask_of_madness', localizedName: 'Mask of Madness', cost: 1775 },
  174: { name: 'diffusal_blade', cleanName: 'diffusal_blade', localizedName: 'Diffusal Blade', cost: 2500 },
  176: { name: 'ethereal_blade', cleanName: 'ethereal_blade', localizedName: 'Ethereal Blade', cost: 4650 },
  177: { name: 'wind_lace', cleanName: 'wind_lace', localizedName: 'Wind Lace', cost: 250 },
  178: { name: 'soul_ring', cleanName: 'soul_ring', localizedName: 'Soul Ring', cost: 850 },
  180: { name: 'arcane_boots', cleanName: 'arcane_boots', localizedName: 'Arcane Boots', cost: 1300 },
  181: { name: 'orb_of_venom', cleanName: 'orb_of_venom', localizedName: 'Orb of Venom', cost: 275 },
  185: { name: 'ancient_janggo', cleanName: 'ancient_janggo', localizedName: 'Drum of Endurance', cost: 1650 },
  188: { name: 'smoke_of_deceit', cleanName: 'smoke_of_deceit', localizedName: 'Smoke of Deceit', cost: 50 },
  190: { name: 'veil_of_discord', cleanName: 'veil_of_discord', localizedName: 'Veil of Discord', cost: 1525 },
  206: { name: 'rod_of_atos', cleanName: 'rod_of_atos', localizedName: 'Rod of Atos', cost: 2750 },
  208: { name: 'abyssal_blade', cleanName: 'abyssal_blade', localizedName: 'Abyssal Blade', cost: 6250 },
  210: { name: 'heavens_halberd', cleanName: 'heavens_halberd', localizedName: "Heaven's Halberd", cost: 3550 },
  214: { name: 'tranquil_boots', cleanName: 'tranquil_boots', localizedName: 'Tranquil Boots', cost: 925 },
  216: { name: 'enchanted_mango', cleanName: 'enchanted_mango', localizedName: 'Enchanted Mango', cost: 65 },
  218: { name: 'ward_dispenser', cleanName: 'ward_dispenser', localizedName: 'Observer and Sentry Wards', cost: 50 },
  220: { name: 'medallion_of_courage', cleanName: 'medallion_of_courage', localizedName: 'Medallion of Courage', cost: 1025 },
  223: { name: 'meteor_hammer', cleanName: 'meteor_hammer', localizedName: 'Meteor Hammer', cost: 2850 },
  225: { name: 'nullifier', cleanName: 'nullifier', localizedName: 'Nullifier', cost: 4375 },
  226: { name: 'lotus_orb', cleanName: 'lotus_orb', localizedName: 'Lotus Orb', cost: 3850 },
  229: { name: 'solar_crest', cleanName: 'solar_crest', localizedName: 'Solar Crest', cost: 2700 },
  231: { name: 'guardian_greaves', cleanName: 'guardian_greaves', localizedName: 'Guardian Greaves', cost: 4950 },
  232: { name: 'aether_lens', cleanName: 'aether_lens', localizedName: 'Aether Lens', cost: 2275 },
  235: { name: 'octarine_core', cleanName: 'octarine_core', localizedName: 'Octarine Core', cost: 4800 },
  236: { name: 'dragon_lance', cleanName: 'dragon_lance', localizedName: 'Dragon Lance', cost: 1900 },
  240: { name: 'blight_stone', cleanName: 'blight_stone', localizedName: 'Blight Stone', cost: 300 },
  242: { name: 'crimson_guard', cleanName: 'crimson_guard', localizedName: 'Crimson Guard', cost: 3725 },
  247: { name: 'moon_shard', cleanName: 'moon_shard', localizedName: 'Moon Shard', cost: 4000 },
  249: { name: 'silver_edge', cleanName: 'silver_edge', localizedName: 'Silver Edge', cost: 5450 },
  250: { name: 'bloodthorn', cleanName: 'bloodthorn', localizedName: 'Bloodthorn', cost: 6800 },
  252: { name: 'echo_sabre', cleanName: 'echo_sabre', localizedName: 'Echo Sabre', cost: 2500 },
  254: { name: 'glimmer_cape', cleanName: 'glimmer_cape', localizedName: 'Glimmer Cape', cost: 2150 },
  263: { name: 'hurricane_pike', cleanName: 'hurricane_pike', localizedName: 'Hurricane Pike', cost: 4450 },
  265: { name: 'infused_raindrop', cleanName: 'infused_raindrop', localizedName: 'Infused Raindrop', cost: 225 },
  267: { name: 'spirit_vessel', cleanName: 'spirit_vessel', localizedName: 'Spirit Vessel', cost: 2780 },
  269: { name: 'holy_locket', cleanName: 'holy_locket', localizedName: 'Holy Locket', cost: 2350 },
  271: { name: 'kaya', cleanName: 'kaya', localizedName: 'Kaya', cost: 2050 },
  273: { name: 'yasha_and_kaya', cleanName: 'yasha_and_kaya', localizedName: 'Yasha and Kaya', cost: 4100 },
  277: { name: 'kaya_and_sange', cleanName: 'kaya_and_sange', localizedName: 'Kaya and Sange', cost: 4100 },
  600: { name: 'overwhelming_blink', cleanName: 'overwhelming_blink', localizedName: 'Overwhelming Blink', cost: 6800 },
  603: { name: 'swift_blink', cleanName: 'swift_blink', localizedName: 'Swift Blink', cost: 6800 },
  604: { name: 'arcane_blink', cleanName: 'arcane_blink', localizedName: 'Arcane Blink', cost: 6800 },
  609: { name: 'aghanims_shard', cleanName: 'aghanims_shard', localizedName: "Aghanim's Shard", cost: 1400 },
  653: { name: 'wind_waker', cleanName: 'wind_waker', localizedName: 'Wind Waker', cost: 6825 },
  1096: { name: 'disperser', cleanName: 'disperser', localizedName: 'Disperser', cost: 5700 },
  1097: { name: 'harpoon', cleanName: 'harpoon', localizedName: 'Harpoon', cost: 4500 },
  1098: { name: 'phylactery', cleanName: 'phylactery', localizedName: 'Phylactery', cost: 2400 },
  1099: { name: 'khanda', cleanName: 'khanda', localizedName: 'Khanda', cost: 5000 },
  1100: { name: 'parasma', cleanName: 'parasma', localizedName: 'Parasma', cost: 5575 }
};

// Common Neutral Items
export const DOTA_NEUTRAL_ITEMS: Record<string, { localizedName: string; tier: number }> = {
  seeds_of_serenity: { localizedName: 'Seeds of Serenity', tier: 1 },
  arcane_ring: { localizedName: 'Arcane Ring', tier: 1 },
  occult_bracelet: { localizedName: 'Occult Bracelet', tier: 1 },
  broom_handle: { localizedName: 'Broom Handle', tier: 1 },
  trusty_shovel: { localizedName: 'Trusty Shovel', tier: 1 },
  safety_bubble: { localizedName: 'Safety Bubble', tier: 1 },
  royal_jelly: { localizedName: 'Royal Jelly', tier: 1 },
  spark_of_courage: { localizedName: 'Spark of Courage', tier: 1 },
  philosophers_stone: { localizedName: "Philosopher's Stone", tier: 2 },
  bullwhip: { localizedName: 'Bullwhip', tier: 2 },
  pupils_gift: { localizedName: "Pupil's Gift", tier: 2 },
  vambrace: { localizedName: 'Vambrace', tier: 2 },
  specialists_array: { localizedName: "Specialist's Array", tier: 2 },
  gossamer_cape: { localizedName: 'Gossamer Cape', tier: 2 },
  eye_of_the_vizier: { localizedName: 'Eye of the Vizier', tier: 2 },
  ceremonial_robe: { localizedName: 'Ceremonial Robe', tier: 3 },
  elven_tunic: { localizedName: 'Elven Tunic', tier: 3 },
  paladin_sword: { localizedName: 'Paladin Sword', tier: 3 },
  mind_breaker: { localizedName: 'Mind Breaker', tier: 3 },
  enchanted_quiver: { localizedName: 'Enchanted Quiver', tier: 3 },
  nemesis_curse: { localizedName: 'Nemesis Curse', tier: 3 },
  defiant_shell: { localizedName: 'Defiant Shell', tier: 3 },
  timeless_relic: { localizedName: 'Timeless Relic', tier: 4 },
  ninja_gear: { localizedName: 'Ninja Gear', tier: 4 },
  spy_gadget: { localizedName: 'Telescope', tier: 4 },
  trickster_cloak: { localizedName: 'Trickster Cloak', tier: 4 },
  stormcrafter: { localizedName: 'Stormcrafter', tier: 4 },
  havoc_hammer: { localizedName: 'Havoc Hammer', tier: 4 },
  apex: { localizedName: 'Apex', tier: 5 },
  mirror_shield: { localizedName: 'Mirror Shield', tier: 5 },
  pirate_hat: { localizedName: 'Pirate Hat', tier: 5 },
  seer_stone: { localizedName: 'Seer Stone', tier: 5 },
  book_of_shadows: { localizedName: 'Book of Shadows', tier: 5 }
};

// =============================================================================
// =============================================================================
// CANONICAL HERO RESOLVERS (Authoritative single-source-of-truth)
// =============================================================================

export const HERO_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="72" viewBox="0 0 128 72"><rect width="100%" height="100%" fill="%23171a21"/><circle cx="64" cy="30" r="14" fill="%233a3f4b"/><path d="M40 60 C40 46 88 46 88 60 Z" fill="%233a3f4b"/><text x="50%" y="68" dominant-baseline="middle" text-anchor="middle" fill="%23777" font-family="monospace" font-size="8">HERO</text></svg>';

export function getHero(heroId: number | string | null | undefined): DotaHeroMeta | null {
  if (heroId === null || heroId === undefined || heroId === '' || heroId === 0 || heroId === '0') {
    return null;
  }
  const numId = Number(heroId);
  if (!isNaN(numId) && DOTA_HEROES_REGISTRY[numId]) {
    return DOTA_HEROES_REGISTRY[numId];
  }
  if (typeof heroId === 'string') {
    const lower = heroId.toLowerCase().trim();
    const found = Object.values(DOTA_HEROES_REGISTRY).find(
      (h) =>
        h.localizedName.toLowerCase() === lower ||
        h.name.replace('npc_dota_hero_', '') === lower ||
        h.cleanName === lower
    );
    if (found) return found;
  }
  return null;
}

export const getHeroById = getHero;

export function getHeroName(heroId: number | string | null | undefined): string {
  const meta = getHero(heroId);
  if (meta) return meta.localizedName;
  return 'Unknown Hero';
}

export function getHeroImage(heroIdOrName: number | string | null | undefined): string {
  const meta = getHero(heroIdOrName);
  if (meta) {
    const valveAsset = meta.name.replace('npc_dota_hero_', '');
    return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${valveAsset}.png`;
  }
  return HERO_PLACEHOLDER_IMAGE;
}

export function getHeroIcon(heroIdOrName: number | string | null | undefined): string {
  const meta = getHero(heroIdOrName);
  if (meta) {
    const valveAsset = meta.name.replace('npc_dota_hero_', '');
    return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${valveAsset}.png`;
  }
  return getHeroImage(heroIdOrName);
}

// Backward-compatibility alias
export function getDotaHeroPortraitUrl(heroIdOrName: number | string): string {
  return getHeroImage(heroIdOrName);
}

// =============================================================================
// CANONICAL ITEM RESOLVERS (Authoritative single-source-of-truth)
// =============================================================================

export function getItem(itemId: number | string | null | undefined): DotaItemMeta | null {
  if (itemId === null || itemId === undefined || itemId === '' || itemId === 0 || itemId === '0') {
    return null;
  }
  const numId = Number(itemId);
  if (!isNaN(numId) && DOTA_ITEMS_MAP[numId]) {
    const it = DOTA_ITEMS_MAP[numId];
    return { id: numId, name: it.name, cleanName: it.cleanName, localizedName: it.localizedName, cost: it.cost };
  }
  if (typeof itemId === 'string') {
    const clean = itemId.toLowerCase().replace(/^item_/, '').replace(/['\s-]/g, '_');
    const neutral = DOTA_NEUTRAL_ITEMS[clean];
    if (neutral) {
      return { id: 0, name: clean, cleanName: clean, localizedName: neutral.localizedName, isNeutral: true, tier: neutral.tier };
    }
    const found = Object.entries(DOTA_ITEMS_MAP).find(
      ([_, v]) => v.cleanName === clean || v.name === clean || v.localizedName.toLowerCase() === itemId.toLowerCase()
    );
    if (found) {
      return { id: Number(found[0]), name: found[1].name, cleanName: found[1].cleanName, localizedName: found[1].localizedName, cost: found[1].cost };
    }
  }
  return null;
}

export const getItemById = getItem;

export function getItemName(itemId: number | string | null | undefined): string {
  if (itemId === null || itemId === undefined || itemId === '' || itemId === 0 || itemId === '0') {
    return 'Empty Slot';
  }
  const meta = getItem(itemId);
  if (meta) return meta.localizedName;
  if (typeof itemId === 'string') {
    const clean = itemId.replace(/^item_/, '');
    if (DOTA_NEUTRAL_ITEMS[clean]) return DOTA_NEUTRAL_ITEMS[clean].localizedName;
    return clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return `Unknown Item (${itemId})`;
}

export function getItemImage(itemIdOrName: number | string | null | undefined): string | null {
  if (itemIdOrName === null || itemIdOrName === undefined || itemIdOrName === '' || itemIdOrName === 0 || itemIdOrName === '0') {
    return null;
  }
  const meta = getItem(itemIdOrName);
  if (meta) {
    return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${meta.cleanName}.png`;
  }
  if (typeof itemIdOrName === 'string') {
    const clean = itemIdOrName.toLowerCase().replace(/^item_/, '').replace(/['\s-]/g, '_');
    if (DOTA_NEUTRAL_ITEMS[clean]) {
      return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${clean}.png`;
    }
  }
  return null;
}

export function getItemCost(itemId: number | string | null | undefined): number | null {
  const meta = getItemById(itemId);
  return meta?.cost ?? null;
}

// Backward-compatibility alias
export function getDotaItemIconUrl(itemCodeOrId: string | number): string {
  return getItemImage(itemCodeOrId) || 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blink.png';
}

/**
 * Rank medal metadata and badges
 */
export interface RankTierDetails {
  tierNumber: number;
  tierName: 'Herald' | 'Guardian' | 'Crusader' | 'Archon' | 'Legend' | 'Ancient' | 'Divine' | 'Immortal' | 'Unranked';
  stars: number;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  iconUrl: string;
  starUrl?: string;
  estimatedMmr: number;
}

export function getRankTierDetails(rankTier?: number | null, leaderboardRank?: number | null): RankTierDetails {
  if (!rankTier || rankTier <= 0) {
    return {
      tierNumber: 0,
      tierName: 'Unranked',
      stars: 0,
      label: 'Unranked',
      badgeBg: 'bg-stone-200',
      badgeBorder: 'border-stone-400',
      badgeText: 'text-stone-700',
      iconUrl: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_0.png',
      estimatedMmr: 3000
    };
  }

  const tier = Math.floor(rankTier / 10);
  const stars = rankTier % 10;

  const tierMap: Record<number, {
    name: RankTierDetails['tierName'];
    bg: string;
    border: string;
    text: string;
    baseMmr: number;
  }> = {
    1: { name: 'Herald', bg: 'bg-stone-300', border: 'border-stone-600', text: 'text-stone-900', baseMmr: 500 },
    2: { name: 'Guardian', bg: 'bg-emerald-100', border: 'border-emerald-700', text: 'text-emerald-950', baseMmr: 1200 },
    3: { name: 'Crusader', bg: 'bg-cyan-100', border: 'border-cyan-700', text: 'text-cyan-950', baseMmr: 1900 },
    4: { name: 'Archon', bg: 'bg-blue-100', border: 'border-blue-800', text: 'text-blue-950', baseMmr: 2600 },
    5: { name: 'Legend', bg: 'bg-purple-100', border: 'border-purple-800', text: 'text-purple-950', baseMmr: 3300 },
    6: { name: 'Ancient', bg: 'bg-amber-100', border: 'border-amber-800', text: 'text-amber-950', baseMmr: 4100 },
    7: { name: 'Divine', bg: 'bg-yellow-100', border: 'border-yellow-700', text: 'text-yellow-950', baseMmr: 4900 },
    8: { name: 'Immortal', bg: 'bg-red-100', border: 'border-red-700', text: 'text-red-950', baseMmr: 5700 }
  };

  const meta = tierMap[tier] || tierMap[4];
  const starSuffix = tier < 8 && stars > 0 ? ` [★${stars}]` : '';
  const leaderboardSuffix = tier === 8 && leaderboardRank ? ` #${leaderboardRank}` : '';
  const label = `${meta.name.toUpperCase()}${starSuffix}${leaderboardSuffix}`;

  return {
    tierNumber: tier,
    tierName: meta.name,
    stars,
    label,
    badgeBg: meta.bg,
    badgeBorder: meta.border,
    badgeText: meta.text,
    iconUrl: `https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${tier}.png`,
    starUrl: stars > 0 && tier < 8 ? `https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_${stars}.png` : undefined,
    estimatedMmr: meta.baseMmr + stars * 150
  };
}

export const DOTA_REGIONS: Record<number, string> = {
  1: 'US West',
  2: 'US East',
  3: 'Europe West',
  5: 'Singapore (SE Asia)',
  6: 'Dubai',
  7: 'Australia',
  8: 'Stockholm (Russia)',
  9: 'Europe East',
  11: 'Brazil (South America)',
  12: 'South Africa',
  14: 'Chile',
  15: 'Peru',
  16: 'India',
  19: 'Japan'
};

export const DOTA_PATCHES = ['7.37e', '7.37d', '7.37c', '7.36c', '7.36b', '7.35', '7.34'];

export const DOTA_LANES: Record<number, string> = {
  1: 'Safe Lane',
  2: 'Mid Lane',
  3: 'Offlane',
  4: 'Jungle / Roam'
};
