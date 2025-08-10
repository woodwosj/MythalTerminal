#!/bin/bash

# Comprehensive Test Generator with Headless Claude
# Uses separate Claude instances with fresh context windows for each task

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "🚀 Starting Comprehensive Test Generation System"
echo "================================================"
echo "Using headless Claude instances for separation of concerns"
echo ""

# Step 1: Create detailed project analysis
echo "📊 Preparing project documentation for test writer..."

cat > /tmp/project-analysis.md << 'EOF'
# MythalTerminal Project Analysis

## Core Architecture
MythalTerminal is an AI-centric terminal application built with Electron, React, and TypeScript.

### Main Process Components (Electron)
1. **ClaudeInstanceManager** (src/main/claudeManager.ts)
   - Manages 4 Claude instances: main, contextManager, summarizer, planner
   - Features: auto-restart with exponential backoff, status tracking, event emission
   - Critical paths: spawn/restart logic, crash handling, config detection

2. **Database Layer** (src/main/database.ts)
   - SQLite with better-sqlite3
   - Tables: context_layers, chat_archives, clipboard_items, planner_queue, resumework_snapshots, token_usage
   - Operations: full CRUD, transactions, migrations

3. **IPC Handlers** (src/main/ipc.ts)
   - Electron IPC for renderer-main communication
   - Terminal lifecycle management
   - Context synchronization

### Renderer Process Components (React)
1. **Terminal Component** (src/renderer/components/Terminal.tsx)
   - xterm.js integration for terminal emulation
   - node-pty for shell spawning
   - Keyboard shortcuts and search functionality

2. **Context Store** (src/renderer/stores/contextStore.ts)
   - Zustand state management
   - Token calculation and tracking
   - Layer management (core, active, reference, archive)
   - Star/immutable flags for context persistence

3. **Context Manager UI** (src/renderer/components/ContextManager.tsx)
   - Visual token tracking
   - Layer manipulation interface
   - Archive management

### Shared Types (src/shared/types.ts)
- ContextLayer, PlanStep, ClipboardItem, ChatArchive, TokenUsage

## Testing Requirements
1. **Unit Tests**: Isolated component testing with mocked dependencies
2. **Integration Tests**: Component interaction testing
3. **E2E Tests**: Full user workflow testing
4. **Performance Tests**: Token calculation, database operations
5. **Security Tests**: Input sanitization, IPC security

## Critical User Workflows
1. Terminal creation → Command execution → Output handling
2. Context addition → Token tracking → Automatic pruning
3. Chat archiving → Context refresh → Session resumption
4. Claude instance management → Crash recovery → Status monitoring
5. Clipboard operations → Category management → Search functionality
EOF

# Step 2: Generate comprehensive unit tests using headless Claude
echo "🧪 Launching headless Claude instance for unit test generation..."
echo "   This instance has a fresh context window focused solely on test writing"

# Read project files for context
PROJECT_CONTEXT=$(cat src/main/claudeManager.ts src/main/database.ts src/main/ipc.ts 2>/dev/null | head -2000)

# Use Claude in print mode with specific test generation prompt
claude --print \
--output-format text \
--max-turns 5 \
--dangerously-skip-permissions \
--allowedTools "Read Write" \
--model claude-3-5-sonnet-20241022 \
"You are an expert test engineer specializing in Electron and React applications.

Project Analysis:
$(cat /tmp/project-analysis.md)

Generate COMPLETE, RUNNABLE Jest test files for the following components:

1. src/main/__tests__/claudeManager.enhanced.test.ts
   - Test all instance lifecycle methods
   - Test crash recovery with exponential backoff
   - Test concurrent instance management
   - Test config detection from multiple sources
   - Test event emission and error handling
   - Include edge cases: network failures, process zombies, memory limits

2. src/main/__tests__/database.enhanced.test.ts
   - Test all CRUD operations for each table
   - Test transaction rollback scenarios
   - Test concurrent access patterns
   - Test migration handling
   - Test data integrity constraints
   - Performance tests for large datasets

3. src/main/__tests__/ipc.enhanced.test.ts
   - Test all IPC channels
   - Test bidirectional communication
   - Test error propagation
   - Test request/response patterns
   - Test event streaming
   - Security tests for input validation

Output complete test files with:
- Proper imports and mocking setup
- BeforeEach/AfterEach hooks for cleanup
- Descriptive test names
- Edge cases and error scenarios
- Performance assertions where relevant
- At least 20 test cases per file

Format each file as:
---FILE: [filename]---
[complete test code]
---END FILE---" > /tmp/generated-unit-tests.txt

echo "✅ Unit tests generated"

# Step 3: Generate integration tests
echo "🔗 Generating integration tests..."

claude --no-interactive \
--max-turns 3 \
--prompt "Generate integration tests for MythalTerminal that test component interactions.

Project Structure:
$(cat /tmp/project-analysis.md)

Create integration test files:

1. tests/integration/claude-database.test.ts
   - Test Claude instance data persistence
   - Test crash recovery with database state
   - Test concurrent operations

2. tests/integration/context-flow.test.ts
   - Test context layer creation through IPC
   - Test token calculation with database updates
   - Test archive and refresh cycle

3. tests/integration/terminal-session.test.ts
   - Test terminal creation, command execution, output capture
   - Test session persistence and restoration
   - Test multiple terminal instances

Include:
- Setup and teardown for test database
- Mock IPC communication
- Realistic data scenarios
- Timing and performance assertions

Format each file as:
---FILE: [filename]---
[complete test code]
---END FILE---" > /tmp/generated-integration-tests.txt

echo "✅ Integration tests generated"

# Step 4: Generate E2E tests
echo "🎯 Generating E2E tests..."

claude --no-interactive \
--max-turns 3 \
--prompt "Generate end-to-end tests for MythalTerminal user workflows.

Critical User Journeys:
1. New user onboarding: Install → Configure → First terminal session
2. Power user workflow: Multiple terminals → Context management → Task planning
3. Recovery scenario: Crash → Restart → Resume work with context
4. Token limit handling: Approach limit → Warning → Automatic pruning → Continue work
5. Archive and search: Generate content → Archive → Search → Restore

Create E2E test files using Playwright or Spectron:

1. tests/e2e/user-workflows.test.ts
2. tests/e2e/error-recovery.test.ts
3. tests/e2e/performance.test.ts

Include:
- Page object patterns
- Visual regression tests
- Performance metrics
- Accessibility tests
- Cross-platform considerations

Format each file as:
---FILE: [filename]---
[complete test code]
---END FILE---" > /tmp/generated-e2e-tests.txt

echo "✅ E2E tests generated"

# Step 5: Extract and save test files
echo "📁 Extracting test files..."

python3 << 'PYTHON'
import re
import os
from pathlib import Path

def extract_files(input_file, output_dir):
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Find all file blocks
    pattern = r'---FILE:\s*(.+?)---\n(.*?)---END FILE---'
    matches = re.findall(pattern, content, re.DOTALL)
    
    for filename, code in matches:
        filename = filename.strip()
        code = code.strip()
        
        # Create full path
        filepath = os.path.join(output_dir, filename)
        
        # Create directory if needed
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Write file
        with open(filepath, 'w') as f:
            f.write(code)
        
        print(f"Created: {filepath}")

# Extract all test files
extract_files('/tmp/generated-unit-tests.txt', '/home/stephen-woodworth/Desktop/MythalTerminal')
extract_files('/tmp/generated-integration-tests.txt', '/home/stephen-woodworth/Desktop/MythalTerminal')
extract_files('/tmp/generated-e2e-tests.txt', '/home/stephen-woodworth/Desktop/MythalTerminal')
PYTHON

echo "✅ Test files extracted"

# Step 6: Run initial test suite
echo "🏃 Running generated tests..."

npm test 2>&1 | tee /tmp/test-results.log

# Check test results
if grep -q "FAIL" /tmp/test-results.log; then
    echo "⚠️ Some tests failed. Analyzing failures..."
    
    # Extract failure information
    grep -A 5 "FAIL" /tmp/test-results.log > /tmp/test-failures.txt
    
    echo "Failed tests saved to /tmp/test-failures.txt"
else
    echo "✅ All tests passed!"
fi

# Step 7: Generate test report
echo "📊 Generating test report..."

cat > test-report.md << EOF
# MythalTerminal Test Generation Report

## Generated Test Files
$(find . -name "*.enhanced.test.ts" -o -name "*integration*.test.ts" -o -name "*e2e*.test.ts" | sort)

## Test Coverage
$(npm run test:coverage -- --silent 2>/dev/null | grep -A 10 "Coverage summary")

## Test Results
- Total test files: $(find . -name "*.test.ts" -o -name "*.test.tsx" | wc -l)
- Unit tests: $(grep -r "describe\|it\(" src/main/__tests__ src/renderer/__tests__ 2>/dev/null | wc -l)
- Integration tests: $(grep -r "describe\|it\(" tests/integration 2>/dev/null | wc -l)
- E2E tests: $(grep -r "describe\|it\(" tests/e2e 2>/dev/null | wc -l)

## Next Steps
1. Review generated tests for accuracy
2. Fix any failing tests
3. Run code reviewer for quality assessment
4. Achieve >80% code coverage
EOF

echo "✅ Test report generated: test-report.md"
echo "🎉 Comprehensive test generation complete!"