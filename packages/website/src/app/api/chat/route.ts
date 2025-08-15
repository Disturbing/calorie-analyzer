import { streamText, convertToModelMessages, experimental_createMCPClient, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export async function POST(req: Request) {
  let mcpClient: any = null;
  
  try {
    const body = await req.json();
    const { messages } = body as { messages: any[] };

    // Check for required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY environment variable is not set');
      throw new Error('Missing ANTHROPIC_API_KEY environment variable');
    }

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid messages format:', messages);
      throw new Error('Messages must be an array');
    }

    console.log('Received messages:', messages.length);
    console.log('Messages structure:', JSON.stringify(messages, null, 2));

    let tools = {};
    
    try {
      // Create MCP client to connect to your calorie analyzer server
      console.log('Connecting to MCP server at localhost:8787...');
      mcpClient = await experimental_createMCPClient({
        transport: {
          type: 'sse',
          url: 'http://localhost:8787/sse',
        },
      });

      // Get tools from the MCP server using schema discovery
      console.log('Discovering tools from MCP server...');
      tools = await mcpClient.tools();

      console.log('Tools:', tools);
      console.log('MCP tools loaded successfully');
    } catch (mcpError) {
      console.warn('Failed to connect to MCP server:', mcpError);
      console.log('Continuing without MCP tools...');
      // Continue without tools for now
    }

    // Convert AI SDK UI messages (with parts) to Model messages (with content)
    console.log('Converting AI SDK UI messages to Model format...');
    console.log('Messages have files:', messages.some((m: any) => m.parts?.some((p: any) => p.type === 'file')));
    
    let convertedMessages;
    try {
      // Use convertToModelMessages - it should handle parts → content conversion
      convertedMessages = convertToModelMessages(messages);
      console.log('convertToModelMessages successful');
    } catch (error) {
      console.error('convertToModelMessages failed:', error);
      throw new Error('Message conversion failed - check message format');
    }
    // Enhance system prompt based on available tools
    const hasTools = Object.keys(tools).length > 0;
    const systemPrompt = hasTools 
      ? `You are a helpful AI assistant with access to a food nutrition analysis tool called "analyze_food_image".

CRITICAL: You MUST use the analyze_food_image tool whenever you see an image in the conversation. The user has uploaded an image and expects you to analyze it.

When you see ANY image in the message content:
1. IMMEDIATELY call the analyze_food_image tool BEFORE any other response
2. Extract the base64 data from the image content in the message
3. For the tool parameters use:
   - image_data: extract the base64 data from the image (remove data URI prefix if present)
   - image_type: determine the media type (e.g., 'image/jpeg', 'image/png', 'image/webp') or assume 'image/jpeg'
   - detail_level: 'basic' (unless user specifically requests detailed analysis)

You MUST call the tool first - do not provide any food analysis without using the tool.

For food-related images:
1. ALWAYS use the analyze_food_image tool first
2. Wait for the tool results
3. Present the results in a clear, user-friendly format
4. Highlight key nutritional facts like calories, macronutrients, and any notable health information

For non-food images, still use the tool - it will identify if it's not food.

Always be encouraging and educational about nutrition and healthy eating.`
      : `You are a helpful AI assistant. I can see images that users share and provide general guidance about nutrition and healthy eating.

If users share food images, I can provide general nutritional guidance based on what I can see, but I don't have access to detailed nutritional analysis tools right now.

For non-food images or general conversation, respond naturally and helpfully.

Always be encouraging and educational about nutrition and healthy eating.`;

    console.log('Available tools:', Object.keys(tools));
    console.log('System prompt length:', systemPrompt.length);
    
    // Debug: Log the actual messages being sent to Claude

    // Create the streaming response
    console.log('=== CREATING STREAMTEXT WITH TOOLS ===');
    console.log('Tools passed to streamText:', Object.keys(tools));
    
    // Check if there's an image in the converted messages (Model format)
    const hasImage = convertedMessages.some((msg: any) => 
      Array.isArray(msg.content) && msg.content.some((part: any) => 
        part.type === 'image' || (part.type === 'file' && part.mediaType?.startsWith('image/'))
      )
    );
    console.log('Has image in messages:', hasImage);
    console.log('Total images found:', convertedMessages.reduce((count: number, msg: any) => {
      if (Array.isArray(msg.content)) {
        return count + msg.content.filter((part: any) => 
          part.type === 'image' || (part.type === 'file' && part.mediaType?.startsWith('image/'))
        ).length;
      }
      return count;
    }, 0));
    
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: convertedMessages,
      tools: tools,
      toolChoice: hasImage ? 'required' : 'auto',
      temperature: 0.7,
      maxOutputTokens: 64000,
      stopWhen: stepCountIs(10),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'calorie-chat',
      },
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
        console.log('=== STEP FINISHED ===');
        console.log('Step text:', text?.substring(0, 100) || 'No text');
        console.log('Tool calls count:', toolCalls?.length || 0);
        console.log('Tool results count:', toolResults?.length || 0);
        console.log('Finish reason:', finishReason);
        console.log('Usage:', usage);
        
        if (toolCalls && toolCalls.length > 0) {
          toolCalls.forEach((call, i) => {
            console.log(`=== TOOL CALL ${i} ===`);
            console.log('Tool name:', call.toolName);
            console.log('Tool args:', (call as any).args || 'No args');
          });
        }
        
        if (toolResults && toolResults.length > 0) {
          toolResults.forEach((result, i) => {
            console.log(`=== TOOL RESULT ${i} ===`);
            console.log('Tool call ID:', result.toolCallId);
            console.log('Tool result:', (result as any).result || 'No result');
          });
        }
      },
      onFinish: async ({ text, toolCalls, toolResults, finishReason, usage, steps }) => {
        console.log('=== STREAM FINISHED ===');
        console.log('Final text:', text?.substring(0, 100) || 'No text');
        console.log('Total steps:', steps?.length || 0);
        console.log('Total tool calls across all steps:', steps?.flatMap(step => step.toolCalls || []).length || 0);
        console.log('Finish reason:', finishReason);
        
        console.log('Closing MCP client connection...');
        if (mcpClient) {
          await mcpClient.close();
        }
      },
    });

    return result.toUIMessageStreamResponse();

  } catch (error) {
    console.error('Chat API error:', error);
    
    // Ensure MCP client is closed even on error
    if (mcpClient) {
      try {
        console.log('Closing MCP client connection due to error...');
        await mcpClient.close();
      } catch (closeError) {
        console.error('Error closing MCP client:', closeError);
      }
    }
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
