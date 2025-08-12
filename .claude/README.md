# Claude Code Configuration for MythalTerminal

This directory contains Claude Code configuration, custom commands, agents, and scripts for the MythalTerminal project with ConPort knowledge graph integration.

## Directory Structure

```
.claude/
├── CLAUDE.md           # Main memory file - ConPort strategy and project context
├── settings.json       # Claude Code settings with hooks configuration
├── commands/           # Custom slash commands
│   ├── conport-init.md    # Initialize ConPort database
│   ├── conport-sync.md    # Synchronize ConPort knowledge
│   ├── conport-status.md  # Generate status report
│   └── conport-search.md  # Search knowledge graph
├── agents/             # Specialized subagents
│   └── conport-manager.md # ConPort knowledge graph manager
├── scripts/            # Automation scripts
│   ├── check_conport_init.sh      # Check ConPort initialization
│   ├── conport_context_injector.sh # Inject context reminders
│   └── conport_sync.sh            # Synchronization checklist
└── README.md          # This file

```

## Features

### 1. Automatic Context Loading
The `CLAUDE.md` file is automatically loaded at the start of each Claude Code session, providing:
- ConPort memory strategy
- Project context and architecture
- Current implementation status
- Known issues and solutions

### 2. Custom Slash Commands
Quick access to ConPort operations:
- `/conport-init` - Initialize or check ConPort database
- `/conport-sync` - Synchronize session knowledge
- `/conport-status` - Generate comprehensive status report
- `/conport-search` - Search the knowledge graph

### 3. Hooks Integration
Automated behaviors configured in `settings.json`:

#### PreToolUse Hooks
- Runs `check_conport_init.sh` before Read/Edit/Write operations
- Ensures ConPort is initialized and provides status

#### PostToolUse Hooks
- Reminds to log decisions after code changes
- Prompts for pattern documentation

#### Notification Hooks
- Displays current ConPort status
- Tracks knowledge graph state

### 4. ConPort Manager Agent
Specialized subagent (`conport-manager`) for:
- Managing knowledge graph initialization
- Maintaining project contexts
- Tracking decisions and progress
- Building relationships between items
- Performing semantic searches

## Usage

### Initial Setup
1. Claude Code automatically loads `CLAUDE.md` on session start
2. Hooks check ConPort status before file operations
3. Use `/conport-init` if database needs initialization

### During Development
1. Make code changes normally
2. Post-edit hooks remind you to log decisions
3. Use `/conport-sync` periodically to update knowledge graph
4. Search with `/conport-search` for relevant context

### Session Management
- Start: ConPort status checked automatically
- During: Decisions and progress logged proactively
- End: Run `/conport-sync` to capture session knowledge

## ConPort Integration

### Database Location
`./context_portal/context.db`

### Key ConPort Tools
- `mcp__conport__get_product_context` - Project overview
- `mcp__conport__update_active_context` - Current focus
- `mcp__conport__log_decision` - Record decisions
- `mcp__conport__log_progress` - Track tasks
- `mcp__conport__semantic_search_conport` - AI search

### Status Indicators
- `[CONPORT_ACTIVE]` - System operational
- `[CONPORT_INACTIVE]` - System unavailable
- `[CONPORT_SYNCING]` - Synchronization in progress
- `[CONPORT_NEEDS_INIT]` - Initialization required

## Scripts

### check_conport_init.sh
- Checks if ConPort database exists
- Validates database size
- Writes status to `~/.claude/conport_status.txt`
- Logs activity to `~/.claude/conport_log.txt`

### conport_context_injector.sh
- Injects context reminders into sessions
- Provides project status summary
- Manages session markers
- Cleans up old session files

### conport_sync.sh
- Displays synchronization checklist
- Shows recent file changes
- Guides through sync process
- Records sync timestamps

## Best Practices

1. **Log Immediately**: Record decisions as they're made
2. **Link Items**: Create relationships between ConPort items
3. **Use Semantic Search**: For complex conceptual queries
4. **Sync Regularly**: Keep knowledge graph current
5. **Document Patterns**: Store reusable solutions

## Troubleshooting

### ConPort Not Initialized
Run `/conport-init` to set up the database

### Hooks Not Running
Ensure scripts have execute permissions:
```bash
chmod +x .claude/scripts/*.sh
```

### Status Unknown
Check `~/.claude/conport_status.txt` and `~/.claude/conport_log.txt`

### Database Issues
Verify `./context_portal/context.db` exists and has proper permissions

## Benefits

1. **Persistent Memory**: ConPort maintains project knowledge across sessions
2. **Automatic Context**: Hooks ensure context is always available
3. **Quick Commands**: Slash commands for common operations
4. **Specialized Agent**: Dedicated ConPort manager for complex tasks
5. **Knowledge Graph**: Relationships between all project items

## Future Enhancements

- [ ] Automatic ConPort sync on session end
- [ ] Visual knowledge graph explorer
- [ ] Pattern recommendation engine
- [ ] Automated decision extraction
- [ ] Cross-project knowledge sharing

---

*This configuration enables intelligent, context-aware development with persistent memory through ConPort integration.*