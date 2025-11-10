# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

- **Build:** `npm run tsc` - Compiles the TypeScript code.
- **Run:** `npm start` - Runs the compiled application from the `build` directory.
- **Develop:** `npm run dev` - A convenient script that builds and then runs the application.
- **Develop with Inspector:** `npm run devins` - Builds and runs the application with the MCP inspector, which is useful for debugging MCP communication.
- **Testing:** The `npm test` command is not currently configured.

## High-level Architecture

This is a server-side application written in TypeScript that implements the Model Context Protocol (MCP). Its primary purpose is to expose local machine capabilities as tools for an AI agent, specifically for interacting with the `TCSAS-Devtools` IDE for miniprogram development.

- **Entry Point:** The main logic is in `src/index.ts`. This file sets up the MCP server and registers all the available tools.
- **Core Logic:** The server defines several tools that the AI can call:
    - `launchIde`: Launches the `TCSAS-Devtools` IDE, optionally opening a specific project.
    - `checkIdeInstalled`: Checks if `TCSAS-Devtools` is installed on the user's machine.
    - `previewMiniprogram`: Previews a miniprogram project and provides a QR code for scanning.
    - `uploadMiniprogram`: Uploads a miniprogram to a service.
- **Utilities:** The `src/utils/` directory contains helper functions for interacting with the operating system, such as finding the IDE installation path (`findAppOnMacOrWin`) and its command-line tool (`getCliPath`).
- **Dependencies:** It uses `@modelcontextprotocol/sdk` for the MCP server implementation and `zod` for schema validation of tool inputs and outputs.

## Development Notes

- Comments in the code should preferably be in English.
