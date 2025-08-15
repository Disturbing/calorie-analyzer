'use client';

import { ImageIcon, XIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export interface ImageAttachment {
  name: string;
  contentType: string;
  data: string; // base64 data
  size: number;
  preview: string; // data URL for preview
}

export type PromptInputImageButtonProps = ComponentProps<typeof Button> & {
  onImageSelect?: (image: ImageAttachment | null) => void;
  maxSizeBytes?: number;
  supportedFormats?: string[];
  disabled?: boolean;
};

export const PromptInputImageButton = ({
  className,
  onImageSelect,
  maxSizeBytes = 5 * 1024 * 1024, // 5MB default
  supportedFormats = ['image/jpeg', 'image/png', 'image/webp'],
  disabled = false,
  ...props
}: PromptInputImageButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const validateAndProcessFile = useCallback((file: File): Promise<ImageAttachment | null> => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!supportedFormats.includes(file.type)) {
        reject(new Error(`Unsupported format. Please use: ${supportedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`));
        return;
      }

      // Validate file size
      if (file.size > maxSizeBytes) {
        const maxSizeMB = Math.round(maxSizeBytes / 1024 / 1024 * 100) / 100;
        const fileSizeMB = Math.round(file.size / 1024 / 1024 * 100) / 100;
        reject(new Error(`File too large (${fileSizeMB}MB). Maximum size: ${maxSizeMB}MB`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result as string;
          if (!result) {
            reject(new Error('Failed to read file'));
            return;
          }

          // Extract base64 data (remove data URL prefix)
          const base64Data = result.split(',')[1];
          
          const attachment: ImageAttachment = {
            name: file.name,
            contentType: file.type,
            data: base64Data,
            size: file.size,
            preview: result // Keep full data URL for preview
          };

          resolve(attachment);
        } catch (error) {
          reject(new Error('Failed to process image'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }, [supportedFormats, maxSizeBytes]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const attachment = await validateAndProcessFile(file);
      onImageSelect?.(attachment);
    } catch (error) {
      console.error('Image validation error:', error);
      // You might want to show a toast or error message here
      alert(error instanceof Error ? error.message : 'Failed to process image');
      onImageSelect?.(null);
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [validateAndProcessFile, onImageSelect]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'shrink-0 text-muted-foreground hover:text-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        <ImageIcon className="size-4" />
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={supportedFormats.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </>
  );
};

export type PromptInputImagePreviewProps = {
  image: ImageAttachment;
  onRemove?: () => void;
  className?: string;
};

export const PromptInputImagePreview = ({
  image,
  onRemove,
  className
}: PromptInputImagePreviewProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024 * 10) / 10} KB`;
    return `${Math.round(bytes / 1024 / 1024 * 100) / 100} MB`;
  };

  return (
    <div className={cn('relative inline-block max-w-48', className)}>
      <div className="relative rounded-lg border bg-muted/50 p-2">
        <img
          src={image.preview}
          alt={image.name}
          className="h-24 w-full rounded object-cover"
        />
        {onRemove && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
            onClick={onRemove}
          >
            <XIcon className="size-3" />
          </Button>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        <div className="truncate" title={image.name}>
          {image.name}
        </div>
        <div>{formatFileSize(image.size)}</div>
      </div>
    </div>
  );
};
