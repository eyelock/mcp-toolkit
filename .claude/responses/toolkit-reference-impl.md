# Toolkit package for Reference Implementations

[sampling]: https://modelcontextprotocol.io/specification/2025-03-26/client/sampling
[prompts]: https://modelcontextprotocol.io/specification/2025-03-26/server/prompts
[resources]: https://modelcontextprotocol.io/specification/2025-03-26/server/resources
[tools]: https://modelcontextprotocol.io/specification/2025-03-26/server/tools
[completion]: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/completion
[logging]: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging
[pagination]: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination
[cancellation]: https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/cancellation
[ping]: https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/ping
[progress]: https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress
[elicitation]: https://modelcontextprotocol.io/docs/learn/client-concepts#elicitation

## Workflow

I'm a developer, I download/clone the boilerplate MCP Toolkit.

- The README told me that if I had an LLM client just open the client in that CWD and enter "Can you help me with MCP Toolkit configuration?"
- Luckily I'm using Claude Code, which supports reading from a CWD .mcp.json
- As it's the first time, I'm asked to allow the MCP Toolkit MCP Server

You are an LLM Agent, you support the MCP Specification.

- Check the status of MCPT [ping]
- MCP Toolkit advertises the guidance for MCPT Session Init via [tools]
- LLM calls the tool to MCPT and returns a response [prompts]
- Gather details of the Model we are operating with [sampling]
- Respond with details of this particular session, via an advertised [resources]
- MCPT Session Init advertises the guidance for MCPT Configuration [prompts]
- LLM calls the Config guidance tool to MCPT and starts the Config session [tools]

We are going through the Configuration workflow for the first time, a basic MCPT so it's a bit of back and forth between us

- YOU: config guidance [prompts] (if not already sent, or if asked by a user)
- YOU: config settings gather details [elicitation]
- ME: Answer and submit questions
- YOU: Save config to MCP [tools]
- MCP: Return details via [logging]

If I ever want to revisit the Config, I can just ask "Can you help me with my MCPT configuration?" [tools] and then enter the config workflow

OK, so now I am set up with the right MCPT configuration and a session is initialzed, we need to GUIDE me to do the right thing, this is where the "packages/toolkit" comes in .... it's not built into "packages/core", like the steps above but is a custom workflow for implementing an MCPT implementation.

Things we want to help the user with:

- Design the model first
- Generate a basic MCP Server and CLI
- Help them get it set up in their IDE / CLI Agent so they can immediately start testing against them
- Lots of other stuff we will likely discover as we get by the initial misalignement :) 