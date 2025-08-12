#!/bin/bash

# ConPort Synchronization Script for MythalTerminal
# Performs comprehensive ConPort sync operations

WORKSPACE_PATH="/home/stephen-woodworth/Desktop/MythalTerminal"
CONPORT_DB="$WORKSPACE_PATH/context_portal/context.db"
LOG_FILE="$HOME/.claude/conport_log.txt"
SYNC_MARKER="/tmp/claude_conport_last_sync"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SYNC: $1" | tee -a "$LOG_FILE"
}

# Check if ConPort is available
if [ ! -f "$CONPORT_DB" ]; then
    echo "[CONPORT_SYNC_ERROR] ConPort database not found. Run /conport-init first."
    exit 1
fi

echo "=================================================================================="
echo "[CONPORT_SYNCING] Starting ConPort synchronization for MythalTerminal"
echo "=================================================================================="

log_message "Synchronization started"

# Record sync timestamp
date '+%Y-%m-%d %H:%M:%S' > "$SYNC_MARKER"

# Provide sync checklist
cat <<EOF

Synchronization Checklist:
--------------------------
1. ✓ Review chat history for new information
2. ✓ Log new decisions made during session
3. ✓ Update progress on existing tasks
4. ✓ Document new system patterns discovered
5. ✓ Update product context if architecture changed
6. ✓ Update active context with current focus
7. ✓ Create links between related items
8. ✓ Store custom data (errors, solutions, glossary)

Specific Areas to Sync:
----------------------
• Decisions: Architectural and implementation choices
• Progress: Task completions, new tasks, status changes
• Patterns: Reusable code patterns or solutions
• Context: Shifts in project focus or goals
• Relationships: New connections between items
• Custom Data: Error solutions, glossary terms, test results

Current Session Focus:
---------------------
• Claude SDK integration
• API key management
• Terminal-Claude connection
• Context management system
• Token counting implementation

EOF

log_message "Sync checklist displayed"

# Check for recent changes in key files
echo "Recent File Changes:"
echo "-------------------"
find "$WORKSPACE_PATH/src" -type f -name "*.ts" -o -name "*.tsx" -mmin -60 2>/dev/null | head -10

echo ""
echo "Sync Status: Ready for manual synchronization"
echo "Use ConPort tools to update the knowledge graph based on session activity"
echo ""

log_message "Synchronization checklist completed"

echo "=================================================================================="
echo "[CONPORT_SYNC_READY] Review checklist and perform synchronization"
echo "=================================================================================="