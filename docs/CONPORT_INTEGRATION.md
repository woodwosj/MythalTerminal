# ConPort Integration Guide for MythalTerminal

## Quick Start

### 1. Initialize ConPort Session
```python
# At the start of each development session:
workspace_id = "/home/stephen-woodworth/Desktop/MythalTerminal"

# Load project context
product_context = mcp__conport__get_product_context(workspace_id)
active_context = mcp__conport__get_active_context(workspace_id)

# Check recent activity
recent = mcp__conport__get_recent_activity_summary(
    workspace_id=workspace_id,
    hours_ago=24
)
```

### 2. Log Decisions Immediately
```python
# When making any architectural or implementation decision:
mcp__conport__log_decision(
    workspace_id=workspace_id,
    summary="Brief decision title",
    rationale="Why this decision was made",
    implementation_details="How it will be implemented"
)
```

### 3. Track Progress in Real-Time
```python
# When starting a task:
mcp__conport__log_progress(
    workspace_id=workspace_id,
    status="IN_PROGRESS",
    description="Task description"
)

# When completing:
mcp__conport__update_progress(
    workspace_id=workspace_id,
    progress_id=task_id,
    status="DONE"
)
```

### 4. Store Test Results
```python
# After running tests:
mcp__conport__log_custom_data(
    workspace_id=workspace_id,
    category="TestResults",
    key=f"{date}-{test_type}",
    value={
        "passed": passed_count,
        "failed": failed_count,
        "coverage": coverage_percent
    }
)
```

## Common Patterns

### Pattern 1: Debug Solution Documentation
When you solve a bug, immediately document it:
```python
mcp__conport__log_custom_data(
    workspace_id=workspace_id,
    category="DebugSolutions",
    key="UniqueErrorIdentifier",
    value={
        "error": "The exact error message",
        "context": "When/where it occurs",
        "solution": "How to fix it",
        "code_fix": "The actual code change",
        "explanation": "Why this fixes it"
    }
)
```

### Pattern 2: Feature Implementation Flow
```python
# 1. Log the decision to implement
decision_id = mcp__conport__log_decision(
    workspace_id=workspace_id,
    summary="Implement feature X",
    rationale="User needs this because...",
    implementation_details="Will use approach Y"
)

# 2. Create progress entry linked to decision
progress_id = mcp__conport__log_progress(
    workspace_id=workspace_id,
    status="IN_PROGRESS",
    description="Implementing feature X",
    linked_item_type="decision",
    linked_item_id=str(decision_id)
)

# 3. Document the pattern if reusable
mcp__conport__log_system_pattern(
    workspace_id=workspace_id,
    name="feature_x_pattern",
    description="Pattern for implementing features like X"
)

# 4. Link pattern to decision
mcp__conport__link_conport_items(
    workspace_id=workspace_id,
    source_item_type="decision",
    source_item_id=str(decision_id),
    target_item_type="system_pattern",
    target_item_id="feature_x_pattern",
    relationship_type="creates_pattern"
)
```

### Pattern 3: Knowledge Retrieval
```python
# Find similar problems/solutions:
results = mcp__conport__semantic_search_conport(
    workspace_id=workspace_id,
    query_text="electron renderer process error",
    filter_item_types=["custom_data"],
    top_k=5
)

# Search for specific error solutions:
solutions = mcp__conport__search_custom_data_value_fts(
    workspace_id=workspace_id,
    query_term="exit code 1",
    category_filter="DebugSolutions"
)

# Find related decisions:
decisions = mcp__conport__search_decisions_fts(
    workspace_id=workspace_id,
    query_term="Claude integration"
)
```

## Data Categories Reference

### ProjectGlossary
Store technical terms and component descriptions:
```python
mcp__conport__log_custom_data(
    category="ProjectGlossary",
    key="ComponentName",
    value="Description of what this component does"
)
```

### TestResults
Store test execution metrics:
```python
mcp__conport__log_custom_data(
    category="TestResults",
    key="2025-08-10-e2e",
    value={
        "total": 25,
        "passed": 25,
        "failed": 0,
        "duration": "45s"
    }
)
```

### DebugSolutions
Store error fixes and workarounds:
```python
mcp__conport__log_custom_data(
    category="DebugSolutions",
    key="ErrorIdentifier",
    value={
        "error": "Error message",
        "solution": "How to fix",
        "code_fix": "Code changes"
    }
)
```

### CodePatterns
Store reusable code snippets:
```python
mcp__conport__log_custom_data(
    category="CodePatterns",
    key="PatternName",
    value={
        "purpose": "What this pattern does",
        "code": "The actual code",
        "usage": "How to use it"
    }
)
```

## Knowledge Graph Building

### Relationship Types
- `implements`: Progress implements Decision
- `fixes`: Solution fixes Problem
- `uses`: Component uses Pattern
- `depends_on`: Component depends on Component
- `related_to`: Item related to Item
- `creates_pattern`: Decision creates Pattern
- `exemplifies`: Implementation exemplifies Pattern

### Creating Links
```python
mcp__conport__link_conport_items(
    workspace_id=workspace_id,
    source_item_type="decision",
    source_item_id="13",
    target_item_type="system_pattern",
    target_item_id="sdk_pattern",
    relationship_type="creates_pattern",
    description="Decision creates new integration pattern"
)
```

## Session Workflow

### Start of Session
1. Load context
2. Check recent activity
3. Review open tasks
4. Search for relevant patterns

### During Development
1. Log decisions as made
2. Update progress status
3. Document bugs and fixes
4. Store test results
5. Create patterns for reusable solutions

### End of Session
1. Update active context
2. Complete or defer open tasks
3. Export critical updates
4. Summarize session work

## Best Practices

### DO's
- ✅ Log immediately, not later
- ✅ Use descriptive keys and summaries
- ✅ Link related items
- ✅ Store structured data
- ✅ Search before solving

### DON'Ts
- ❌ Store sensitive data
- ❌ Use vague descriptions
- ❌ Forget to update progress
- ❌ Duplicate information
- ❌ Skip documentation

## Troubleshooting

### Issue: Validation Errors
**Solution**: Simplify data structures, avoid nested arrays

### Issue: Search Not Finding Items
**Solution**: Use more specific terms, check categories

### Issue: Lost Context
**Solution**: Export to markdown, then re-import

### Issue: Orphaned Items
**Solution**: Use link_conport_items to connect

## Advanced Usage

### Batch Operations
```python
mcp__conport__batch_log_items(
    workspace_id=workspace_id,
    item_type="decision",
    items=[
        {"summary": "Decision 1", "rationale": "..."},
        {"summary": "Decision 2", "rationale": "..."}
    ]
)
```

### Context Export/Import
```python
# Export current context
mcp__conport__export_conport_to_markdown(
    workspace_id=workspace_id,
    output_path="./context_backup/"
)

# Import saved context
mcp__conport__import_markdown_to_conport(
    workspace_id=workspace_id,
    input_path="./context_backup/"
)
```

### Semantic Search
```python
# Advanced semantic search with filters
results = mcp__conport__semantic_search_conport(
    workspace_id=workspace_id,
    query_text="Your natural language query",
    filter_item_types=["decision", "custom_data"],
    filter_custom_data_categories=["DebugSolutions"],
    top_k=10
)
```

## ConPort Commands Cheatsheet

```python
# Context Management
get_product_context()         # Get project overview
get_active_context()          # Get current state
update_product_context()      # Update project info
update_active_context()       # Update current state

# Decision Tracking
log_decision()                # Record decision
get_decisions()               # Retrieve decisions
search_decisions_fts()        # Search decisions

# Progress Management
log_progress()                # Create task
update_progress()             # Update task
get_progress()                # List tasks
delete_progress_by_id()       # Remove task

# Pattern Documentation
log_system_pattern()          # Document pattern
get_system_patterns()         # List patterns

# Custom Data Storage
log_custom_data()             # Store data
get_custom_data()             # Retrieve data
search_custom_data_value_fts() # Search data

# Knowledge Graph
link_conport_items()          # Create relationship
get_linked_items()            # Find connections

# Search & Query
semantic_search_conport()     # AI-powered search
search_project_glossary_fts() # Search glossary
get_recent_activity_summary() # Recent changes

# Import/Export
export_conport_to_markdown()  # Backup to files
import_markdown_to_conport()  # Restore from files
```

---
*This integration guide is a living document. Update it as new patterns emerge.*