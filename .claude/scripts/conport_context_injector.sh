#!/bin/bash

# ConPort Context Injector for MythalTerminal
# Automatically injects ConPort context into Claude sessions

WORKSPACE_PATH="/home/stephen-woodworth/Desktop/MythalTerminal"
CONPORT_DB="$WORKSPACE_PATH/context_portal/context.db"
SESSION_MARKER="/tmp/claude_conport_initialized_$$"
LOG_FILE="$HOME/.claude/conport_log.txt"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INJECTOR: $1" >> "$LOG_FILE"
}

# Check if this is a ConPort-related operation or new session
if [[ "$1" == *"conport"* ]] || [ ! -f "$SESSION_MARKER" ]; then
    
    # Determine ConPort status
    if [ -f "$CONPORT_DB" ]; then
        DB_STATUS="EXISTS"
        DB_SIZE=$(stat -f%z "$CONPORT_DB" 2>/dev/null || stat -c%s "$CONPORT_DB" 2>/dev/null)
        DB_INFO="(${DB_SIZE} bytes)"
    else
        DB_STATUS="NOT_FOUND"
        DB_INFO="(needs initialization)"
    fi
    
    # Inject context reminder
    cat <<EOF
================================================================================
[CONPORT_CONTEXT_INJECTION]
Project: MythalTerminal - AI-centric terminal with Claude integration
Workspace: $WORKSPACE_PATH
ConPort DB: $DB_STATUS $DB_INFO

Key Reminders:
- Follow ConPort Memory Strategy in CLAUDE.md
- Begin responses with [CONPORT_ACTIVE] or [CONPORT_INACTIVE]
- Log decisions and progress proactively
- Create relationships between ConPort items
- Use semantic search for complex queries

Recent Implementation:
- Anthropic SDK integration complete
- API key configuration UI added
- Terminal-Claude connection established
- Context management system implemented
- Token counting and auto-archiving functional

Use /conport-init, /conport-sync, /conport-status, /conport-search commands
================================================================================
EOF
    
    # Mark as initialized for this session
    touch "$SESSION_MARKER"
    log_message "Context injected for session (PID: $$)"
    
    # Clean up old session markers (older than 24 hours)
    find /tmp -name "claude_conport_initialized_*" -mtime +1 -delete 2>/dev/null
    
else
    log_message "Context already injected for session (PID: $$)"
fi