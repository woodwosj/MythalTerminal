#!/bin/bash

# Reviewer Instance - Validates fixes and demands more tests
# Cannot write code, only review and demand changes

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "👨‍⚖️ REVIEWER Instance Starting..."
echo "=================================="
echo "Role: Validate fixes and demand quality improvements"
echo ""

# Collect current metrics
COVERAGE=$(npm run test:coverage -- --silent --json 2>/dev/null | tail -1 | jq -r '.total.lines.pct // 0' || echo "0")
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
ANY_COUNT=$(grep -r "\bany\b" src/ --include="*.ts" --include="*.tsx" | grep -v "// @ts-ignore" | wc -l)

echo "Current Metrics:"
echo "  Coverage: ${COVERAGE}%"
echo "  TypeScript Errors: ${TS_ERRORS}"
echo "  'any' usage: ${ANY_COUNT}"
echo ""

# Review the fixes
echo "🔍 Reviewing Applied Fixes..."
echo "=============================="

claude --print \
--model claude-opus-4-1-20250805 \
--output-format json \
--max-turns 5 \
"You are the STRICTEST code reviewer. The coder claims to have fixed the issues.
VERIFY EVERY FIX. Trust nothing. Be skeptical.

Your job:
1. Read the supposedly fixed files and verify each fix
2. Check if security vulnerabilities are REALLY fixed
3. Verify test coverage is REALLY above 80%
4. Ensure no new bugs were introduced
5. Demand additional tests for any uncovered scenarios

CHECK THESE CRITICAL FIXES:
1. Command injection in src/main/claudeManager.ts - Is input REALLY sanitized?
2. Memory leaks - Are event listeners REALLY removed?
3. SQL injection - Are fields REALLY whitelisted?
4. Error handling - Do errors REALLY propagate correctly?
5. TypeScript types - Are ALL 'any' types gone?

Also verify:
- Are magic numbers extracted to constants?
- Is the code following SOLID principles?
- Are there comprehensive tests for each fix?

DEMAND SPECIFIC TESTS:
For each fix, there must be a test that:
1. Verifies the vulnerability is fixed
2. Tests edge cases
3. Tests error conditions
4. Has clear assertions

Output your verdict as JSON:
{
  \"verdict\": \"APPROVED/REJECTED/NEEDS_MORE_WORK\",
  \"fixes_validated\": {
    \"command_injection\": {\"fixed\": true/false, \"reason\": \"...\"},
    \"memory_leaks\": {\"fixed\": true/false, \"reason\": \"...\"},
    \"sql_injection\": {\"fixed\": true/false, \"reason\": \"...\"},
    \"error_handling\": {\"fixed\": true/false, \"reason\": \"...\"},
    \"typescript_types\": {\"fixed\": true/false, \"reason\": \"...\"}
  },
  \"coverage\": {
    \"current\": ${COVERAGE},
    \"acceptable\": true/false,
    \"missing_tests\": [\"list of specific tests needed\"]
  },
  \"demanded_tests\": [
    {
      \"file\": \"path/to/test.ts\",
      \"description\": \"what to test\",
      \"assertions\": [\"what to verify\"]
    }
  ],
  \"remaining_issues\": [
    {
      \"severity\": \"CRITICAL/MAJOR/MINOR\",
      \"file\": \"path\",
      \"line\": 123,
      \"issue\": \"description\",
      \"required_fix\": \"what needs to be done\"
    }
  ],
  \"quality_score\": 1-10,
  \"feedback\": \"harsh but specific feedback\"
}" > /tmp/review-validation.json

# Parse review results
VERDICT=$(jq -r '.verdict' /tmp/review-validation.json)
QUALITY=$(jq -r '.quality_score' /tmp/review-validation.json)
COVERAGE_OK=$(jq -r '.coverage.acceptable' /tmp/review-validation.json)

echo ""
echo "=================================="
echo "📋 Review Results"
echo "=================================="
echo "Verdict: $VERDICT"
echo "Quality Score: $QUALITY/10"
echo "Coverage Acceptable: $COVERAGE_OK"
echo ""

# Check each fix
echo "Fix Validation:"
jq -r '.fixes_validated | to_entries[] | "  \(.key): \(if .value.fixed then "✅" else "❌" end) - \(.value.reason)"' /tmp/review-validation.json

# If not approved, list demanded tests
if [ "$VERDICT" != "APPROVED" ]; then
    echo ""
    echo "❌ NOT APPROVED - More Work Required"
    echo ""
    
    echo "🔴 Remaining Issues:"
    jq -r '.remaining_issues[] | "  [\(.severity)] \(.file):\(.line)\n    Issue: \(.issue)\n    Fix: \(.required_fix)"' /tmp/review-validation.json
    
    echo ""
    echo "📝 DEMANDED TESTS (Coder must write these):"
    jq -r '.demanded_tests[] | "  \(.file):\n    Purpose: \(.description)\n    Must verify: \(.assertions | join(\", \"))"' /tmp/review-validation.json
    
    echo ""
    echo "Missing Test Scenarios:"
    jq -r '.coverage.missing_tests[] | "  - \(.)"' /tmp/review-validation.json
    
    # Create a todo list for the coder
    cat > /tmp/coder-todo.md << EOF
# Coder TODO List (From Reviewer)

## Tests You MUST Write:
$(jq -r '.demanded_tests[] | "- [ ] \(.file): \(.description)"' /tmp/review-validation.json)

## Issues You MUST Fix:
$(jq -r '.remaining_issues[] | "- [ ] [\(.severity)] \(.file): \(.issue)"' /tmp/review-validation.json)

## Coverage Gaps to Fill:
$(jq -r '.coverage.missing_tests[] | "- [ ] \(.)"' /tmp/review-validation.json)

After completing these, run the reviewer again.
EOF
    
    echo ""
    echo "📄 TODO list saved to /tmp/coder-todo.md"
    echo "The coder must complete ALL items before re-review"
    
elif [ "$VERDICT" = "APPROVED" ]; then
    echo ""
    echo "✅ APPROVED! Code meets production standards!"
    echo ""
    echo "Final Quality Metrics:"
    echo "  Coverage: ${COVERAGE}%"
    echo "  Quality Score: $QUALITY/10"
    echo "  TypeScript Errors: $TS_ERRORS"
    echo ""
    echo "Praise (sparse):"
    jq -r '.feedback' /tmp/review-validation.json
else
    echo ""
    echo "⚠️ NEEDS MORE WORK"
    echo "Some fixes are good but not sufficient."
fi

# Generate final review report
cat > review-validation-report.md << EOF
# Code Review Validation Report

**Date:** $(date)
**Reviewer:** Claude Opus 4.1 (Strict Mode)
**Verdict:** $VERDICT
**Quality Score:** $QUALITY/10

## Metrics
- Test Coverage: ${COVERAGE}%
- TypeScript Errors: $TS_ERRORS
- 'any' usage: $ANY_COUNT

## Fix Validation
$(jq -r '.fixes_validated | to_entries[] | "- **\(.key)**: \(if .value.fixed then "✅ Fixed" else "❌ Not Fixed" end)\n  - Reason: \(.value.reason)"' /tmp/review-validation.json)

## Tests Demanded by Reviewer
$(jq -r '.demanded_tests[] | "### \(.file)\n**Purpose:** \(.description)\n**Must Verify:** \(.assertions | join(\", \"))\n"' /tmp/review-validation.json)

## Remaining Issues
$(jq -r '.remaining_issues[] | "### [\(.severity)] \(.file):\(.line)\n**Issue:** \(.issue)\n**Required Fix:** \(.required_fix)\n"' /tmp/review-validation.json)

## Reviewer Feedback
$(jq -r '.feedback' /tmp/review-validation.json)

---
*Generated by Strict Code Reviewer*
EOF

echo ""
echo "📄 Full report saved to review-validation-report.md"
echo "=================================="