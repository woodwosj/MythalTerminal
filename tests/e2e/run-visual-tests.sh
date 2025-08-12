#!/bin/bash

# MythalTerminal Visual E2E Test Runner
# This script runs all E2E tests with screenshot capture and generates a visual report

echo "🚀 MythalTerminal Visual E2E Testing Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create screenshots directory structure
echo -e "${BLUE}📁 Setting up screenshot directories...${NC}"
mkdir -p tests/e2e/screenshots/{terminal-core,claude-integration,context-layers,special-commands,baseline,diff,failed}

# Build the application first
echo -e "${BLUE}🔨 Building application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed! Please fix build errors first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"
echo ""

# Function to run a specific test file
run_test() {
    local test_file=$1
    local test_name=$2
    
    echo -e "${YELLOW}📸 Running $test_name tests...${NC}"
    npx playwright test $test_file --project=electron --reporter=list
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $test_name tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name tests failed${NC}"
        return 1
    fi
}

# Track overall test status
TESTS_PASSED=0
TESTS_FAILED=0

# Run each test suite
echo -e "${BLUE}🧪 Starting E2E Test Execution${NC}"
echo "================================"
echo ""

# Terminal Core Tests
if run_test "tests/e2e/terminal-core.spec.ts" "Terminal Core"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

# Claude Integration Tests
if run_test "tests/e2e/claude-integration.spec.ts" "Claude Integration"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

# Context Layers Tests
if run_test "tests/e2e/context-layers.spec.ts" "Context Layers"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

# Special Commands Tests
if run_test "tests/e2e/special-commands.spec.ts" "Special Commands"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

# Existing test suites
echo -e "${YELLOW}📸 Running existing test suites...${NC}"
npx playwright test tests/e2e/app.spec.ts tests/e2e/context.spec.ts tests/e2e/terminal.spec.ts --project=electron --reporter=list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Existing tests passed${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Some existing tests failed${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Visual regression tests
echo -e "${YELLOW}📸 Running visual regression tests...${NC}"
npx playwright test tests/e2e/visual-mcp.spec.ts --project=electron --reporter=list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Visual regression tests passed${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Visual regression tests failed${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Generate HTML report
echo -e "${BLUE}📊 Generating test report...${NC}"
npx playwright show-report

# Summary
echo ""
echo "=========================================="
echo -e "${BLUE}📈 Test Execution Summary${NC}"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

# Count screenshots
SCREENSHOT_COUNT=$(find tests/e2e/screenshots -name "*.png" | wc -l)
echo -e "${BLUE}📸 Total screenshots captured: $SCREENSHOT_COUNT${NC}"
echo ""

# List screenshot directories with counts
echo -e "${BLUE}📁 Screenshot breakdown:${NC}"
for dir in tests/e2e/screenshots/*/; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -name "*.png" | wc -l)
        dirname=$(basename "$dir")
        echo "   - $dirname: $count screenshots"
    fi
done
echo ""

# Generate markdown report
echo -e "${BLUE}📝 Generating markdown report...${NC}"
cat > tests/e2e/visual-test-report.md << EOF
# MythalTerminal Visual E2E Test Report

Generated: $(date)

## Test Execution Summary

- **Tests Passed:** $TESTS_PASSED
- **Tests Failed:** $TESTS_FAILED
- **Total Screenshots:** $SCREENSHOT_COUNT

## Test Suites Executed

1. **Terminal Core Functionality**
   - Terminal initialization and focus
   - Input/output operations
   - Special characters and colors
   - Keyboard shortcuts
   - Command history
   - Copy/paste operations
   - Terminal resize
   - Scrollback buffer

2. **Claude AI Integration**
   - Command parsing (claude:, /claude, ai:, /ai)
   - Response streaming
   - Error handling
   - Multiple instances
   - Token counting
   - Conversation context

3. **Context Layer Management**
   - Layer operations
   - Auto-archiving
   - Token limits
   - Persistence
   - ConPort sync

4. **Special Commands**
   - /help command
   - /clear command
   - /status command
   - /history command

## Screenshot Locations

Screenshots are organized by test suite:
- \`tests/e2e/screenshots/terminal-core/\`
- \`tests/e2e/screenshots/claude-integration/\`
- \`tests/e2e/screenshots/context-layers/\`
- \`tests/e2e/screenshots/special-commands/\`

## Next Steps

1. Review failed tests and screenshots
2. Apply fixes using pair coder/reviewer strategy
3. Update baseline screenshots if needed
4. Re-run tests to verify fixes

EOF

echo -e "${GREEN}✅ Report generated: tests/e2e/visual-test-report.md${NC}"
echo ""

# Check if we should open the report
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some tests failed. Review the screenshots and report for details.${NC}"
    echo -e "${YELLOW}   Opening HTML report...${NC}"
    # Uncomment to auto-open report: xdg-open playwright-report/index.html
else
    echo -e "${GREEN}🎉 All tests passed! Great job!${NC}"
fi

echo ""
echo "=========================================="
echo -e "${BLUE}📸 Visual testing complete!${NC}"
echo "=========================================="

exit $TESTS_FAILED