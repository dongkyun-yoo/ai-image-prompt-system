import OpenAI from 'openai';
import { BaseImageProvider, UnifiedImageParams, ProviderCapabilities, CostEstimate } from './baseProvider';
import { ImageResult } from '../types';
import { logger } from '../utils/logger';

export class DalleProvider extends BaseImageProvider {
  private openai: OpenAI;
  
  constructor(apiKey: string) {
    super('dalleE3', apiKey);
    this.openai = new OpenAI({ apiKey });
  }

  async generateImage(params: UnifiedImageParams): Promise<ImageResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      this.logRequest(params, requestId);
      
      // Validate parameters
      const validation = await this.validateParams(params);
      if (!validation.valid) {
        throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      const { width, height } = this.standardizeImageSize(params.width, params.height);
      const size = this.mapToValidSize(width, height);
      
      const dalleParams: OpenAI.Images.ImageGenerateParams = {
        model: 'dall-e-3',
        prompt: this.truncatePrompt(params.prompt, 4000),
        n: 1, // DALL-E 3 only supports n=1
        size: size as '1024x1024' | '1024x1792' | '1792x1024',
        quality: params.quality === 'hd' ? 'hd' : 'standard',
        style: params.style === 'natural' ? 'natural' : 'vivid',
        response_format: 'url'
      };

      const response = await this.retryWithBackoff(async () => {
        return await this.openai.images.generate(dalleParams);
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from DALL-E');
      }

      const cost = this.calculateActualCost(dalleParams);
      const duration = Date.now() - startTime;

      const result: ImageResult = {
        id: requestId,
        imageUrl,
        thumbnailUrl: imageUrl, // DALL-E doesn't provide separate thumbnails
        metadata: {
          provider: 'dalleE3',
          prompt: params.prompt,
          settings: {
            size: size,
            quality: dalleParams.quality,
            style: dalleParams.style
          },
          generationTime: duration,
          cost
        }
      };

      this.logResponse(result, requestId, duration);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logError(error, requestId, duration);
      throw error;
    }
  }

  async validateParams(params: UnifiedImageParams): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!params.prompt || params.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }

    if (params.prompt && params.prompt.length > 4000) {
      errors.push('Prompt exceeds maximum length of 4000 characters');
    }

    if (params.count && params.count > 1) {
      errors.push('DALL-E 3 only supports generating 1 image at a time');
    }

    const { width, height } = this.standardizeImageSize(params.width, params.height);
    const validSizes = ['1024x1024', '1024x1792', '1792x1024'];
    const sizeString = `${width}x${height}`;
    
    if (!validSizes.includes(sizeString)) {
      errors.push(`Invalid size ${sizeString}. Supported sizes: ${validSizes.join(', ')}`);
    }

    if (params.negativePrompt) {
      errors.push('DALL-E 3 does not support negative prompts');
    }

    if (params.seed) {
      errors.push('DALL-E 3 does not support seed parameter');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxImageSize: { width: 1792, height: 1792 },
      supportedSizes: ['1024x1024', '1024x1792', '1792x1024'],
      supportedFormats: ['png'],
      maxPromptLength: 4000,
      supportsNegativePrompts: false,
      supportsStylePresets: true, // vivid/natural
      maxBatchSize: 1,
      costPerImage: 0.04 // Base cost, varies by quality
    };
  }

  estimateCost(params: UnifiedImageParams): CostEstimate {
    const { width, height } = this.standardizeImageSize(params.width, params.height);
    const isHD = params.quality === 'hd';
    const isLargeSize = width > 1024 || height > 1024;
    
    let costPerImage = 0.04; // Standard 1024x1024
    
    if (isHD && !isLargeSize) {
      costPerImage = 0.08; // HD 1024x1024
    } else if (isLargeSize) {
      costPerImage = isHD ? 0.12 : 0.08; // Large sizes
    }

    const count = Math.min(params.count || 1, 1); // DALL-E 3 max is 1
    
    return {
      totalCost: costPerImage * count,
      costPerImage,
      currency: 'USD',
      breakdown: {
        baseImages: costPerImage * count,
        qualityUpgrade: isHD ? costPerImage * 0.5 * count : 0,
        sizeUpgrade: isLargeSize ? costPerImage * 0.25 * count : 0
      }
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Simple health check by listing models
      const models = await this.openai.models.list();
      const hasDalle = models.data.some(model => model.id.includes('dall-e'));
      return hasDalle;
    } catch (error) {
      logger.error('DALL-E health check failed:', error);
      return false;
    }
  }

  private mapToValidSize(width: number, height: number): string {
    // Map to closest valid DALL-E size
    const sizes = [
      { w: 1024, h: 1024, size: '1024x1024' },
      { w: 1024, h: 1792, size: '1024x1792' },
      { w: 1792, h: 1024, size: '1792x1024' }
    ];

    // Find the size with minimum distance
    let closestSize = sizes[0];
    let minDistance = Math.abs(width - sizes[0].w) + Math.abs(height - sizes[0].h);

    for (const size of sizes) {
      const distance = Math.abs(width - size.w) + Math.abs(height - size.h);
      if (distance < minDistance) {
        minDistance = distance;
        closestSize = size;
      }
    }

    return closestSize.size;
  }

  private calculateActualCost(params: OpenAI.Images.ImageGenerateParams): number {
    const isHD = params.quality === 'hd';
    const isLargeSize = params.size !== '1024x1024';
    
    if (isHD && !isLargeSize) {
      return 0.08;
    } else if (isLargeSize) {
      return isHD ? 0.12 : 0.08;
    }
    
    return 0.04;
  }

  // Provider-specific optimization for DALL-E
  optimizePromptForDalle(prompt: string): string {
    // DALL-E 3 works best with natural language descriptions
    // Remove technical terms that might confuse it
    let optimized = prompt;
    
    // Remove Stable Diffusion specific terms
    const sdTerms = ['masterpiece', 'best quality', 'highly detailed', 'ultra realistic'];
    for (const term of sdTerms) {
      optimized = optimized.replace(new RegExp(term, 'gi'), '');
    }
    
    // Clean up extra spaces
    optimized = optimized.replace(/\s+/g, ' ').trim();
    
    // Add DALL-E friendly enhancement if prompt is too short
    if (optimized.split(' ').length < 10) {
      optimized += ', high quality, detailed';
    }
    
    return optimized;
  }

  // Enhanced prompt with DALL-E specific optimizations
  async generateImageWithOptimization(params: UnifiedImageParams): Promise<ImageResult> {
    const optimizedParams = {
      ...params,
      prompt: this.optimizePromptForDalle(params.prompt)
    };
    
    return this.generateImage(optimizedParams);
  }
}