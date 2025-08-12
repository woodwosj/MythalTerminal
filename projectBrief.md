# MythalTerminal Project Brief

## Project Overview
MythalTerminal is an AI-centric terminal application that integrates Claude AI capabilities directly into a terminal environment, featuring intelligent context management, auto-archiving, and seamless project switching.

## Vision
Create a next-generation terminal that seamlessly blends traditional command-line functionality with AI assistance, providing developers with an intelligent coding companion that maintains context and learns from interactions.

## Core Features

### 1. AI-Powered Terminal
- Full terminal emulation using xterm.js
- Claude AI integration via Anthropic SDK
- Multiple Claude instances for different purposes (main, context manager, summarizer, planner)
- Natural language commands alongside traditional shell commands

### 2. Intelligent Context Management
- Layer-based context system (Core⭐, Active🔵, Reference📚, Archive📦)
- Real-time token counting with visual indicators
- Automatic promotion/demotion based on usage patterns
- Smart pruning to stay within token limits

### 3. Auto-Archive System
- Automatic conversation archiving on /clear command
- AI-generated summaries of archived conversations
- Searchable conversation history
- Persistent storage in SQLite database

### 4. Project Intelligence
- RESUMEWORK.md auto-generation for session continuity
- Project detection and Claude configuration loading
- ConPort knowledge graph integration for persistent memory
- Semantic search across all project knowledge

## Technical Architecture

### Frontend Stack
- React 18.3.1 for UI components
- TypeScript 5.5.0 for type safety
- Tailwind CSS 3.4.0 for styling
- Zustand 5.0.0 for state management
- xterm.js 5.3.0 for terminal emulation

### Backend Stack
- Electron 33.4.11 for desktop application
- SQLite via better-sqlite3 for persistence
- node-pty for terminal process management
- Anthropic SDK for Claude AI integration

### Testing Infrastructure
- Jest for unit testing (86.86% coverage)
- Playwright for E2E testing
- Visual regression testing with screenshots
- MCP server integration for automation

## Implementation Status

### ✅ Completed
1. **Anthropic SDK Integration** - Real Claude API communication
2. **API Key Configuration** - Secure settings with encryption
3. **Terminal-Claude Connection** - Commands: `claude:`, `/claude`, `ai:`, `/ai`
4. **Context Management System** - Full layer management with token counting
5. **Auto-archiving** - Conversations archived on /clear
6. **ConPort Integration** - Knowledge graph for persistent memory

### 🚧 In Progress
- Performance optimization for large contexts
- Enhanced semantic search capabilities
- Streaming response improvements

### 📋 Planned
- Multi-model support (GPT, Gemini)
- Collaborative features
- Plugin system for extensions
- Cloud sync capabilities

## Development Workflow

### Quick Start
```bash
npm install
npm run dev  # Development mode
npm run build && npm start  # Production mode
```

### Testing
```bash
npm test  # Unit tests
xvfb-run -a npm run test:e2e  # E2E tests (headless)
npm run test:e2e:ui  # E2E tests with UI
```

### MCP Servers
- puppeteer: Browser automation
- filesystem: File system access
- context7: Documentation retrieval
- playwright: E2E testing
- conport: Knowledge graph persistence

## ConPort Knowledge Management

### Strategy
- Decisions logged immediately when made
- Progress tracked in real-time
- Patterns documented for reusability
- Relationships created between items
- Semantic search for intelligent retrieval

### Key Commands
- `/conport-init` - Initialize ConPort
- `/conport-sync` - Synchronize knowledge
- `/conport-status` - Status report
- `/conport-search` - Search knowledge base

## Project Goals

### Short Term
- Stabilize Claude integration
- Improve context management efficiency
- Enhance error handling
- Complete test coverage

### Long Term
- Build comprehensive plugin ecosystem
- Implement collaborative features
- Add cloud synchronization
- Support multiple AI models
- Create marketplace for extensions

## Success Metrics
- Response time < 2 seconds for AI queries
- Token usage optimization > 80% efficiency
- Test coverage > 90%
- User session continuity > 95%
- Knowledge graph connectivity > 10 links per item

## Team & Resources
- Repository: /home/stephen-woodworth/Desktop/MythalTerminal
- Documentation: ConPort knowledge graph
- Testing: Automated E2E and unit tests
- CI/CD: GitHub Actions (planned)

---

*This project brief serves as the foundation for ConPort initialization and provides context for all development decisions.*