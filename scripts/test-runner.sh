#!/bin/bash

# Test Runner Script - Runs tests and uses Claude to fix failures

PROJECT_DIR="/home/stephen-woodworth/Desktop/MythalTerminal"
cd "$PROJECT_DIR"

echo "🧪 Starting Test Runner..."

# Function to extract and create test files
create_test_files() {
    echo "📂 Creating test files from generated content..."
    
    # Parse generated tests and create actual test files
    claude -p "Extract the test code from the generated test files and create proper Jest test files.
    Read these files:
    - tests/generated-unit-tests.txt
    - tests/generated-integration-tests.txt
    - tests/generated-e2e-tests.txt
    
    For each test, output a JSON with:
    {
      \"filename\": \"path/to/test.test.ts\",
      \"content\": \"test file content\"
    }
    
    Ensure proper imports and Jest structure." \
    --output-format json > /tmp/test-files.json
    
    # Process the JSON and create files
    python3 -c "
import json
import os

with open('/tmp/test-files.json', 'r') as f:
    data = json.load(f)
    if isinstance(data, list):
        for test in data:
            filepath = test['filename']
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'w') as tf:
                tf.write(test['content'])
            print(f'Created: {filepath}')
    "
}

# Function to run tests and capture results
run_tests() {
    echo "🏃 Running tests..."
    npm test 2>&1 | tee test-results.log
    return ${PIPESTATUS[0]}
}

# Function to fix failing tests
fix_failures() {
    echo "🔧 Analyzing test failures..."
    
    # Extract failure details
    FAILURES=$(grep -A 10 "FAIL" test-results.log)
    
    if [ -n "$FAILURES" ]; then
        echo "❌ Tests failed. Using Claude to fix..."
        
        claude -p "The following tests are failing in MythalTerminal:

$FAILURES

Full test output:
$(cat test-results.log)

Analyze the failures and provide fixes for the source code (not the tests).
Focus on:
1. Missing implementations
2. Incorrect logic
3. Type errors
4. Async handling issues

Output the complete fixed code for each file that needs changes.
Format as JSON: {\"file\": \"path\", \"content\": \"fixed code\"}" \
        --output-format json \
        --max-turns 5 > /tmp/fixes.json
        
        # Apply fixes
        echo "📝 Applying fixes..."
        python3 -c "
import json
import os

with open('/tmp/fixes.json', 'r') as f:
    data = json.load(f)
    if isinstance(data, dict) and 'file' in data:
        fixes = [data]
    elif isinstance(data, list):
        fixes = data
    else:
        fixes = []
    
    for fix in fixes:
        if 'file' in fix and 'content' in fix:
            filepath = fix['file']
            print(f'Fixing: {filepath}')
            with open(filepath, 'w') as f:
                f.write(fix['content'])
        "
        
        return 0
    else
        echo "✅ All tests passed!"
        return 1
    fi
}

# Main execution
echo "📋 Test Runner Starting..."

# Create test files from generated content
create_test_files

# Run tests up to 3 times with fixes
MAX_ATTEMPTS=3
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🔄 Attempt $ATTEMPT of $MAX_ATTEMPTS"
    
    if run_tests; then
        echo "✅ All tests passed!"
        break
    else
        if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
            fix_failures
            ((ATTEMPT++))
        else
            echo "❌ Tests still failing after $MAX_ATTEMPTS attempts"
            exit 1
        fi
    fi
done

# Generate coverage report
echo "📊 Generating coverage report..."
npm run test:coverage

echo "🎉 Test runner complete!"