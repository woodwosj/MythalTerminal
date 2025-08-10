# Decision Log

---
## Decision
*   [2025-08-10 03:27:48] Integrate Context Portal (ConPort) for knowledge management

## Rationale
*   ConPort provides knowledge graph-based memory system with semantic search, essential for AI-centric terminal with context management

## Implementation Details
*   ConPort MCP server running via uvx with SQLite backend, ML libraries cached locally

---
## Decision
*   [2025-08-10 03:27:48] Use React with TypeScript for UI development

## Rationale
*   React provides component-based architecture ideal for complex UI, TypeScript adds type safety and better IDE support

## Implementation Details
*   React 18 with functional components and hooks, strict TypeScript configuration

---
## Decision
*   [2025-08-10 03:27:48] Implement MCP servers via stdio transport instead of HTTP

## Rationale
*   Stdio transport proved more reliable than Docker HTTP servers, avoiding container restart issues

## Implementation Details
*   Using npx for Node-based servers (puppeteer, filesystem) and uvx for Python-based Context Portal

---
## Decision
*   [2025-08-10 03:27:48] Use SQLite with better-sqlite3 for local database

## Rationale
*   SQLite provides lightweight, serverless database perfect for desktop apps. better-sqlite3 offers synchronous API that's easier to work with in Electron

## Implementation Details
*   Database stored locally per project, enables offline functionality and fast queries

---
## Decision
*   [2025-08-10 03:27:47] Use Electron for desktop application framework

## Rationale
*   Electron provides cross-platform desktop capabilities while allowing use of web technologies (React, TypeScript) that the team is familiar with

## Implementation Details
*   Electron main process handles window management and IPC, renderer process runs React app
