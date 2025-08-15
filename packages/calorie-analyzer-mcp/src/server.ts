import { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { McpHonoServerDO } from '@xava-labs/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupServerTools } from './tools';
import { setupServerResources } from './resources';
import { setupServerPrompts } from './prompts';

/**
 * CalorieAnalyzerMcpServer extends McpHonoServerDO for food calorie analysis
 */
export class CalorieAnalyzerMcpServer extends McpHonoServerDO {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Implementation of the required abstract method
   */
  getImplementation(): Implementation {
    return {
      name: 'CalorieAnalyzerMcpServer',
      version: '1.0.0',
    };
  }

  /**
   * Implements the required abstract configureServer method
   * Registers tools for food image analysis
   */
  configureServer(server: McpServer): void {
    // Create and set up tools and resources, passing environment
    setupServerTools(server, this.env as Env);
    setupServerResources(server);
    setupServerPrompts(server);
  }
} 