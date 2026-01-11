# Session Initialization

This MCP Toolkit session has been initialized. Follow these requirements for proper operation.

## Server Status

The server is operational and ready to process requests. Use the `server_info` tool to retrieve server identity, version, and capabilities if needed.

## Ping Protocol

When the client sends a ping request, respond promptly to maintain connection health. The server tracks uptime and request counts internally.

## Session Workflow

1. **Initialize**: Call `session_init` with the project name to configure the session
2. **Verify Status**: Use `session_status` to confirm configuration is active
3. **Operate**: Execute tools and access resources as needed
4. **Update**: Use `session_update` to modify session configuration if requirements change

## Tool Execution

When executing tools:
- Provide clear, descriptive parameters
- Handle errors gracefully with informative messages
- Use progress notifications for long-running operations
- Support cancellation where applicable

## Resource Access

Resources are available via the MCP resource protocol:
- Use `session://current` for active session state
- Use `session://config` for current configuration
- Additional resources may be available based on server capabilities
