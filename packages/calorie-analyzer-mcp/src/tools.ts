import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { 
  AnalyzeImageParams, 
  NutritionalAnalysis, 
  AnalysisError
} from './types';
import { 
  NUTRITIONAL_ANALYSIS_SYSTEM_PROMPT, 
  createAnalysisPrompt 
} from './claude-prompts';

export function setupServerTools(server: McpServer, env: Env) {
  server.tool(
    'analyze_food_image',
    'Analyze nutritional content of food from an image using AI vision',
    {
      image_data: z.string().describe('Raw base64 encoded image data (without data URI prefix)'),
      image_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).describe('MIME type of the image'),
      detail_level: z.enum(['basic', 'detailed']).optional().describe('Analysis detail level (default: basic)')
    },
    async ({ image_data, image_type, detail_level = 'basic' }: AnalyzeImageParams): Promise<any> => {
      console.log('=== MCP TOOL CALLED: analyze_food_image ===');
      console.log(`Parameters received:`, {
        image_data_length: image_data?.length || 0,
        image_type,
        detail_level,
        has_image_data: !!image_data
      });
      console.log(`Starting nutritional analysis with detail level: ${detail_level}`);
      
      try {
        // Use the environment passed to the function
        
        if (!env.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY not configured');
        }

        // Validate image size (5MB limit for Claude API)
        const imageSizeBytes = (image_data.length * 3) / 4; // Approximate base64 to binary size
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB

        if (imageSizeBytes > maxSizeBytes) {
          const error: AnalysisError = {
            error: 'Image size exceeds 5MB limit',
            code: 'IMAGE_TOO_LARGE',
            details: `Image size: ${Math.round(imageSizeBytes / 1024 / 1024 * 100) / 100}MB, limit: 5MB`
          };
          
          return {
            content: [{
              type: "text",
              text: `Error: ${error.error}. ${error.details}`
            }],
            error
          };
        }

        // Initialize Claude client
        const anthropic = new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY,
        });

        // Prepare message content for the updated Anthropic SDK
        const messageContent = [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: image_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: image_data
            }
          },
          {
            type: "text" as const,
            text: createAnalysisPrompt(detail_level)
          }
        ];

        console.log('Sending request to Claude API...');

        // Call Claude API
        const response = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: NUTRITIONAL_ANALYSIS_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: messageContent
          }]
        });

        console.log('Received response from Claude API');

        // Extract and parse response
        const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
        
        if (!responseText) {
          throw new Error('Empty response from Claude API');
        }

        let analysis: NutritionalAnalysis;
        
        try {
          // Clean response text in case Claude adds any extra formatting
          const cleanedResponse = responseText.trim().replace(/^```json\s*|```\s*$/g, '');
          analysis = JSON.parse(cleanedResponse);
          
          // Add timestamp if not present
          if (!analysis.timestamp) {
            analysis.timestamp = new Date().toISOString();
          }
          
          // Validate required fields
          if (!analysis.food_items || !Array.isArray(analysis.food_items)) {
            throw new Error('Invalid response format: missing or invalid food_items');
          }
          
          console.log(`Analysis completed successfully. Found ${analysis.food_items.length} food items.`);
          
        } catch (parseError) {
          console.error('Failed to parse Claude response as JSON:', parseError);
          console.error('Raw response:', responseText);
          
          const error: AnalysisError = {
            error: 'Failed to parse nutritional analysis from AI response',
            code: 'PARSE_ERROR',
            details: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          };
          
          return {
            content: [{
              type: "text",
              text: `Error: ${error.error}. The AI response could not be parsed as valid JSON.`
            }],
            error,
            raw_response: responseText
          };
        }

        // Calculate total calories if multiple items and not already provided
        const totalCalories = analysis.total_nutrition?.calories || 
          analysis.food_items.reduce((sum, item) => sum + item.nutrition.calories, 0);

        const summaryText = analysis.food_items.length === 1
          ? `Analyzed "${analysis.food_items[0].name}": ${analysis.food_items[0].nutrition.calories} calories, ${analysis.food_items[0].nutrition.fat_grams}g fat, ${analysis.food_items[0].nutrition.protein_grams}g protein. Confidence: ${Math.round(analysis.food_items[0].confidence * 100)}%`
          : `Analyzed ${analysis.food_items.length} food items with total ${totalCalories} calories. Overall confidence: ${Math.round(analysis.analysis_confidence * 100)}%`;

        return {
          content: [{
            type: "text",
            text: summaryText
          }],
          analysis
        };

      } catch (error) {
        console.error('Error in nutritional analysis:', error);
        
        const analysisError: AnalysisError = {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'API_ERROR',
          details: error instanceof Error ? error.stack : undefined
        };
        
        return {
          content: [{
            type: "text",
            text: `Failed to analyze food image: ${analysisError.error}`
          }],
          error: analysisError
        };
      }
    }
  );
} 