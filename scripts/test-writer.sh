#!/bin/bash

# Test Writer Script - Uses headless Claude to generate comprehensive tests

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "🤖 Starting Claude Test Writer..."

# Create project description file
cat > /tmp/project-description.txt << 'EOF'
MythalTerminal is an AI-centric terminal for coding with Claude Code. Key components:

1. ClaudeInstanceManager (src/main/claudeManager.ts):
   - Manages 4 dedicated Claude instances (main, contextManager, summarizer, planner)
   - Auto-restart with exponential backoff
   - Status tracking and event emission
   - Config detection from .claude files

2. Database Layer (src/main/database.ts):
   - SQLite with better-sqlite3
   - Tables: context_layers, chat_archives, clipboard_items, planner_queue, resumework_snapshots, token_usage
   - Full CRUD operations

3. Context Store (src/renderer/stores/contextStore.ts):
   - Zustand state management
   - Token calculation and tracking
   - Layer management (core, active, reference, archive)
   - Star/immutable flags

4. Terminal Component (src/renderer/components/Terminal.tsx):
   - xterm.js integration
   - node-pty for shell spawning
   - Keyboard shortcuts

5. IPC Layer (src/main/ipc.ts):
   - Electron IPC handlers
   - Bidirectional communication
   - Terminal lifecycle management
EOF

# Generate unit tests
echo "📝 Generating unit tests..."
claude -p "You are an expert test engineer. Read this project description and generate comprehensive Jest unit tests.

$(cat /tmp/project-description.txt)

Generate complete, runnable Jest test files for:
1. ClaudeInstanceManager - test spawning, restart logic, crash handling
2. Database operations - test all CRUD operations, transactions
3. Context Store - test token calculations, state updates
4. IPC handlers - test message routing, error handling

Output the complete test code for each file. Use proper mocking and follow Jest best practices.
Include edge cases and error scenarios." \
--output-format text \
--max-turns 3 > tests/generated-unit-tests.txt

echo "✅ Unit tests generated"

# Generate integration tests
echo "📝 Generating integration tests..."
claude -p "Generate integration tests for MythalTerminal that test:
1. Database + IPC integration
2. Claude instance coordination
3. Context persistence and retrieval
4. Terminal creation and command execution

Focus on testing the interaction between components.
Output complete Jest test files." \
--output-format text \
--max-turns 2 > tests/generated-integration-tests.txt

echo "✅ Integration tests generated"

# Generate E2E tests
echo "📝 Generating E2E tests..."
claude -p "Generate end-to-end tests for MythalTerminal user workflows:
1. Create terminal → Execute command → Archive chat
2. Add context → Star items → Refresh with context injection
3. Token limit warnings and pruning
4. Claude instance management

Output complete test scenarios that simulate real user interactions." \
--output-format text \
--max-turns 2 > tests/generated-e2e-tests.txt

echo "✅ E2E tests generated"

echo "🎉 Test generation complete! Check tests/ directory for generated files."