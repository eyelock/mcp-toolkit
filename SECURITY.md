# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

> **Note**: This project is pre-1.0 and under active development. Security fixes will be applied to the latest version.

## Reporting a Vulnerability

If you discover a security vulnerability in MCP Toolkit, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainers directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Security Considerations

MCP Toolkit runs as an MCP server with access to your development environment. Be aware that:

- MCP servers can execute tools with your user privileges
- Session data is stored in memory by default (MemoryProvider)
- Custom storage providers may persist sensitive data
- HTTP transport mode should only be used in trusted network environments
