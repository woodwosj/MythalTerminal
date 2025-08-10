#!/bin/bash

# Code Reviewer Script - Uses Claude to review code quality and suggest improvements

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "👨‍💻 Starting Code Review with Claude..."

# Collect codebase information
echo "📊 Analyzing codebase..."

# Get test coverage
COVERAGE=$(npm run test:coverage -- --silent --json 2>/dev/null | tail -n 1)

# Count TypeScript 'any' usage
ANY_COUNT=$(grep -r "any" src/ --include="*.ts" --include="*.tsx" | wc -l)

# Check for console.log statements
CONSOLE_COUNT=$(grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | wc -l)

# Create review request
cat > /tmp/review-request.txt << EOF
Please perform a comprehensive code review of the MythalTerminal project.

Project Structure:
$(find src/ -type f -name "*.ts" -o -name "*.tsx" | head -20)

Code Metrics:
- TypeScript 'any' usage: $ANY_COUNT occurrences
- Console.log statements: $CONSOLE_COUNT occurrences
- Test Coverage: $(echo $COVERAGE | jq -r '.total.lines.pct // "N/A"')%

Review Criteria:
1. Code Quality
   - No 'any' types unless absolutely necessary
   - Proper error handling in all async operations
   - No memory leaks (event listeners, intervals, etc.)
   - Clean code principles

2. Security
   - No command injection vulnerabilities
   - Proper input sanitization
   - Secure IPC communication
   - Safe file operations

3. Performance
   - Efficient token counting
   - Proper resource cleanup
   - Optimized re-renders in React

4. Architecture
   - Separation of concerns
   - SOLID principles
   - Proper abstraction layers

5. Testing
   - Test coverage > 80%
   - All critical paths tested
   - Edge cases covered

Please review these key files:
$(ls src/main/*.ts | head -5)
$(ls src/renderer/components/*.tsx | head -5)
$(ls src/renderer/stores/*.ts | head -5)
EOF

# Perform the review
echo "🔍 Performing code review..."
claude -p "$(cat /tmp/review-request.txt)

Review the codebase and provide:
1. Approval Status: APPROVED or REJECTED
2. Critical Issues (must fix)
3. Recommendations (should fix)
4. Best Practices (nice to have)

For each issue, provide:
- File and line number (if applicable)
- Description of the issue
- Suggested fix

Output as JSON:
{
  \"status\": \"APPROVED/REJECTED\",
  \"critical\": [{\"file\": \"...\", \"issue\": \"...\", \"fix\": \"...\"}],
  \"recommendations\": [...],
  \"bestPractices\": [...],
  \"coverage\": \"...\",
  \"summary\": \"...\"
}" \
--output-format json \
--max-turns 3 > /tmp/review-results.json

# Parse review results
REVIEW_STATUS=$(cat /tmp/review-results.json | jq -r '.status // "UNKNOWN"')
echo "📋 Review Status: $REVIEW_STATUS"

# If rejected, apply critical fixes
if [ "$REVIEW_STATUS" = "REJECTED" ]; then
    echo "❌ Code review failed. Critical issues found."
    
    # Extract critical issues
    CRITICAL_ISSUES=$(cat /tmp/review-results.json | jq -r '.critical')
    echo "🔴 Critical Issues:"
    echo "$CRITICAL_ISSUES" | jq -r '.[] | "- \(.file): \(.issue)"'
    
    # Apply fixes
    echo "🔧 Applying critical fixes..."
    claude -p "Apply these critical fixes to the MythalTerminal codebase:

$(echo $CRITICAL_ISSUES | jq -r '.[] | \"File: \(.file)\nIssue: \(.issue)\nFix: \(.fix)\n---\"')

Output the complete fixed code for each file that needs changes.
Ensure all critical issues are resolved.
Format as JSON: [{\"file\": \"path\", \"content\": \"fixed code\"}]" \
    --output-format json \
    --max-turns 5 > /tmp/critical-fixes.json
    
    # Apply the fixes
    python3 -c "
import json
import os

with open('/tmp/critical-fixes.json', 'r') as f:
    fixes = json.load(f)
    for fix in fixes:
        if 'file' in fix and 'content' in fix:
            filepath = fix['file']
            print(f'Applying fix to: {filepath}')
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'w') as f:
                f.write(fix['content'])
    "
    
    echo "✅ Critical fixes applied. Re-running review..."
    exec "$0"  # Re-run the script
    
elif [ "$REVIEW_STATUS" = "APPROVED" ]; then
    echo "✅ Code review PASSED!"
    
    # Show recommendations
    RECOMMENDATIONS=$(cat /tmp/review-results.json | jq -r '.recommendations // []')
    if [ "$(echo $RECOMMENDATIONS | jq 'length')" -gt 0 ]; then
        echo "💡 Recommendations for improvement:"
        echo "$RECOMMENDATIONS" | jq -r '.[] | "- \(.file): \(.issue)"'
    fi
    
    # Show summary
    SUMMARY=$(cat /tmp/review-results.json | jq -r '.summary // "No summary provided"')
    echo "📝 Review Summary:"
    echo "$SUMMARY"
    
else
    echo "⚠️ Review status unknown. Check /tmp/review-results.json"
fi

# Generate final report
echo "📄 Generating review report..."
cat > review-report.md << EOF
# MythalTerminal Code Review Report

**Date:** $(date)
**Status:** $REVIEW_STATUS

## Code Metrics
- TypeScript 'any' usage: $ANY_COUNT
- Console.log statements: $CONSOLE_COUNT
- Test Coverage: $(echo $COVERAGE | jq -r '.total.lines.pct // "N/A"')%

## Review Results
$(cat /tmp/review-results.json | jq -r '
"### Critical Issues: " + ((.critical // []) | length | tostring) + "\n" +
"### Recommendations: " + ((.recommendations // []) | length | tostring) + "\n" +
"### Best Practices: " + ((.bestPractices // []) | length | tostring)
')

## Summary
$(cat /tmp/review-results.json | jq -r '.summary // "No summary provided"')

---
*Generated by Claude Code Reviewer*
EOF

echo "✅ Review report saved to review-report.md"
echo "🎉 Code review complete!"