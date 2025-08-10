#!/bin/bash

# Code Reviewer - Strict Headless Claude Instance
# Reviews code quality and can reject implementations

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "👨‍⚖️ Code Reviewer Instance Starting..."
echo "======================================"
echo "This Claude instance is a STRICT, UNCOMPROMISING reviewer"
echo ""

# Collect metrics
echo "📊 Collecting code metrics..."

# Test coverage
COVERAGE=$(npm run test:coverage -- --silent --json 2>/dev/null | tail -1 | jq -r '.total.lines.pct // 0')
[ -z "$COVERAGE" ] && COVERAGE=0

# TypeScript errors
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")

# Code quality issues
ANY_COUNT=$(grep -r "\bany\b" src/ --include="*.ts" --include="*.tsx" | grep -v "// @ts-ignore" | wc -l)
CONSOLE_COUNT=$(grep -r "console\." src/ --include="*.ts" --include="*.tsx" | grep -v "// DEBUG" | wc -l)

# Create review context
cat > /tmp/review-context.md << EOF
You are the STRICTEST code reviewer. You have ZERO tolerance for:
- Code coverage below 80%
- Security vulnerabilities
- Poor error handling
- Memory leaks
- Race conditions
- Bad TypeScript practices

PROJECT METRICS:
- Test Coverage: ${COVERAGE}%
- TypeScript Errors: ${TS_ERRORS}
- 'any' usage: ${ANY_COUNT}
- Console statements: ${CONSOLE_COUNT}

Your job is to REJECT code that isn't production-ready.
Be brutally honest. Your reputation depends on finding every flaw.
EOF

# Perform comprehensive review
echo "🔍 Performing strict code review..."

claude --print \
--output-format json \
--max-turns 5 \
--model claude-opus-4-1-20250805 \
--allowedTools "Read Grep" \
"$(cat /tmp/review-context.md)

Review the MythalTerminal codebase:
1. Read src/main/claudeManager.ts and check for proper error handling, resource cleanup
2. Read src/main/database.ts and check for SQL injection, transaction handling
3. Read src/renderer/stores/contextStore.ts and check for state management issues
4. Grep for security issues: eval, exec, innerHTML, dangerouslySetInnerHTML
5. Check test quality in src/main/__tests__ and tests/

VERDICT CRITERIA:
- REJECTED: Any critical security issue, coverage < 80%, major bugs
- CONDITIONAL: Minor issues that can be fixed quickly
- APPROVED: Production-ready code

Output JSON:
{
  \"verdict\": \"APPROVED/REJECTED/CONDITIONAL\",
  \"quality_score\": 1-10,
  \"critical_issues\": [
    {
      \"file\": \"path\",
      \"line\": 123,
      \"severity\": \"CRITICAL\",
      \"issue\": \"description\",
      \"fix\": \"specific solution\",
      \"code_sample\": \"problematic code\"
    }
  ],
  \"test_quality\": {
    \"score\": 1-10,
    \"coverage_ok\": true/false,
    \"missing_tests\": [\"list\"],
    \"weak_tests\": [\"list\"]
  },
  \"security\": {
    \"score\": 1-10,
    \"vulnerabilities\": [\"list\"],
    \"recommendations\": [\"list\"]
  },
  \"improvements\": [\"ordered list of improvements\"],
  \"praise\": [\"things done well - be sparse\"]
}" > /tmp/review-result.json

# Parse results
VERDICT=$(jq -r '.verdict' /tmp/review-result.json)
QUALITY=$(jq -r '.quality_score' /tmp/review-result.json)
CRITICAL=$(jq '.critical_issues | length' /tmp/review-result.json)

echo ""
echo "======================================"
echo "📋 Review Result: $VERDICT"
echo "======================================"
echo "Quality Score: $QUALITY/10"
echo "Critical Issues: $CRITICAL"
echo ""

# Handle rejection
if [ "$VERDICT" = "REJECTED" ]; then
    echo "❌ CODE REJECTED!"
    echo ""
    echo "Critical issues that MUST be fixed:"
    jq -r '.critical_issues[] | "[\(.severity)] \(.file):\(.line)\n  Issue: \(.issue)\n  Fix: \(.fix)\n"' /tmp/review-result.json
    
    echo ""
    echo "🔧 Generating fixes for critical issues..."
    
    # Generate fixes using another headless instance
    claude --print \
    --output-format text \
    --max-turns 3 \
    --model claude-opus-4-1-20250805 \
    --allowedTools "Read Edit Write" \
    "You are a senior engineer fixing critical issues.

Critical Issues to Fix:
$(jq '.critical_issues' /tmp/review-result.json)

For each issue:
1. Read the file
2. Apply the fix
3. Verify the fix doesn't break anything
4. Add a test to prevent regression

Fix all critical issues now." > /tmp/critical-fixes-applied.log
    
    echo "✅ Critical fixes applied. Re-running tests..."
    npm test
    
    echo "🔄 Re-running code review..."
    exec "$0"  # Re-run this script
    
elif [ "$VERDICT" = "CONDITIONAL" ]; then
    echo "⚠️ CONDITIONAL APPROVAL"
    echo ""
    echo "Must fix before final approval:"
    jq -r '.improvements[:3][] | "- \(.)"' /tmp/review-result.json
    
elif [ "$VERDICT" = "APPROVED" ]; then
    echo "✅ CODE APPROVED!"
    echo ""
    echo "Quality highlights:"
    jq -r '.praise[] | "✓ \(.)"' /tmp/review-result.json
    
    if [ "$QUALITY" -lt 8 ]; then
        echo ""
        echo "Suggested improvements for excellence:"
        jq -r '.improvements[:2][] | "- \(.)"' /tmp/review-result.json
    fi
fi

# Generate final report
cat > review-report-final.md << EOF
# MythalTerminal Code Review Report

**Date:** $(date)
**Reviewer:** Claude Opus 4.1 (Strict Mode)
**Verdict:** $VERDICT
**Quality Score:** $QUALITY/10

## Metrics
- Test Coverage: ${COVERAGE}%
- TypeScript Errors: $TS_ERRORS
- Critical Issues: $CRITICAL

## Review Summary
$(jq -r '.verdict + ": " + (.critical_issues | length | tostring) + " critical, " + (.improvements | length | tostring) + " improvements needed"' /tmp/review-result.json)

## Test Quality
$(jq -r '.test_quality | "Score: " + (.score | tostring) + "/10\nCoverage OK: " + (.coverage_ok | tostring)' /tmp/review-result.json)

## Security Assessment  
$(jq -r '.security | "Score: " + (.score | tostring) + "/10\nVulnerabilities: " + (.vulnerabilities | length | tostring)' /tmp/review-result.json)

## Critical Issues
$(jq -r '.critical_issues[] | "### " + .issue + "\n**File:** " + .file + ":" + (.line | tostring) + "\n**Fix:** " + .fix + "\n"' /tmp/review-result.json)

## Next Steps
$([ "$VERDICT" = "APPROVED" ] && echo "Code is production-ready!" || echo "Fix critical issues and re-run review")

---
*Generated by Claude Opus 4.1 Code Reviewer*
EOF

echo ""
echo "📄 Full report saved to review-report-final.md"
echo "======================================"