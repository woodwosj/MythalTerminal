#!/bin/bash

# Simple Test Generator using Headless Claude
# Generates tests one at a time with proper file access

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "🚀 Starting Test Generation with Headless Claude Opus 4.1"
echo "========================================================="
echo ""

# Create directories
mkdir -p src/main/__tests__
mkdir -p src/renderer/__tests__
mkdir -p tests/integration
mkdir -p tests/e2e

# Test 1: Generate enhanced ClaudeManager tests
echo "📝 Generating enhanced tests for ClaudeInstanceManager..."

claude --print --model claude-opus-4-1-20250805 \
"Read the file src/main/claudeManager.ts and analyze its structure.

Then generate a COMPLETE Jest test file that includes:
- Comprehensive tests for all methods (initialize, spawnInstance, sendToInstance, etc.)
- Tests for auto-restart with exponential backoff
- Tests for concurrent instance management
- Tests for configuration detection from multiple sources
- Error handling and edge cases
- At least 30 test cases total

The test should mock child_process and fs/promises appropriately.
Include proper TypeScript types and follow Jest best practices.

Output the COMPLETE test file code for src/main/__tests__/claudeManager.enhanced.test.ts" \
> src/main/__tests__/claudeManager.enhanced.test.ts

echo "✅ ClaudeManager tests generated"

# Test 2: Generate enhanced Database tests
echo "📝 Generating enhanced tests for Database layer..."

claude --print --model claude-opus-4-1-20250805 \
"Read the file src/main/database.ts and analyze all the database operations.

Generate a COMPLETE Jest test file that includes:
- Tests for all CRUD operations on each table
- Transaction and rollback tests
- Concurrent access tests
- Data integrity constraint tests
- Performance tests with large datasets
- Migration tests
- At least 25 test cases

Use an in-memory SQLite database for testing.
Mock the Electron app module.

Output the COMPLETE test file code for src/main/__tests__/database.enhanced.test.ts" \
> src/main/__tests__/database.enhanced.test.ts

echo "✅ Database tests generated"

# Test 3: Generate Context Store tests
echo "📝 Generating tests for Context Store..."

claude --print --model claude-opus-4-1-20250805 \
"Read the file src/renderer/stores/contextStore.ts and analyze the Zustand store.

Generate a COMPLETE Jest test file that includes:
- Tests for all store actions (loadContext, addLayer, deleteLayer, toggleStar, etc.)
- Token calculation tests with various layer combinations
- State update tests
- Edge cases (empty state, max tokens, etc.)
- At least 20 test cases

Use @testing-library/react for hook testing.
Mock the IPC API appropriately.

Output the COMPLETE test file code for src/renderer/__tests__/contextStore.enhanced.test.tsx" \
> src/renderer/__tests__/contextStore.enhanced.test.tsx

echo "✅ Context Store tests generated"

# Test 4: Generate Integration tests
echo "📝 Generating integration tests..."

claude --print --model claude-opus-4-1-20250805 \
"Based on the MythalTerminal architecture (Electron + React + SQLite + Claude instances), generate COMPLETE integration tests that verify:

1. Database and IPC integration
2. Claude instance coordination with database
3. Context persistence and retrieval flow
4. Terminal session management
5. Token calculation across components

Include at least 15 integration test cases.
Use proper mocking for external dependencies.

Output the COMPLETE test file code for tests/integration/full-integration.test.ts" \
> tests/integration/full-integration.test.ts

echo "✅ Integration tests generated"

# Test 5: Generate E2E tests
echo "📝 Generating E2E tests..."

claude --print --model claude-opus-4-1-20250805 \
"Generate COMPLETE end-to-end tests for MythalTerminal user workflows:

1. Terminal creation and command execution
2. Context management (add, star, delete)
3. Token limit handling and auto-pruning
4. Claude instance crash and recovery
5. Archive and restore workflows

Use Playwright for Electron testing.
Include page object patterns.
Add at least 10 E2E test scenarios.

Output the COMPLETE test file code for tests/e2e/workflows.test.ts" \
> tests/e2e/workflows.test.ts

echo "✅ E2E tests generated"

# Check file sizes to verify generation
echo ""
echo "📊 Generated Test Files:"
echo "========================"
for file in src/main/__tests__/*.enhanced.test.ts src/renderer/__tests__/*.enhanced.test.tsx tests/integration/*.test.ts tests/e2e/*.test.ts; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        echo "✓ $(basename $file): $lines lines"
    fi
done

echo ""
echo "🎉 Test generation complete!"
echo "Run 'npm test' to execute the tests"