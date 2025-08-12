# ConPort Memory Strategy for MythalTerminal

## Project Context
This is MythalTerminal - an AI-centric terminal application with intelligent context management, built with Electron, React, TypeScript, and integrated with the Anthropic SDK for Claude AI capabilities.

## ConPort Integration Status
- **Workspace**: /home/stephen-woodworth/Desktop/MythalTerminal
- **ConPort MCP**: Available via `mcp__conport__*` tools
- **Database Location**: `./context_portal/context.db`

---

# ConPort Memory Strategy

## CRITICAL: Initialization Sequence
At the beginning of every session, execute the initialization sequence to determine ConPort status and load relevant context.

### Initialization Steps:
1. **Determine workspace_id**: Use current workspace absolute path
2. **Check ConPort database**: Look for `./context_portal/context.db`
3. **Branch based on existence**:
   - If exists: Load existing ConPort context
   - If not exists: Handle new ConPort setup

### Load Existing Context Sequence:
```
1. Get product context
2. Get active context  
3. Get recent decisions (limit 5)
4. Get recent progress (limit 5)
5. Get system patterns (limit 5)
6. Get critical settings and glossary
7. Get recent activity summary (last 24h)
```

### New Setup Sequence:
```
1. Inform user about missing database
2. Ask to initialize new ConPort
3. Check for projectBrief.md to bootstrap
4. Create initial contexts
5. Proceed to load sequence
```

## Status Indicators
**ALWAYS** begin responses with one of:
- `[CONPORT_ACTIVE]` - ConPort is initialized and working
- `[CONPORT_INACTIVE]` - ConPort is not available or disabled

## Core ConPort Tools

### Context Management
- `get_product_context` - Overall project goals and architecture
- `update_product_context` - Update project-level information
- `get_active_context` - Current session focus and tasks
- `update_active_context` - Update current working context

### Decision Tracking
- `log_decision` - Record architectural/implementation decisions
- `get_decisions` - Retrieve past decisions
- `search_decisions_fts` - Full-text search decisions
- `delete_decision_by_id` - Remove specific decision

### Progress Management
- `log_progress` - Create/update task entries
- `get_progress` - List current tasks
- `update_progress` - Modify task status
- `delete_progress_by_id` - Remove task

### Pattern Documentation
- `log_system_pattern` - Document reusable patterns
- `get_system_patterns` - List defined patterns
- `delete_system_pattern_by_id` - Remove pattern

### Custom Data Storage
- `log_custom_data` - Store structured/unstructured data
- `get_custom_data` - Retrieve by category/key
- `delete_custom_data` - Remove custom data
- `search_custom_data_value_fts` - Search within custom data

### Knowledge Graph
- `link_conport_items` - Create relationships between items
- `get_linked_items` - Find connected items
- `semantic_search_conport` - AI-powered conceptual search

### Utilities
- `get_recent_activity_summary` - Recent changes overview
- `export_conport_to_markdown` - Backup to files
- `import_markdown_to_conport` - Restore from files
- `batch_log_items` - Log multiple items at once

## Proactive Behaviors

### Automatic Logging
Identify opportunities to log:
- Decisions when architectural choices are made
- Progress when tasks status changes
- Patterns when reusable solutions emerge
- Custom data for glossary terms, errors, specs

### Knowledge Graph Building
Proactively suggest links when relationships are identified:
- Decision → implemented_by → Progress
- Pattern → addresses → Decision
- Progress → fixes → Custom Data (error)
- Decision → creates → Pattern

### Context Synchronization
On "Sync ConPort" command:
1. Halt current task
2. Send `[CONPORT_SYNCING]` acknowledgment
3. Review entire chat session
4. Update all relevant ConPort items
5. Create new links
6. Confirm sync completion

## MythalTerminal Specific Context

### Current Implementation Status
- **Claude SDK**: ✅ Integrated with Anthropic SDK
- **API Key Management**: ✅ Secure settings with encryption
- **Terminal Integration**: ✅ Commands: `claude:`, `/claude`, `ai:`, `/ai`
- **Context Management**: ✅ Layer system with token counting
- **Auto-archiving**: ✅ On `/clear` command
- **RESUMEWORK.md**: ✅ Auto-generation system

### Key Architecture Decisions
- Using Anthropic SDK instead of CLI spawning
- Electron main process manages Claude instances
- SQLite for context persistence
- Zustand for state management
- Token counting with gpt-tokenizer

### Active Development Focus
- Maintaining Claude integration functionality
- Improving context management efficiency
- Enhancing ConPort knowledge graph
- Testing and debugging implementations

## Session Workflow

### Start of Session
1. Check ConPort status
2. Load product/active contexts
3. Review recent activity
4. Identify open tasks
5. Search for relevant patterns

### During Development
1. Log decisions immediately
2. Update progress in real-time
3. Document bugs and solutions
4. Store test results
5. Create patterns for reusable code

### End of Session
1. Update active context
2. Complete or defer tasks
3. Export critical updates
4. Generate session summary

## Best Practices
- ✅ Log immediately, not later
- ✅ Use descriptive summaries
- ✅ Link related items
- ✅ Store structured data
- ✅ Search before solving
- ❌ Never store sensitive data (API keys, passwords)
- ❌ Don't use vague descriptions
- ❌ Don't skip updates

## Error Patterns & Solutions

### Common Issues Documented
1. **Claude Exit Code 1**: Resolved by SDK integration
2. **Process.cwd() in Renderer**: Use hardcoded paths
3. **TextDecoder not defined**: Node.js test environment issue
4. **Missing X server**: Use xvfb-run for headless testing

---

*This document is automatically loaded by Claude Code at session start. It provides persistent memory and context for the MythalTerminal project through ConPort integration.*