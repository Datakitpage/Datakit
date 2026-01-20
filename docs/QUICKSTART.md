# Quick Start Guide

Get Board running in 5 minutes.

## Web App (Fastest)

```bash
bun install
bun dev
```

Open http://localhost:5180 and drag a CSV file onto the canvas!

## Desktop App (Native Performance)

### Prerequisites
- **Bun** (install with: `curl -fsSL https://bun.sh/install | bash`)
- **Rust** (install with: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)

### Run
```bash
bun install
bun tauri dev
```

The desktop app window will open automatically.

## First Steps

1. **Drop a File**: Drag any CSV, JSON, or Parquet file onto the canvas
2. **Double-Click**: Open the file to see your data in a table view
3. **Edit**: Click any cell to edit (changes are tracked)
4. **AI Commands**: Type `/` in focused view to run SQL transformations
5. **Export**: Right-click → Export to save your changes

## Performance Comparison

| Feature | Web (WASM) | Desktop (Native) |
|---------|------------|------------------|
| File Size Limit | ~500MB | Unlimited |
| Query Speed | Good | 10x faster |
| File Access | Upload only | Direct disk access |
| Export Formats | CSV, JSON | CSV, JSON, Parquet |

## Next Steps

- Read the [Architecture Vision](./ARCHITECTURE_VISION_DUCKDB_FOCUSED_VIEW.md) to understand how it works
- Check the [Implementation Guide](./IMPLEMENTATION_GUIDE_DUCKDB_EDITING.md) to add features
