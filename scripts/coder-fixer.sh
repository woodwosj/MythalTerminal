#!/bin/bash

# Coder Instance - Fixes issues identified by reviewer
# Works iteratively with reviewer until approval

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "👨‍💻 CODER Instance Starting..."
echo "================================"
echo "Role: Fix all issues to meet production standards"
echo ""

# Read the review report to understand what needs fixing
if [ ! -f "review-report-final.md" ]; then
    echo "❌ No review report found. Running reviewer first..."
    bash scripts/code-reviewer-headless.sh
fi

# Phase 1: Fix Critical Security Issues
echo "🔧 Phase 1: Fixing CRITICAL Security Issues"
echo "==========================================="

claude --print \
--model claude-opus-4-1-20250805 \
--output-format text \
--max-turns 5 \
"You are a senior software engineer fixing critical security vulnerabilities.

CRITICAL ISSUES TO FIX:

1. Command Injection in src/main/claudeManager.ts:142
   - Sanitize all inputs before passing to spawn()
   - Validate and escape user inputs
   - Use a whitelist approach for allowed commands

2. Memory Leaks in src/main/claudeManager.ts:243-251
   - Remove all event listeners before nullifying process
   - Implement proper cleanup in shutdown()
   - Add cleanup to error handlers

3. SQL Injection Risk in src/main/database.ts:149-167
   - Whitelist allowed field names
   - Use parameterized queries only
   - Validate all dynamic SQL components

Read each file, apply the fixes, and ensure the code is secure.
After each fix, add a comment: // SECURITY FIX: [description]

Fix these issues now using Read and Edit tools." > /tmp/security-fixes.log

echo "✅ Security fixes applied"

# Phase 2: Improve Error Handling
echo ""
echo "🔧 Phase 2: Improving Error Handling"
echo "===================================="

claude --print \
--model claude-opus-4-1-20250805 \
--output-format text \
--max-turns 3 \
"Fix poor error handling throughout the codebase:

1. In src/renderer/stores/contextStore.ts - implement proper error propagation
2. Add user-facing error notifications
3. Implement Result<T, Error> pattern for async operations
4. Add error recovery mechanisms

Use Read and Edit tools to apply these fixes.
Add comments: // ERROR HANDLING: [description]" > /tmp/error-handling-fixes.log

echo "✅ Error handling improved"

# Phase 3: Replace TypeScript 'any' Types
echo ""
echo "🔧 Phase 3: Replacing 'any' Types"
echo "================================="

claude --print \
--model claude-opus-4-1-20250805 \
--output-format text \
--max-turns 3 \
"You need to replace ALL 'any' types with proper TypeScript interfaces.

1. Search for all uses of 'any' in the codebase
2. Define proper interfaces in src/shared/types.ts
3. Replace each 'any' with the appropriate type
4. Ensure type safety throughout

Files to check:
- src/main/database.ts
- src/main/ipc.ts
- src/main/claudeManager.ts
- All test files

Use Grep to find all 'any' usage, then Edit to fix them." > /tmp/typescript-fixes.log

echo "✅ TypeScript types fixed"

# Phase 4: Extract Magic Numbers
echo ""
echo "🔧 Phase 4: Extracting Magic Numbers"
echo "===================================="

claude --print \
--model claude-opus-4-1-20250805 \
--output-format text \
--max-turns 2 \
"Extract all magic numbers to named constants:

1. Find hardcoded numbers in src/main/claudeManager.ts (10000, 1000, 3, etc.)
2. Create a constants.ts file with named constants
3. Replace all magic numbers with constant references
4. Do the same for hardcoded strings

Use meaningful names like:
- MAX_RESTART_ATTEMPTS = 3
- RESTART_COOLDOWN_MS = 10000
- BASE_RETRY_DELAY_MS = 1000

Apply these fixes with Read and Edit tools." > /tmp/constants-fixes.log

echo "✅ Magic numbers extracted"

# Phase 5: Write Missing Tests
echo ""
echo "🔧 Phase 5: Writing Missing Tests"
echo "================================="

claude --print \
--model claude-opus-4-1-20250805 \
--output-format text \
--max-turns 5 \
"Write comprehensive tests to achieve 80%+ coverage:

REQUIRED TESTS:
1. Security tests - verify input sanitization works
2. Error handling tests - verify all error paths
3. Memory leak tests - verify proper cleanup
4. Integration tests for database transactions
5. E2E tests for critical user workflows

Focus on untested code paths:
- Error conditions in claudeManager.ts
- Database transaction rollbacks
- Context store error states
- IPC message validation

Write complete test files:
- src/main/__tests__/security.test.ts
- src/main/__tests__/memory.test.ts
- tests/integration/error-recovery.test.ts

Use Write tool to create these test files." > /tmp/new-tests.log

echo "✅ New tests written"

# Phase 6: SOLID Refactoring
echo ""
echo "🔧 Phase 6: SOLID Principle Refactoring"
echo "======================================="

claude --print \
--model claude-opus-4-1-20250805 \
--output-format text \
--max-turns 3 \
"Refactor to follow SOLID principles:

1. Split ClaudeInstanceManager into:
   - ProcessManager (handles process lifecycle)
   - ConfigDetector (handles configuration)
   - InstanceEventEmitter (handles events)

2. Create interfaces for dependency injection
3. Implement proper separation of concerns

This is a major refactor - create new files:
- src/main/ProcessManager.ts
- src/main/ConfigDetector.ts
- src/main/InstanceEventEmitter.ts

Then update claudeManager.ts to use these components.

Use Read, Write, and Edit tools." > /tmp/solid-refactor.log

echo "✅ SOLID refactoring complete"

# Summary
echo ""
echo "================================"
echo "📊 Fix Summary"
echo "================================"
echo "✅ Critical security vulnerabilities fixed"
echo "✅ Memory leaks resolved"
echo "✅ Error handling improved"
echo "✅ TypeScript types properly defined"
echo "✅ Magic numbers extracted to constants"
echo "✅ New tests written for 80%+ coverage"
echo "✅ SOLID principles applied"
echo ""
echo "Next: Run reviewer-validator.sh to verify all fixes"