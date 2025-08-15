/**
 * TypeScript interfaces for calorie analysis MCP tool
 */

export interface NutritionalInfo {
  calories: number;
  fat_grams: number;
  protein_grams: number;
  carbs_grams?: number;
  fiber_grams?: number;
  sodium_mg?: number;
  sugar_grams?: number;
}

export interface ServingSize {
  description: string;
  weight_grams?: number;
  volume_ml?: number;
}

export interface FoodItem {
  name: string;
  confidence: number; // 0-1 scale indicating AI confidence in identification
  nutrition: NutritionalInfo;
  serving_size: ServingSize;
}

export interface NutritionalAnalysis {
  food_items: FoodItem[];
  analysis_confidence: number; // 0-1 scale for overall analysis confidence
  total_nutrition?: NutritionalInfo; // Sum of all food items if multiple
  notes?: string; // Additional context or warnings
  timestamp: string; // ISO timestamp of analysis
}

export interface AnalyzeImageParams {
  image_data: string; // Raw base64 encoded image data
  image_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  detail_level?: 'basic' | 'detailed';
}

export interface ClaudeImageMessage {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ClaudeTextMessage {
  type: 'text';
  text: string;
}

export type ClaudeMessageContent = ClaudeImageMessage | ClaudeTextMessage;

export interface AnalysisError {
  error: string;
  code: 'INVALID_IMAGE' | 'IMAGE_TOO_LARGE' | 'API_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR';
  details?: string;
}
