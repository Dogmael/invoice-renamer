# Invoice Renamer Project - Agent Instructions

## Project Structure

This is a **Tauri + TypeScript** desktop application for renaming invoice files. The project has two main components:

- **Frontend**: TypeScript/HTML/CSS in `invoiceRenamer/` directory
- **Backend**: Rust in `invoiceRenamer/src-tauri/` directory
- **Python**: Additional processing scripts in root directory

## Key Files and Directories

- `invoiceRenamer/` - Main Tauri application
  - `src/` - Frontend TypeScript/HTML/CSS
  - `src-tauri/` - Rust backend
  - `package.json` - Frontend dependencies and scripts
  - `src-tauri/Cargo.toml` - Rust dependencies

- Root directory contains:
  - Python scripts and Jupyter notebooks for invoice processing
  - Sample data and configuration files

## Development Commands

### Frontend (Tauri)
```bash
# Development mode
cd invoiceRenamer && npm run dev

# Build for production
cd invoiceRenamer && npm run build

# Run Tauri application
cd invoiceRenamer && npm run tauri
```

### Python
```bash
# Python dependencies
pip install -r requirements.txt
```

## Build Process

1. Frontend: `npm run build` compiles TypeScript and creates production assets
2. Tauri: Uses compiled frontend assets and Rust backend
3. Final application is built with `npm run tauri`

## Important Notes

- The project uses **Tauri v2** framework
- Frontend runs on port **1420** during development
- The application includes file drop functionality for invoice processing
- Rust backend handles file operations and business logic
- Python scripts are used for additional processing and testing

## Testing

- No formal test suite exists yet
- Manual testing required for file drop functionality
- Python scripts in root can be used for testing invoice processing logic

## Architecture

- **UI Layer**: HTML/CSS/TypeScript in `invoiceRenamer/src/`
- **Business Logic**: Rust in `invoiceRenamer/src-tauri/src/lib.rs`
- **File Processing**: Python scripts in root directory
- **Build System**: Vite for frontend, Cargo for Rust

## Known Issues (from TODO.md)

1. Need to test without supplier list
2. Parallel processing not yet implemented
3. API rate limiting needs handling
4. UI needs drag and drop functionality
5. First version will have file selection only with global progress bar