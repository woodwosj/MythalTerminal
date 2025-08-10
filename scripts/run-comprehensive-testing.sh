#!/bin/bash

# Master Test Orchestrator
# Runs headless Claude instances for test generation, execution, and review

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "🚀 MythalTerminal Comprehensive Testing System"
echo "=============================================="
echo "Using separate headless Claude Opus 4.1 instances for:"
echo "  1. Test Writing (fresh context)"
echo "  2. Test Running & Analysis (fresh context)"
echo "  3. Code Review (fresh context)"
echo ""

# Check dependencies
echo "✓ Checking dependencies..."
if ! command -v claude &> /dev/null; then
    echo "❌ Error: Claude CLI not found. Please install Claude Code."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm not found. Please install Node.js."
    exit 1
fi

echo "✓ Dependencies OK"
echo ""

# Phase 1: Test Generation
echo "======================================"
echo "📝 PHASE 1: Test Generation"
echo "======================================"
echo "Launching headless Claude instance for test writing..."
echo ""

if [ -f scripts/test-writer-headless.sh ]; then
    bash scripts/test-writer-headless.sh
    if [ $? -ne 0 ]; then
        echo "❌ Test generation failed"
        exit 1
    fi
else
    echo "❌ test-writer-headless.sh not found"
    exit 1
fi

echo ""
sleep 2

# Phase 2: Test Execution
echo "======================================"
echo "🏃 PHASE 2: Test Execution & Analysis"
echo "======================================"
echo "Launching headless Claude instance for test running..."
echo ""

if [ -f scripts/test-runner-headless.sh ]; then
    bash scripts/test-runner-headless.sh
    if [ $? -ne 0 ]; then
        echo "⚠️ Some tests failed, but continuing to review..."
    fi
else
    echo "❌ test-runner-headless.sh not found"
    exit 1
fi

echo ""
sleep 2

# Phase 3: Code Review
echo "======================================"
echo "👨‍⚖️ PHASE 3: Strict Code Review"
echo "======================================"
echo "Launching headless Claude instance for code review..."
echo ""

if [ -f scripts/code-reviewer-headless.sh ]; then
    bash scripts/code-reviewer-headless.sh
    REVIEW_EXIT=$?
else
    echo "❌ code-reviewer-headless.sh not found"
    exit 1
fi

echo ""

# Final Summary
echo "======================================"
echo "📊 FINAL SUMMARY"
echo "======================================"

# Check review verdict
if [ -f /tmp/review-result.json ]; then
    VERDICT=$(jq -r '.verdict' /tmp/review-result.json)
    QUALITY=$(jq -r '.quality_score' /tmp/review-result.json)
    
    echo "Review Verdict: $VERDICT"
    echo "Quality Score: $QUALITY/10"
    echo ""
    
    if [ "$VERDICT" = "APPROVED" ]; then
        echo "🎉 SUCCESS! Code is production-ready!"
        echo ""
        echo "Generated artifacts:"
        echo "  ✓ Comprehensive test suite"
        echo "  ✓ Coverage report"
        echo "  ✓ Code review report"
        
    elif [ "$VERDICT" = "CONDITIONAL" ]; then
        echo "⚠️ CONDITIONAL PASS - Minor fixes needed"
        echo ""
        echo "Review action-items.md for required fixes"
        
    else
        echo "❌ FAILED - Critical issues found"
        echo ""
        echo "Required actions:"
        echo "  1. Review critical issues in review-report-final.md"
        echo "  2. Apply fixes from /tmp/critical-fixes-applied.log"
        echo "  3. Re-run this script"
    fi
else
    echo "⚠️ Review results not found"
fi

echo ""
echo "Reports available:"
echo "  - review-report-final.md (comprehensive review)"
echo "  - /tmp/test-results.log (test execution log)"
echo "  - /tmp/coverage-report.txt (coverage analysis)"
echo "  - /tmp/coverage-gaps.txt (missing test scenarios)"

# Create consolidated report
echo ""
echo "📄 Creating consolidated report..."

cat > comprehensive-test-report.md << EOF
# MythalTerminal Comprehensive Testing Report

**Date:** $(date)
**System:** Headless Claude Opus 4.1 Testing System

## Results Summary
- **Verdict:** ${VERDICT:-Unknown}
- **Quality Score:** ${QUALITY:-0}/10
- **Test Coverage:** $(grep 'All files' /tmp/coverage-report.txt 2>/dev/null | awk '{print $10}' || echo "N/A")

## Phase Results

### Phase 1: Test Generation
$([ -f src/main/__tests__/claudeManager.comprehensive.test.ts ] && echo "✅ Unit tests generated" || echo "❌ Unit test generation failed")
$([ -f tests/integration/system-integration.test.ts ] && echo "✅ Integration tests generated" || echo "❌ Integration test generation failed")
$([ -f tests/e2e/user-workflows.test.ts ] && echo "✅ E2E tests generated" || echo "❌ E2E test generation failed")

### Phase 2: Test Execution
$(grep -q 'FAIL' /tmp/test-results.log 2>/dev/null && echo "⚠️ Some tests failed" || echo "✅ All tests passed")

### Phase 3: Code Review
${VERDICT:-Not completed}

## Generated Files
- src/main/__tests__/claudeManager.comprehensive.test.ts
- src/main/__tests__/database.comprehensive.test.ts
- tests/integration/system-integration.test.ts
- tests/e2e/user-workflows.test.ts

## Next Steps
$(if [ "$VERDICT" = "APPROVED" ]; then
    echo "1. Code is ready for production deployment"
    echo "2. Consider implementing suggested improvements"
elif [ "$VERDICT" = "CONDITIONAL" ]; then
    echo "1. Fix issues listed in action-items.md"
    echo "2. Re-run comprehensive testing"
else
    echo "1. Fix critical issues immediately"
    echo "2. Review and apply fixes from /tmp/critical-fixes-applied.log"
    echo "3. Re-run comprehensive testing until approved"
fi)

---
*Generated by MythalTerminal Comprehensive Testing System*
EOF

echo "✅ Consolidated report saved to comprehensive-test-report.md"

echo ""
echo "======================================"
echo "✨ Comprehensive testing complete!"
echo "======================================"

exit $REVIEW_EXIT