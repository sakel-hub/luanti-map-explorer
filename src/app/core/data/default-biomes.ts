import { BiomeDefinition } from '../models/biome.model';
import { resolveNodeColor } from './node-colors';

/**
 * Authentic Luanti / Minetest Game Biome Registry
 * Covers lowland/surface (y: 4..48), ocean/shore (y: -112..3), and highland/mountain (y: 48..31000)
 * with exact Heat (0..100) and Humidity (0..100) Voronoi seed points.
 */
export const DEFAULT_LUANTI_BIOMES: BiomeDefinition[] = [
  // ============================================
  // LOWLAND / SURFACE BIOMES (y: 4 to 48)
  // ============================================
  {
    id: 'icesheet',
    name: 'Icesheet',
    game: 'minetest_game',
    heatPoint: 0,
    humidityPoint: 73,
    yMin: -8,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [224, 242, 254],
    hexColor: '#e0f2fe',
    topNode: 'default:snowblock',
    fillerNode: 'default:ice',
    stoneNode: 'default:stone',
    description: 'Frozen glacial plains covered in thick snowblocks and solid glacial ice.'
  },
  {
    id: 'tundra',
    name: 'Tundra',
    game: 'minetest_game',
    heatPoint: 15,
    humidityPoint: 40,
    yMin: 2,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [148, 163, 184],
    hexColor: '#94a3b8',
    topNode: 'default:permafrost_with_stones',
    fillerNode: 'default:permafrost',
    stoneNode: 'default:stone',
    description: 'Cold, treeless permafrost barrens dotted with moss and frost-heaved stones.'
  },
  {
    id: 'taiga',
    name: 'Taiga',
    game: 'minetest_game',
    heatPoint: 25,
    humidityPoint: 70,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [45, 106, 98],
    hexColor: '#2d6a62',
    topNode: 'default:dirt_with_snow',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Subarctic pine forest blanketed in snow with dense conifer needles.'
  },
  {
    id: 'snowy_grassland',
    name: 'Snowy Grassland',
    game: 'minetest_game',
    heatPoint: 20,
    humidityPoint: 35,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [165, 205, 198],
    hexColor: '#a5cdc6',
    topNode: 'default:dirt_with_snow',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Chilly open steppes where hardy grasses push through early frost.'
  },
  {
    id: 'grassland',
    name: 'Grassland',
    game: 'minetest_game',
    heatPoint: 50,
    humidityPoint: 35,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [65, 111, 26],
    hexColor: '#416f1a',
    topNode: 'default:dirt_with_grass',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Temperate rolling meadows rich in wildflowers, flora, and open building terrain.'
  },
  {
    id: 'coniferous_forest',
    name: 'Coniferous Forest',
    game: 'minetest_game',
    heatPoint: 45,
    humidityPoint: 70,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [28, 124, 84],
    hexColor: '#1c7c54',
    topNode: 'default:dirt_with_coniferous_litter',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Cool evergreen pine woodland with fern undergrowth and needle litter.'
  },
  {
    id: 'deciduous_forest',
    name: 'Deciduous Forest',
    game: 'minetest_game',
    heatPoint: 60,
    humidityPoint: 68,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [52, 168, 83],
    hexColor: '#34a853',
    topNode: 'default:dirt_with_grass',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Lush apple and aspen broadleaf woodland with mushrooms and fallen logs.'
  },
  {
    id: 'desert',
    name: 'Desert',
    game: 'minetest_game',
    heatPoint: 92,
    humidityPoint: 16,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [234, 179, 88],
    hexColor: '#eab358',
    topNode: 'default:desert_sand',
    fillerNode: 'default:desert_sand',
    stoneNode: 'default:desert_stone',
    description: 'Hot arid dunes of red-gold desert sand, cacti, and red desert stone.'
  },
  {
    id: 'sandstone_desert',
    name: 'Sandstone Desert',
    game: 'minetest_game',
    heatPoint: 60,
    humidityPoint: 0,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [217, 189, 130],
    hexColor: '#d9bd82',
    topNode: 'default:sand',
    fillerNode: 'default:sandstone',
    stoneNode: 'default:sandstone',
    description: 'Dry layered sandstone plateaus and pale wind-swept sand basins.'
  },
  {
    id: 'cold_desert',
    name: 'Cold Desert',
    game: 'minetest_game',
    heatPoint: 40,
    humidityPoint: 0,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [194, 178, 155],
    hexColor: '#c2b29b',
    topNode: 'default:silver_sand',
    fillerNode: 'default:silver_sand',
    stoneNode: 'default:stone',
    description: 'Crisp, arid silver-sand expanses with dry shrubs and stark rock formations.'
  },
  {
    id: 'savanna',
    name: 'Savanna',
    game: 'minetest_game',
    heatPoint: 89,
    humidityPoint: 42,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [181, 166, 66],
    hexColor: '#b5a642',
    topNode: 'default:dry_dirt_with_dry_grass',
    fillerNode: 'default:dry_dirt',
    stoneNode: 'default:stone',
    description: 'Warm golden grassland scattered with flat-topped acacia trees.'
  },
  {
    id: 'rainforest',
    name: 'Rainforest',
    game: 'minetest_game',
    heatPoint: 86,
    humidityPoint: 65,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [16, 110, 51],
    hexColor: '#106e33',
    topNode: 'default:dirt_with_rainforest_litter',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Dense tropical jungle canopy with towering jungletrees and rich humus.'
  },
  {
    id: 'rainforest_swamp',
    name: 'Rainforest Swamp',
    game: 'minetest_game',
    heatPoint: 88,
    humidityPoint: 88,
    yMin: -3,
    yMax: 12,
    altitudeBand: 'lowland',
    color: [15, 85, 63],
    hexColor: '#0f553f',
    topNode: 'default:dirt_with_rainforest_litter',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Humid low-lying tropical wetlands with papyrus reeds and murky pools.'
  },

  // ============================================
  // OCEAN / SHORE BIOMES (y: -112 to 3)
  // ============================================
  {
    id: 'icesheet_ocean',
    name: 'Icesheet Ocean',
    game: 'minetest_game',
    heatPoint: 0,
    humidityPoint: 73,
    yMin: -112,
    yMax: 3,
    altitudeBand: 'ocean',
    color: [125, 211, 252],
    hexColor: '#7dd3fc',
    topNode: 'default:ice',
    fillerNode: 'default:snowblock',
    stoneNode: 'default:stone',
    description: 'Pack-ice covered polar waters with submerged icebergs.'
  },
  {
    id: 'tundra_ocean',
    name: 'Tundra Ocean',
    game: 'minetest_game',
    heatPoint: 15,
    humidityPoint: 40,
    yMin: -112,
    yMax: 3,
    altitudeBand: 'ocean',
    color: [30, 82, 136],
    hexColor: '#1e5288',
    topNode: 'default:gravel',
    fillerNode: 'default:gravel',
    stoneNode: 'default:stone',
    description: 'Frigid gravel shorelines and deep subpolar waters.'
  },
  {
    id: 'temperate_ocean',
    name: 'Temperate Ocean',
    game: 'minetest_game',
    heatPoint: 50,
    humidityPoint: 50,
    yMin: -112,
    yMax: 3,
    altitudeBand: 'ocean',
    color: [37, 99, 235],
    hexColor: '#2563eb',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Sandy beaches and kelp-forested coastal waters.'
  },
  {
    id: 'tropical_ocean',
    name: 'Tropical Coral Ocean',
    game: 'minetest_game',
    heatPoint: 88,
    humidityPoint: 60,
    yMin: -112,
    yMax: 3,
    altitudeBand: 'ocean',
    color: [14, 165, 233],
    hexColor: '#0ea5e9',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Warm turquoise lagoons teeming with vibrant coral reefs.'
  },

  // ============================================
  // HIGHLAND / ALPINE BIOMES (y: 48 to 31000)
  // ============================================
  {
    id: 'alpine_glacier',
    name: 'Alpine Glacier',
    game: 'minetest_game',
    heatPoint: 15,
    humidityPoint: 70,
    yMin: 48,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [241, 245, 249],
    hexColor: '#f1f5f9',
    topNode: 'default:snowblock',
    fillerNode: 'default:ice',
    stoneNode: 'default:stone',
    description: 'High-altitude snowfields and jagged ice-crowned peaks.'
  },
  {
    id: 'mountain_crag',
    name: 'Mountain Crag',
    game: 'minetest_game',
    heatPoint: 45,
    humidityPoint: 40,
    yMin: 48,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [100, 116, 139],
    hexColor: '#64748b',
    topNode: 'default:stone',
    fillerNode: 'default:stone',
    stoneNode: 'default:stone',
    description: 'Exposed granite ridges and wind-scoured mountain cliffs.'
  },
  {
    id: 'highland_meadow',
    name: 'Highland Meadow',
    game: 'minetest_game',
    heatPoint: 65,
    humidityPoint: 65,
    yMin: 48,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [74, 222, 128],
    hexColor: '#4ade80',
    topNode: 'default:dirt_with_grass',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Elevated mountain plateaus with alpine flora and pine groves.'
  },
  {
    id: 'mesa_badlands',
    name: 'Mesa High Plateau',
    game: 'minetest_game',
    heatPoint: 88,
    humidityPoint: 20,
    yMin: 48,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [217, 119, 6],
    hexColor: '#d97706',
    topNode: 'default:desert_stone',
    fillerNode: 'default:desert_stone',
    stoneNode: 'default:desert_stone',
    description: 'Towering red-rock canyons and sun-baked desert stone mesas.'
  },

  // ============================================
  // UNDERGROUND / DEEP CAVERN BIOMES (y: -31000 to -113)
  // ============================================
  {
    id: 'icesheet_under',
    name: 'Glacial Ice Caverns',
    game: 'minetest_game',
    heatPoint: 0,
    humidityPoint: 73,
    yMin: -31000,
    yMax: -113,
    altitudeBand: 'underground',
    color: [138, 198, 238],
    hexColor: '#8ac6ee',
    topNode: 'default:cave_ice',
    fillerNode: 'default:ice',
    stoneNode: 'default:stone',
    description: 'Subterranean subzero fault lines lined with translucent cave ice and frozen aquifers.'
  },
  {
    id: 'tundra_under',
    name: 'Permafrost Abyss',
    game: 'minetest_game',
    heatPoint: 15,
    humidityPoint: 40,
    yMin: -31000,
    yMax: -113,
    altitudeBand: 'underground',
    color: [98, 128, 112],
    hexColor: '#628070',
    topNode: 'default:permafrost_with_moss',
    fillerNode: 'default:gravel',
    stoneNode: 'default:stone',
    description: 'Cold deep-earth chambers with ancient gravel talus and subterranean moss.'
  },
  {
    id: 'temperate_under',
    name: 'Mossy Limestone Caverns',
    game: 'minetest_game',
    heatPoint: 50,
    humidityPoint: 50,
    yMin: -31000,
    yMax: -113,
    altitudeBand: 'underground',
    color: [82, 112, 85],
    hexColor: '#527055',
    topNode: 'default:mossycobble',
    fillerNode: 'default:cobble',
    stoneNode: 'default:stone',
    description: 'Expansive temperate karst cave systems with underground rivers and mossy dungeons.'
  },
  {
    id: 'rainforest_under',
    name: 'Fungal Jungle Depths',
    game: 'minetest_game',
    heatPoint: 86,
    humidityPoint: 65,
    yMin: -31000,
    yMax: -113,
    altitudeBand: 'underground',
    color: [36, 115, 58],
    hexColor: '#24733a',
    topNode: 'default:mossycobble',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Humid geothermal caverns beneath the jungle rich in subterranean Spores and waterfalls.'
  },
  {
    id: 'desert_under',
    name: 'Magma Basalt Vaults',
    game: 'minetest_game',
    heatPoint: 92,
    humidityPoint: 16,
    yMin: -31000,
    yMax: -113,
    altitudeBand: 'underground',
    color: [234, 88, 12],
    hexColor: '#ea580c',
    topNode: 'default:desert_stone',
    fillerNode: 'default:obsidian',
    stoneNode: 'default:lava_source',
    description: 'Blistering deep-crust chambers of red desert stone, obsidian, and molten lava lakes.'
  }
];

/**
 * Everness Mod Biome Registry (matching exact `heat_point`, `humidity_point`, `y_min`, `y_max` from `everness/mapgen_*.lua`).
 * Includes Surface/Lowland, Ocean, and Underground (`_under`, y: -31000..-256) biome strata.
 */
export const EVERNESS_MOD_BIOMES: BiomeDefinition[] = [
  // ============================================
  // EVERNESS SURFACE / LOWLAND BIOMES
  // ============================================
  {
    id: 'everness_frosted_icesheet',
    name: 'Frosted Icesheet (Everness)',
    game: 'everness',
    heatPoint: 0,
    humidityPoint: 93,
    yMin: -8,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [169, 207, 248],
    hexColor: '#a9cff8',
    topNode: 'everness:frosted_snowblock',
    fillerNode: 'everness:frosted_ice',
    stoneNode: 'everness:frosted_cave_ice',
    description: 'Everness glacial expanse of lavender-tinted frosted ice, ancient fossils, and crystalline spires.'
  },
  {
    id: 'everness_forsaken_tundra',
    name: 'Forsaken Tundra (Everness)',
    game: 'everness',
    heatPoint: 10,
    humidityPoint: 10,
    yMin: -3,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [32, 32, 30],
    hexColor: '#20201e',
    topNode: 'everness:forsaken_tundra_dirt',
    fillerNode: 'everness:forsaken_tundra_dirt',
    stoneNode: 'everness:forsaken_tundra_stone',
    description: 'Bleak volcanic ash and sulfur barrens with pebble shores and glowing magma vents.'
  },
  {
    id: 'everness_crystal_forest',
    name: 'Crystal Forest (Everness)',
    game: 'everness',
    heatPoint: 35,
    humidityPoint: 50,
    yMin: 0,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [140, 96, 154],
    hexColor: '#8c609a',
    topNode: 'everness:dirt_with_crystal_grass',
    fillerNode: 'everness:crystal_dirt',
    stoneNode: 'everness:crystal_stone',
    description: 'Enchanted violet crystal woodland with glowing amethyst trees, crystal dunes, and crystal moss.'
  },
  {
    id: 'everness_cursed_lands',
    name: 'Cursed Lands (Everness)',
    game: 'everness',
    heatPoint: 45,
    humidityPoint: 85,
    yMin: -1,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [39, 76, 54],
    hexColor: '#274c36',
    topNode: 'everness:dirt_with_cursed_grass',
    fillerNode: 'everness:cursed_dirt',
    stoneNode: 'everness:cursed_stone_carved',
    description: 'Shadowy haunted marshlands with twisted dry trees, cursed mud swamps, and eerie catacombs.'
  },
  {
    id: 'everness_coral_forest',
    name: 'Coral Forest (Everness)',
    game: 'everness',
    heatPoint: 60,
    humidityPoint: 50,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [109, 50, 71],
    hexColor: '#6d3247',
    topNode: 'everness:dirt_with_coral_grass',
    fillerNode: 'everness:coral_dirt',
    stoneNode: 'everness:coral_desert_stone',
    description: 'Vibrant magenta-pink terrestrial coral forest with towering coral trees and bioluminescent flora.'
  },
  {
    id: 'everness_mineral_waters',
    name: 'Mineral Waters (Everness)',
    game: 'everness',
    heatPoint: 78,
    humidityPoint: 58,
    yMin: 1,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [239, 234, 238],
    hexColor: '#efeaee',
    topNode: 'everness:mineral_sand',
    fillerNode: 'everness:mineral_stone',
    stoneNode: 'everness:mineral_stone',
    description: 'Steaming turquoise travertine terraces, mineral pools, and palm-fringed geothermal springs.'
  },
  {
    id: 'everness_bamboo_forest',
    name: 'Bamboo Forest (Everness)',
    game: 'everness',
    heatPoint: 80,
    humidityPoint: 60,
    yMin: 1,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [79, 185, 72],
    hexColor: '#4fb948',
    topNode: 'everness:dirt_with_grass_1',
    fillerNode: 'everness:dirt_1',
    stoneNode: 'default:stone',
    description: 'Dense emerald bamboo groves with giant culms, stepping stones, and humid mist.'
  },
  {
    id: 'everness_baobab_savanna',
    name: 'Baobab Savanna (Everness)',
    game: 'everness',
    heatPoint: 80,
    humidityPoint: 30,
    yMin: 1,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [202, 138, 4],
    hexColor: '#ca8a04',
    topNode: 'everness:dry_dirt_with_dry_grass',
    fillerNode: 'everness:dry_dirt',
    stoneNode: 'default:stone',
    description: 'Sun-drenched golden savanna dominated by colossal ancient baobab trees.'
  },
  {
    id: 'everness_forsaken_desert',
    name: 'Forsaken Desert (Everness)',
    game: 'everness',
    heatPoint: 100,
    humidityPoint: 30,
    yMin: 4,
    yMax: 48,
    altitudeBand: 'lowland',
    color: [201, 140, 80],
    hexColor: '#c98c50',
    topNode: 'everness:forsaken_desert_sand',
    fillerNode: 'everness:forsaken_desert_sand',
    stoneNode: 'everness:forsaken_desert_stone',
    description: 'Scorched ochre-copper dunes dotted with hollow cacti and subterranean temples.'
  },

  // ============================================
  // EVERNESS OCEAN & DEEP OCEAN BIOMES (y: -255 to 3)
  // ============================================
  {
    id: 'everness_frosted_icesheet_ocean',
    name: 'Frosted Icesheet Ocean (Everness)',
    game: 'everness',
    heatPoint: 0,
    humidityPoint: 93,
    yMin: -255,
    yMax: -9,
    altitudeBand: 'ocean',
    color: [132, 112, 222],
    hexColor: '#8470de',
    topNode: 'everness:frosted_ice',
    fillerNode: 'everness:frosted_snowblock',
    stoneNode: 'everness:frosted_cave_ice',
    description: 'Subpolar lavender pack-ice shelf and deep glacial ocean floor.'
  },
  {
    id: 'everness_forsaken_tundra_ocean',
    name: 'Forsaken Tundra Ocean (Everness)',
    game: 'everness',
    heatPoint: 10,
    humidityPoint: 10,
    yMin: -255,
    yMax: -4,
    altitudeBand: 'ocean',
    color: [138, 130, 122],
    hexColor: '#8a827a',
    topNode: 'everness:forsaken_tundra_beach_sand',
    fillerNode: 'everness:forsaken_tundra_stone',
    stoneNode: 'everness:forsaken_tundra_stone',
    description: 'Ashen volcanic seabed and dark pebble coastlines bordering the Forsaken Tundra.'
  },
  {
    id: 'everness_crystal_forest_ocean',
    name: 'Crystal Forest Ocean (Everness)',
    game: 'everness',
    heatPoint: 35,
    humidityPoint: 50,
    yMin: -255,
    yMax: -2,
    altitudeBand: 'ocean',
    color: [138, 126, 204],
    hexColor: '#8a7ecc',
    topNode: 'everness:crystal_sand',
    fillerNode: 'everness:crystal_forest_deep_ocean_sand',
    stoneNode: 'everness:crystal_stone',
    description: 'Shimmering violet crystal sands and submerged amethyst reefs.'
  },
  {
    id: 'everness_cursed_lands_ocean',
    name: 'Cursed Lands Ocean (Everness)',
    game: 'everness',
    heatPoint: 45,
    humidityPoint: 85,
    yMin: -255,
    yMax: -2,
    altitudeBand: 'ocean',
    color: [58, 72, 84],
    hexColor: '#3a4854',
    topNode: 'everness:cursed_stone',
    fillerNode: 'everness:cursed_lands_deep_ocean_sand',
    stoneNode: 'everness:cursed_stone_carved',
    description: 'Murky abyssal waters with drowned ruins and cursed silt.'
  },
  {
    id: 'everness_coral_forest_ocean',
    name: 'Coral Forest Ocean (Everness)',
    game: 'everness',
    heatPoint: 60,
    humidityPoint: 50,
    yMin: -255,
    yMax: 3,
    altitudeBand: 'ocean',
    color: [234, 178, 196],
    hexColor: '#eab2c4',
    topNode: 'everness:coral_white_sand',
    fillerNode: 'everness:coral_forest_deep_ocean_sand',
    stoneNode: 'everness:coral_desert_stone',
    description: 'Luminous pink-and-white coral lagoons and deep marine coral reefs.'
  },
  {
    id: 'everness_forsaken_desert_ocean',
    name: 'Forsaken Desert Ocean (Everness)',
    game: 'everness',
    heatPoint: 100,
    humidityPoint: 30,
    yMin: -8,
    yMax: 3,
    altitudeBand: 'ocean',
    color: [142, 106, 72],
    hexColor: '#8e6a48',
    topNode: 'everness:dry_ocean_dirt',
    fillerNode: 'everness:dry_ocean_dirt',
    stoneNode: 'everness:forsaken_desert_stone',
    description: 'Parched coastal mudflats and warm shallows along the Forsaken Desert.'
  },

  // ============================================
  // EVERNESS UNDERGROUND BIOMES (y: -31000 to -256)
  // ============================================
  {
    id: 'everness_frosted_icesheet_under',
    name: 'Frosted Caverns Under (Everness)',
    game: 'everness',
    heatPoint: 0,
    humidityPoint: 93,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [142, 136, 218],
    hexColor: '#8e88da',
    topNode: 'everness:frosted_cave_ice',
    fillerNode: 'everness:icecobble',
    stoneNode: 'everness:frosted_cave_ice',
    description: 'Deep subterranean ice caverns with glowing frosted stalactites and icecobble.'
  },
  {
    id: 'everness_forsaken_tundra_under',
    name: 'Volcanic Sulfur Under (Everness)',
    game: 'everness',
    heatPoint: 10,
    humidityPoint: 10,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [228, 188, 38],
    hexColor: '#e4bc26',
    topNode: 'everness:volcanic_sulfur',
    fillerNode: 'everness:sulfur_stone',
    stoneNode: 'everness:forsaken_tundra_stone',
    description: 'Geothermal sulfur caverns, obsidian chambers, and active magma vents.'
  },
  {
    id: 'everness_crystal_forest_under',
    name: 'Crystal Caverns Under (Everness)',
    game: 'everness',
    heatPoint: 35,
    humidityPoint: 50,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [146, 114, 228],
    hexColor: '#9272e4',
    topNode: 'everness:crystal_moss_block',
    fillerNode: 'everness:crystal_cobble',
    stoneNode: 'everness:crystal_stone',
    description: 'Subterranean amethyst geodes, crystal moss vaults, and glowing quartz pillars.'
  },
  {
    id: 'everness_cursed_lands_under',
    name: 'Cursed Catacombs Under (Everness)',
    game: 'everness',
    heatPoint: 45,
    humidityPoint: 85,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [62, 92, 86],
    hexColor: '#3e5c56',
    topNode: 'everness:cursed_brick_with_growth',
    fillerNode: 'everness:cursed_brick',
    stoneNode: 'everness:cursed_stone_carved',
    description: 'Ancient sunken catacombs of carved cursed stone and overgrown crypt bricks.'
  },
  {
    id: 'everness_coral_forest_under',
    name: 'Coral Abyss Under (Everness)',
    game: 'everness',
    heatPoint: 60,
    humidityPoint: 50,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [198, 86, 134],
    hexColor: '#c65686',
    topNode: 'everness:coral_desert_stone_with_moss',
    fillerNode: 'everness:coral_desert_cobble',
    stoneNode: 'everness:coral_desert_stone',
    description: 'Bioluminescent subterranean coral grottoes and mossy coral stone caverns.'
  },
  {
    id: 'everness_mineral_waters_under',
    name: 'Mineral Caverns Under (Everness)',
    game: 'everness',
    heatPoint: 78,
    humidityPoint: 58,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [76, 158, 148],
    hexColor: '#4c9e94',
    topNode: 'everness:mineral_cave_stone',
    fillerNode: 'everness:mineral_stone_brick_with_growth',
    stoneNode: 'everness:mineral_cave_stone',
    description: 'Deep thermal aquifers and mineral-encrusted subterranean stone vaults.'
  },
  {
    id: 'everness_bamboo_forest_under',
    name: 'Bamboo Root Caverns Under (Everness)',
    game: 'everness',
    heatPoint: 80,
    humidityPoint: 60,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [138, 168, 74],
    hexColor: '#8aa84a',
    topNode: 'everness:bamboo_wood',
    fillerNode: 'everness:bamboo_mosaic_wood',
    stoneNode: 'default:stone',
    description: 'Subterranean bamboo temples and root-woven underground chambers.'
  },
  {
    id: 'everness_forsaken_desert_under',
    name: 'Forsaken Tombs Under (Everness)',
    game: 'everness',
    heatPoint: 100,
    humidityPoint: 30,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [168, 108, 66],
    hexColor: '#a86c42',
    topNode: 'everness:forsaken_desert_chiseled_stone',
    fillerNode: 'everness:forsaken_desert_brick',
    stoneNode: 'everness:forsaken_desert_stone',
    description: 'Buried desert tombs crafted from chiseled ochre brick and ancient traps.'
  }
];
/**
 * Authentic Ethereal Mod Biome Registry (matching exact heat_point, humidity_point, y_min, y_max from ethereal/biomes.lua).
 */
export const ETHEREAL_MOD_BIOMES: BiomeDefinition[] = [
  {
    id: 'ethereal_bamboo',
    name: 'Bamboo Forest (Ethereal)',
    game: 'ethereal',
    heatPoint: 45,
    humidityPoint: 75,
    yMin: 25,
    yMax: 70,
    altitudeBand: 'lowland',
    color: [130, 167, 76],
    hexColor: '#82a74c',
    topNode: 'ethereal:bamboo_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Towering bamboo stalks on vibrant chartreuse bamboo dirt.'
  },
  {
    id: 'ethereal_sakura',
    name: 'Sakura Grove (Ethereal)',
    game: 'ethereal',
    heatPoint: 45,
    humidityPoint: 75,
    yMin: 3,
    yMax: 25,
    altitudeBand: 'lowland',
    color: [199, 137, 168],
    hexColor: '#c789a8',
    topNode: 'ethereal:bamboo_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Cherry blossom wonderland with delicate pink sakura leaves.'
  },
  {
    id: 'ethereal_prairie',
    name: 'Prairie (Ethereal)',
    game: 'ethereal',
    heatPoint: 20,
    humidityPoint: 40,
    yMin: 3,
    yMax: 26,
    altitudeBand: 'lowland',
    color: [120, 156, 63],
    hexColor: '#789c3f',
    topNode: 'ethereal:prairie_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Flowering prairie meadows dense with wild herbs and prairie grasses.'
  },
  {
    id: 'ethereal_grove',
    name: 'Healing Grove (Ethereal)',
    game: 'ethereal',
    heatPoint: 45,
    humidityPoint: 35,
    yMin: 3,
    yMax: 23,
    altitudeBand: 'lowland',
    color: [114, 153, 55],
    hexColor: '#729937',
    topNode: 'ethereal:grove_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Lush temperate healing grove filled with banana and olive trees.'
  },
  {
    id: 'ethereal_mediterranean',
    name: 'Mediterranean (Ethereal)',
    game: 'ethereal',
    heatPoint: 20,
    humidityPoint: 45,
    yMin: 3,
    yMax: 50,
    altitudeBand: 'lowland',
    color: [138, 168, 68],
    hexColor: '#8aa844',
    topNode: 'ethereal:grove_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Sunny coastal terraces with ancient olive groves and herb terraces.'
  },
  {
    id: 'ethereal_frost',
    name: 'Crystal Frost (Ethereal)',
    game: 'ethereal',
    heatPoint: 10,
    humidityPoint: 40,
    yMin: 1,
    yMax: 71,
    altitudeBand: 'lowland',
    color: [50, 97, 119],
    hexColor: '#326177',
    topNode: 'ethereal:crystal_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Glistening frosted biome of teal crystal dirt and frost spires.'
  },
  {
    id: 'ethereal_mushroom',
    name: 'Mushroom Shroomland (Ethereal)',
    game: 'ethereal',
    heatPoint: 45,
    humidityPoint: 55,
    yMin: 3,
    yMax: 50,
    altitudeBand: 'lowland',
    color: [115, 71, 114],
    hexColor: '#734772',
    topNode: 'ethereal:mushroom_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Spore-lit purple mushroom dirt barrens covered in giant fungi.'
  },
  {
    id: 'ethereal_fiery',
    name: 'Fiery Badlands (Ethereal)',
    game: 'ethereal',
    heatPoint: 75,
    humidityPoint: 10,
    yMin: 5,
    yMax: 20,
    altitudeBand: 'lowland',
    color: [136, 27, 8],
    hexColor: '#881b08',
    topNode: 'ethereal:fiery_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Scorched crimson earth with fiery shrubs, cinder blossoms, and magma.'
  },
  {
    id: 'ethereal_grayness',
    name: 'Grayness Blight (Ethereal)',
    game: 'ethereal',
    heatPoint: 15,
    humidityPoint: 30,
    yMin: 2,
    yMax: 41,
    altitudeBand: 'lowland',
    color: [155, 155, 155],
    hexColor: '#9b9b9b',
    topNode: 'ethereal:gray_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'ethereal:blue_marble',
    description: 'Monochrome desolate wasteland of pale gray dirt resting on blue marble bedrock.'
  },
  {
    id: 'ethereal_mesa',
    name: 'Baked Clay Mesa (Ethereal)',
    game: 'ethereal',
    heatPoint: 25,
    humidityPoint: 28,
    yMin: 1,
    yMax: 71,
    altitudeBand: 'lowland',
    color: [152, 113, 98],
    hexColor: '#987162',
    topNode: 'default:dirt_with_dry_grass',
    fillerNode: 'bakedclay:orange',
    stoneNode: 'default:stone',
    description: 'Striated canyon plateaus built of layered baked clay and dry grass.'
  },
  {
    id: 'ethereal_plains',
    name: 'Arid Plains (Ethereal)',
    game: 'ethereal',
    heatPoint: 65,
    humidityPoint: 25,
    yMin: 3,
    yMax: 25,
    altitudeBand: 'lowland',
    color: [161, 128, 80],
    hexColor: '#a18050',
    topNode: 'ethereal:dry_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Sun-baked arid steppe of cracked dry dirt and drought-tolerant scrub.'
  },
  {
    id: 'ethereal_quicksand',
    name: 'Quicksand Sinkhole (Ethereal)',
    game: 'ethereal',
    heatPoint: 50,
    humidityPoint: 38,
    yMin: 1,
    yMax: 1,
    altitudeBand: 'lowland',
    color: [183, 183, 183],
    hexColor: '#b7b7b7',
    topNode: 'ethereal:quicksand2',
    fillerNode: 'default:gravel',
    stoneNode: 'default:stone',
    description: 'Treacherous sinkhole fields of sinking quicksand and loose silt.'
  },
  {
    id: 'ethereal_sandclay',
    name: 'Clay Flats (Ethereal)',
    game: 'ethereal',
    heatPoint: 65,
    humidityPoint: 2,
    yMin: 1,
    yMax: 11,
    altitudeBand: 'lowland',
    color: [183, 183, 183],
    hexColor: '#b7b7b7',
    topNode: 'default:sand',
    fillerNode: 'default:clay',
    stoneNode: 'default:stone',
    description: 'Vast estuarine flats rich in surface clay deposits and coastal dunes.'
  },
  {
    id: 'ethereal_jumble',
    name: 'Jumble Jungle (Ethereal)',
    game: 'ethereal',
    heatPoint: 25,
    humidityPoint: 50,
    yMin: 1,
    yMax: 71,
    altitudeBand: 'lowland',
    color: [75, 125, 45],
    hexColor: '#4b7d2d',
    topNode: 'default:dirt_with_grass',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Chaotic overgrown deciduous tangle with dense vines and fallen logs.'
  },
  {
    id: 'ethereal_junglee',
    name: 'Deep Jungle (Ethereal)',
    game: 'ethereal',
    heatPoint: 30,
    humidityPoint: 60,
    yMin: 1,
    yMax: 71,
    altitudeBand: 'lowland',
    color: [47, 68, 35],
    hexColor: '#2f4423',
    topNode: 'default:dirt_with_rainforest_litter',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Primeval rainforest canopy dense with giant redwood and fern trees.'
  },
  {
    id: 'ethereal_swamp',
    name: 'Willow Swamp (Ethereal)',
    game: 'ethereal',
    heatPoint: 80,
    humidityPoint: 90,
    yMin: 1,
    yMax: 7,
    altitudeBand: 'lowland',
    color: [60, 95, 48],
    hexColor: '#3c5f30',
    topNode: 'default:dirt_with_grass',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Murky lowland delta draped in weeping willow vines and lily pads.'
  },
  {
    id: 'ethereal_mountain',
    name: 'Alpine Glacial Peaks (Ethereal)',
    game: 'ethereal',
    heatPoint: 50,
    humidityPoint: 50,
    yMin: 140,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [238, 246, 252],
    hexColor: '#eef6fc',
    topNode: 'default:snow',
    fillerNode: 'default:snowblock',
    stoneNode: 'default:stone',
    description: 'Towering mountain spires scraping the upper clouds in perpetual blizzard.'
  },
  {
    id: 'ethereal_frost_floatland',
    name: 'Floating Crystal Isles (Ethereal)',
    game: 'ethereal',
    heatPoint: 10,
    humidityPoint: 40,
    yMin: 1025,
    yMax: 1750,
    altitudeBand: 'highland',
    color: [96, 159, 165],
    hexColor: '#609fa5',
    topNode: 'ethereal:crystal_dirt',
    fillerNode: 'default:dirt',
    stoneNode: 'default:stone',
    description: 'Surreal levitating sky islands rich in crystal galleons and starry ether.'
  },
  {
    id: 'ethereal_caves',
    name: 'Hollow Caverns (Ethereal)',
    game: 'ethereal',
    heatPoint: 15,
    humidityPoint: 25,
    yMin: 4,
    yMax: 41,
    altitudeBand: 'lowland',
    color: [130, 79, 61],
    hexColor: '#824f3d',
    topNode: 'default:desert_stone',
    fillerNode: 'default:stone',
    stoneNode: 'default:desert_stone',
    description: 'Perforated limestone bluffs riddled with natural caves and arches.'
  },
  {
    id: 'ethereal_bamboo_ocean',
    name: 'Bamboo Ocean (Ethereal)',
    game: 'ethereal',
    heatPoint: 45,
    humidityPoint: 75,
    yMin: -192,
    yMax: 2,
    altitudeBand: 'ocean',
    color: [30, 110, 160],
    hexColor: '#1e6ea0',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Warm temperate coastal waters lapping bamboo archipelagos.'
  },
  {
    id: 'ethereal_frost_ocean',
    name: 'Glacial Crystal Sea (Ethereal)',
    game: 'ethereal',
    heatPoint: 10,
    humidityPoint: 40,
    yMin: -192,
    yMax: 1,
    altitudeBand: 'ocean',
    color: [40, 90, 140],
    hexColor: '#285a8c',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Freezing frigid ocean beneath crystal cliffs.'
  },
  {
    id: 'ethereal_grayness_ocean',
    name: 'Blue Marble Abyss (Ethereal)',
    game: 'ethereal',
    heatPoint: 15,
    humidityPoint: 30,
    yMin: -18,
    yMax: 1,
    altitudeBand: 'ocean',
    color: [98, 133, 181],
    hexColor: '#6285b5',
    topNode: 'ethereal:blue_marble',
    fillerNode: 'default:sand',
    stoneNode: 'ethereal:blue_marble',
    description: 'Submerged seabed paved in brilliant azure blue marble.'
  },
  {
    id: 'ethereal_prairie_ocean',
    name: 'Prairie Shallow Bay (Ethereal)',
    game: 'ethereal',
    heatPoint: 20,
    humidityPoint: 40,
    yMin: -192,
    yMax: 1,
    altitudeBand: 'ocean',
    color: [35, 120, 175],
    hexColor: '#2378af',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Sheltered sunlit ocean fringing the wildflower prairies.'
  },
  {
    id: 'ethereal_grove_ocean',
    name: 'Grove Estuary (Ethereal)',
    game: 'ethereal',
    heatPoint: 45,
    humidityPoint: 35,
    yMin: -192,
    yMax: 2,
    altitudeBand: 'ocean',
    color: [32, 125, 185],
    hexColor: '#207db9',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Turquoise shallows surrounding the healing groves.'
  },
  {
    id: 'ethereal_mushroom_ocean',
    name: 'Bioluminescent Trench (Ethereal)',
    game: 'ethereal',
    heatPoint: 45,
    humidityPoint: 55,
    yMin: -192,
    yMax: 2,
    altitudeBand: 'ocean',
    color: [45, 95, 150],
    hexColor: '#2d5f96',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Deep ocean bed reflecting the purple glow of giant fungi.'
  },
  {
    id: 'ethereal_fiery_ocean',
    name: 'Boiling Red Depths (Ethereal)',
    game: 'ethereal',
    heatPoint: 75,
    humidityPoint: 10,
    yMin: -192,
    yMax: 0,
    altitudeBand: 'ocean',
    color: [75, 45, 95],
    hexColor: '#4b2d5f',
    topNode: 'default:sand',
    fillerNode: 'default:sand',
    stoneNode: 'default:stone',
    description: 'Volcanic thermal abyss where undersea vents boil the ocean.'
  },
  {
    id: 'ethereal_swamp_ocean',
    name: 'Mangrove Mud Bay (Ethereal)',
    game: 'ethereal',
    heatPoint: 80,
    humidityPoint: 90,
    yMin: -192,
    yMax: 1,
    altitudeBand: 'ocean',
    color: [25, 80, 110],
    hexColor: '#19506e',
    topNode: 'default:sand',
    fillerNode: 'default:clay',
    stoneNode: 'default:stone',
    description: 'Silt-heavy shallow bay choked with clay and willow roots.'
  }
];

/**
 * Authentic MineClone2 / Mineclonia Biome Registry (matching exact noise centroids & registered biomes in mcl_biomes/init.lua).
 * Covers Overworld (Lowland, Ocean, Highland), Nether, and The End.
 */
export const MINECLONE_GAME_BIOMES: BiomeDefinition[] = [
  // --- OVERWORLD SURFACE ---
  {
    id: 'mcl_plains',
    name: 'Plains (MineClone)',
    game: 'mineclone2',
    heatPoint: 58,
    humidityPoint: 39,
    yMin: 3,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [61, 100, 52],
    hexColor: '#3d6434',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Classic grassy open plains with horses, flowers, and gentle topography.'
  },
  {
    id: 'mcl_sunflower_plains',
    name: 'Sunflower Plains (MineClone)',
    game: 'mineclone2',
    heatPoint: 45,
    humidityPoint: 28,
    yMin: 4,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [220, 190, 40],
    hexColor: '#dcbe28',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Bright blooming meadow covered in golden yellow sunflowers.'
  },
  {
    id: 'mcl_desert',
    name: 'Desert (MineClone)',
    game: 'mineclone2',
    heatPoint: 94,
    humidityPoint: 26,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [221, 212, 163],
    hexColor: '#ddd4a3',
    topNode: 'mcl_core:sand',
    fillerNode: 'mcl_core:sandstone',
    stoneNode: 'mcl_core:stone',
    description: 'Arid desert of undulating sand dunes, cacti, dead bushes, and desert temples.'
  },
  {
    id: 'mcl_mesa',
    name: 'Badlands / Mesa (MineClone)',
    game: 'mineclone2',
    heatPoint: 100,
    humidityPoint: 0,
    yMin: 11,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [161, 83, 37],
    hexColor: '#a15325',
    topNode: 'mcl_colorblocks:hardened_clay',
    fillerNode: 'mcl_colorblocks:hardened_clay_orange',
    stoneNode: 'mcl_core:stone',
    description: 'Vibrant striated canyons and plateaus of terracotta and red sand.'
  },
  {
    id: 'mcl_mesa_bryce',
    name: 'Eroded Badlands (MineClone)',
    game: 'mineclone2',
    heatPoint: 100,
    humidityPoint: -5,
    yMin: 4,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [180, 95, 45],
    hexColor: '#b45f2d',
    topNode: 'mcl_colorblocks:hardened_clay',
    fillerNode: 'mcl_colorblocks:hardened_clay_orange',
    stoneNode: 'mcl_core:stone',
    description: 'Dramatic eroded Bryce-style spires of rainbow terracotta.'
  },
  {
    id: 'mcl_mesa_plateau',
    name: 'Wooded Badlands (MineClone)',
    game: 'mineclone2',
    heatPoint: 60,
    humidityPoint: 0,
    yMin: 11,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [130, 95, 40],
    hexColor: '#825f28',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_colorblocks:hardened_clay',
    stoneNode: 'mcl_core:stone',
    description: 'High plateau overlooking the badlands, forested with sparse oak trees.'
  },
  {
    id: 'mcl_forest',
    name: 'Oak Forest (MineClone)',
    game: 'mineclone2',
    heatPoint: 45,
    humidityPoint: 61,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [50, 90, 42],
    hexColor: '#325a2a',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Standard temperate forest canopy of oak and birch trees.'
  },
  {
    id: 'mcl_flower_forest',
    name: 'Flower Forest (MineClone)',
    game: 'mineclone2',
    heatPoint: 32,
    humidityPoint: 44,
    yMin: 3,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [75, 135, 60],
    hexColor: '#4b873c',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Scenic valley carpeted with every variety of wildflower and allium.'
  },
  {
    id: 'mcl_birch_forest',
    name: 'Birch Forest (MineClone)',
    game: 'mineclone2',
    heatPoint: 31,
    humidityPoint: 78,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [70, 115, 60],
    hexColor: '#46733c',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Open forest characterized exclusively by white birch trunks.'
  },
  {
    id: 'mcl_roofed_forest',
    name: 'Dark Forest (MineClone)',
    game: 'mineclone2',
    heatPoint: 27,
    humidityPoint: 94,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [30, 65, 25],
    hexColor: '#1e4119',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Extremely dense dark oak canopy casting deep shadows and giant mushrooms.'
  },
  {
    id: 'mcl_taiga',
    name: 'Taiga (MineClone)',
    game: 'mineclone2',
    heatPoint: 22,
    humidityPoint: 58,
    yMin: 4,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [45, 85, 55],
    hexColor: '#2d5537',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Subalpine conifer forest of spruce trees, sweet berries, and ferns.'
  },
  {
    id: 'mcl_cold_taiga',
    name: 'Snowy Taiga (MineClone)',
    game: 'mineclone2',
    heatPoint: 8,
    humidityPoint: 58,
    yMin: 3,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [180, 205, 215],
    hexColor: '#b4cdd7',
    topNode: 'mcl_core:dirt_with_grass_snow',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Winter spruce woodland coated in deep snowdrifts and frozen streams.'
  },
  {
    id: 'mcl_mega_taiga',
    name: 'Old Growth Pine Taiga (MineClone)',
    game: 'mineclone2',
    heatPoint: 10,
    humidityPoint: 76,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [90, 63, 37],
    hexColor: '#5a3f25',
    topNode: 'mcl_core:podzol',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Primeval old-growth forest carpeted in rich brown podzol and giant spruce.'
  },
  {
    id: 'mcl_mega_spruce_taiga',
    name: 'Old Growth Spruce Taiga (MineClone)',
    game: 'mineclone2',
    heatPoint: 8,
    humidityPoint: 100,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [78, 55, 32],
    hexColor: '#4e3720',
    topNode: 'mcl_core:podzol',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Ancient dense spruce woods with towering thick canopies and coarse dirt.'
  },
  {
    id: 'mcl_ice_plains',
    name: 'Snowy Plains (MineClone)',
    game: 'mineclone2',
    heatPoint: 8,
    humidityPoint: 24,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [225, 238, 245],
    hexColor: '#e1eef5',
    topNode: 'mcl_core:dirt_with_grass_snow',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Expansive rolling tundra buried in snow with polar bears and ice patches.'
  },
  {
    id: 'mcl_ice_plains_spikes',
    name: 'Ice Spikes (MineClone)',
    game: 'mineclone2',
    heatPoint: -5,
    humidityPoint: 24,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [168, 206, 247],
    hexColor: '#a8cef7',
    topNode: 'mcl_core:snowblock',
    fillerNode: 'mcl_core:packed_ice',
    stoneNode: 'mcl_core:stone',
    description: 'Surreal glacial fields dominated by towering monolithic spires of packed ice.'
  },
  {
    id: 'mcl_jungle',
    name: 'Jungle (MineClone)',
    game: 'mineclone2',
    heatPoint: 81,
    humidityPoint: 88,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [35, 95, 25],
    hexColor: '#235f19',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Dense tropical rainforest with massive emergent jungle trees and cocoa pods.'
  },
  {
    id: 'mcl_bamboo_jungle',
    name: 'Bamboo Jungle (MineClone)',
    game: 'mineclone2',
    heatPoint: 95,
    humidityPoint: 90,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [75, 140, 45],
    hexColor: '#4b8c2d',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Thick impenetrable thickets of bamboo reeds and giant pandas.'
  },
  {
    id: 'mcl_swampland',
    name: 'Swamp (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 90,
    yMin: 1,
    yMax: 23,
    altitudeBand: 'lowland',
    color: [75, 91, 55],
    hexColor: '#4b5b37',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Low marshland of vine-draped oak trees, lily pads, shallow ponds, and witch huts.'
  },
  {
    id: 'mcl_mangrove_swamp',
    name: 'Mangrove Swamp (MineClone)',
    game: 'mineclone2',
    heatPoint: 94,
    humidityPoint: 95,
    yMin: 1,
    yMax: 27,
    altitudeBand: 'lowland',
    color: [60, 48, 40],
    hexColor: '#3c3028',
    topNode: 'mcl_mud:mud',
    fillerNode: 'mcl_mud:mud',
    stoneNode: 'mcl_core:stone',
    description: 'Deep coastal wetland of stilt mangrove roots, warm waters, and muddy deposits.'
  },
  {
    id: 'mcl_savanna',
    name: 'Savanna (MineClone)',
    game: 'mineclone2',
    heatPoint: 79,
    humidityPoint: 36,
    yMin: 3,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [145, 142, 60],
    hexColor: '#918e3c',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Dry golden savanna grasslands dotted with umbrella-shaped acacia trees.'
  },
  {
    id: 'mcl_mushroom_island',
    name: 'Mushroom Fields (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 100,
    yMin: 1,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [111, 99, 105],
    hexColor: '#6f6369',
    topNode: 'mcl_core:mycelium',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Rare enchanted islands of purple mycelium turf, red and brown giant mushrooms.'
  },
  {
    id: 'mcl_extreme_hills',
    name: 'Windswept Hills (MineClone)',
    game: 'mineclone2',
    heatPoint: 45,
    humidityPoint: 10,
    yMin: 4,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [95, 115, 85],
    hexColor: '#5f7355',
    topNode: 'mcl_core:dirt_with_grass',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Craggy mountainous terrain with sheer cliffs, floating islands, and gravel deposits.'
  },
  {
    id: 'mcl_stone_beach',
    name: 'Stony Shore (MineClone)',
    game: 'mineclone2',
    heatPoint: 8,
    humidityPoint: 0,
    yMin: -7,
    yMax: 31000,
    altitudeBand: 'lowland',
    color: [125, 125, 125],
    hexColor: '#7d7d7d',
    topNode: 'mcl_core:stone',
    fillerNode: 'mcl_core:stone',
    stoneNode: 'mcl_core:stone',
    description: 'Rugged rock-strewn coastal cliffs where stone plateaus meet the frigid sea.'
  },
  {
    id: 'mcl_deep_ocean',
    name: 'Deep Ocean (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 50,
    yMin: -31000,
    yMax: -32,
    altitudeBand: 'ocean',
    color: [20, 50, 95],
    hexColor: '#14325f',
    topNode: 'mcl_core:gravel',
    fillerNode: 'mcl_core:gravel',
    stoneNode: 'mcl_core:stone',
    description: 'Deep oceanic abyss featuring sea monuments, underwater trenches, and kelp forests.'
  },

  // --- NETHER BIOMES ---
  {
    id: 'mcl_nether_wastes',
    name: 'Nether Wastes (MineClone)',
    game: 'mineclone2',
    heatPoint: 100,
    humidityPoint: 0,
    yMin: -31000,
    yMax: 31000,
    altitudeBand: 'underground',
    color: [111, 54, 52],
    hexColor: '#6f3634',
    topNode: 'mcl_nether:netherrack',
    fillerNode: 'mcl_nether:netherrack',
    stoneNode: 'mcl_nether:netherrack',
    description: 'The primordial fiery underworld of netherrack, lava seas, and nether fortresses.'
  },
  {
    id: 'mcl_crimson_forest',
    name: 'Crimson Forest (MineClone)',
    game: 'mineclone2',
    heatPoint: 60,
    humidityPoint: 47,
    yMin: -31000,
    yMax: 31000,
    altitudeBand: 'underground',
    color: [148, 25, 45],
    hexColor: '#94192d',
    topNode: 'mcl_crimson:crimson_nylium',
    fillerNode: 'mcl_nether:netherrack',
    stoneNode: 'mcl_nether:netherrack',
    description: 'Lurid scarlet jungle nourished by weeping vines and giant crimson fungi.'
  },
  {
    id: 'mcl_warped_forest',
    name: 'Warped Forest (MineClone)',
    game: 'mineclone2',
    heatPoint: 37,
    humidityPoint: 70,
    yMin: -31000,
    yMax: 31000,
    altitudeBand: 'underground',
    color: [22, 115, 115],
    hexColor: '#167373',
    topNode: 'mcl_crimson:warped_nylium',
    fillerNode: 'mcl_nether:netherrack',
    stoneNode: 'mcl_nether:netherrack',
    description: 'Mysterious teal fungal sanctuary inhabited by Endermen and twisted vines.'
  },
  {
    id: 'mcl_soul_sand_valley',
    name: 'Soul Sand Valley (MineClone)',
    game: 'mineclone2',
    heatPoint: 70,
    humidityPoint: 5,
    yMin: -31000,
    yMax: 31000,
    altitudeBand: 'underground',
    color: [81, 62, 50],
    hexColor: '#513e32',
    topNode: 'mcl_nether:soul_sand',
    fillerNode: 'mcl_nether:soul_sand',
    stoneNode: 'mcl_nether:netherrack',
    description: 'Eerie cavern carved from soul sand and soul soil, lit by spectral cyan soul fire.'
  },
  {
    id: 'mcl_basalt_deltas',
    name: 'Basalt Deltas (MineClone)',
    game: 'mineclone2',
    heatPoint: 95,
    humidityPoint: 5,
    yMin: -31000,
    yMax: 31000,
    altitudeBand: 'underground',
    color: [79, 79, 84],
    hexColor: '#4f4f54',
    topNode: 'mcl_blackstone:basalt',
    fillerNode: 'mcl_blackstone:basalt',
    stoneNode: 'mcl_blackstone:blackstone',
    description: 'Volcanic ash barrens of towering columnar basalt pillars and magma chambers.'
  },

  // --- THE END BIOMES ---
  {
    id: 'mcl_the_end',
    name: 'The End (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 50,
    yMin: 10000,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [218, 222, 161],
    hexColor: '#dadea1',
    topNode: 'mcl_end:end_stone',
    fillerNode: 'mcl_end:end_stone',
    stoneNode: 'mcl_end:end_stone',
    description: 'The central void realm of obsidian pillars, end crystals, and the Ender Dragon.'
  },
  {
    id: 'mcl_end_highlands',
    name: 'End Highlands (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 60,
    yMin: 10000,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [195, 200, 140],
    hexColor: '#c3c88c',
    topNode: 'mcl_end:end_stone',
    fillerNode: 'mcl_end:end_stone',
    stoneNode: 'mcl_end:end_stone',
    description: 'Rolling outer End plateaus rich in chorus fruit forests and End Cities.'
  },
  {
    id: 'mcl_end_midlands',
    name: 'End Midlands (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 40,
    yMin: 10000,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [210, 214, 155],
    hexColor: '#d2d69b',
    topNode: 'mcl_end:end_stone',
    fillerNode: 'mcl_end:end_stone',
    stoneNode: 'mcl_end:end_stone',
    description: 'Transition slopes descending between the high End plateaus and outer void.'
  },
  {
    id: 'mcl_end_small_islands',
    name: 'Small End Islands (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 30,
    yMin: 10000,
    yMax: 31000,
    altitudeBand: 'highland',
    color: [225, 228, 170],
    hexColor: '#e1e4aa',
    topNode: 'mcl_end:end_stone',
    fillerNode: 'mcl_end:end_stone',
    stoneNode: 'mcl_end:end_stone',
    description: 'Scattered fragments and stepping stones floating in the cosmic void.'
  },

  // --- UNDERGROUND CAVES ---
  {
    id: 'mcl_deep_dark',
    name: 'Deep Dark (MineClone)',
    game: 'mineclone2',
    heatPoint: 50,
    humidityPoint: 50,
    yMin: -31000,
    yMax: -256,
    altitudeBand: 'underground',
    color: [13, 41, 49],
    hexColor: '#0d2931',
    topNode: 'mcl_sculk:sculk',
    fillerNode: 'mcl_deepslate:deepslate',
    stoneNode: 'mcl_deepslate:deepslate',
    description: 'Abyssal silent depths covered in reactive sculk growths and ancient cities.'
  },
  {
    id: 'mcl_lush_caves',
    name: 'Lush Caves (MineClone)',
    game: 'mineclone2',
    heatPoint: 60,
    humidityPoint: 75,
    yMin: -31000,
    yMax: -64,
    altitudeBand: 'underground',
    color: [75, 120, 50],
    hexColor: '#4b7832',
    topNode: 'mcl_core:mossycobble',
    fillerNode: 'mcl_core:dirt',
    stoneNode: 'mcl_core:stone',
    description: 'Underground oasis glowing with glow berries, azalea bushes, and moss blocks.'
  }
];


function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Maps an observed modded surface node name from `map.sqlite` into a `BiomeDefinition`
 * for the dynamic Voronoi diagram. Known Everness biomes keep their authentic Luanti
 * climate Voronoi seed points (`heatPoint`, `humidityPoint`) so they never cluster at (50, 50).
 */
export function buildDiscoveredBiomeDefinition(
  nodeName: string,
  meanHeat: number,
  meanHumidity: number
): BiomeDefinition | null {
  const lower = nodeName.toLowerCase();

  // 1. Check Ethereal Mod biomes (specific mod prefix)
  if (lower.startsWith('ethereal:')) {
    if (lower.includes('bamboo')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_bamboo')! };
    }
    if (lower.includes('prairie')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_prairie')! };
    }
    if (lower.includes('crystal') || lower.includes('frost')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_frost')! };
    }
    if (lower.includes('grove') || lower.includes('mediterranean')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_grove')! };
    }
    if (lower.includes('mushroom')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_mushroom')! };
    }
    if (lower.includes('fiery')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_fiery')! };
    }
    if (lower.includes('gray')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_grayness')! };
    }
    if (lower.includes('quicksand')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_quicksand')! };
    }
    if (lower.includes('dry_dirt')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_plains')! };
    }
    if (lower.includes('sakura')) {
      return { ...ETHEREAL_MOD_BIOMES.find(b => b.id === 'ethereal_sakura')! };
    }
  }

  // 2. Check MineClone2 / Mineclonia biomes (specific mod prefix)
  if (lower.startsWith('mcl_')) {
    if (lower.includes('crimson')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_crimson_forest')! };
    }
    if (lower.includes('warped')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_warped_forest')! };
    }
    if (lower.includes('soul_sand') || lower.includes('soul_soil')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_soul_sand_valley')! };
    }
    if (lower.includes('netherrack') || lower.startsWith('mcl_nether:')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_nether_wastes')! };
    }
    if (lower.includes('basalt') || lower.includes('blackstone')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_basalt_deltas')! };
    }
    if (lower.startsWith('mcl_end:') || lower.includes('end_stone')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_the_end')! };
    }
    if (lower.includes('mud') || lower.startsWith('mcl_mangrove:')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_mangrove_swamp')! };
    }
    if (lower.includes('podzol')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_mega_taiga')! };
    }
    if (lower.includes('mycelium')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_mushroom_island')! };
    }
    if (lower.includes('hardened_clay') || lower.includes('redsand')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_mesa')! };
    }
    if (lower.includes('sculk')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_deep_dark')! };
    }
    if (lower.includes('dirt_with_grass_snow')) {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_ice_plains')! };
    }
    if (lower === 'mcl_core:sand') {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_desert')! };
    }
    if (lower === 'mcl_core:dirt_with_grass') {
      return { ...MINECLONE_GAME_BIOMES.find(b => b.id === 'mcl_plains')! };
    }
  }


  // 1. Check Everness underground (`_under`) and ocean (`_ocean`) biome nodes first
  if (lower.includes('coral_desert_stone_with_moss') || lower.includes('coral_desert_mossy_cobble')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_coral_forest_under')! };
  }
  if (lower.includes('coral_sand') || lower.includes('coral_white_sand') || lower.includes('coral_forest_deep_ocean')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_coral_forest_ocean')! };
  }
  if (lower.includes('crystal_cave_dirt') || lower.includes('crystal_moss')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_crystal_forest_under')! };
  }
  if (lower.includes('crystal_sand')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_crystal_forest_ocean')! };
  }
  if (lower.includes('frosted_cave_ice')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_frosted_icesheet_under')! };
  }
  if (lower.includes('frosted_ice_translucent')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_frosted_icesheet_ocean')! };
  }
  if (lower.includes('cursed_brick') || lower.includes('cursed_lands_deep_ocean')) {
    return {
      ...EVERNESS_MOD_BIOMES.find(
        b => b.id === (lower.includes('ocean') ? 'everness_cursed_lands_ocean' : 'everness_cursed_lands_under')
      )!
    };
  }
  if (lower.includes('cursed_mud')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_cursed_lands_ocean')! };
  }
  if (lower.includes('mineral_cave_stone') || lower.includes('mineral_lava_stone')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_mineral_waters_under')! };
  }
  if (lower.includes('bamboo_wood') || lower.includes('bamboo_mosaic')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_bamboo_forest_under')! };
  }
  if (lower.includes('forsaken_desert_chiseled') || lower.includes('forsaken_desert_brick') || lower.includes('forsaken_desert_engraved')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_forsaken_desert_under')! };
  }
  if (lower.includes('forsaken_tundra_cobble') || lower.includes('forsaken_tundra_brick') || lower.includes('mold_stone')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_forsaken_tundra_under')! };
  }
  if (lower.includes('forsaken_tundra_beach_sand')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_forsaken_tundra_ocean')! };
  }

  // 2. Check Everness surface / lowland biome top nodes
  if (
    lower.includes('coral_grass') ||
    lower.includes('coral_dirt') ||
    lower.includes('coral_leaves') ||
    lower.includes('coral_desert')
  ) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_coral_forest')! };
  }
  if (
    lower.includes('crystal_grass') ||
    lower.includes('crystal_dirt') ||
    lower.includes('crystal_stone')
  ) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_crystal_forest')! };
  }
  if (
    lower.includes('frosted_ice') ||
    lower.includes('frosted_snow')
  ) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_frosted_icesheet')! };
  }
  if (
    lower.includes('mineral_stone') ||
    lower.includes('mineral_sand') ||
    lower.includes('mineral_water')
  ) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_mineral_waters')! };
  }
  if (
    lower.includes('cursed_grass') ||
    lower.includes('cursed_dirt') ||
    lower.includes('cursed_stone')
  ) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_cursed_lands')! };
  }
  if (lower === 'everness:dirt_with_grass_1' || (lower.startsWith('everness:') && lower.includes('bamboo'))) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_bamboo_forest')! };
  }
  if (lower.includes('forsaken_desert')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_forsaken_desert')! };
  }
  if (lower.includes('forsaken_tundra')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_forsaken_tundra')! };
  }
  if (lower === 'everness:dry_dirt_with_dry_grass' || lower.includes('baobab')) {
    return { ...EVERNESS_MOD_BIOMES.find(b => b.id === 'everness_baobab_savanna')! };
  }

  // Generic custom mod surface biome (e.g. ethereal:*, Wilhelmines, etc.)
  const [modPrefix, rawItem] = lower.split(':');
  if (
    modPrefix &&
    modPrefix !== 'default' &&
    rawItem &&
    (rawItem.includes('dirt_with_') || rawItem.includes('turf') || rawItem.includes('moss'))
  ) {
    const cleanName = rawItem
      .replace(/^dirt_with_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    const modTitle = modPrefix.charAt(0).toUpperCase() + modPrefix.slice(1);
    const color = resolveNodeColor(nodeName);
    return {
      id: `mod_${modPrefix}_${rawItem}`,
      name: `${cleanName} (${modTitle})`,
      game: modPrefix,
      heatPoint: Math.round(meanHeat),
      humidityPoint: Math.round(meanHumidity),
      yMin: 1,
      yMax: 48,
      altitudeBand: 'lowland',
      color,
      hexColor: rgbToHex(color[0], color[1], color[2]),
      topNode: nodeName,
      fillerNode: `${modPrefix}:dirt`,
      stoneNode: 'default:stone',
      description: `Discovered ${modTitle} mod biome characterized by ${nodeName} surface cover.`
    };
  }

  return null;
}

/**
 * Resolves the authentic `BiomeDefinition` corresponding to an actual SQLite surface node (`map.sqlite`)
 * so that hovering over DB-loaded terrain (Desert, Savanna, Everness Coral Forest, etc.) highlights
 * the exact matching biome in the Voronoi diagram and HUD, and anchors Hybrid climate extrapolation.
 */
export function resolveBiomeForDbNode(
  nodeName: string,
  elevation: number,
  waterDepth: number,
  biomes: BiomeDefinition[],
  fallbackBiome?: BiomeDefinition
): BiomeDefinition {
  const lower = (nodeName || '').toLowerCase();
  const findById = (id: string): BiomeDefinition | undefined =>
    biomes.find(b => b.id === id) ||
    (lower.startsWith('ethereal:') ? ETHEREAL_MOD_BIOMES.find(b => b.id === id) : undefined) ||
    (lower.startsWith('mcl_') ? MINECLONE_GAME_BIOMES.find(b => b.id === id) : undefined) ||
    (lower.startsWith('everness:') ? EVERNESS_MOD_BIOMES.find(b => b.id === id) : undefined) ||
    DEFAULT_LUANTI_BIOMES.find(b => b.id === id);

  // Decorative or thin player attachments should never dictate terrain biome
  if (
    lower.includes('end_rod') ||
    lower.includes('torch') ||
    lower.includes('lantern') ||
    lower.includes('trapdoor') ||
    lower.includes('fence') ||
    lower.includes('carpet') ||
    lower.includes('sign')
  ) {
    return fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }

  // 1. Ocean / Water columns
  if (waterDepth > 0 || lower.includes('water')) {
    if (lower.includes('mineral_water')) {
      return findById('everness_mineral_waters') || findById('tropical_ocean') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('frosted')) {
      return findById('everness_frosted_icesheet_ocean') || findById('icesheet_ocean') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('ice') || lower.includes('snow')) {
      return findById('icesheet_ocean') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('coral')) {
      return findById('everness_coral_forest_ocean') || findById('tropical_ocean') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (fallbackBiome && fallbackBiome.altitudeBand === 'ocean') {
      return fallbackBiome;
    }
    if (fallbackBiome && fallbackBiome.heatPoint >= 75) {
      return findById('tropical_ocean') || fallbackBiome;
    }
    if (fallbackBiome && fallbackBiome.heatPoint <= 22) {
      return findById('tundra_ocean') || fallbackBiome;
    }
    return findById('temperate_ocean') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }

  const isUnderground = elevation <= -200;

  // 2. Ethereal Mod nodes
  if (lower.startsWith('ethereal:')) {
    if (lower.includes('bamboo')) return findById('ethereal_bamboo') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('prairie')) return findById('ethereal_prairie') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('crystal') || lower.includes('frost')) {
      return elevation > 1000 ? findById('ethereal_frost_floatland') || findById('ethereal_frost') || DEFAULT_LUANTI_BIOMES[0] : findById('ethereal_frost') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('grove')) return findById('ethereal_grove') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('mushroom')) return findById('ethereal_mushroom') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('fiery')) return findById('ethereal_fiery') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('gray')) return findById('ethereal_grayness') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('quicksand')) return findById('ethereal_quicksand') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('dry_dirt')) return findById('ethereal_plains') || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('sakura')) return findById('ethereal_sakura') || DEFAULT_LUANTI_BIOMES[0];
  }

  // 3. MineClone2 / Mineclonia nodes (dimension elevation-gated)
  if (lower.startsWith('mcl_')) {
    if (lower.includes('crimson')) return findById('mcl_crimson_forest') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('warped')) return findById('mcl_warped_forest') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('soul_sand') || lower.includes('soul_soil')) return findById('mcl_soul_sand_valley') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('netherrack') || lower.startsWith('mcl_nether:')) {
      if (elevation < -20000) {
        return findById('mcl_nether_wastes') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
      }
      return fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('basalt') || lower.includes('blackstone')) return findById('mcl_basalt_deltas') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.startsWith('mcl_end:') || lower.includes('end_stone')) {
      if (elevation > 5000 || elevation < -25000) {
        return findById('mcl_the_end') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
      }
      return fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('mud') || lower.startsWith('mcl_mangrove:')) return findById('mcl_mangrove_swamp') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('podzol')) return findById('mcl_mega_taiga') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('mycelium')) return findById('mcl_mushroom_island') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('hardened_clay') || lower.includes('redsand')) return findById('mcl_mesa') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('sculk')) return findById('mcl_deep_dark') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower.includes('dirt_with_grass_snow')) return findById('mcl_ice_plains') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower === 'mcl_core:sand') return findById('mcl_desert') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    if (lower === 'mcl_core:dirt_with_grass') return findById('mcl_plains') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }

  // 3.5 Asuna mods (japaneseforest, naturalbiomes)
  if (lower.startsWith('japaneseforest:')) {
    if (fallbackBiome && (fallbackBiome.id === 'deciduous_forest' || fallbackBiome.id === 'grassland')) {
      return fallbackBiome;
    }
    return findById('deciduous_forest') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.startsWith('naturalbiomes:')) {
    if (lower.includes('alpine')) {
      return elevation >= 48
        ? findById('alpine_glacier') || findById('highland_meadow') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0]
        : findById('highland_meadow') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('mediterran')) {
      return findById('savanna') || findById('deciduous_forest') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('heath')) {
      return findById('grassland') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('alderswamp')) {
      return findById('rainforest_swamp') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('outback')) {
      return findById('savanna') || findById('desert') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
    if (lower.includes('beach')) {
      return findById('sandstone_desert') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
    }
  }

  // 2. Everness Mod surface, ocean & underground nodes
  if (
    lower.includes('coral_grass') ||
    lower.includes('coral_dirt') ||
    lower.includes('coral_leaves') ||
    lower.includes('coral_sand') ||
    lower.includes('coral_white_sand') ||
    lower.includes('coral_desert') ||
    lower.includes('coral_tree') ||
    lower.includes('coral_bush') ||
    lower.includes('coral_forest_deep_ocean')
  ) {
    if (isUnderground) {
      return findById('everness_coral_forest_under') || findById('everness_coral_forest') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= 2 || lower.includes('deep_ocean') || lower.includes('white_sand')) {
      return findById('everness_coral_forest_ocean') || findById('everness_coral_forest') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_coral_forest') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (
    lower.includes('crystal_grass') ||
    lower.includes('crystal_dirt') ||
    lower.includes('crystal_cave') ||
    lower.includes('crystal_moss') ||
    lower.includes('crystal_sand') ||
    lower.includes('crystal_stone') ||
    lower.includes('crystal_cobble') ||
    lower.includes('crystal_leaves') ||
    lower.includes('crystal_tree') ||
    lower.includes('crystal_forest_deep_ocean')
  ) {
    if (isUnderground) {
      return findById('everness_crystal_forest_under') || findById('everness_crystal_forest') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= -1 || lower.includes('deep_ocean')) {
      return findById('everness_crystal_forest_ocean') || findById('everness_crystal_forest') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_crystal_forest') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (
    lower.includes('frosted_ice') ||
    lower.includes('frosted_snow') ||
    lower.includes('frosted_cave_ice') ||
    lower.includes('icecobble')
  ) {
    if (isUnderground) {
      return findById('everness_frosted_icesheet_under') || findById('everness_frosted_icesheet') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= -9) {
      return findById('everness_frosted_icesheet_ocean') || findById('everness_frosted_icesheet') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_frosted_icesheet') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (
    lower.includes('mineral_stone') ||
    lower.includes('mineral_sand') ||
    lower.includes('mineral_cave_stone')
  ) {
    if (isUnderground || lower.includes('mineral_cave_stone') || lower.includes('mineral_stone_brick')) {
      return findById('everness_mineral_waters_under') || findById('everness_mineral_waters') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_mineral_waters') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('cursed')) {
    if (isUnderground || lower.includes('cursed_brick')) {
      return findById('everness_cursed_lands_under') || findById('everness_cursed_lands') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= -2 || lower.includes('deep_ocean')) {
      return findById('everness_cursed_lands_ocean') || findById('everness_cursed_lands') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_cursed_lands') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower === 'everness:dirt_with_grass_1' || (lower.startsWith('everness:') && lower.includes('bamboo'))) {
    if (isUnderground || lower.includes('bamboo_wood') || lower.includes('bamboo_mosaic')) {
      return findById('everness_bamboo_forest_under') || findById('everness_bamboo_forest') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_bamboo_forest') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('forsaken_desert') || lower.includes('dry_ocean_dirt')) {
    if (isUnderground || lower.includes('chiseled') || lower.includes('forsaken_desert_brick')) {
      return findById('everness_forsaken_desert_under') || findById('everness_forsaken_desert') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= 3 || lower.includes('dry_ocean_dirt')) {
      return findById('everness_forsaken_desert_ocean') || findById('everness_forsaken_desert') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_forsaken_desert') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('forsaken_tundra') || lower.includes('volcanic_sulfur') || lower.includes('sulfur_stone')) {
    if (isUnderground || lower.includes('sulfur')) {
      return findById('everness_forsaken_tundra_under') || findById('everness_forsaken_tundra') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= -4 || lower.includes('beach_sand')) {
      return findById('everness_forsaken_tundra_ocean') || findById('everness_forsaken_tundra') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('everness_forsaken_tundra') || fallbackBiome || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('baobab') || lower.startsWith('everness:dry_dirt')) {
    return (
      biomes.find(b => b.id === 'everness_baobab_savanna') ||
      findById('savanna') ||
      findById('everness_baobab_savanna') ||
      DEFAULT_LUANTI_BIOMES[0]
    );
  }

  // 3. Vanilla Luanti / Minetest Game surface & flora nodes
  if (
    lower.includes('desert_sand') ||
    lower.includes('desert_stone') ||
    lower.includes('desert_cobble') ||
    lower.includes('cactus') ||
    lower.includes('lava')
  ) {
    if (isUnderground) {
      return findById('desert_under') || findById('desert') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation >= 48) {
      return findById('mesa_badlands') || findById('desert') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('desert') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (
    lower.includes('dry_dirt') ||
    lower.includes('dry_grass') ||
    lower.includes('dry_shrub') ||
    lower.includes('acacia')
  ) {
    return findById('savanna') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('silver_sand')) {
    return findById('cold_desert') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('sandstone') || (lower === 'default:sand' && elevation >= 5)) {
    return findById('sandstone_desert') || findById('desert') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower === 'default:sand') {
    return findById('temperate_ocean') || findById('sandstone_desert') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (
    lower.includes('rainforest') ||
    lower.includes('jungle') ||
    lower.includes('papyrus') ||
    lower.includes('palm')
  ) {
    if (isUnderground) {
      return findById('rainforest_under') || findById('rainforest') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= 8) {
      return findById('rainforest_swamp') || findById('rainforest') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('rainforest') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('coniferous') || lower.includes('pine_needles') || lower.includes('pine_tree')) {
    return findById('coniferous_forest') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('dirt_with_snow')) {
    if (fallbackBiome && fallbackBiome.id === 'snowy_grassland') {
      return fallbackBiome;
    }
    return findById('taiga') || findById('snowy_grassland') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('snowblock') || lower.includes('snow') || lower.includes('ice')) {
    if (isUnderground) {
      return findById('icesheet_under') || findById('icesheet') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation >= 48) {
      return findById('alpine_glacier') || findById('icesheet') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation <= 2) {
      return findById('icesheet_ocean') || findById('icesheet') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('icesheet') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('permafrost')) {
    if (isUnderground) {
      return findById('tundra_under') || findById('tundra') || DEFAULT_LUANTI_BIOMES[0];
    }
    return findById('tundra') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('gravel')) {
    if (isUnderground) {
      return findById('tundra_under') || findById('tundra') || DEFAULT_LUANTI_BIOMES[0];
    }
    return elevation <= 3
      ? findById('tundra_ocean') || findById('tundra') || DEFAULT_LUANTI_BIOMES[0]
      : findById('tundra') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('aspen') || lower === 'default:leaves' || lower === 'default:tree') {
    return findById('deciduous_forest') || findById('grassland') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower.includes('dirt_with_grass') || lower === 'default:dirt') {
    if (elevation >= 48) {
      return findById('highland_meadow') || findById('grassland') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (fallbackBiome && fallbackBiome.id === 'deciduous_forest') {
      return fallbackBiome;
    }
    return findById('grassland') || DEFAULT_LUANTI_BIOMES[0];
  }
  if (lower === 'default:stone' || lower === 'default:cobble' || lower === 'default:mossycobble') {
    if (isUnderground) {
      return fallbackBiome?.altitudeBand === 'underground'
        ? fallbackBiome
        : findById('temperate_under') || DEFAULT_LUANTI_BIOMES[0];
    }
    if (elevation >= 48) {
      return findById('mountain_crag') || DEFAULT_LUANTI_BIOMES[0];
    }
  }

  // 4. Direct match against active biome registry topNode / fillerNode / stoneNode
  const directMatch = biomes.find(
    b => b.topNode === nodeName || b.fillerNode === nodeName || b.stoneNode === nodeName
  );
  if (directMatch) {
    return directMatch;
  }

  return fallbackBiome || findById('grassland') || biomes[0] || DEFAULT_LUANTI_BIOMES[0];
}
