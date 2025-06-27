import { ImageRequest, ImageResult, ImageProvider, RateLimitInfo } from '../types';
import { logger } from '../utils/logger';

export interface ProviderCapabilities {
  maxImageSize: { width: number; height: number };
  supportedSizes: string[];
  supportedFormats: string[];
  maxPromptLength: number;
  supportsNegativePrompts: boolean;
  supportsStylePresets: boolean;
  maxBatchSize: number;
  costPerImage: number;
}

export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface UnifiedImageParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  quality?: 'standard' | 'hd';
  style?: string;
  count?: number;
  seed?: number;
  provider?: ImageProvider;
}

export interface CostEstimate {
  totalCost: number;
  costPerImage: number;
  currency: 'USD';
  breakdown?: Record<string, number>;
}

export abstract class BaseImageProvider {
  protected readonly name: ImageProvider;
  protected readonly apiKey: string;
  protected rateLimitTracker: Map<string, RateLimitInfo> = new Map();

  constructor(name: ImageProvider, apiKey: string) {
    this.name = name;
    this.apiKey = apiKey;
  }

  abstract generateImage(params: UnifiedImageParams): Promise<ImageResult>;
  abstract validateParams(params: UnifiedImageParams): Promise<{ valid: boolean; errors: string[] }>;
  abstract getCapabilities(): ProviderCapabilities;
  abstract estimateCost(params: UnifiedImageParams): CostEstimate;
  abstract checkHealth(): Promise<boolean>;

  protected async handleRateLimit(endpoint: string): Promise<void> {
    const rateLimit = this.rateLimitTracker.get(endpoint);
    
    if (rateLimit && rateLimit.remaining === 0 && rateLimit.resetTime > new Date()) {
      const waitTime = rateLimit.resetTime.getTime() - Date.now();
      logger.warn(`Rate limit hit for ${this.name}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  protected updateRateLimit(endpoint: string, info: RateLimitInfo): void {
    this.rateLimitTracker.set(endpoint, info);
  }

  protected mapError(error: any): ProviderError {
    const baseError: ProviderError = {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      retryable: false
    };

    if (error.response?.status === 429) {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retryable: true,
        retryAfter: parseInt(error.response.headers['retry-after'] || '60')
      };
    }

    if (error.response?.status >= 500) {
      return {
        code: 'SERVER_ERROR',
        message: 'Provider server error',
        retryable: true
      };
    }

    if (error.response?.status === 400) {
      return {
        code: 'INVALID_REQUEST',
        message: error.response.data?.error?.message || 'Invalid request parameters',
        retryable: false
      };
    }

    if (error.response?.status === 401) {
      return {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key or authentication failed',
        retryable: false
      };
    }

    return baseError;
  }

  protected standardizeImageSize(width?: number, height?: number): { width: number; height: number } {
    // Default to 1024x1024 if not specified
    const defaultSize = 1024;
    
    // Ensure dimensions are multiples of 64 (common requirement)
    const roundTo64 = (value: number) => Math.round(value / 64) * 64;
    
    const finalWidth = width ? roundTo64(Math.max(256, Math.min(2048, width))) : defaultSize;
    const finalHeight = height ? roundTo64(Math.max(256, Math.min(2048, height))) : defaultSize;
    
    return { width: finalWidth, height: finalHeight };
  }

  protected truncatePrompt(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }
    
    // Truncate at word boundary
    const truncated = prompt.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
  }

  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const providerError = this.mapError(error);
        
        if (!providerError.retryable || attempt === maxRetries) {
          throw error;
        }
        
        const delay = providerError.retryAfter 
          ? providerError.retryAfter * 1000 
          : baseDelay * Math.pow(2, attempt - 1);
        
        logger.warn(`${this.name} attempt ${attempt} failed, retrying in ${delay}ms:`, providerError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  protected generateRequestId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected logRequest(params: UnifiedImageParams, requestId: string): void {
    logger.info(`${this.name} request ${requestId}:`, {
      provider: this.name,
      requestId,
      prompt: params.prompt.substring(0, 100),
      parameters: {
        size: `${params.width || 1024}x${params.height || 1024}`,
        quality: params.quality,
        count: params.count || 1
      }
    });
  }

  protected logResponse(result: ImageResult, requestId: string, duration: number): void {
    logger.info(`${this.name} response ${requestId}:`, {
      provider: this.name,
      requestId,
      success: true,
      imageCount: result.images?.length || 0,
      cost: result.cost,
      duration: `${duration}ms`
    });
  }

  protected logError(error: any, requestId: string, duration: number): void {
    const providerError = this.mapError(error);
    logger.error(`${this.name} error ${requestId}:`, {
      provider: this.name,
      requestId,
      success: false,
      error: providerError,
      duration: `${duration}ms`
    });
  }

  getName(): ImageProvider {
    return this.name;
  }

  getRateLimitInfo(endpoint: string = 'default'): RateLimitInfo | undefined {
    return this.rateLimitTracker.get(endpoint);
  }

  async warmup(): Promise<boolean> {
    try {
      return await this.checkHealth();
    } catch (error) {
      logger.error(`Failed to warm up ${this.name}:`, error);
      return false;
    }
  }
}