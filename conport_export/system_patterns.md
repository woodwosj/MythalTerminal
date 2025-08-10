# System Patterns

---
## mcp-integration
*   [2025-08-10 03:32:34]
MCP servers integrated via stdio transport, configured in .mcp.json, with each server providing specific capabilities (browser automation, file access, context management)

---
## test-structure
*   [2025-08-10 03:32:34]
Tests organized by type (unit/e2e/security), using Vitest for unit tests and Playwright for E2E tests, with coverage goals above 80%

---
## database-access
*   [2025-08-10 03:32:34]
Database operations use service layer with prepared statements via better-sqlite3, centralized in database.ts with proper error handling

---
## ipc-communication
*   [2025-08-10 03:32:33]
Electron IPC uses typed channels with invoke/handle pattern for main-renderer communication, ensuring type safety across process boundaries

---
## component-structure
*   [2025-08-10 03:32:33]
React components use functional components with TypeScript interfaces for props, hooks for state management, and Tailwind CSS for styling
