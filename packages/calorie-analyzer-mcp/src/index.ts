import { CalorieAnalyzerMcpServer } from './server';
// Export the TodoMcpServer class for Durable Object binding
export { CalorieAnalyzerMcpServer };

// Worker entrypoint for handling incoming requests
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const sessionIdStr = url.searchParams.get('sessionId')
    const id = sessionIdStr
        ? env.CALORIE_ANALYZER_MCP_SERVER.idFromString(sessionIdStr)
        : env.CALORIE_ANALYZER_MCP_SERVER.newUniqueId();

    console.log(`=== MCP WORKER REQUEST ===`);
    console.log(`Method: ${request.method}`);
    console.log(`URL: ${url.pathname}`);
    console.log(`SessionId: ${sessionIdStr} with id: ${id}`);
    
    url.searchParams.set('sessionId', id.toString());

    return env.CALORIE_ANALYZER_MCP_SERVER.get(id).fetch(new Request(
        url.toString(),
        request
    ));
  }
};
