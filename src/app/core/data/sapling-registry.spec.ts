import { describe, expect, it } from 'vitest';
import {
  SAPLING_TEXTURE_ENTRIES,
  TREE_COMPOSITE_ENTRIES,
  createProceduralFallbackBillboard,
  isDecorationOrCropKey,
  isDecorationOrCropNode,
  resolveDecorationOrCropKey,
  resolveSaplingForBiome,
  resolveSaplingForNode
} from './sapling-registry';

describe('Sapling Texture & Flora Registry', () => {
  it('registers comprehensive sapling entries across MTG, Everness, Ethereal, and MineClone', () => {
    expect(SAPLING_TEXTURE_ENTRIES.length).toBeGreaterThanOrEqual(40);
    for (const entry of SAPLING_TEXTURE_ENTRIES) {
      expect(entry.key).toBeTruthy();
      expect(entry.file.endsWith('.png')).toBe(true);
    }
  });

  it('registers high-fidelity composite tree billboard entries from MTG and Everness', () => {
    expect(TREE_COMPOSITE_ENTRIES.length).toBeGreaterThanOrEqual(13);
    for (const entry of TREE_COMPOSITE_ENTRIES) {
      expect(entry.key).toBeTruthy();
      expect(entry.trunkFile.endsWith('.png')).toBe(true);
      if (entry.leavesFile) {
        expect(entry.leavesFile.endsWith('.png')).toBe(true);
      }
    }
  });

  describe('resolveSaplingForNode (DB Mode Voxel Nodes)', () => {
    it('resolves Minetest Game (MTG) trees to composite voxel billboards', () => {
      expect(resolveSaplingForNode('default:tree')).toBe('default:tree');
      expect(resolveSaplingForNode('default:leaves')).toBe('default:tree');
      expect(resolveSaplingForNode('default:pine_tree')).toBe('default:pine_tree');
      expect(resolveSaplingForNode('default:pine_needles')).toBe('default:pine_tree');
      expect(resolveSaplingForNode('default:jungletree')).toBe('default:jungletree');
      expect(resolveSaplingForNode('default:jungleleaves')).toBe('default:jungletree');
      expect(resolveSaplingForNode('default:acacia_tree')).toBe('default:acacia_tree');
      expect(resolveSaplingForNode('default:aspen_tree')).toBe('default:aspen_tree');
      expect(resolveSaplingForNode('default:cactus')).toBe('default:cactus');
      expect(resolveSaplingForNode('default:bush_leaves')).toBe('default:bush_sapling');
      expect(resolveSaplingForNode('default:pine_bush_needles')).toBe('default:pine_bush_sapling');
    });

    it('resolves Everness mod signature trees, coral bones, and bamboo', () => {
      expect(resolveSaplingForNode('everness:coral_bones')).toBe('everness:coral_bones');
      expect(resolveSaplingForNode('everness:crystal_tree')).toBe('everness:crystal_tree');
      expect(resolveSaplingForNode('everness:crystal_leaves')).toBe('everness:crystal_tree');
      expect(resolveSaplingForNode('everness:coral_tree')).toBe('everness:coral_tree');
      expect(resolveSaplingForNode('everness:bamboo_stalk')).toBe('everness:bamboo');
      expect(resolveSaplingForNode('everness:bamboo_sprout')).toBe('everness:bamboo_sprout');
      expect(resolveSaplingForNode('everness:sequoia_trunk')).toBe('everness:sequoia_tree');
      expect(resolveSaplingForNode('everness:baobab_trunk')).toBe('everness:baobab_tree');
      expect(resolveSaplingForNode('everness:cursed_dream_tree')).toBe('everness:cursed_dream_sapling');
    });

    it('resolves Ethereal mod signature flora', () => {
      expect(resolveSaplingForNode('ethereal:sakura_trunk')).toBe('ethereal:sakura_sapling');
      expect(resolveSaplingForNode('ethereal:willow_trunk')).toBe('everness:willow_tree');
      expect(resolveSaplingForNode('ethereal:redwood_trunk')).toBe('ethereal:redwood_sapling');
      expect(resolveSaplingForNode('ethereal:yellow_trunk')).toBe('ethereal:yellow_tree_sapling');
      expect(resolveSaplingForNode('ethereal:mushroom_trunk')).toBe('ethereal:mushroom_sapling');
      expect(resolveSaplingForNode('ethereal:frost_tree_trunk')).toBe('ethereal:frost_tree_sapling');
    });

    it('prefers Minetest Game and Everness composite textures over MineClone species per user specification', () => {
      expect(resolveSaplingForNode('mcl_core:birchtree')).toBe('default:aspen_tree');
      expect(resolveSaplingForNode('mcl_core:sprucetree')).toBe('default:pine_tree');
      expect(resolveSaplingForNode('mcl_core:dark_oak')).toBe('default:tree');
      expect(resolveSaplingForNode('mcl_cherry_blossom:trunk')).toBe('mcl_cherry_blossom:cherrysapling');
      expect(resolveSaplingForNode('mcl_bamboo:bamboo')).toBe('everness:bamboo');
      expect(resolveSaplingForNode('mcl_bamboo:bamboo_shoot')).toBe('mcl_bamboo:bamboo_shoot');
    });

    it('excludes crafted wooden building materials like planks, stairs, slabs, and fences', () => {
      expect(resolveSaplingForNode('default:wood')).toBeNull();
      expect(resolveSaplingForNode('default:pine_wood')).toBeNull();
      expect(resolveSaplingForNode('default:acacia_wood')).toBeNull();
      expect(resolveSaplingForNode('default:aspen_wood')).toBeNull();
      expect(resolveSaplingForNode('default:junglewood')).toBeNull();
      expect(resolveSaplingForNode('stairs:stair_wood')).toBeNull();
      expect(resolveSaplingForNode('doors:door_wood')).toBeNull();
      expect(resolveSaplingForNode('default:fence_wood')).toBeNull();
    });

    it('returns null for non-flora stone, structural, or liquid nodes', () => {
      expect(resolveSaplingForNode('default:stone')).toBeNull();
      expect(resolveSaplingForNode('default:cobble')).toBeNull();
      expect(resolveSaplingForNode('default:dirt_with_grass')).toBeNull();
      expect(resolveSaplingForNode('default:water_source')).toBeNull();
      expect(resolveSaplingForNode('air')).toBeNull();
      expect(resolveSaplingForNode('ignore')).toBeNull();
    });

    it('resolves flowers, mushrooms, reeds, ferns, and waterlilies across MTG, BakedClay, Everness, Ethereal, and MineClone', () => {
      expect(resolveSaplingForNode('flowers:rose')).toBe('flowers:rose');
      expect(resolveSaplingForNode('flowers:tulip')).toBe('flowers:tulip');
      expect(resolveSaplingForNode('flowers:tulip_black')).toBe('flowers:tulip_black');
      expect(resolveSaplingForNode('flowers:dandelion_yellow')).toBe('flowers:dandelion_yellow');
      expect(resolveSaplingForNode('flowers:dandelion_white')).toBe('flowers:dandelion_white');
      expect(resolveSaplingForNode('flowers:chrysanthemum_green')).toBe('flowers:chrysanthemum_green');
      expect(resolveSaplingForNode('flowers:geranium')).toBe('flowers:geranium');
      expect(resolveSaplingForNode('flowers:viola')).toBe('flowers:viola');
      expect(resolveSaplingForNode('flowers:waterlily')).toBe('flowers:waterlily');
      expect(resolveSaplingForNode('flowers:mushroom_red')).toBe('flowers:mushroom_red');
      expect(resolveSaplingForNode('flowers:mushroom_brown')).toBe('flowers:mushroom_brown');

      expect(resolveSaplingForNode('bakedclay:delphinium')).toBe('bakedclay:delphinium');
      expect(resolveSaplingForNode('bakedclay:thistle')).toBe('bakedclay:thistle');
      expect(resolveSaplingForNode('bakedclay:lazarus')).toBe('bakedclay:lazarus');
      expect(resolveSaplingForNode('bakedclay:mannagrass')).toBe('bakedclay:mannagrass');

      expect(resolveSaplingForNode('default:papyrus')).toBe('default:papyrus');
      expect(resolveSaplingForNode('default:fern_2')).toBe('default:fern');
      expect(resolveSaplingForNode('default:junglegrass')).toBe('default:junglegrass');
      expect(resolveSaplingForNode('default:dry_shrub')).toBe('default:dry_shrub');
      expect(resolveSaplingForNode('default:marram_grass_1')).toBe('default:marram_grass');

      expect(resolveSaplingForNode('everness:lotus_flower_pink')).toBe('everness:lotus_flower_pink');
      expect(resolveSaplingForNode('everness:venus_trap')).toBe('everness:venus_trap');
      expect(resolveSaplingForNode('everness:crystal_mushrooms')).toBe('everness:crystal_mushrooms');
      expect(resolveSaplingForNode('mcl_flowers:poppy')).toBe('flowers:rose');
      expect(resolveSaplingForNode('mcl_flowers:blue_orchid')).toBe('flowers:geranium');

      expect(isDecorationOrCropKey('flowers:rose')).toBe(true);
      expect(isDecorationOrCropKey('default:tree')).toBe(false);
    });

    it('resolves farming crops from MTG farming, x_farming, Farming Redo, and MineClone while excluding basic grass & soil/crates', () => {
      expect(resolveDecorationOrCropKey('farming:wheat_8')).toBe('farming:wheat');
      expect(resolveDecorationOrCropKey('farming:cotton_8')).toBe('farming:cotton');
      expect(resolveDecorationOrCropKey('farming:cotton_wild')).toBe('farming:cotton_wild');
      expect(resolveDecorationOrCropKey('x_farming:barley_8')).toBe('x_farming:barley');
      expect(resolveDecorationOrCropKey('x_farming:cotton_8')).toBe('x_farming:cotton');
      expect(resolveDecorationOrCropKey('x_farming:corn_10')).toBe('x_farming:corn');
      expect(resolveDecorationOrCropKey('x_farming:carrot_8')).toBe('x_farming:carrot');
      expect(resolveDecorationOrCropKey('x_farming:potato_8')).toBe('x_farming:potato');
      expect(resolveDecorationOrCropKey('x_farming:beetroot_8')).toBe('x_farming:beetroot');
      expect(resolveDecorationOrCropKey('x_farming:strawberry_4')).toBe('x_farming:strawberry');
      expect(resolveDecorationOrCropKey('x_farming:coffee_5')).toBe('x_farming:coffee');
      expect(resolveDecorationOrCropKey('x_farming:rice_8')).toBe('x_farming:rice');
      expect(resolveDecorationOrCropKey('x_farming:soybean_7')).toBe('x_farming:soybean');
      expect(resolveDecorationOrCropKey('x_farming:stevia_8')).toBe('x_farming:stevia');
      expect(resolveDecorationOrCropKey('x_farming:obsidian_wart_6')).toBe('x_farming:obsidian_wart');
      expect(resolveDecorationOrCropKey('x_farming:melon_8')).toBe('x_farming:melon');
      expect(resolveDecorationOrCropKey('x_farming:pumpkin_8')).toBe('x_farming:pumpkin');
      expect(resolveDecorationOrCropKey('mcl_farming:carrot_4')).toBe('x_farming:carrot');

      // Excludes basic grass tufts, soil, straw, and storage crates/bags
      expect(isDecorationOrCropNode('default:grass_3')).toBe(false);
      expect(isDecorationOrCropNode('default:dry_grass_4')).toBe(false);
      expect(isDecorationOrCropNode('mcl_flowers:tallgrass')).toBe(false);
      expect(isDecorationOrCropNode('farming:soil_wet')).toBe(false);
      expect(isDecorationOrCropNode('farming:straw')).toBe(false);
      expect(isDecorationOrCropNode('x_farming:crate_carrot_3')).toBe(false);
      expect(isDecorationOrCropNode('x_farming:bag_rice_grains')).toBe(false);
    });
  });

  describe('createProceduralFallbackBillboard', () => {
    it('generates valid voxel billboard fallback images for all tree shapes', () => {
      const shapes: Array<'deciduous' | 'pine' | 'baobab' | 'palm' | 'cactus' | 'bones' | 'bamboo'> = [
        'deciduous',
        'pine',
        'baobab',
        'palm',
        'cactus',
        'bones',
        'bamboo'
      ];
      for (const shape of shapes) {
        const img = createProceduralFallbackBillboard(shape, 48, 56);
        expect(img).not.toBeNull();
        expect(img?.width).toBe(48);
        expect(img?.height).toBe(56);
        expect(img?.data.length).toBe(48 * 56 * 4);
      }
    });
  });

  describe('resolveSaplingForBiome (Seed Mode Procedural Biomes)', () => {
    it('maps temperate and cold biomes to signature saplings and densities', () => {
      const conifer = resolveSaplingForBiome('coniferous_forest');
      expect(conifer).not.toBeNull();
      expect(conifer?.saplingKey).toBe('default:pine_tree');
      expect(conifer?.density).toBeGreaterThan(0);

      const jungle = resolveSaplingForBiome('rainforest');
      expect(jungle).not.toBeNull();
      expect(jungle?.saplingKey).toBe('default:jungletree');

      const savanna = resolveSaplingForBiome('savanna');
      expect(savanna).not.toBeNull();
      expect(savanna?.saplingKey).toBe('default:acacia_tree');

      const desert = resolveSaplingForBiome('sandstone_desert');
      expect(desert).not.toBeNull();
      expect(desert?.saplingKey).toBe('default:cactus');
    });

    it('maps modded biomes like Crystal Forest, Coral Bones, Bamboo, and Sakura', () => {
      const crystal = resolveSaplingForBiome('crystal_forest');
      expect(crystal?.saplingKey).toBe('everness:crystal_tree');

      const bones = resolveSaplingForBiome('coral_bones');
      expect(bones?.saplingKey).toBe('everness:coral_bones');

      const bamboo = resolveSaplingForBiome('bamboo_forest');
      expect(bamboo?.saplingKey).toBe('everness:bamboo');

      const sakura = resolveSaplingForBiome('ethereal_sakura');
      expect(sakura?.saplingKey).toBe('ethereal:sakura_sapling');
    });

    it('returns null for non-vegetated barren biomes', () => {
      expect(resolveSaplingForBiome('icesheet')).toBeNull();
      expect(resolveSaplingForBiome('stone_desert')).toBeNull();
    });
  });
});
