import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../sample-luanti-world');

function packBlockPos(x, y, z) {
  const mask12 = n => BigInt(n < 0 ? n + 4096 : n) & 0xfffn;
  const unsigned = mask12(x) | (mask12(y) << 12n) | (mask12(z) << 24n);
  return z < 0 ? unsigned - (1n << 36n) : unsigned;
}

/**
 * Encodes a valid Luanti v28 MapBlock binary blob (zlib node stream + NameIdMapping table).
 */
function createV28MapBlockBlob(blockX, blockZ) {
  const nodeNames = [
    'air',
    'default:stone',
    'default:dirt_with_grass',
    'default:sand',
    'default:water_source',
    'default:stonebrick',
    'default:brick',
    'default:meselamp'
  ];

  // 16x16x16 nodes = 4096 nodes
  // param0: 8192 bytes (u16 BE), param1: 4096 bytes, param2: 4096 bytes = 16384 bytes
  const rawNodes = Buffer.alloc(16384);

  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      const worldX = blockX * 16 + lx;
      const worldZ = blockZ * 16 + lz;
      const dist = Math.hypot(worldX, worldZ);

      let surfaceY = Math.max(2, Math.min(14, Math.round(7 + Math.sin(worldX * 0.08) * 3 + Math.cos(worldZ * 0.08) * 3)));
      let topId = 2; // default:dirt_with_grass

      if (dist < 14) {
        surfaceY = 11;
        topId = dist < 4 ? 6 : 5; // brick keep or stonebrick plaza
      } else if (surfaceY <= 4) {
        topId = 3; // sand
      }

      for (let ly = 0; ly < 16; ly++) {
        const idx = (lz << 8) | (ly << 4) | lx;
        let nodeId = 0; // air
        if (ly < surfaceY) {
          nodeId = 1; // stone
        } else if (ly === surfaceY) {
          nodeId = topId;
        } else if (ly <= 4 && surfaceY < 4) {
          nodeId = 4; // water_source
        }
        rawNodes.writeUInt16BE(nodeId, idx * 2);
      }
    }
  }

  const compressedNodes = zlib.deflateSync(rawNodes);
  const compressedMeta = zlib.deflateSync(Buffer.from([0, 0, 0]));

  // Build NameIdMapping tail: version=0 (u8), count (u16 BE), [id (u16 BE), len (u16 BE), ascii...]
  const mappingParts = [];
  const headerBuf = Buffer.alloc(3);
  headerBuf.writeUInt8(0, 0);
  headerBuf.writeUInt16BE(nodeNames.length, 1);
  mappingParts.push(headerBuf);

  for (let i = 0; i < nodeNames.length; i++) {
    const strBuf = Buffer.from(nodeNames[i], 'utf8');
    const itemHeader = Buffer.alloc(4);
    itemHeader.writeUInt16BE(i, 0);
    itemHeader.writeUInt16BE(strBuf.length, 2);
    mappingParts.push(itemHeader, strBuf);
  }

  const mappingBuf = Buffer.concat(mappingParts);

  // v28 Header: [version=28, flags=0x01, lighting=0xFFFF, content_width=2, params_width=2]
  const blockHeader = Buffer.from([28, 1, 255, 255, 2, 2]);
  return Buffer.concat([blockHeader, compressedNodes, compressedMeta, mappingBuf]);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Write world.mt
  const worldMt = [
    'gameid = minetest_game',
    'world_name = Sample Luanti Citadel World',
    'enable_damage = true',
    'creative_mode = false',
    'backend = sqlite3',
    'player_backend = sqlite3',
    'auth_backend = sqlite3'
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'world.mt'), worldMt, 'utf8');

  // 2. Write map_meta.txt
  const mapMeta = [
    'mg_name = v7',
    'seed = 74829104',
    'water_level = 1',
    'mg_biome_np_heat = { offset = 50, scale = 50, spread = (750,750,750), seed = 5349, octaves = 3, persistence = 0.5, lacunarity = 2.0 }',
    'mg_biome_np_humidity = { offset = 50, scale = 50, spread = (750,750,750), seed = 842, octaves = 3, persistence = 0.5, lacunarity = 2.0 }',
    '[end_of_params]'
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'map_meta.txt'), mapMeta, 'utf8');

  // 3. Generate map.sqlite
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE blocks (pos INT64 PRIMARY KEY, data BLOB);');

  const insertStmt = db.prepare('INSERT INTO blocks (pos, data) VALUES (?, ?);');
  let count = 0;
  for (let bz = -4; bz <= 4; bz++) {
    for (let bx = -4; bx <= 4; bx++) {
      const pos = packBlockPos(bx, 0, bz);
      const blob = createV28MapBlockBlob(bx, bz);
      insertStmt.run([pos.toString(), blob]);
      count++;
    }
  }
  insertStmt.free();

  const binarySqlite = db.export();
  fs.writeFileSync(path.join(outDir, 'map.sqlite'), Buffer.from(binarySqlite));
  db.close();

  // 4. Generate map.sql (PostgreSQL dump format)
  const sqlLines = [
    '--',
    '-- PostgreSQL database dump for Luanti / Minetest world',
    '-- Schema: public.blocks (pos bigint PRIMARY KEY, data bytea)',
    '--',
    'SET statement_timeout = 0;',
    'SET client_encoding = \'UTF8\';',
    'SET standard_conforming_strings = on;',
    '',
    'CREATE TABLE IF NOT EXISTS public.blocks (',
    '    pos bigint NOT NULL,',
    '    data bytea',
    ');',
    '',
    'ALTER TABLE ONLY public.blocks',
    '    DROP CONSTRAINT IF EXISTS blocks_pkey;',
    'ALTER TABLE ONLY public.blocks',
    '    ADD CONSTRAINT blocks_pkey PRIMARY KEY (pos);',
    '',
    'COPY public.blocks (pos, data) FROM stdin;'
  ];

  for (let bz = -4; bz <= 4; bz++) {
    for (let bx = -4; bx <= 4; bx++) {
      const pos = packBlockPos(bx, 0, bz);
      const blob = createV28MapBlockBlob(bx, bz);
      const hex = blob.toString('hex');
      sqlLines.push(`${pos}\t\\\\x${hex}`);
    }
  }

  sqlLines.push('\\.');
  sqlLines.push('');
  fs.writeFileSync(path.join(outDir, 'map.sql'), sqlLines.join('\n'), 'utf8');

  console.log(`Generated sample Luanti world in ${outDir} (${count} MapBlocks in map.sqlite & map.sql)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
