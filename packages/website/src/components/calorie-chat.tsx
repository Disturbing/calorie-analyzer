'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { FileUIPart } from 'ai';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageAvatar,
} from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import {
  PromptInputImageButton,
  PromptInputImagePreview,
  type ImageAttachment,
} from '@/components/ai-elements/prompt-input-image';
import { 
  Tool, 
  ToolHeader, 
  ToolContent, 
  ToolInput, 
  ToolOutput 
} from '@/components/ai-elements/tool';
import { Actions, Action } from '@/components/ai-elements/actions';
import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { RefreshCwIcon, CopyIcon, AlertCircleIcon, CheckCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Error display component for better UX
const ErrorDisplay = ({ error, className }: { error: any; className?: string }) => {
  const isExpectedError = error?.type && ['IMAGE_TOO_LARGE', 'UNSUPPORTED_FORMAT', 'CONNECTION_ERROR', 'ANALYSIS_ERROR'].includes(error.type);
  
  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-2',
      isExpectedError ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800',
      className
    )}>
      <div className="flex items-center gap-2">
        <AlertCircleIcon className="size-4 shrink-0" />
        <span className="font-medium">
          {isExpectedError ? 'Unable to Process' : 'Unexpected Error'}
        </span>
      </div>
      <div className="text-sm">
        <div>{error?.message || 'Something went wrong'}</div>
        {error?.details && (
          <div className="mt-1 text-xs opacity-80">
            {error.details}
          </div>
        )}
      </div>
    </div>
  );
};

// Success display component for tool results
const SuccessDisplay = ({ result, className }: { result: any; className?: string }) => {
  return (
    <div className={cn(
      'rounded-lg border border-green-200 bg-green-50 text-green-800 p-4 space-y-2',
      className
    )}>
      <div className="flex items-center gap-2">
        <CheckCircleIcon className="size-4 shrink-0" />
        <span className="font-medium">Analysis Complete</span>
      </div>
      <div className="text-sm">
        {result?.summary || 'Nutritional analysis completed successfully'}
      </div>
    </div>
  );
};

export function CalorieChat() {
  const [selectedImage, setSelectedImage] = useState<ImageAttachment | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Use AI SDK 5.x useChat hook (correct API)
  const { messages, sendMessage } = useChat({
    onError: (error: any) => {
      console.error('Chat error:', error);
      setImageError(error.message || 'An error occurred');
    },
  });
  
  // Manual input state management (AI SDK 5.x pattern)
  const [input, setInput] = useState('');
  
  // Debug: Remove in production
  // console.log('useChat 5.x debug:', { messagesLength: messages.length });

  // Handle image selection with validation
  const handleImageSelect = (image: ImageAttachment | null) => {
    setSelectedImage(image);
    setImageError(null);
    
    if (image) {
      console.log(`Selected image: ${image.name} (${Math.round(image.size / 1024)}KB)`);
    }
  };

  // AI SDK 5.x form submit handler following the documentation pattern
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input?.trim() && !selectedImage) {
      return;
    }

    try {
      if (selectedImage) {
        // Send message with attachment using AI SDK 5.x format
        const messageContent = input?.trim() || 'Please analyze this food image.';
        sendMessage({
          text: messageContent,
          files: [{
            type: 'file' as const,
            filename: selectedImage.name,
            mediaType: selectedImage.contentType,
            url: `data:${selectedImage.contentType};base64,${selectedImage.data}`,
          }],
        });
        
        // Clear inputs after submission
        setInput('');
        setSelectedImage(null);
        setImageError(null);
      } else {
        // Send text-only message using AI SDK 5.x sendMessage
        sendMessage({ text: input });
        setInput('');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setImageError('Failed to send message. Please try again.');
    }
  };

  // Copy to clipboard functionality
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You might want to show a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Format tool responses for better display
  const formatToolResponse = (toolResult: any) => {
    if (!toolResult) return null;

    const { success, analysis, error: toolError, summary } = toolResult;

    if (!success && toolError) {
      return <ErrorDisplay error={toolError} />;
    }

    if (success && analysis) {
      return (
        <div className="space-y-4">
          <SuccessDisplay result={{ summary }} />
          
          {analysis.food_items && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Nutritional Breakdown</h4>
              {analysis.food_items.map((item: any, index: number) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="secondary">
                      {Math.round(item.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Calories: <span className="font-medium">{item.nutrition.calories}</span></div>
                    <div>Protein: <span className="font-medium">{item.nutrition.protein_grams}g</span></div>
                    <div>Fat: <span className="font-medium">{item.nutrition.fat_grams}g</span></div>
                    <div>Carbs: <span className="font-medium">{item.nutrition.carb_grams}g</span></div>
                  </div>
                  {item.serving_info && (
                    <div className="text-xs text-muted-foreground">
                      Serving: {item.serving_info.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <div className="text-sm text-muted-foreground">Analysis result not available</div>;
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">Calorie Analyzer Chat</h1>
        <p className="text-sm text-muted-foreground">
          Upload food images to get nutritional analysis powered by AI
        </p>
      </div>

      {/* Chat Area */}
      <Conversation className="flex-1">
        <ConversationContent>
          {(!messages || messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="text-muted-foreground">
                <h2 className="text-lg font-medium mb-2">Welcome to Calorie Analyzer</h2>
                <p>Upload a food image or ask about nutrition to get started!</p>
                <div className="mt-4 text-xs opacity-75">
                  Supports PNG, JPG, and WebP images up to 5MB
                </div>
              </div>
            </div>
          )}

          {messages.map((message: any) => (
            <Message key={message.id} from={message.role}>
              <MessageAvatar
                src={message.role === 'user' ? '/user-avatar.png' : '/ai-avatar.png'}
                name={message.role === 'user' ? 'You' : 'AI'}
              />
              <MessageContent>
                {/* AI SDK 5.x message parts rendering pattern */}
                {message.parts?.map((part: any, i: number) => {
                  switch (part.type) {
                    case 'text':
                      return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                    case 'file':
                      if (part.mediaType?.startsWith('image/')) {
                        return (
                          <div key={`${message.id}-${i}`} className="mt-2">
                            <img
                              src={part.url}
                              alt={part.filename || 'Uploaded image'}
                              className="max-w-sm rounded-lg border"
                            />
                          </div>
                        );
                      }
                      return null;
                    case 'tool-analyze_food_image':
                      return (
                        <Tool key={`${message.id}-${i}`} defaultOpen>
                          <ToolHeader
                            type="tool-analyze_food_image"
                            state={part.result ? 'output-available' : 'input-available'}
                          />
                          <ToolContent>
                            <ToolInput input={part.args} />
                            {part.result && (
                              <ToolOutput
                                output={formatToolResponse(part.result)}
                                errorText={undefined}
                              />
                            )}
                          </ToolContent>
                        </Tool>
                      );
                    default:
                      return null;
                  }
                })}

                {/* Fallback for messages without parts (backward compatibility) */}
                {!message.parts && message.content && (
                  <Response>{message.content}</Response>
                )}



                {/* Actions for assistant messages */}
                {message.role === 'assistant' && (
                  <Actions className="mt-2">
                    <Action
                      label="Copy"
                      onClick={() => {
                        const textContent = message.parts
                          ?.filter((part: any) => part.type === 'text')
                          ?.map((part: any) => part.text)
                          ?.join('') || message.content || '';
                        copyToClipboard(textContent);
                      }}
                    >
                      <CopyIcon className="size-4" />
                    </Action>
                  </Actions>
                )}
              </MessageContent>
            </Message>
          ))}

          {/* Loading State - check if last message is still streaming */}
          {messages.length > 0 && 
           messages[messages.length - 1]?.role === 'assistant' && 
           messages[messages.length - 1]?.parts?.some((part: any) => !part.text && part.type === 'text') && (
            <Message from="assistant">
              <MessageAvatar src="/ai-avatar.png" name="AI" />
              <MessageContent>
                <Loader />
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="border-t p-4">
        {/* Error Display */}
        {imageError && (
          <div className="mb-4">
            <div className="flex items-center gap-2 p-3 rounded-md text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              <AlertCircleIcon className="size-4" />
              <div>
                <p className="font-medium">{imageError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <div className="mb-4">
            <PromptInputImagePreview
              image={selectedImage}
              onRemove={() => setSelectedImage(null)}
            />
          </div>
        )}

        {/* Chat Input */}
        <PromptInput onSubmit={handleFormSubmit}>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedImage 
                ? "Ask me about this food image..." 
                : "Ask me about nutrition or upload a food image..."
            }
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputImageButton
                onImageSelect={handleImageSelect}
                supportedFormats={['image/jpeg', 'image/png', 'image/webp']}
                maxSizeBytes={5 * 1024 * 1024} // 5MB
              />
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!input?.trim() && !selectedImage}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}