import type maplibregl from 'maplibre-gl';

export interface SaplingTextureEntry {
  key: string;
  file: string;
}

export const SAPLING_ASSET_BASE_PATH = 'assets/saplings/';

export const SAPLING_TEXTURE_ENTRIES: SaplingTextureEntry[] = [
  // Minetest Game
  { key: 'default:sapling', file: 'default_sapling.png' },
  { key: 'default:pine_sapling', file: 'default_pine_sapling.png' },
  { key: 'default:junglesapling', file: 'default_junglesapling.png' },
  { key: 'default:emergent_jungle_sapling', file: 'default_emergent_jungle_sapling.png' },
  { key: 'default:acacia_sapling', file: 'default_acacia_sapling.png' },
  { key: 'default:aspen_sapling', file: 'default_aspen_sapling.png' },
  { key: 'default:bush_sapling', file: 'default_bush_sapling.png' },
  { key: 'default:acacia_bush_sapling', file: 'default_acacia_bush_sapling.png' },
  { key: 'default:pine_bush_sapling', file: 'default_pine_bush_sapling.png' },
  { key: 'default:blueberry_bush_sapling', file: 'default_blueberry_bush_sapling.png' },

  // Everness Mod
  { key: 'everness:crystal_sapling', file: 'everness_crystal_tree_sapling.png' },
  { key: 'everness:crystal_tree_large_sapling', file: 'everness_crystal_tree_large_sapling.png' },
  { key: 'everness:crystal_bush_sapling', file: 'everness_crystal_bush_sapling.png' },
  { key: 'everness:coral_sapling', file: 'everness_coral_tree_sapling.png' },
  { key: 'everness:coral_bioluminescent_sapling', file: 'everness_coral_tree_bioluminescent_sapling.png' },
  { key: 'everness:bamboo_sprout', file: 'everness_bamboo_sprout.png' },
  { key: 'everness:baobab_sapling', file: 'everness_baobab_tree_sapling.png' },
  { key: 'everness:sequoia_sapling', file: 'everness_sequoia_tree_sapling.png' },
  { key: 'everness:willow_sapling', file: 'everness_willow_sapling.png' },
  { key: 'everness:lava_sapling', file: 'everness_lava_tree_sapling.png' },
  { key: 'everness:palm_sapling', file: 'everness_palm_tree_sapling.png' },
  { key: 'everness:mese_sapling', file: 'everness_mese_tree_sapling.png' },
  { key: 'everness:cursed_dream_sapling', file: 'everness_cursed_dream_tree_sapling.png' },
  { key: 'everness:cursed_bush_sapling', file: 'everness_cursed_bush_sapling.png' },
  { key: 'everness:dry_sapling', file: 'everness_dry_tree_sapling.png' },

  // Ethereal Mod
  { key: 'ethereal:sakura_sapling', file: 'ethereal_sakura_sapling.png' },
  { key: 'ethereal:willow_sapling', file: 'ethereal_willow_sapling.png' },
  { key: 'ethereal:redwood_sapling', file: 'ethereal_redwood_sapling.png' },
  { key: 'ethereal:giant_redwood_sapling', file: 'ethereal_giant_redwood_sapling.png' },
  { key: 'ethereal:yellow_tree_sapling', file: 'ethereal_yellow_tree_sapling.png' },
  { key: 'ethereal:mushroom_sapling', file: 'ethereal_mushroom_sapling.png' },
  { key: 'ethereal:frost_tree_sapling', file: 'ethereal_frost_tree_sapling.png' },
  { key: 'ethereal:banana_tree_sapling', file: 'ethereal_banana_tree_sapling.png' },
  { key: 'ethereal:orange_tree_sapling', file: 'ethereal_orange_tree_sapling.png' },
  { key: 'ethereal:lemon_tree_sapling', file: 'ethereal_lemon_tree_sapling.png' },
  { key: 'ethereal:olive_tree_sapling', file: 'ethereal_olive_tree_sapling.png' },
  { key: 'ethereal:gray_tree_sapling', file: 'ethereal_gray_tree_sapling.png' },
  { key: 'ethereal:big_tree_sapling', file: 'ethereal_big_tree_sapling.png' },
  { key: 'ethereal:bamboo_sprout', file: 'ethereal_bamboo_sprout.png' },
  { key: 'ethereal:palm_sapling', file: 'moretrees_palm_sapling.png' },

  // MineClone
  { key: 'mcl_core:birchsapling', file: 'mcl_core_sapling_birch.png' },
  { key: 'mcl_core:sprucesapling', file: 'mcl_core_sapling_spruce.png' },
  { key: 'mcl_core:darksapling', file: 'mcl_core_sapling_big_oak.png' },
  { key: 'mcl_cherry_blossom:cherrysapling', file: 'mcl_cherry_blossom_sapling.png' },
  { key: 'mcl_bamboo:bamboo_shoot', file: 'mcl_bamboo_bamboo_shoot.png' },
  { key: 'mcl_core:cactus', file: 'mcl_core_cactus_side.png' },

  // Asuna
  { key: 'japaneseforest:japanese_sapling_1', file: 'mcl_cherry_blossom_sapling.png' },
  { key: 'japaneseforest:japanese_sapling_2', file: 'mcl_cherry_blossom_sapling.png' },
  { key: 'japaneseforest:japanese_sapling_3', file: 'mcl_cherry_blossom_sapling.png' },

  // Minetest Game — Flowers, Mushrooms, Reeds, Ferns & Farming
  { key: 'flowers:rose', file: 'flowers_rose.png' },
  { key: 'flowers:tulip', file: 'flowers_tulip.png' },
  { key: 'flowers:tulip_black', file: 'flowers_tulip_black.png' },
  { key: 'flowers:dandelion_yellow', file: 'flowers_dandelion_yellow.png' },
  { key: 'flowers:dandelion_white', file: 'flowers_dandelion_white.png' },
  { key: 'flowers:chrysanthemum_green', file: 'flowers_chrysanthemum_green.png' },
  { key: 'flowers:geranium', file: 'flowers_geranium.png' },
  { key: 'flowers:viola', file: 'flowers_viola.png' },
  { key: 'flowers:waterlily', file: 'flowers_waterlily.png' },
  { key: 'flowers:mushroom_red', file: 'flowers_mushroom_red.png' },
  { key: 'flowers:mushroom_brown', file: 'flowers_mushroom_brown.png' },
  { key: 'farming:wheat', file: 'farming_wheat_8.png' },
  { key: 'farming:cotton', file: 'farming_cotton_8.png' },
  { key: 'farming:cotton_wild', file: 'farming_cotton_wild.png' },
  { key: 'default:papyrus', file: 'default_papyrus.png' },
  { key: 'default:fern', file: 'default_fern_1.png' },
  { key: 'default:junglegrass', file: 'default_junglegrass.png' },
  { key: 'default:dry_shrub', file: 'default_dry_shrub.png' },
  { key: 'default:marram_grass', file: 'default_marram_grass_1.png' },
  { key: 'default:large_cactus_seedling', file: 'default_large_cactus_seedling.png' },

  // X Farming Mod — Crops & Tree Saplings
  { key: 'x_farming:barley', file: 'x_farming_barley_8.png' },
  { key: 'x_farming:cotton', file: 'x_farming_cotton_8.png' },
  { key: 'x_farming:corn', file: 'x_farming_corn_10.png' },
  { key: 'x_farming:carrot', file: 'x_farming_carrot_8.png' },
  { key: 'x_farming:potato', file: 'x_farming_potato_8.png' },
  { key: 'x_farming:beetroot', file: 'x_farming_beetroot_8.png' },
  { key: 'x_farming:strawberry', file: 'x_farming_strawberry_4.png' },
  { key: 'x_farming:coffee', file: 'x_farming_coffee_5.png' },
  { key: 'x_farming:rice', file: 'x_farming_rice_8.png' },
  { key: 'x_farming:soybean', file: 'x_farming_soybean_7.png' },
  { key: 'x_farming:stevia', file: 'x_farming_stevia_8.png' },
  { key: 'x_farming:obsidian_wart', file: 'x_farming_obsidian_wart_6.png' },
  { key: 'x_farming:melon', file: 'x_farming_melon_8.png' },
  { key: 'x_farming:pumpkin', file: 'x_farming_pumpkin_8.png' },
  { key: 'x_farming:kiwi_sapling', file: 'x_farming_kiwi_sapling.png' },
  { key: 'x_farming:pine_nut_sapling', file: 'x_farming_pine_nut_sapling.png' },
  { key: 'x_farming:christmas_tree_sapling', file: 'x_farming_christmas_tree_sapling.png' },
  { key: 'x_farming:large_cactus_seedling', file: 'x_farming_large_cactus_with_fruit_seedling.png' },

  // Baked Clay Mod — Flowers
  { key: 'bakedclay:delphinium', file: 'baked_clay_delphinium.png' },
  { key: 'bakedclay:thistle', file: 'baked_clay_thistle.png' },
  { key: 'bakedclay:lazarus', file: 'baked_clay_lazarus.png' },
  { key: 'bakedclay:mannagrass', file: 'baked_clay_mannagrass.png' },

  // Everness Mod — Flowers, Mushrooms & Plants
  { key: 'everness:lotus_flower_pink', file: 'everness_lotus_flower_pink_item.png' },
  { key: 'everness:lotus_flower_white', file: 'everness_lotus_flower_white_item.png' },
  { key: 'everness:lotus_flower_purple', file: 'everness_lotus_flower_purple_item.png' },
  { key: 'everness:venus_trap', file: 'everness_venus_trap_item.png' },
  { key: 'everness:rose_bush', file: 'everness_rose_bush_item.png' },
  { key: 'everness:forsythia', file: 'everness_forsythia_item.png' },
  { key: 'everness:cave_flower', file: 'everness_cave_flower_item.png' },
  { key: 'everness:crystal_mushrooms', file: 'everness_crystal_mushrooms.png' },
  { key: 'everness:coral_mushrooms', file: 'everness_coral_mushrooms_bioluminescent.png' },
  { key: 'everness:coral_plant', file: 'everness_coral_plant_bioluminescent.png' },
  { key: 'everness:bloodspore_plant', file: 'everness_bloodspore_plant.png' },
  { key: 'everness:blooming_cooksonia', file: 'everness_blooming_cooksonia.png' },
  { key: 'everness:red_castor', file: 'everness_red_castor_4.png' }
];

export const DECORATION_AND_CROP_KEYS = new Set<string>([
  'flowers:rose',
  'flowers:tulip',
  'flowers:tulip_black',
  'flowers:dandelion_yellow',
  'flowers:dandelion_white',
  'flowers:chrysanthemum_green',
  'flowers:geranium',
  'flowers:viola',
  'flowers:waterlily',
  'flowers:mushroom_red',
  'flowers:mushroom_brown',
  'farming:wheat',
  'farming:cotton',
  'farming:cotton_wild',
  'default:papyrus',
  'default:fern',
  'default:junglegrass',
  'default:dry_shrub',
  'default:marram_grass',
  'x_farming:barley',
  'x_farming:cotton',
  'x_farming:corn',
  'x_farming:carrot',
  'x_farming:potato',
  'x_farming:beetroot',
  'x_farming:strawberry',
  'x_farming:coffee',
  'x_farming:rice',
  'x_farming:soybean',
  'x_farming:stevia',
  'x_farming:obsidian_wart',
  'x_farming:melon',
  'x_farming:pumpkin',
  'bakedclay:delphinium',
  'bakedclay:thistle',
  'bakedclay:lazarus',
  'bakedclay:mannagrass',
  'everness:lotus_flower_pink',
  'everness:lotus_flower_white',
  'everness:lotus_flower_purple',
  'everness:venus_trap',
  'everness:rose_bush',
  'everness:forsythia',
  'everness:cave_flower',
  'everness:crystal_mushrooms',
  'everness:coral_mushrooms',
  'everness:coral_plant',
  'everness:bloodspore_plant',
  'everness:blooming_cooksonia',
  'everness:red_castor'
]);

/**
 * Returns true if the resolved saplingKey represents a ground decoration (flower, mushroom,
 * reed, fern, shrub) or farming crop rather than a tree.
 */
export function isDecorationOrCropKey(saplingKey: string): boolean {
  return DECORATION_AND_CROP_KEYS.has(saplingKey);
}

export interface TreeCompositeEntry {
  key: string;
  trunkFile: string;
  leavesFile?: string;
  shape: 'deciduous' | 'pine' | 'baobab' | 'palm' | 'cactus' | 'bones' | 'bamboo';
}

export const TREE_ASSET_BASE_PATH = 'assets/trees/';

export const TREE_COMPOSITE_ENTRIES: TreeCompositeEntry[] = [
  // Minetest Game Authentic Voxel Billboard Trees
  {
    key: 'default:tree',
    trunkFile: 'default_tree.png',
    leavesFile: 'default_leaves.png',
    shape: 'deciduous'
  },
  {
    key: 'default:pine_tree',
    trunkFile: 'default_pine_tree.png',
    leavesFile: 'default_pine_needles.png',
    shape: 'pine'
  },
  {
    key: 'default:acacia_tree',
    trunkFile: 'default_acacia_tree.png',
    leavesFile: 'default_acacia_leaves.png',
    shape: 'baobab'
  },
  {
    key: 'default:aspen_tree',
    trunkFile: 'default_aspen_tree.png',
    leavesFile: 'default_aspen_leaves.png',
    shape: 'deciduous'
  },
  {
    key: 'default:jungletree',
    trunkFile: 'default_jungletree.png',
    leavesFile: 'default_jungleleaves.png',
    shape: 'deciduous'
  },
  {
    key: 'default:cactus',
    trunkFile: 'default_cactus_side.png',
    leavesFile: 'default_cactus_top.png',
    shape: 'cactus'
  },

  // Everness Mod Authentic Voxel Billboard Trees
  {
    key: 'everness:coral_bones',
    trunkFile: 'everness_coral_bones.png',
    shape: 'bones'
  },
  {
    key: 'everness:coral_tree',
    trunkFile: 'everness_coral_tree.png',
    leavesFile: 'everness_coral_leaves.png',
    shape: 'deciduous'
  },
  {
    key: 'everness:crystal_tree',
    trunkFile: 'everness_crystal_tree.png',
    leavesFile: 'everness_crystal_leaves.png',
    shape: 'deciduous'
  },
  {
    key: 'everness:baobab_tree',
    trunkFile: 'everness_baobab_tree_side.png',
    leavesFile: 'everness_baobab_tree_leaves.png',
    shape: 'baobab'
  },
  {
    key: 'everness:sequoia_tree',
    trunkFile: 'everness_sequoia_tree_side.png',
    leavesFile: 'everness_sequoia_tree_leaves.png',
    shape: 'pine'
  },
  {
    key: 'everness:willow_tree',
    trunkFile: 'everness_willow_tree_side.png',
    leavesFile: 'everness_willow_leaves.png',
    shape: 'deciduous'
  },
  {
    key: 'everness:palm_tree',
    trunkFile: 'everness_palm_tree_side.png',
    leavesFile: 'everness_palm_tree_leaves.png',
    shape: 'palm'
  },
  {
    key: 'everness:bamboo',
    trunkFile: 'everness_palm_tree_side.png',
    shape: 'bamboo'
  },
  {
    key: 'ethereal:bamboo',
    trunkFile: 'everness_palm_tree_side.png',
    shape: 'bamboo'
  }
];

export const SAPLING_LOOKUP_MAP: Record<string, string> = Object.fromEntries(
  SAPLING_TEXTURE_ENTRIES.map(e => [e.key, e.file])
);

/**
 * Procedurally composites authentic 16x16 trunk bark and canopy leaves textures into
 * camera-facing voxel tree billboards with proper proportions (wide canopy over narrow trunk).
 */
export function renderCompositeTreeBillboard(
  trunkImg: CanvasImageSource,
  leavesImg: CanvasImageSource | null,
  shape: 'deciduous' | 'pine' | 'baobab' | 'palm' | 'cactus' | 'bones' | 'bamboo',
  width = 48,
  height = 56
): ImageData | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;

  // Ground contact ambient occlusion shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height - 3, 11, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (shape === 'bones') {
    // Coral bones: Organic calcium skeletal tree with tapering vertebrae, splayed roots, and branching ribs/antlers
    // 1. Splayed calcium roots
    ctx.fillStyle = '#eceff1';
    ctx.fillRect(14, 48, 20, 4);
    ctx.fillRect(10, 50, 7, 3);
    ctx.fillRect(31, 50, 7, 3);
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(12, 51, 3, 2);
    ctx.fillRect(33, 51, 3, 2);

    // 2. Central tapering vertebral spinal column
    ctx.drawImage(trunkImg, 18, 40, 12, 9);
    ctx.drawImage(trunkImg, 19, 30, 10, 9);
    ctx.drawImage(trunkImg, 20, 20, 8, 9);
    ctx.drawImage(trunkImg, 21, 10, 6, 9);

    // 3. Ivory skeletal bone contours and ribbed joints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(20, 10, 2, 38);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(21, 19, 6, 2);
    ctx.fillRect(20, 29, 8, 2);
    ctx.fillRect(19, 39, 10, 2);

    // 4. Branching skeletal rib / antler boughs curving upwards
    ctx.fillStyle = '#eceff1';
    ctx.fillRect(12, 34, 7, 3);
    ctx.fillRect(8, 26, 4, 9);
    ctx.fillRect(7, 20, 3, 7);
    ctx.fillRect(29, 34, 7, 3);
    ctx.fillRect(36, 26, 4, 9);
    ctx.fillRect(38, 20, 3, 7);

    // Mid upper antlers
    ctx.fillStyle = '#f5f5f0';
    ctx.fillRect(14, 23, 6, 3);
    ctx.fillRect(10, 15, 4, 9);
    ctx.fillRect(9, 10, 3, 6);
    ctx.fillRect(28, 23, 6, 3);
    ctx.fillRect(34, 15, 4, 9);
    ctx.fillRect(36, 10, 3, 6);

    // Calcium tips & crest
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 9, 3, 3);
    ctx.fillRect(37, 9, 3, 3);
    ctx.fillRect(22, 6, 4, 5);
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(12, 27, 2, 7);
    ctx.fillRect(34, 27, 2, 7);

    return ctx.getImageData(0, 0, width, height);
  }

  if (shape === 'bamboo') {
    // Tall bamboo grove: 3 slender culms with joint rings, nodal leaf sprays, and crowned foliage
    // Base roots
    ctx.fillStyle = '#33691e';
    ctx.fillRect(15, 48, 18, 4);

    // Left culm (medium height, x=15, w=4, y=14..50)
    ctx.fillStyle = '#558b2f';
    ctx.fillRect(15, 14, 4, 36);
    // Center culm (tallest, x=22, w=4, y=6..50)
    ctx.fillStyle = '#689f38';
    ctx.fillRect(22, 6, 4, 44);
    // Right culm (medium-short, x=29, w=4, y=18..50)
    ctx.fillStyle = '#558b2f';
    ctx.fillRect(29, 18, 4, 32);

    // Nodal rings & lateral leaf sprays
    const nodeY = [42, 34, 26, 18];
    for (const ny of nodeY) {
      if (ny >= 16) {
        ctx.fillStyle = '#33691e';
        ctx.fillRect(14, ny, 6, 1);
        ctx.fillStyle = '#9ccc65';
        ctx.fillRect(14, ny + 1, 6, 1);
        ctx.fillStyle = '#7cb342';
        ctx.fillRect(9, ny - 2, 6, 2);
        ctx.fillRect(7, ny - 3, 3, 2);
      }
      ctx.fillStyle = '#33691e';
      ctx.fillRect(21, ny, 6, 1);
      ctx.fillStyle = '#9ccc65';
      ctx.fillRect(21, ny + 1, 6, 1);
      ctx.fillStyle = '#8bc34a';
      ctx.fillRect(17, ny - 3, 5, 2);
      ctx.fillRect(26, ny - 2, 5, 2);
      if (ny >= 20) {
        ctx.fillStyle = '#33691e';
        ctx.fillRect(28, ny, 6, 1);
        ctx.fillStyle = '#9ccc65';
        ctx.fillRect(28, ny + 1, 6, 1);
        ctx.fillStyle = '#7cb342';
        ctx.fillRect(33, ny - 3, 6, 2);
        ctx.fillRect(38, ny - 4, 3, 2);
      }
    }

    // Top leafy crowns / foliage cascades
    ctx.fillStyle = '#7cb342';
    ctx.fillRect(18, 4, 12, 6);
    ctx.fillStyle = '#8bc34a';
    ctx.fillRect(16, 2, 16, 4);
    ctx.fillRect(20, 0, 8, 3);
    ctx.fillStyle = '#689f38';
    ctx.fillRect(11, 10, 11, 5);
    ctx.fillRect(9, 8, 8, 4);
    ctx.fillRect(26, 14, 10, 5);
    ctx.fillRect(30, 12, 8, 4);

    return ctx.getImageData(0, 0, width, height);
  }

  if (shape === 'cactus') {
    // Saguaro cactus: Main column with side arms and top cap
    // Left arm
    ctx.drawImage(trunkImg, 9, 24, 7, 14);
    ctx.drawImage(trunkImg, 9, 17, 7, 7);
    if (leavesImg) ctx.drawImage(leavesImg, 9, 16, 7, 3);
    // Right arm
    ctx.drawImage(trunkImg, 32, 21, 7, 14);
    ctx.drawImage(trunkImg, 32, 14, 7, 7);
    if (leavesImg) ctx.drawImage(leavesImg, 32, 13, 7, 3);
    // Main column
    ctx.drawImage(trunkImg, 19, 8, 10, 44);
    if (leavesImg) ctx.drawImage(leavesImg, 19, 7, 10, 4);
    return ctx.getImageData(0, 0, width, height);
  }

  if (shape === 'palm') {
    // Palm: slender trunk with radiating tropical fronds
    ctx.drawImage(trunkImg, 21, 16, 6, 36);
    if (leavesImg) {
      // Top fronds cluster
      ctx.drawImage(leavesImg, 14, 4, 20, 14);
      // Left and right drooping leaves
      ctx.drawImage(leavesImg, 4, 10, 16, 10);
      ctx.drawImage(leavesImg, 28, 10, 16, 10);
    }
    return ctx.getImageData(0, 0, width, height);
  }

  if (shape === 'pine') {
    // Pine: visible lower trunk with conical needle tiers
    ctx.drawImage(trunkImg, 21, 38, 6, 14);
    if (leavesImg) {
      // Bottom widest tier
      ctx.drawImage(leavesImg, 6, 26, 36, 14);
      // Mid tier
      ctx.drawImage(leavesImg, 11, 14, 26, 14);
      // Top cone tier
      ctx.drawImage(leavesImg, 16, 4, 16, 12);
    }
    return ctx.getImageData(0, 0, width, height);
  }

  if (shape === 'baobab') {
    // Baobab: massive thick trunk with wide spreading umbrella canopy
    ctx.drawImage(trunkImg, 16, 20, 16, 32);
    if (leavesImg) {
      ctx.drawImage(leavesImg, 4, 6, 40, 16);
      ctx.drawImage(leavesImg, 10, 3, 28, 8);
    }
    return ctx.getImageData(0, 0, width, height);
  }

  // Default 'deciduous':
  // Central upright trunk
  ctx.drawImage(trunkImg, 19, 20, 10, 32);
  // Root flare
  ctx.drawImage(trunkImg, 17, 48, 14, 4);

  if (leavesImg) {
    // Under-canopy shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(10, 32, 28, 4);

    // Voxel-style puffy canopy (central block + side puffs + top crown)
    ctx.drawImage(leavesImg, 8, 10, 32, 24);
    ctx.drawImage(leavesImg, 5, 14, 10, 16);
    ctx.drawImage(leavesImg, 33, 14, 10, 16);
    ctx.drawImage(leavesImg, 13, 4, 22, 10);
  }

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Resolves a surface decoration (flower, mushroom, reed, fern, waterlily, shrub)
 * or farming crop node name to its canonical sprite key, or null if not a decoration/crop.
 * Ubiquitous basic grass blades (default:grass_1..5, default:dry_grass_1..5, tallgrass)
 * and non-plant blocks (soil, straw, crates, bags, bricks) are intentionally excluded.
 */
export function resolveDecorationOrCropKey(nodeName: string): string | null {
  if (!nodeName || nodeName === 'air' || nodeName === 'ignore') return null;
  const lower = nodeName.toLowerCase();

  // Exclude ubiquitous basic grass blades so grassland biomes stay clean and fast
  if (
    lower.startsWith('default:grass_') ||
    lower.startsWith('default:dry_grass_') ||
    lower.startsWith('everness:dry_grass_') ||
    lower.startsWith('everness:coral_grass_') ||
    lower.startsWith('everness:crystal_grass_') ||
    lower.startsWith('everness:cursed_grass_') ||
    lower.startsWith('everness:ngrass_') ||
    lower.startsWith('everness:grass_extras_') ||
    lower === 'mcl_flowers:tallgrass' ||
    lower.startsWith('mcl_flowers:double_grass')
  ) {
    return null;
  }

  // Exclude soil, farmland, storage crates/bags, crafted items, tools, and structural blocks
  if (
    lower.includes('soil') ||
    lower.includes('dirt') ||
    lower.includes('sand') ||
    lower.includes('stone') ||
    lower.endsWith(':straw') ||
    lower.includes('straw_') ||
    lower.includes('crate') ||
    lower.includes('bag_') ||
    lower.includes('_bag') ||
    lower.includes('block') ||
    lower.includes('brick') ||
    lower.includes('stair') ||
    lower.includes('slab') ||
    lower.includes('wood') ||
    lower.includes('plank') ||
    lower.includes('fence') ||
    lower.includes('door') ||
    lower.includes('gate') ||
    lower.includes('chest') ||
    lower.includes('wall') ||
    lower.includes('floor') ||
    lower.includes('stack') ||
    lower.includes('flour') ||
    lower.includes('bread') ||
    lower.includes('_pie') ||
    lower.includes('pie_') ||
    lower.includes('soup') ||
    lower.includes('stew') ||
    lower.includes('bowl') ||
    lower.includes('bottle') ||
    lower.includes('jar_') ||
    lower.includes('candle') ||
    lower.includes('pillow') ||
    lower.includes('rope') ||
    lower.includes('safety_net') ||
    lower.includes('stove') ||
    lower.includes('trough') ||
    lower.includes('rack') ||
    lower.includes('composter') ||
    lower.includes('scarecrow') ||
    lower.includes('hive') ||
    lower.includes('fish') ||
    lower.includes('hoe') ||
    lower.includes('sickle') ||
    lower.includes('watering_can') ||
    lower.includes('salt') ||
    lower.includes(':ice_') ||
    lower.includes('icefishing') ||
    lower.includes('drilled_ice') ||
    lower.endsWith(':ice') ||
    lower.includes('torch') ||
    lower.includes('lantern') ||
    lower.includes('ceramic_pot') ||
    lower.includes('flowerpot') ||
    lower.includes('_baked') ||
    lower.includes('baked_') ||
    lower.includes('poisonous') ||
    (lower.includes('seed') && !lower.includes('seedling'))
  ) {
    return null;
  }

  // 1. Minetest Game Flowers & Mushrooms (flowers:*)
  if (lower.startsWith('flowers:')) {
    if (lower.includes('mushroom_red') || lower.includes('red_natural')) return 'flowers:mushroom_red';
    if (lower.includes('mushroom_brown') || lower.includes('brown_natural')) return 'flowers:mushroom_brown';
    if (lower.includes('waterlily')) return 'flowers:waterlily';
    if (lower.includes('rose')) return 'flowers:rose';
    if (lower.includes('tulip_black')) return 'flowers:tulip_black';
    if (lower.includes('tulip')) return 'flowers:tulip';
    if (lower.includes('dandelion_yellow')) return 'flowers:dandelion_yellow';
    if (lower.includes('dandelion_white')) return 'flowers:dandelion_white';
    if (lower.includes('chrysanthemum_green')) return 'flowers:chrysanthemum_green';
    if (lower.includes('geranium')) return 'flowers:geranium';
    if (lower.includes('viola')) return 'flowers:viola';
  }

  // 2. Baked Clay Flowers (bakedclay:*)
  if (lower.startsWith('bakedclay:')) {
    if (lower === 'bakedclay:delphinium') return 'bakedclay:delphinium';
    if (lower === 'bakedclay:thistle') return 'bakedclay:thistle';
    if (lower === 'bakedclay:lazarus') return 'bakedclay:lazarus';
    if (lower === 'bakedclay:mannagrass') return 'bakedclay:mannagrass';
    return null;
  }

  // 3. Reeds, Ferns & Shrubs (default:*, mcl_core:*)
  if (lower === 'default:papyrus' || lower === 'mcl_core:reeds') return 'default:papyrus';
  if (lower.startsWith('default:fern_') || lower === 'default:fern') return 'default:fern';
  if (lower === 'default:junglegrass') return 'default:junglegrass';
  if (lower === 'default:dry_shrub' || lower === 'mcl_core:deadbush') return 'default:dry_shrub';
  if (lower.startsWith('default:marram_grass')) return 'default:marram_grass';

  // 4. MineClone2 / VoxeLibre Flowers, Mushrooms & Crops (mcl_*)
  if (lower.startsWith('mcl_flowers:')) {
    if (lower.includes('waterlily')) return 'flowers:waterlily';
    if (lower.includes('fern')) return 'default:fern';
    if (lower.includes('poppy') || lower.includes('tulip_red')) return 'flowers:rose';
    if (lower.includes('rose_bush')) return 'everness:rose_bush';
    if (lower.includes('wither_rose')) return 'flowers:tulip_black';
    if (lower.includes('tulip_orange')) return 'flowers:tulip';
    if (lower.includes('tulip_pink') || lower.includes('peony')) return 'bakedclay:lazarus';
    if (
      lower.includes('tulip_white') ||
      lower.includes('oxeye_daisy') ||
      lower.includes('azure_bluet') ||
      lower.includes('lily_of_the_valley')
    ) {
      return 'flowers:dandelion_white';
    }
    if (lower.includes('dandelion') || lower.includes('sunflower')) return 'flowers:dandelion_yellow';
    if (lower.includes('blue_orchid') || lower.includes('cornflower')) return 'flowers:geranium';
    if (lower.includes('allium') || lower.includes('lilac')) return 'flowers:viola';
  }
  if (lower.startsWith('mcl_mushrooms:') || lower.startsWith('mcl_crimson:')) {
    if (lower.includes('mushroom_red') || lower.includes('crimson_fungus')) return 'flowers:mushroom_red';
    if (lower.includes('mushroom_brown')) return 'flowers:mushroom_brown';
    if (lower.includes('warped_fungus')) return 'everness:crystal_mushrooms';
  }
  if (lower.startsWith('mcl_nether:nether_wart')) {
    return 'x_farming:obsidian_wart';
  }

  // 5. Everness Flowers, Mushrooms & Ground Plants (everness:*)
  if (lower.startsWith('everness:')) {
    if (lower.includes('lotus_flower_pink')) return 'everness:lotus_flower_pink';
    if (lower.includes('lotus_flower_white')) return 'everness:lotus_flower_white';
    if (lower.includes('lotus_flower_purple')) return 'everness:lotus_flower_purple';
    if (lower.includes('lotus_leaf')) return 'flowers:waterlily';
    if (lower.includes('venus_trap')) return 'everness:venus_trap';
    if (lower.includes('rose_bush')) return 'everness:rose_bush';
    if (lower.includes('forsythia')) return 'everness:forsythia';
    if (lower.includes('cave_flower') || lower.includes('clover_with_flowers') || lower.startsWith('everness:flowers')) {
      return 'everness:cave_flower';
    }
    if (lower.includes('crystal_mushrooms')) return 'everness:crystal_mushrooms';
    if (
      lower.includes('coral_mushrooms') ||
      lower.includes('luminous_mushroom') ||
      lower.includes('glossy_mushroom')
    ) {
      return 'everness:coral_mushrooms';
    }
    if (lower.includes('coral_plant') || lower.includes('coral_burdock') || lower.includes('coral_shrub')) {
      return 'everness:coral_plant';
    }
    if (lower.includes('bloodspore_plant')) return 'everness:bloodspore_plant';
    if (
      lower.includes('blooming_cooksonia') ||
      lower.includes('forsaken_desert_plant') ||
      lower.includes('twisted_crystal_grass')
    ) {
      return 'everness:blooming_cooksonia';
    }
    if (lower.includes('red_castor')) return 'everness:red_castor';
  }

  // 6. Ethereal Ground Flora & Crops (ethereal:*)
  if (lower.startsWith('ethereal:')) {
    if (lower.includes('fire_flower')) return 'flowers:tulip';
    if (lower.includes('illumishroom')) return 'everness:crystal_mushrooms';
    if (lower === 'ethereal:mushroom') return 'flowers:mushroom_red';
    if (lower.includes('fern')) return 'default:fern';
    if (lower.includes('dry_shrub')) return 'default:dry_shrub';
    if (lower.includes('snowygrass') || lower.includes('crystalgrass')) return 'default:marram_grass';
    if (lower.includes('strawberry')) return 'x_farming:strawberry';
    if (lower.includes('onion')) return 'x_farming:potato';
  }

  // 7. Farming Crops (farming:*, x_farming:*, mcl_farming:*)
  if (
    lower.startsWith('farming:') ||
    lower.startsWith('x_farming:') ||
    lower.startsWith('mcl_farming:')
  ) {
    // Exclude x_farming trees & cacti (handled as trees/saplings below)
    if (
      lower.includes('kiwi') ||
      lower.includes('pine_nut') ||
      lower.includes('christmas_tree') ||
      lower.includes('cactus') ||
      lower.includes('jungle')
    ) {
      return null;
    }
    if (lower.includes('cotton_wild')) return 'farming:cotton_wild';
    if (lower.startsWith('farming:cotton')) return 'farming:cotton';
    if (lower.includes('cotton') || lower.includes('hemp')) return 'x_farming:cotton';
    if (lower.includes('barley')) return 'x_farming:barley';
    if (lower.includes('wheat') || lower.includes('oat') || lower.includes('rye')) return 'farming:wheat';
    if (lower.includes('corn')) return 'x_farming:corn';
    if (lower.includes('carrot')) return 'x_farming:carrot';
    if (lower.includes('potato') || lower.includes('garlic') || lower.includes('onion')) return 'x_farming:potato';
    if (lower.includes('beetroot') || lower.includes('rhubarb')) return 'x_farming:beetroot';
    if (
      lower.includes('strawberry') ||
      lower.includes('raspberry') ||
      lower.includes('blueberry') ||
      lower.includes('blackberry') ||
      lower.includes('sweet_berry') ||
      lower.includes('tomato') ||
      lower.includes('chili')
    ) {
      return 'x_farming:strawberry';
    }
    if (
      lower.includes('coffee') ||
      lower.includes('beans') ||
      lower.includes('pea') ||
      lower.includes('grapes') ||
      lower.includes('cocoa')
    ) {
      return 'x_farming:coffee';
    }
    if (lower.includes('rice')) return 'x_farming:rice';
    if (
      lower.includes('soy') ||
      lower.includes('cabbage') ||
      lower.includes('lettuce') ||
      lower.includes('spinach') ||
      lower.includes('parsley') ||
      lower.includes('mint') ||
      lower.includes('artichoke')
    ) {
      return 'x_farming:soybean';
    }
    if (lower.includes('stevia') || lower.includes('vanilla')) return 'x_farming:stevia';
    if (lower.includes('obsidian_wart') || lower.includes('nether_wart')) return 'x_farming:obsidian_wart';
    if (lower.includes('melon') || lower.includes('pineapple')) return 'x_farming:melon';
    if (lower.includes('pumpkin')) return 'x_farming:pumpkin';
    if (lower.includes('sunflower')) return 'flowers:dandelion_yellow';
  }

  return null;
}

/**
 * Returns true if the voxel node name is a supported surface decoration or farming crop.
 */
export function isDecorationOrCropNode(nodeName: string): boolean {
  return resolveDecorationOrCropKey(nodeName) !== null;
}

/**
 * Resolves a voxel node name (trunk, log, leaves, sprout, decoration, or crop) to its canonical tree sprite or sapling key.
 * Prioritizes Minetest Game and Everness authentic textures over MineClone/MCL per user requirement.
 */
export function resolveSaplingForNode(nodeName: string): string | null {
  if (!nodeName || nodeName === 'air' || nodeName === 'ignore') return null;
  const lower = nodeName.toLowerCase();

  // Check surface decorations & farming crops first
  const decoOrCropKey = resolveDecorationOrCropKey(nodeName);
  if (decoOrCropKey) {
    return decoOrCropKey;
  }

  // Exclude crafted wooden building materials (planks, stairs, slabs, fences, etc.)
  if (
    (lower.includes('wood') && !lower.includes('redwood') && !lower.includes('ironwood')) ||
    lower.includes('plank') ||
    lower.includes('stair') ||
    lower.includes('slab') ||
    lower.includes('fence') ||
    lower.includes('door') ||
    lower.includes('gate') ||
    lower.includes('chest') ||
    lower.includes('wall') ||
    lower.includes('floor')
  ) {
    return null;
  }

  // 0. X Farming Trees & Cacti
  if (lower.startsWith('x_farming:')) {
    if (lower.includes('kiwi')) return 'x_farming:kiwi_sapling';
    if (lower.includes('pine_nut')) return 'x_farming:pine_nut_sapling';
    if (lower.includes('christmas_tree')) return 'x_farming:christmas_tree_sapling';
    if (lower.includes('large_cactus') && lower.includes('seedling')) return 'x_farming:large_cactus_seedling';
    if (lower.includes('cactus')) return 'default:cactus';
  }

  // 1. Everness Mod (Authentic textures)
  if (lower.startsWith('everness:')) {
    if (lower.includes('coral_bones')) return 'everness:coral_bones';
    if (lower.includes('crystal_tree') || lower.includes('crystal_leaves')) return 'everness:crystal_tree';
    if (lower.includes('crystal_bush')) return 'everness:crystal_bush_sapling';
    if (lower.includes('coral_tree') || lower.includes('coral_leaves')) {
      return lower.includes('bioluminescent') ? 'everness:coral_bioluminescent_sapling' : 'everness:coral_tree';
    }
    if (lower.includes('bamboo')) {
      if (lower.includes('sprout') || lower.includes('shoot')) {
        return 'everness:bamboo_sprout';
      }
      return 'everness:bamboo';
    }
    if (lower.includes('baobab')) return 'everness:baobab_tree';
    if (lower.includes('sequoia')) return 'everness:sequoia_tree';
    if (lower.includes('willow')) return 'everness:willow_tree';
    if (lower.includes('palm')) return 'everness:palm_tree';
    if (lower.includes('lava_tree')) return 'everness:lava_sapling';
    if (lower.includes('mese_tree')) return 'everness:mese_sapling';
    if (lower.includes('cursed_dream')) return 'everness:cursed_dream_sapling';
    if (lower.includes('cursed_bush')) return 'everness:cursed_bush_sapling';
    if (lower.includes('dry_tree') || lower.includes('forsaken')) return 'everness:dry_sapling';
  }

  // 2. MineClone (Prefer Minetest Game and Everness composite textures before MCL per user requirement)
  if (lower.startsWith('mcl_')) {
    if (lower.includes('spruce')) return 'default:pine_tree';
    if (lower.includes('birch')) return 'default:aspen_tree';
    if (lower.includes('dark')) return 'default:tree';
    if (lower.includes('cherry')) return 'mcl_cherry_blossom:cherrysapling';
    if (lower.includes('bamboo')) {
      if (lower.includes('shoot') || lower.includes('sprout')) {
        return 'mcl_bamboo:bamboo_shoot';
      }
      return 'everness:bamboo';
    }
    if (lower.includes('cactus')) return 'default:cactus';
    if (lower.includes('jungle')) return 'default:jungletree';
    if (lower.includes('acacia')) return 'default:acacia_tree';
    if (lower.includes('oak') || lower.includes('tree') || lower.includes('leaves')) return 'default:tree';
  }

  // 3. Ethereal Mod
  if (lower.startsWith('ethereal:')) {
    if (lower.includes('sakura')) return 'ethereal:sakura_sapling';
    if (lower.includes('willow')) return 'everness:willow_tree';
    if (lower.includes('giant_redwood')) return 'ethereal:giant_redwood_sapling';
    if (lower.includes('redwood')) return 'ethereal:redwood_sapling';
    if (lower.includes('yellow_tree') || lower.includes('yellow_trunk')) return 'ethereal:yellow_tree_sapling';
    if (lower.includes('mushroom')) return 'ethereal:mushroom_sapling';
    if (lower.includes('frost')) return 'ethereal:frost_tree_sapling';
    if (lower.includes('banana')) return 'ethereal:banana_tree_sapling';
    if (lower.includes('orange')) return 'ethereal:orange_tree_sapling';
    if (lower.includes('lemon')) return 'ethereal:lemon_tree_sapling';
    if (lower.includes('olive')) return 'ethereal:olive_tree_sapling';
    if (lower.includes('gray_tree')) return 'ethereal:gray_tree_sapling';
    if (lower.includes('bamboo')) {
      if (lower.includes('sprout') || lower.includes('shoot')) {
        return 'ethereal:bamboo_sprout';
      }
      return 'ethereal:bamboo';
    }
    if (lower.includes('palm')) return 'everness:palm_tree';
  }

  // 3.5 Asuna mods (japaneseforest, naturalbiomes)
  if (lower.startsWith('japaneseforest:')) {
    if (lower.includes('sapling') || lower.includes('leaves') || lower.includes('tree')) {
      return 'mcl_cherry_blossom:cherrysapling';
    }
  }
  if (lower.startsWith('naturalbiomes:')) {
    if (lower.includes('alppine1') || lower.includes('alppine2')) {
      return 'default:pine_tree';
    }
    if (lower.includes('cowberry')) {
      return 'default:blueberry_bush_sapling';
    }
    if (lower.includes('palm')) {
      return 'everness:palm_tree';
    }
    if (lower.includes('alder')) {
      return 'default:aspen_tree';
    }
    if (lower.includes('bamboo')) {
      return 'everness:bamboo';
    }
  }

  // 4. Minetest Game (Default - Core Voxel Composite Trees)
  if (lower.includes('pine_bush')) return 'default:pine_bush_sapling';
  if (lower.includes('acacia_bush')) return 'default:acacia_bush_sapling';
  if (lower.includes('blueberry')) return 'default:blueberry_bush_sapling';
  if (lower.includes('bush')) return 'default:bush_sapling';

  if (lower.includes('pine_tree') || lower.includes('pine_needles')) {
    return 'default:pine_tree';
  }
  if (lower.includes('emergent_jungle')) return 'default:emergent_jungle_sapling';
  if (lower.includes('jungletree') || lower.includes('jungleleaves') || lower.includes('jungle_tree')) {
    return 'default:jungletree';
  }
  if (lower.includes('acacia_tree') || lower.includes('acacia_leaves')) {
    return 'default:acacia_tree';
  }
  if (lower.includes('aspen_tree') || lower.includes('aspen_leaves')) {
    return 'default:aspen_tree';
  }
  if (lower.includes('cactus')) return 'default:cactus';
  if (lower.includes('bamboo')) {
    if (lower.includes('sprout') || lower.includes('shoot')) {
      return 'everness:bamboo_sprout';
    }
    return 'everness:bamboo';
  }
  if (lower.includes('coral_bones')) return 'everness:coral_bones';

  // Generic tree/leaves -> Minetest Game default oak tree
  if (
    lower.includes('tree') ||
    lower.includes('leaves') ||
    lower.includes('trunk') ||
    lower.includes('log') ||
    lower.includes('sapling')
  ) {
    return 'default:tree';
  }

  return null;
}

/**
 * Maps a procedural biome ID to its signature tree billboard or sapling sprite and vegetation density.
 */
export function resolveSaplingForBiome(biomeId: string): { saplingKey: string; density: number } | null {
  if (!biomeId) return null;
  const id = biomeId.toLowerCase();

  // Minetest Game Biomes
  if (id === 'coniferous_forest' || id === 'taiga') {
    return { saplingKey: 'default:pine_tree', density: 0.045 };
  }
  if (id === 'snowy_grassland') {
    return { saplingKey: 'default:pine_bush_sapling', density: 0.012 };
  }
  if (id === 'rainforest' || id.includes('jungle')) {
    return { saplingKey: 'default:jungletree', density: 0.065 };
  }
  if (id === 'savanna') {
    return { saplingKey: 'default:acacia_tree', density: 0.02 };
  }
  if (id === 'deciduous_forest' || id === 'forest') {
    return { saplingKey: 'default:tree', density: 0.045 };
  }
  if ((id.includes('desert') && id !== 'stone_desert') || id.includes('dune')) {
    return { saplingKey: 'default:cactus', density: 0.007 };
  }
  if (id === 'grassland') {
    return { saplingKey: 'default:bush_sapling', density: 0.008 };
  }

  // Everness Mod Biomes
  if (id.includes('crystal_forest')) {
    return { saplingKey: 'everness:crystal_tree', density: 0.04 };
  }
  if (id.includes('bamboo_forest') || id.includes('bamboo')) {
    return { saplingKey: 'everness:bamboo', density: 0.045 };
  }
  if (id.includes('coral_forest')) {
    return { saplingKey: 'everness:coral_tree', density: 0.035 };
  }
  if (id.includes('coral_bones') || id.includes('bone')) {
    return { saplingKey: 'everness:coral_bones', density: 0.025 };
  }
  if (id.includes('forsaken_tundra') || id.includes('forsaken')) {
    return { saplingKey: 'everness:dry_sapling', density: 0.014 };
  }
  if (id.includes('cursed_lands') || id.includes('cursed')) {
    return { saplingKey: 'everness:cursed_dream_sapling', density: 0.022 };
  }
  if (id.includes('baobab')) {
    return { saplingKey: 'everness:baobab_tree', density: 0.015 };
  }

  // Ethereal Mod Biomes
  if (id.includes('sakura')) {
    return { saplingKey: 'ethereal:sakura_sapling', density: 0.05 };
  }
  if (id.includes('redwood')) {
    return { saplingKey: 'ethereal:redwood_sapling', density: 0.035 };
  }
  if (id.includes('willow')) {
    return { saplingKey: 'everness:willow_tree', density: 0.04 };
  }
  if (id.includes('yellow')) {
    return { saplingKey: 'ethereal:yellow_tree_sapling', density: 0.035 };
  }
  if (id.includes('mushroom')) {
    return { saplingKey: 'ethereal:mushroom_sapling', density: 0.025 };
  }
  if (id.includes('frost')) {
    return { saplingKey: 'ethereal:frost_tree_sapling', density: 0.03 };
  }
  if (id.includes('grove')) {
    return { saplingKey: 'ethereal:banana_tree_sapling', density: 0.03 };
  }
  if (id.includes('mediterranean') || id.includes('olive')) {
    return { saplingKey: 'ethereal:olive_tree_sapling', density: 0.035 };
  }

  // MineClone Biomes (Prefer Minetest Game before MCL)
  if (id.includes('birch')) {
    return { saplingKey: 'default:aspen_tree', density: 0.045 };
  }
  if (id.includes('spruce') || id.includes('mega_taiga')) {
    return { saplingKey: 'default:pine_tree', density: 0.05 };
  }
  if (id.includes('dark_forest') || id.includes('roofed')) {
    return { saplingKey: 'default:tree', density: 0.055 };
  }
  if (id.includes('cherry')) {
    return { saplingKey: 'mcl_cherry_blossom:cherrysapling', density: 0.05 };
  }

  return null;
}

/**
 * Generates an instant, crisp voxel-art fallback billboard image for MapLibre
 * so tree sprites are IMMEDIATELY visible without waiting on async disk/network loads.
 * Uses a pure typed-array pixel buffer for 100% reliability across all environments (including test/worker).
 */
export function createProceduralFallbackBillboard(
  shape: 'deciduous' | 'pine' | 'baobab' | 'palm' | 'cactus' | 'bones' | 'bamboo',
  width = 48,
  height = 56
): ImageData | { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4);

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  };

  const fillRect = (rx: number, ry: number, rw: number, rh: number, r: number, g: number, b: number, a = 255) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  };

  // Ground shadow
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -11; dx <= 11; dx++) {
      if ((dx * dx) / 121 + (dy * dy) / 6 <= 1.0) {
        setPixel(Math.round(width / 2) + dx, height - 3 + dy, 0, 0, 0, 75);
      }
    }
  }

  if (shape === 'bones') {
    // Splayed calcium roots
    fillRect(14, 48, 20, 4, 236, 239, 241);
    fillRect(10, 50, 7, 3, 207, 216, 220);
    fillRect(31, 50, 7, 3, 207, 216, 220);
    // Central tapering vertebrae
    fillRect(18, 40, 12, 9, 236, 239, 241);
    fillRect(19, 30, 10, 9, 245, 245, 240);
    fillRect(20, 20, 8, 9, 245, 245, 240);
    fillRect(21, 10, 6, 9, 255, 255, 255);
    // Ribbed clefts
    fillRect(20, 19, 8, 2, 176, 190, 197);
    fillRect(19, 29, 10, 2, 176, 190, 197);
    fillRect(18, 39, 12, 2, 176, 190, 197);
    // Skeletal antler boughs
    fillRect(12, 34, 7, 3, 236, 239, 241);
    fillRect(8, 26, 4, 9, 236, 239, 241);
    fillRect(7, 20, 3, 7, 255, 255, 255);
    fillRect(29, 34, 7, 3, 236, 239, 241);
    fillRect(36, 26, 4, 9, 236, 239, 241);
    fillRect(38, 20, 3, 7, 255, 255, 255);
    // Mid antlers
    fillRect(14, 23, 6, 3, 245, 245, 240);
    fillRect(10, 15, 4, 9, 245, 245, 240);
    fillRect(28, 23, 6, 3, 245, 245, 240);
    fillRect(34, 15, 4, 9, 245, 245, 240);
    // Calcium crown tip
    fillRect(22, 6, 4, 5, 255, 255, 255);
  } else if (shape === 'bamboo') {
    // Tall bamboo grove: 3 culms with rings and leafy crowns
    // Roots
    fillRect(15, 48, 18, 4, 51, 105, 30);
    // Culms
    fillRect(15, 14, 4, 36, 85, 139, 47);
    fillRect(22, 6, 4, 44, 104, 159, 56);
    fillRect(29, 18, 4, 32, 85, 139, 47);
    // Rings & leaf sprays
    for (const ny of [42, 34, 26, 18]) {
      fillRect(14, ny, 6, 1, 51, 105, 30);
      fillRect(21, ny, 6, 1, 51, 105, 30);
      fillRect(28, ny, 6, 1, 51, 105, 30);
      fillRect(9, ny - 2, 6, 2, 124, 179, 66);
      fillRect(33, ny - 2, 6, 2, 124, 179, 66);
    }
    // Foliage crowns
    fillRect(16, 2, 16, 5, 139, 195, 74);
    fillRect(20, 0, 8, 3, 156, 204, 101);
    fillRect(10, 8, 9, 5, 104, 159, 56);
    fillRect(29, 12, 9, 5, 104, 159, 56);
  } else if (shape === 'cactus') {
    fillRect(19, 8, 10, 44, 46, 125, 50);
    fillRect(9, 20, 7, 18, 46, 125, 50);
    fillRect(32, 16, 7, 18, 46, 125, 50);
    fillRect(21, 10, 2, 40, 56, 142, 60);
  } else if (shape === 'palm') {
    fillRect(22, 18, 5, 34, 141, 110, 99);
    fillRect(14, 6, 20, 12, 46, 125, 50);
    fillRect(4, 12, 16, 8, 46, 125, 50);
    fillRect(28, 12, 16, 8, 46, 125, 50);
  } else if (shape === 'pine') {
    fillRect(21, 38, 6, 14, 78, 52, 46);
    fillRect(6, 26, 36, 14, 27, 94, 32);
    fillRect(11, 14, 26, 14, 46, 125, 50);
    fillRect(16, 4, 16, 12, 56, 142, 60);
  } else if (shape === 'baobab') {
    fillRect(16, 20, 16, 32, 121, 85, 72);
    fillRect(4, 6, 40, 16, 85, 139, 47);
    fillRect(10, 2, 28, 8, 85, 139, 47);
  } else {
    // deciduous
    fillRect(20, 24, 8, 28, 109, 76, 65);
    fillRect(8, 10, 32, 22, 46, 125, 50);
    fillRect(5, 14, 10, 14, 46, 125, 50);
    fillRect(33, 14, 10, 14, 46, 125, 50);
    fillRect(12, 4, 24, 10, 67, 160, 71);
  }

  if (typeof ImageData !== 'undefined') {
    try {
      return new ImageData(data, width, height);
    } catch {
      // Fallback in environments without ImageData constructor
    }
  }

  return { width, height, data };
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    // Do NOT set crossOrigin on local same-origin assets: avoids CORS rejection on dev servers without ACAO headers
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      resolve(null);
    };
    img.src = src;
  });
}

function safeSetOrUpdateMapImage(
  map: maplibregl.Map,
  key: string,
  imageData: ImageData | { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
): void {
  try {
    if (map.hasImage(key)) {
      map.removeImage(key);
    }
    map.addImage(key, imageData as any, { pixelRatio: 1 });
  } catch {
    // Ignore test environment or context issues
  }
}

/**
 * Loads and registers both composite tree billboards and sapling textures into MapLibre GL.
 * Synchronously registers instant pixel-art billboard fallbacks so trees are IMMEDIATELY visible,
 * then seamlessly updates them as authentic 16x16 game textures load from disk.
 */
export async function loadAndRegisterSaplingTextures(
  map: maplibregl.Map,
  targetSize = 48
): Promise<void> {
  if (typeof window === 'undefined' || !map) return;

  const targetH = Math.round(targetSize * 1.16);

  // 1. Immediately register instant procedural fallback billboards if images not yet present
  for (const entry of TREE_COMPOSITE_ENTRIES) {
    if (!map.hasImage(entry.key)) {
      const fallback = createProceduralFallbackBillboard(entry.shape, targetSize, targetH);
      if (fallback) {
        safeSetOrUpdateMapImage(map, entry.key, fallback);
      }
    }
  }

  // 2. Immediately register instant procedural fallback for sapling icons
  for (const entry of SAPLING_TEXTURE_ENTRIES) {
    if (!map.hasImage(entry.key)) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#388E3C';
          ctx.fillRect(18, 14, 12, 18);
          ctx.fillRect(14, 20, 20, 6);
          ctx.fillStyle = '#6D4C41';
          ctx.fillRect(22, 32, 4, 12);
          const data = ctx.getImageData(0, 0, targetSize, targetSize);
          safeSetOrUpdateMapImage(map, entry.key, data);
        }
      } catch {
        // Fallback in headless environment
      }
    }
  }

  // 3. Asynchronously load and composite high-fidelity tree billboards from Minetest Game & Everness
  const compositePromises = TREE_COMPOSITE_ENTRIES.map(async entry => {
    const trunkImg = await loadImageElement(`${TREE_ASSET_BASE_PATH}${entry.trunkFile}`);
    if (!trunkImg) return;

    let leavesImg: HTMLImageElement | null = null;
    if (entry.leavesFile) {
      leavesImg = await loadImageElement(`${TREE_ASSET_BASE_PATH}${entry.leavesFile}`);
    }

    try {
      const imageData = renderCompositeTreeBillboard(
        trunkImg,
        leavesImg,
        entry.shape,
        targetSize,
        targetH
      );
      if (imageData) {
        safeSetOrUpdateMapImage(map, entry.key, imageData);
      }
    } catch {
      // Ignore individual canvas draw errors
    }
  });

  // 4. Asynchronously load standard sapling / seedling icon entries
  const saplingPromises = SAPLING_TEXTURE_ENTRIES.map(async entry => {
    const img = await loadImageElement(`${SAPLING_ASSET_BASE_PATH}${entry.file}`);
    if (!img) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
        safeSetOrUpdateMapImage(map, entry.key, imageData);
      }
    } catch {
      // Ignore individual texture draw errors
    }
  });

  await Promise.all([...compositePromises, ...saplingPromises]);
}
