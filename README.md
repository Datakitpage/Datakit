# Board

A **dual-platform data manipulation tool** that runs as both a web app and a high-performance desktop app. Visualize, edit, and transform data files with a flow-based interface powered by DuckDB.

## 🚀 Key Features

### Universal Platform Support
- **Web App**: Run in any browser with DuckDB-WASM
- **Desktop App**: Native performance with Tauri + Rust + DuckDB
- **Same Codebase**: One React app, two execution environments

### Native DuckDB Integration
- **Direct File Access**: Desktop app reads files from disk without upload
- **10x Performance**: Native DuckDB vs WASM in browser
- **Universal Formats**: CSV, JSON, Parquet, Excel
- **SQL-Level Operations**: Millions of rows with instant pagination

### Flow-Based UI
- **Visual Canvas**: Drag files onto a desktop-like workspace
- **Focused View**: Deep-dive into data with inline editing
- **AI Commands**: Natural language → SQL transformations
- **Change Tracking**: Undo/redo with atomic commits

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    REACT APP                             │
│         (Board UI, Components, State)                    │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    WEB MODE        DESKTOP MODE
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ DuckDB-WASM  │  │Native DuckDB │
│  (Browser)   │  │   (Rust)     │
└──────────────┘  └──────────────┘
```

### Platform Detection Layer (`src/lib/platform.ts`)
Automatically detects environment and routes to appropriate engine:
- **Web**: Uses DuckDB-WASM via `useDuckDBViewStore`
- **Desktop**: Uses native DuckDB via Tauri IPC commands

### Native Backend (`src-tauri/src/lib.rs`)
Rust backend with DuckDB integration:
- In-memory database for fast queries
- Tauri commands for IPC (e.g., `create_view_from_file`, `query_view`)
- Change tracking with delta tables
- Export to CSV/Parquet/JSON

## 📦 Installation

### Prerequisites
- **Bun** (install with: `curl -fsSL https://bun.sh/install | bash`)
- **Rust** (for desktop app, install with: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)

### Web App
```bash
bun install
bun dev
```
Visit http://localhost:5180

### Desktop App
```bash
# Install dependencies
bun install

# Run desktop app
bun tauri dev
```

### Building Desktop Release
```bash
bun tauri build
```
Outputs to `src-tauri/target/release/bundle/`

## 📁 Project Structure

```
├── src/
│   ├── components/
│   │   ├── flow/              # Canvas, nodes, file icons
│   │   └── flow/focused/      # Data table, editing UI
│   ├── lib/
│   │   ├── platform.ts        # Platform detection & abstraction
│   │   ├── duckdb/
│   │   │   ├── native.ts      # Tauri IPC client
│   │   │   └── duckdb.ts      # WASM interface
│   │   └── ai/                # AI command parsing
│   ├── store/                 # Zustand state management
│   ├── pages/Board.tsx        # Main app page
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs             # Rust backend + DuckDB
│   │   └── main.rs
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # App config
└── docs/
    ├── ARCHITECTURE_VISION_DUCKDB_FOCUSED_VIEW.md
    └── IMPLEMENTATION_GUIDE_DUCKDB_EDITING.md
```

## 🎯 How It Works

### 1. Opening Files

**Web (DuckDB-WASM)**:
```typescript
const file = await fileInput.files[0];
const view = await createViewFromFile(file, 'my_data');
// Uploads file to WASM, creates SQL VIEW
```

**Desktop (Native DuckDB)**:
```typescript
const filePath = '/Users/you/data.csv';
const view = await createViewFromFile(filePath, 'my_data');
// DuckDB reads directly from disk!
```

### 2. Querying Data

Both platforms use the same interface:
```typescript
const result = await engine.queryView('my_data', {
  page: 0,
  pageSize: 50,
  sortColumn: 'revenue',
  sortDirection: 'DESC',
  search: 'california'
});
// Returns paginated results from SQL query
```

### 3. Editing & Change Tracking

```typescript
// Record a cell edit
await engine.recordChange('my_data', rowId, 'price', 19.99, 24.99, 'update', 'user');

// Get pending changes
const changes = await engine.getPendingChanges('my_data');

// Commit or discard
await engine.commitChanges('my_data');
await engine.discardChanges('my_data');
```

## 🔧 Configuration

### Tauri Config (`src-tauri/tauri.conf.json`)
- App name, version, identifier
- Window size and decorations
- Build commands
- Bundle settings

### Environment Variables
```bash
# For AI features (optional)
VITE_ANTHROPIC_API_KEY=your_key_here
```

## 📚 Documentation

- [Architecture Vision](./docs/ARCHITECTURE_VISION_DUCKDB_FOCUSED_VIEW.md) - Deep dive into DuckDB-powered design
- [Implementation Guide](./docs/IMPLEMENTATION_GUIDE_DUCKDB_EDITING.md) - How to add features and extend the app

## 🚢 Deployment

### Web App
Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages)

### Desktop App
GitHub Actions workflow (`.github/workflows/release-desktop.yml`) automatically builds installers when you push a tag:
```bash
git tag v0.1.0
git push origin v0.1.0
```

Creates:
- **macOS**: `.dmg` installer
- **Windows**: `.msi` installer
- **Linux**: `.deb` and `.AppImage`

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test in both web and desktop modes
5. Submit a pull request

## 📄 License

MIT

## 🙏 Credits

Built with:
- [Tauri](https://tauri.app) - Desktop app framework
- [DuckDB](https://duckdb.org) - High-performance SQL engine
- [React](https://react.dev) - UI framework
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Framer Motion](https://www.framer.com/motion/) - Animations
