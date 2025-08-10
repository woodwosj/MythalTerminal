#!/bin/bash

# Test Writer - Headless Claude Instance
# Uses a dedicated Claude instance with fresh context for test generation

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "🤖 Test Writer Instance Starting..."
echo "=================================="
echo "This Claude instance specializes in writing comprehensive tests"
echo ""

# Prepare project documentation
echo "📚 Preparing project documentation..."

cat > /tmp/test-writer-context.md << 'EOF'
You are a specialized test engineer. Your ONLY job is to write comprehensive, production-ready tests.

PROJECT: MythalTerminal - AI-centric terminal with Claude integration

ARCHITECTURE:
- Electron main process (Node.js)
- React renderer process  
- SQLite database
- IPC communication layer
- Multiple Claude instances managed by ClaudeInstanceManager

YOUR TASK: Generate complete Jest test files that:
1. Have 100% code coverage for critical paths
2. Include edge cases and error scenarios
3. Use proper mocking strategies
4. Follow Jest best practices
5. Are immediately runnable

Focus on testing:
- ClaudeInstanceManager (spawning, crashes, restarts)
- Database operations (CRUD, transactions, migrations)
- IPC handlers (message routing, error handling)
- Context store (state management, token calculations)
- Terminal component (xterm integration)

Output complete test files, not snippets.
EOF

# Generate unit tests for ClaudeInstanceManager
echo "✍️ Writing tests for ClaudeInstanceManager..."

claude --print \
--output-format text \
--max-turns 3 \
--model claude-opus-4-1-20250805 \
"$(cat /tmp/test-writer-context.md)

Read the file src/main/claudeManager.ts and write a COMPLETE Jest test file that:
- Tests all public methods
- Tests crash recovery with exponential backoff
- Tests concurrent instance management
- Tests configuration detection
- Includes at least 25 test cases
- Uses proper beforeEach/afterEach hooks
- Mocks child_process appropriately

Output the complete test file content for src/main/__tests__/claudeManager.comprehensive.test.ts" \
> /tmp/claudeManager.test.generated.ts

echo "✅ ClaudeInstanceManager tests generated"

# Generate unit tests for Database
echo "✍️ Writing tests for Database layer..."

claude --print \
--output-format text \
--max-turns 3 \
--model claude-opus-4-1-20250805 \
"$(cat /tmp/test-writer-context.md)

Read the file src/main/database.ts and write a COMPLETE Jest test file that:
- Tests all CRUD operations for each table
- Tests transaction rollback scenarios  
- Tests concurrent access patterns
- Tests data integrity constraints
- Tests migration handling
- Includes performance tests for large datasets
- Uses an in-memory SQLite database for testing

Output the complete test file content for src/main/__tests__/database.comprehensive.test.ts" \
> /tmp/database.test.generated.ts

echo "✅ Database tests generated"

# Generate integration tests
echo "✍️ Writing integration tests..."

claude --print \
--output-format text \
--max-turns 3 \
--model claude-opus-4-1-20250805 \
"$(cat /tmp/test-writer-context.md)

Write COMPLETE integration tests that verify:
1. Claude instances persist data to database correctly
2. IPC communication triggers proper database updates
3. Context flow from UI to database and back
4. Terminal session persistence and recovery
5. Token calculation across components

Output the complete test file content for tests/integration/system-integration.test.ts" \
> /tmp/integration.test.generated.ts

echo "✅ Integration tests generated"

# Generate E2E tests
echo "✍️ Writing E2E tests..."

claude --print \
--output-format text \
--max-turns 3 \
--model claude-opus-4-1-20250805 \
"$(cat /tmp/test-writer-context.md)

Write COMPLETE end-to-end tests for these user workflows:
1. User creates terminal → executes commands → archives session
2. User adds context → stars items → refreshes with context preservation
3. System approaches token limit → warns user → auto-prunes → continues
4. Claude instance crashes → auto-restarts → resumes work
5. User searches archives → restores context → continues work

Use Playwright or Spectron for Electron app testing.
Include page object patterns and visual regression tests.

Output the complete test file content for tests/e2e/user-workflows.test.ts" \
> /tmp/e2e.test.generated.ts

echo "✅ E2E tests generated"

# Move generated tests to proper locations
echo "📁 Installing generated tests..."

# Create test directories if needed
mkdir -p src/main/__tests__
mkdir -p tests/integration
mkdir -p tests/e2e

# Copy generated tests
cp /tmp/claudeManager.test.generated.ts src/main/__tests__/claudeManager.comprehensive.test.ts
cp /tmp/database.test.generated.ts src/main/__tests__/database.comprehensive.test.ts
cp /tmp/integration.test.generated.ts tests/integration/system-integration.test.ts
cp /tmp/e2e.test.generated.ts tests/e2e/user-workflows.test.ts

echo "✅ Tests installed in project"

# Summary
echo ""
echo "=================================="
echo "📊 Test Generation Complete"
echo "=================================="
echo "Generated files:"
echo "  - src/main/__tests__/claudeManager.comprehensive.test.ts"
echo "  - src/main/__tests__/database.comprehensive.test.ts"
echo "  - tests/integration/system-integration.test.ts"
echo "  - tests/e2e/user-workflows.test.ts"
echo ""
echo "Next step: Run test-runner-headless.sh to execute tests"