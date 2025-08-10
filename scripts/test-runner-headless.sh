#!/bin/bash

# Test Runner - Headless Claude Instance
# Executes tests and analyzes failures with a fresh context

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "🏃 Test Runner Instance Starting..."
echo "=================================="
echo "This Claude instance specializes in running and analyzing tests"
echo ""

# Run the test suite
echo "🧪 Running test suite..."
npm test 2>&1 | tee /tmp/test-results.log

# Check if tests passed
if grep -q "FAIL" /tmp/test-results.log; then
    echo "❌ Tests failed. Analyzing failures..."
    
    # Extract failure details
    grep -A 10 "FAIL" /tmp/test-results.log > /tmp/test-failures.txt
    
    # Use headless Claude to analyze failures
    echo "🔍 Launching Claude to analyze test failures..."
    
    claude --print \
    --output-format text \
    --max-turns 3 \
    --model claude-opus-4-1-20250805 \
    "You are a test debugging specialist. Analyze these test failures and provide fixes.

Test Results:
$(cat /tmp/test-failures.txt)

For each failure:
1. Identify the root cause
2. Suggest a specific code fix
3. Explain why the test is failing
4. Provide the corrected test or implementation code

Be specific and provide complete solutions, not general advice." \
    > /tmp/test-fixes.txt
    
    echo "✅ Failure analysis complete. See /tmp/test-fixes.txt"
    
    # Apply fixes automatically
    echo "🔧 Attempting to apply fixes..."
    
    claude --print \
    --output-format json \
    --max-turns 2 \
    --model claude-opus-4-1-20250805 \
    --allowedTools "Read Edit Write" \
    "Read the failure analysis from /tmp/test-fixes.txt and apply the suggested fixes.

Edit the necessary files to fix the failing tests.
Focus on actual bugs in the code, not just making tests pass.

After applying fixes, output a JSON summary:
{
  \"files_modified\": [\"list of files\"],
  \"fixes_applied\": [\"description of each fix\"],
  \"confidence\": \"HIGH/MEDIUM/LOW\"
}" \
    > /tmp/fixes-applied.json
    
    echo "✅ Fixes applied. Re-running tests..."
    npm test
    
else
    echo "✅ All tests passed!"
fi

# Generate coverage report
echo "📊 Generating coverage report..."
npm run test:coverage 2>&1 | tee /tmp/coverage-report.txt

# Analyze coverage gaps
echo "🔍 Analyzing coverage gaps..."

claude --print \
--output-format text \
--max-turns 2 \
--model claude-opus-4-1-20250805 \
"Analyze the test coverage report and identify critical gaps.

Coverage Report:
$(cat /tmp/coverage-report.txt | tail -50)

Identify:
1. Critical uncovered code paths
2. Missing edge case tests
3. Untested error scenarios
4. Performance test opportunities

For each gap, provide a specific test case that should be added." \
> /tmp/coverage-gaps.txt

echo "✅ Coverage analysis complete"

# Summary
echo ""
echo "=================================="
echo "📊 Test Execution Summary"
echo "=================================="
echo "Test Results: $(grep -q 'FAIL' /tmp/test-results.log && echo 'FAILED' || echo 'PASSED')"
echo "Coverage: $(grep 'All files' /tmp/coverage-report.txt | awk '{print $10}')"
echo "Gaps identified: $(wc -l < /tmp/coverage-gaps.txt) lines"
echo ""
echo "Reports saved to:"
echo "  - /tmp/test-results.log"
echo "  - /tmp/coverage-report.txt"
echo "  - /tmp/coverage-gaps.txt"
echo ""
echo "Next step: Run code-reviewer-headless.sh for quality review"