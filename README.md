# MythalTerminal

AI-centric terminal for coding with Claude Code, featuring intelligent context management, auto-archiving, and seamless project switching.

## Features

- **Full Terminal Emulation**: Built on xterm.js with complete shell support
- **Claude Code Integration**: Multiple dedicated Claude instances for different tasks
- **Smart Context Management**: 
  - Layer-based context system (Core, Active, Reference, Archive)
  - Star important context to prevent pruning
  - Visual token usage tracking
  - Executive summaries via AI
- **Auto-Archive System**: Automatically archives conversations on /clear
- **Integrated Clipboard**: Save and organize code snippets
- **Planner Queue**: Sequential task execution with dependency management
- **Project Detection**: Automatic detection of working directories and Claude configurations
- **RESUMEWORK.md**: Auto-generated context for seamless session resumption

## Installation

```bash
# Clone the repository
cd /home/stephen-woodworth/Desktop/MythalTerminal

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

## Development

```bash
# Run in development mode with hot reload
npm run dev
```

## Architecture

- **Main Process**: Electron main process managing Claude instances and database
- **Renderer Process**: React app with terminal UI and context management
- **Claude Instances**:
  - Main: Primary terminal assistant
  - Context Manager: Monitors and updates RESUMEWORK.md
  - Summarizer: Creates executive summaries
  - Planner: Executes planned task sequences
- **Database**: SQLite for persistent storage of context, archives, and clipboard

## Key Components

### Context Layers
- **Core (⭐)**: Starred, never pruned without consent
- **Active (🔵)**: Current working context
- **Reference (📚)**: Available for lookup
- **Archive (📦)**: Searchable history

### Token Management
- Real-time token counting with visual indicators
- Warning levels (safe/warning/critical)
- Periodic sync with actual Claude tokenizer
- Automatic pruning suggestions when approaching limits

### Refresh Mechanism
1. Saves current context state
2. Executes /clear command
3. Gathers context from:
   - RESUMEWORK.md
   - Context-portal MCP
   - Recent git commits
   - Starred context blocks
4. Injects as single prompt for seamless continuation

## MCP Integration

The terminal supports MCP (Model Context Protocol) servers:
- context-portal: Context persistence
- conport: Context gathering
- playwright: Browser automation
- mythal-terminal: Custom MCP for terminal control

## Keyboard Shortcuts

- `Ctrl+Shift+F`: Search in terminal
- `Ctrl+Shift+C`: Copy selection
- `Ctrl+Shift+V`: Paste

## Configuration

Claude configuration is automatically detected from:
1. `.claude/settings.local.json` (project local)
2. `.claude/settings.json` (project shared)
3. `~/.claude/settings.json` (user)

## Building for Distribution

```bash
# Build for your platform
npm run dist

# Output will be in dist-electron/
```

## Requirements

- Node.js 18+
- Claude Code CLI installed and configured
- Linux/macOS/Windows