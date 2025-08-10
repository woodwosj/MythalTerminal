#!/bin/bash

# Strict Code Reviewer with Headless Claude
# This script uses Claude as a harsh critic to review code and tests

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "👨‍⚖️ Starting Strict Code Review System"
echo "======================================"

# Step 1: Collect comprehensive metrics
echo "📊 Collecting code metrics..."

# Test coverage
COVERAGE_JSON=$(npm run test:coverage -- --silent --json 2>/dev/null | tail -n 1)
COVERAGE_PCT=$(echo "$COVERAGE_JSON" | jq -r '.total.lines.pct // 0')

# Code quality metrics
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
ANY_COUNT=$(grep -r "\bany\b" src/ --include="*.ts" --include="*.tsx" | grep -v "// eslint-disable" | wc -l)
CONSOLE_LOGS=$(grep -r "console\.\(log\|error\|warn\)" src/ --include="*.ts" --include="*.tsx" | grep -v "// eslint-disable" | wc -l)
TODO_COMMENTS=$(grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx" | wc -l)

# Test metrics
TOTAL_TESTS=$(grep -r "it\(\|test\(" src/ tests/ --include="*.test.ts" --include="*.test.tsx" 2>/dev/null | wc -l)
SKIPPED_TESTS=$(grep -r "it\.skip\(\|test\.skip\(" src/ tests/ --include="*.test.ts" --include="*.test.tsx" 2>/dev/null | wc -l)
TEST_FILES=$(find . -name "*.test.ts" -o -name "*.test.tsx" | wc -l)

# Security checks
EXEC_USAGE=$(grep -r "exec\|spawn" src/ --include="*.ts" --include="*.tsx" | grep -v "child_process" | wc -l)
EVAL_USAGE=$(grep -r "eval\(" src/ --include="*.ts" --include="*.tsx" | wc -l)

# Step 2: Create detailed review request
cat > /tmp/review-request.md << EOF
# Code Review Request for MythalTerminal

## Project Metrics
- Test Coverage: ${COVERAGE_PCT}%
- TypeScript Errors: ${TS_ERRORS}
- 'any' Type Usage: ${ANY_COUNT}
- Console Statements: ${CONSOLE_LOGS}
- TODO/FIXME Comments: ${TODO_COMMENTS}
- Total Tests: ${TOTAL_TESTS}
- Skipped Tests: ${SKIPPED_TESTS}
- Test Files: ${TEST_FILES}
- Unsafe exec/spawn: ${EXEC_USAGE}
- eval() usage: ${EVAL_USAGE}

## Files to Review
### Core Implementation
$(ls src/main/*.ts | head -10)

### React Components
$(ls src/renderer/components/*.tsx 2>/dev/null | head -10)

### Test Files
$(find . -name "*.test.ts" -o -name "*.test.tsx" | head -20)

## Review Criteria
You are a STRICT, UNCOMPROMISING code reviewer. Your job is to find every flaw, no matter how small.

### CRITICAL (Immediate Rejection)
1. Test coverage < 80%
2. Any security vulnerabilities
3. Memory leaks or resource management issues
4. Race conditions or deadlocks
5. Unhandled promise rejections
6. Missing error boundaries

### MAJOR (Must Fix)
1. Poor test quality (no assertions, weak coverage)
2. Excessive mocking that hides real issues
3. Performance problems (O(n²) or worse)
4. Improper error handling
5. Breaking SOLID principles
6. Magic numbers/strings without constants

### MINOR (Should Fix)
1. Code duplication (DRY violations)
2. Inconsistent naming conventions
3. Missing TypeScript types
4. Incomplete documentation
5. Overly complex functions (cyclomatic complexity > 10)

BE BRUTALLY HONEST. If the code is not production-ready, REJECT IT.
EOF

# Step 3: Perform strict code review
echo "🔍 Performing strict code review..."

claude --no-interactive \
--max-turns 5 \
--prompt "You are an extremely strict code reviewer with 20 years of experience.
You have zero tolerance for mediocre code. Your reputation depends on finding every issue.

$(cat /tmp/review-request.md)

Review the MythalTerminal codebase with extreme scrutiny:

1. VERDICT: APPROVED, REJECTED, or CONDITIONAL
2. If REJECTED, list all CRITICAL issues that must be fixed
3. List all MAJOR issues regardless of verdict
4. Provide specific examples with file:line references
5. Suggest concrete fixes for each issue
6. Rate the overall code quality from 1-10 (10 being perfect)

Output as JSON:
{
  \"verdict\": \"APPROVED/REJECTED/CONDITIONAL\",
  \"quality_score\": 0-10,
  \"coverage_assessment\": {
    \"current\": ${COVERAGE_PCT},
    \"required\": 80,
    \"gaps\": [\"list of uncovered critical paths\"]
  },
  \"critical_issues\": [
    {
      \"severity\": \"CRITICAL\",
      \"file\": \"path/to/file.ts\",
      \"line\": 123,
      \"issue\": \"description\",
      \"impact\": \"what could go wrong\",
      \"fix\": \"specific solution\"
    }
  ],
  \"major_issues\": [...],
  \"minor_issues\": [...],
  \"security_assessment\": {
    \"vulnerabilities\": [...],
    \"risk_level\": \"LOW/MEDIUM/HIGH\"
  },
  \"test_quality\": {
    \"score\": 0-10,
    \"issues\": [\"weak assertions\", \"excessive mocking\", etc],
    \"missing_tests\": [\"list of untested scenarios\"]
  },
  \"recommendations\": [
    \"specific actionable improvements\"
  ],
  \"positive_aspects\": [
    \"things done well (be sparse with praise)\"
  ]
}" > /tmp/review-results.json

# Step 4: Parse review results
VERDICT=$(cat /tmp/review-results.json | jq -r '.verdict // "UNKNOWN"')
QUALITY_SCORE=$(cat /tmp/review-results.json | jq -r '.quality_score // 0')
CRITICAL_COUNT=$(cat /tmp/review-results.json | jq '.critical_issues | length')
MAJOR_COUNT=$(cat /tmp/review-results.json | jq '.major_issues | length')

echo ""
echo "======================================"
echo "📋 Review Results"
echo "======================================"
echo "Verdict: $VERDICT"
echo "Quality Score: $QUALITY_SCORE/10"
echo "Critical Issues: $CRITICAL_COUNT"
echo "Major Issues: $MAJOR_COUNT"
echo ""

# Step 5: If rejected, generate fixes
if [ "$VERDICT" = "REJECTED" ]; then
    echo "❌ CODE REJECTED - Generating fixes..."
    
    # Extract critical issues
    cat /tmp/review-results.json | jq -r '.critical_issues[] | "[\(.severity)] \(.file):\(.line)\n  Issue: \(.issue)\n  Fix: \(.fix)\n"'
    
    # Generate fix implementation
    claude --no-interactive \
    --max-turns 5 \
    --prompt "The code review REJECTED the codebase. Here are the critical issues:

$(cat /tmp/review-results.json | jq '.critical_issues')

Generate the complete fixed code for each critical issue.
The fixes must be production-ready and thoroughly tested.

For each fix, provide:
1. The complete updated file content
2. New test cases to verify the fix
3. Explanation of what was changed and why

Format as:
---FIX: [issue description]---
File: [path]
[complete fixed code]
---TEST---
[test code to verify fix]
---EXPLANATION---
[what changed and why]
---END FIX---" > /tmp/critical-fixes.txt
    
    echo "✅ Fixes generated in /tmp/critical-fixes.txt"
    
elif [ "$VERDICT" = "CONDITIONAL" ]; then
    echo "⚠️ CONDITIONAL APPROVAL - Major issues must be addressed"
    
    cat /tmp/review-results.json | jq -r '.major_issues[] | "[\(.severity)] \(.file):\(.line)\n  Issue: \(.issue)\n  Fix: \(.fix)\n"'
    
elif [ "$VERDICT" = "APPROVED" ]; then
    echo "✅ CODE APPROVED!"
    
    if [ "$MAJOR_COUNT" -gt 0 ]; then
        echo ""
        echo "Recommended improvements:"
        cat /tmp/review-results.json | jq -r '.major_issues[] | "- \(.file): \(.issue)"'
    fi
    
    echo ""
    echo "Positive aspects:"
    cat /tmp/review-results.json | jq -r '.positive_aspects[] | "✓ \(.)"'
fi

# Step 6: Generate detailed report
echo ""
echo "📄 Generating detailed review report..."

cat > code-review-report.md << EOF
# MythalTerminal Code Review Report

**Date:** $(date)
**Reviewer:** Claude (Strict Mode)
**Verdict:** $VERDICT
**Quality Score:** $QUALITY_SCORE/10

## Executive Summary
$(cat /tmp/review-results.json | jq -r '.recommendations | "- " + join("\n- ")')

## Metrics
| Metric | Value | Status |
|--------|-------|--------|
| Test Coverage | ${COVERAGE_PCT}% | $([ "${COVERAGE_PCT%.*}" -ge 80 ] && echo "✅" || echo "❌") |
| TypeScript Errors | $TS_ERRORS | $([ "$TS_ERRORS" -eq 0 ] && echo "✅" || echo "❌") |
| Security Issues | $(cat /tmp/review-results.json | jq '.security_assessment.vulnerabilities | length') | $([ "$(cat /tmp/review-results.json | jq '.security_assessment.vulnerabilities | length')" -eq 0 ] && echo "✅" || echo "❌") |
| Test Quality | $(cat /tmp/review-results.json | jq -r '.test_quality.score')/10 | $([ "$(cat /tmp/review-results.json | jq -r '.test_quality.score')" -ge 7 ] && echo "✅" || echo "⚠️") |

## Critical Issues
$(cat /tmp/review-results.json | jq -r '.critical_issues[] | "### \(.issue)\n**File:** \(.file):\(.line)\n**Impact:** \(.impact)\n**Fix:** \(.fix)\n"')

## Major Issues
$(cat /tmp/review-results.json | jq -r '.major_issues[] | "### \(.issue)\n**File:** \(.file):\(.line)\n**Fix:** \(.fix)\n"')

## Test Coverage Gaps
$(cat /tmp/review-results.json | jq -r '.coverage_assessment.gaps[] | "- \(.)"')

## Security Assessment
**Risk Level:** $(cat /tmp/review-results.json | jq -r '.security_assessment.risk_level')

$(cat /tmp/review-results.json | jq -r '.security_assessment.vulnerabilities[] | "- \(.)"')

## Test Quality Issues
$(cat /tmp/review-results.json | jq -r '.test_quality.issues[] | "- \(.)"')

## Missing Test Scenarios
$(cat /tmp/review-results.json | jq -r '.test_quality.missing_tests[] | "- \(.)"')

## Recommendations
$(cat /tmp/review-results.json | jq -r '.recommendations[] | "1. \(.)"' | nl)

---
*Generated by Strict Code Reviewer*
EOF

echo "✅ Review report saved to code-review-report.md"

# Step 7: Create action items
if [ "$VERDICT" != "APPROVED" ]; then
    echo ""
    echo "📝 Creating action items..."
    
    cat > action-items.md << EOF
# Action Items from Code Review

## Priority 1: Critical (Must fix immediately)
$(cat /tmp/review-results.json | jq -r '.critical_issues[] | "- [ ] \(.file): \(.issue)"')

## Priority 2: Major (Fix before next review)
$(cat /tmp/review-results.json | jq -r '.major_issues[] | "- [ ] \(.file): \(.issue)"')

## Priority 3: Minor (Fix when possible)
$(cat /tmp/review-results.json | jq -r '.minor_issues[] | "- [ ] \(.file): \(.issue)"')

## Test Improvements
$(cat /tmp/review-results.json | jq -r '.test_quality.missing_tests[] | "- [ ] Add test for: \(.)"')
EOF
    
    echo "✅ Action items saved to action-items.md"
fi

echo ""
echo "======================================"
echo "🎬 Code review complete!"
echo "======================================"