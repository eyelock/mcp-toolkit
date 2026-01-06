# MCP Specification Work We Did on Acme

* Roots
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/client/roots
  * Description
    * In ACME we implemented ACME_ROOTS
    * To be honest, at the time I didn't realise it was a Client concept, but it worked out well
    * The client uses Roots to send to the MCP Server, but the Roots concept that the MCP Server has access is also important
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/core/src/roots
  * Priority
    * Low Medium
    * I wonder if that's a bit too specific to ACME at moment to convert to the MCP Tool and a typical MCP server won't need it
    * Feels easy to defer right now as my current use cases don't involve it as much as ACME

* Sampling
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/client/sampling
  * Description
    * Giving the LLM Agent Prompts it can role with role=audience has already proved incredibly powerfule
    * Claude Code is already ahead of the game using things I didn't expect, and even from them new features emerge
    * Haven't given much thought to role=user Prompts currently
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/sampling
      * I _think_ these role=assistant ones have been the real glue that has made Claude Code think really fluidly
      * Again not sure if all of them apply to a general starter template, but maybe /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/sampling/actions/summarize-session-action.ts could be used as an example?
    * /Users/david/Storage/Workspace/eyelock/mcp-toolkit/packages/mcp/src/sampling
      * Weirdly the samples here are role=user, but I'm not sure they are that great.  They at least show what to satart with!
  * Priority
    * Medium
    * Think toolkit samples look OK - with one suggestion of bringing across a good role=assistant example

* Ellicitation
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation
  * Description
    * TBA
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/elicitation
      * TBA
    * /Users/david/Storage/Workspace/eyelock/mcp-toolkit/packages/mcp/src/elicitation
      * Is empty (the cause of me writing up this detailed doc)
  * Priority
    * High
    * Need some good initial examples added


* Prompts
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
  * Description
    * TBA
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/prompts
      * TBA
    * /Users/david/Storage/Workspace/eyelock/mcp-toolkit/packages/mcp/src/prompts
      * TBA
  * Priority
    * Low
    * Think toolkit samples look OK


* Resources / Resource Templates
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/server/resources
  * Description
    * TBA
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/model
      * In ACME, the Model is pretty tied to the Resources ... so it's kinda named different in there
    * /Users/david/Storage/Workspace/eyelock/mcp-toolkit/packages/mcp/src/resources
      * Not sure if I can see a resource template example in the MCP Tooling
  * Priority
    * Medium
    * Double check if have one, if not create something that makes sense


* Tools
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation
  * Description
    * TBA
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/model
      * In ACME, the Model is pretty tied to the Resources ... so it's kinda named different in there
      * at this point it seems we have the abstraction to just tools, we KNOW it is linked to the model
    * /Users/david/Storage/Workspace/eyelock/mcp-toolkit/packages/mcp/src/tools
      * Love the ServerInfo idea, that's a good example that demonstrates but doesn't leak responsibility
  * Priority
    * Low
    * Think toolkit samples look OK


* Logging
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging
  * Description
    * TBA
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/logging.ts
      * I remember a lot of my effort went into this, so that means a huge amount of yours did
    * /Users/david/Storage/Workspace/eyelock/mcp-toolkit/???
      * Not sure
  * Priority
    * High
    * Not seeing this in toolkit

* Pagination
  * Spec links
    * https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
  * Description
    * TBA
  * Code Locations
    * /Users/david/Storage/Workspace/eyelock/acme/packages/mcp/src/pagination.ts
      * I remember a lot of my effort went into this, so that means a huge amount of yours did
    * /Users/david/Storage/Workspace/eyelock/mcp-toolkit/???
      * Not sure
  * Priority
    * High
    * Not seeing this in toolkit
