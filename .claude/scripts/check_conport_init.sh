#!/bin/bash

# ConPort Initialization Check Script for MythalTerminal
# This script checks if ConPort is initialized and provides status

WORKSPACE_PATH="/home/stephen-woodworth/Desktop/MythalTerminal"
CONPORT_DB="$WORKSPACE_PATH/context_portal/context.db"
STATUS_FILE="$HOME/.claude/conport_status.txt"
LOG_FILE="$HOME/.claude/conport_log.txt"

# Create directories if they don't exist
mkdir -p "$HOME/.claude"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if we're in the MythalTerminal project
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" != "$WORKSPACE_PATH"* ]]; then
    echo "[CONPORT_SKIP] Not in MythalTerminal workspace"
    echo "SKIP" > "$STATUS_FILE"
    exit 0
fi

# Check if ConPort database exists
if [ -f "$CONPORT_DB" ]; then
    echo "[CONPORT_ACTIVE] ConPort database found at $CONPORT_DB"
    echo "ACTIVE" > "$STATUS_FILE"
    log_message "ConPort is ACTIVE - database found"
    
    # Check database size to ensure it's not empty
    DB_SIZE=$(stat -f%z "$CONPORT_DB" 2>/dev/null || stat -c%s "$CONPORT_DB" 2>/dev/null)
    if [ "$DB_SIZE" -lt 1000 ]; then
        echo "[CONPORT_WARNING] Database exists but appears empty (size: $DB_SIZE bytes)"
        log_message "WARNING: Database may be empty or corrupted"
    fi
else
    echo "[CONPORT_NEEDS_INIT] ConPort database not found at $CONPORT_DB"
    echo "NEEDS_INIT" > "$STATUS_FILE"
    log_message "ConPort NEEDS_INIT - database not found"
    
    # Check if context_portal directory exists
    if [ ! -d "$WORKSPACE_PATH/context_portal" ]; then
        echo "[CONPORT_INFO] Context portal directory doesn't exist. Will be created on first use."
        log_message "Context portal directory missing"
    fi
    
    # Check for projectBrief.md to potentially bootstrap from
    if [ -f "$WORKSPACE_PATH/projectBrief.md" ]; then
        echo "[CONPORT_INFO] Found projectBrief.md - can bootstrap initial context"
        log_message "projectBrief.md available for bootstrapping"
    fi
fi

# Output current status for other scripts to use
echo "Status written to: $STATUS_FILE"