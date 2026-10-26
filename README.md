# Luanti Map & Biome Explorer

<p align="center">
  <a href="https://sakel-hub.github.io/luanti-map-explorer/">
    <img src="screenshot.png" alt="Luanti Map & Biome Explorer Screenshot" width="100%">
  </a>
</p>

<h3 align="center">Luanti Map &amp; Biome Explorer</h3>

<p align="center">
  <strong>Seed Biome Generator, Interactive Heat/Humidity Voronoi Matrix, 2D/3D Topographic Terrain &amp; Offline SQLite / PostgreSQL World Viewer for Luanti</strong>
</p>

<p align="center">
  <a href="https://sakel-hub.github.io/luanti-map-explorer/"><strong>🚀 Launch Live Web App</strong></a> &bull;
  <a href="#-key-features">Features</a> &bull;
  <a href="#-keyboard-shortcuts">Shortcuts</a> &bull;
  <a href="#-luanti-coordinates-reference">Coordinates Reference</a> &bull;
  <a href="#-getting-started">Getting Started</a> &bull;
  <a href="#-contributing--translations">Contributing &amp; Translations</a>
</p>

<p align="center">
  <a href="https://github.com/sakel-hub/luanti-map-explorer/actions/workflows/deploy.yml">
    <img src="https://github.com/sakel-hub/luanti-map-explorer/actions/workflows/deploy.yml/badge.svg" alt="Deploy to GitHub Pages">
  </a>
  <img src="https://img.shields.io/badge/Angular-22+-dd0031.svg?logo=angular&logoColor=white" alt="Angular 22+">
  <img src="https://img.shields.io/badge/MapLibre_GL-5.2+-0078d4.svg?logo=mapbox&logoColor=white" alt="MapLibre GL 5.2+">
  <img src="https://img.shields.io/badge/PWA-Offline%20Ready-5a0fc8.svg?logo=pwa&logoColor=white" alt="PWA Ready">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License MIT">
</p>

---

A modern, high-performance, offline-first Progressive Web App (PWA) built with **Angular 22+ (Signals)**, **MapLibre GL JS**, **Tailwind CSS v4**, **`d3-delaunay`**, and multi-core **Web Workers** for exploring, inspecting, and navigating **Luanti** (formerly Minetest) worlds and procedural seeds.

---

## ✨ Key Features

### 🗺️ Dual-Engine Map Viewport (2D, 3D Topographic Relief & 3D Extrusions)
- **2D Topographic Vector Map**: Smooth orthographic projection mapping Cartesian Luanti block coordinates directly to bijective Mercator tiles.
- **3D Terrarium DEM Hillshading (`3`)**: Encodes digital elevation models into real-time terrain relief with camera pitch (`0°–75°`), bearing rotation (`-180°–180°`), vertical scale exaggeration, and contour shading.
- **2.5D Camera-Facing Tree Sprites (Billboard) (`T`)**: Renders authentic pixel-sharp retro sapling and flora billboards anchored to 3D terrain elevation in both DB Mode (scanned SQLite/PostgreSQL tree trunks) and Seed Mode (deterministic procedural biomes) across Minetest Game, Everness, Ethereal, and MineClone.
- **3D Voxel Structures & Tall Flora Extrusions**: Extrudes player structures, mapgen architecture, Everness crystal pillars, and bamboo forests in Detail 1:1 view with filter modes (`All`, `Pillars & Flora`, `Structures Only`, `OFF`).
- **4-Tier LOD Streaming Presets**: Switch seamlessly between **World 4×4 (64n)**, **Region 2×2 (32n)**, **Sector 1×1 (16n)**, and **Detail 1:1 (1n)** levels of detail.
- **Multi-Source Display Presets**:
  - **Seed Mode (`1`)**: Real-time procedural Mapgen v7 / Valleys / Carpathian / Flat biome preview generated on the fly.
  - **Database Mode (`2`)**: Visualizes saved chunks and player modifications directly from `map.sqlite` or PostgreSQL dump `map.sql`.
  - **Hybrid Mode (`H`)**: Overlays discovered player builds, structures, and explored sectors seamlessly over darkened procedural background biomes.

### 🎲 Procedural Seed Generator & Voronoi Matrix
- **Mapgen v7 Perlin Noise Engine**: Multi-octave 2D/3D Perlin noise generator modeling terrain height, heat variations, and humidity spreads.
- **Interactive Voronoi Biome Diagram**:
  - Mathematical Voronoi cell decomposition (`[0..100] × [0..100]`) via `d3-delaunay`.
  - **Synchronized Reticle**: Moving your cursor over the map tracks the exact `(Heat, Humidity)` coordinate on the Voronoi matrix in real time.
  - **Click-to-Isolate**: Click any biome cell to instantly highlight its distribution across the entire world map.
  - **Game & Mod Palette Filters**: Filter Voronoi cells between **Auto**, **All**, **Vanilla MTG**, **Everness**, **Ethereal**, and **MineClone**.

### 📂 Offline SQLite & PostgreSQL (`map.sqlite` / `map.sql`) World Explorer
- **100% Client-Side Privacy**: Opens local Luanti world folders, `map.sqlite` databases, or PostgreSQL text dumps (`map.sql`, `pg_dump -t blocks -d luanti_world`) directly in your browser without uploading data to external servers.
- **Continuous B-Tree & 2MB Chunked SQL Streaming**: Traverses SQLite interior routing pages and streams large PostgreSQL text dumps using zero-OOM memory-efficient chunk slicing.
- **Vertical Elevation Slices**: Inspect specific horizontal depth slices (e.g. Surface, Sky Islands at $Y > 500$, or Underground Caves at $Y < -100$).
- **Macroscopic Mipmapping**: Progressive coarse streaming renders entire worlds spanning 30,000+ nodes in low-res preview mode.
- **Automatic Base & Structure Discovery**: Heuristically detects concentrated clusters of player-crafted nodes (wood, brick, glass, torches, stone bricks).
- **Cross-Backend SQL Export**: Convert and export any loaded world directly into a PostgreSQL SQL dump (`COPY public.blocks (pos, data) FROM stdin;`).

### 🧭 3D Voxel Route Planner
- **Multi-Modal Dijkstra / A* Pathfinding**: Calculates optimal 3D trajectories between any two coordinates in the world.
- **Customizable Travel Modes**:
  - 🥾 **Hiking**: Balances horizontal distance and smooth elevation changes.
  - 🧗 **Climbing**: Permits steep cliff ascents and vertical ascents up to 45° with specialized node penalties.
  - ⛵ **Sailing**: Prioritizes open water surfaces, rivers, and coastlines.
  - ⛏️ **Mining**: Navigates underground tunnel networks, cavern voids, and mineshafts.
- **Route Analytics**: Real-time distance (meters/nodes), estimated travel duration, elevation profiles, total ascent, and total descent.
- **Luanti Waypoints**: Export and import paths as standard JSON or native Luanti `/teleport` waypoints.

### 🎨 Authentic Game & Mod Palettes (777 Nodes & 96 Biomes)
- **Pixel-Accurate Top-Face Textures**: Calibrated using pixel-averaged RGB colors extracted directly from 16×16 in-game textures and official mappers:
  - **Minetest Game (`default:*`)**: Authentic lush grass, dry grass, desert sand, silver sand, and stone.
  - **Everness Mod (`everness:*`)**: 64 calibrated nodes (Crystal, Coral, Forsaken Tundra, Bamboo, Cursed Lands).
  - **Ethereal Mod (`ethereal:*`)**: 27 top surface dirt and foliage nodes (Crystal Dirt, Fiery Dirt, Mushroom Dirt, Gray Dirt, Cold Dirt, Bamboo Dirt).
  - **MineClone 2 / Mineclonia (`mcl_*`)**: 615 mapped nodes matching official `tools/colors.txt`.
- **Intelligent Derivative Resolution**: Automatically strips block prefixes (`stair_`, `slab_`, `wall_`, `cut_`, `polished_`) to resolve parent colors.

### ⚡ PWA Acceleration & Storage Architecture
- **Two-Tier Tile Caching**:
  - **L1 RAM Cache**: 200 tiles in memory for instantaneous 0ms recall.
  - **L2 IndexedDB Cache**: Fast retrieval with a strict **50 MB limit** and automatic LRU eviction.
- **Screen Wake Lock API**: Prevents mobile and laptop CPUs from throttling background workers during world indexing.
- **File System Access API**: Remembers file handles across tab reloads and system sleep for 1-click zero-prompt reopening.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
|:---:|:---|:---|
| <kbd>0</kbd> / <kbd>Home</kbd> | **Origin (0, 0)** | Center map camera on Spawn Origin `(0, 0)` |
| <kbd>F</kbd> | **Fit World** | Fit camera to explored SQLite world bounds |
| <kbd>M</kbd> | **Pin Marker** | Drop a custom waypoint marker at current cursor coordinates |
| <kbd>3</kbd> | **Toggle 3D** | Toggle 3D Terrarium DEM topographic relief |
| <kbd>N</kbd> | **Reset Camera** | Reset camera bearing, pitch, and 3D scale to North defaults |
| <kbd>G</kbd> | **Chunk Grid** | Toggle Luanti MapBlock (16×16) & MapChunk (80×80) grid |
| <kbd>1</kbd> | **Seed Mode** | Switch to procedural seed biome view |
| <kbd>2</kbd> | **DB Mode** | Switch to saved `map.sqlite` blocks only |
| <kbd>H</kbd> | **Hybrid Mode** | Overlay explored chunks onto procedural background |
| <kbd>V</kbd> | **Voronoi Borders** | Toggle Voronoi biome cell boundary contours on map |
| <kbd>L</kbd> | **Hillshade** | Toggle directional 2.5D solar hillshading |
| <kbd>T</kbd> | **Tree Sprites** | Toggle 2.5D camera-facing tree billboards |
| <kbd>O</kbd> | **Open World** | Open local Luanti world folder or `map.sqlite` |
| <kbd>R</kbd> | **Random Seed** | Generate and preview a random procedural world seed |
| <kbd>P</kbd> | **Route Planner** | Focus the 3D Voxel Route Planner panel |
| <kbd>S</kbd> | **Share** | Open the deep-link world share dialog |
| <kbd>Esc</kbd> | **Clear Filter** | Clear active Voronoi biome isolation filter |
| <kbd>?</kbd> | **Shortcuts** | Show keyboard shortcuts modal |

---

## 📐 Luanti Coordinates Reference

Luanti uses a 3D Cartesian coordinate system measured in **nodes** (1 node = 1 meter):

- **`+X` East** &bull; **`-X` West**
- **`+Y` Up** (Elevation / Altitude above sea level, where sea level is $Y = 0$)
- **`+Z` North** &bull; **`-Z` South**

### 64-Bit Integer MapBlock Encoding
MapBlocks consist of $16 \times 16 \times 16$ nodes. The block coordinates $(X, Y, Z)$ are packed into a 64-bit signed integer key:

$$\text{key} = (Z \times 16777216) + (Y \times 4096) + X$$

$$\text{where } X, Y, Z \in [-2048, 2047]$$

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: `>= 24.16.0` (LTS)
- **npm**: `>= 11.0.0`
- **Git**

### Installation & Development
```bash
# 1. Clone repository
git clone https://github.com/sakel-hub/luanti-map-explorer.git
cd luanti-map-explorer

# 2. Install dependencies
npm ci

# 3. Generate sample Luanti world data for testing
npm run generate:sample-world

# 4. Start local development server
npm start
```
Navigate to `http://localhost:4200/` in your browser.

### Automated Testing & Build
```bash
# Run unit test suite (Vitest)
npm run test

# Strict TypeScript compilation check
npx tsc --noEmit

# Production PWA build
npm run build
```

---

## 🤝 Contributing & Translations

Contributions are welcome! Please check our [Contributing Guidelines](CONTRIBUTING.md) for details on code style, testing, and pull requests.

To contribute translations, see the [Translation Guide](CONTRIBUTING.md#-contributing-translations) or submit an issue via the [Translation Template](https://github.com/sakel-hub/luanti-map-explorer/issues/new?template=translation.yml).

---

## 📄 License

This project is licensed under the **MIT License** &ndash; see the [LICENSE.txt](LICENSE.txt) file for details.
