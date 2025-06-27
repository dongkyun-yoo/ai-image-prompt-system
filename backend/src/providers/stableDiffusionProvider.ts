import axios, { AxiosInstance } from 'axios';
import { BaseImageProvider, UnifiedImageParams, ProviderCapabilities, CostEstimate } from './baseProvider';
import { ImageResult } from '../types';
import { logger } from '../utils/logger';

interface StabilityRequest {
  text_prompts: Array<{
    text: string;
    weight: number;
  }>;
  cfg_scale?: number;
  height?: number;
  width?: number;
  samples?: number;
  steps?: number;
  seed?: number;
  style_preset?: string;
}

interface StabilityResponse {
  artifacts: Array<{
    base64: string;
    seed: number;
    finishReason: string;
  }>;
}

export class StableDiffusionProvider extends BaseImageProvider {
  private client: AxiosInstance;
  private engineId: string;

  constructor(apiKey: string, engineId: string = 'stable-diffusion-xl-1024-v1-0') {
    super('stableDiffusion', apiKey);
    this.engineId = engineId;
    
    this.client = axios.create({
      baseURL: 'https://api.stability.ai/v1',
      timeout: 120000, // 2 minutes for generation
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
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
      
      // Build text prompts array
      const textPrompts = [
        {
          text: this.optimizePromptForSD(params.prompt),
          weight: 1.0
        }
      ];

      // Add negative prompt if provided
      if (params.negativePrompt) {
        textPrompts.push({
          text: params.negativePrompt,
          weight: -1.0
        });
      }

      const requestBody: StabilityRequest = {
        text_prompts: textPrompts,
        cfg_scale: 7,
        height: this.roundToDivisibleBy64(height),
        width: this.roundToDivisibleBy64(width),
        samples: Math.min(params.count || 1, 10),
        steps: 30,
        seed: params.seed || 0
      };

      // Add style preset if specified
      if (params.style) {
        requestBody.style_preset = this.mapToStylePreset(params.style);
      }

      const endpoint = `/generation/${this.engineId}/text-to-image`;
      
      const response = await this.retryWithBackoff(async () => {
        return await this.client.post<StabilityResponse>(endpoint, requestBody);
      });

      const artifacts = response.data.artifacts;
      if (!artifacts || artifacts.length === 0) {
        throw new Error('No images returned from Stability AI');
      }

      // Convert first image to data URL
      const imageUrl = `data:image/png;base64,${artifacts[0].base64}`;
      
      const cost = this.calculateActualCost(requestBody);
      const duration = Date.now() - startTime;

      const result: ImageResult = {
        id: requestId,
        imageUrl,
        thumbnailUrl: imageUrl, // Use same image as thumbnail
        metadata: {
          provider: 'stableDiffusion',
          prompt: params.prompt,
          settings: {
            size: `${requestBody.width}x${requestBody.height}`,
            steps: requestBody.steps,
            cfgScale: requestBody.cfg_scale,
            seed: artifacts[0].seed,
            stylePreset: requestBody.style_preset
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

    if (params.prompt && params.prompt.length > 2000) {
      errors.push('Prompt exceeds maximum length of 2000 characters');
    }

    if (params.negativePrompt && params.negativePrompt.length > 2000) {
      errors.push('Negative prompt exceeds maximum length of 2000 characters');
    }

    if (params.count && params.count > 10) {
      errors.push('Stability AI supports maximum 10 images per request');
    }

    const { width, height } = this.standardizeImageSize(params.width, params.height);
    
    // Check minimum and maximum dimensions
    if (width < 128 || height < 128) {
      errors.push('Minimum image size is 128x128');
    }
    
    if (width > 2048 || height > 2048) {
      errors.push('Maximum image size is 2048x2048');
    }

    // Check that dimensions are divisible by 64
    if (width % 64 !== 0 || height % 64 !== 0) {
      errors.push('Image dimensions must be divisible by 64');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxImageSize: { width: 2048, height: 2048 },
      supportedSizes: ['512x512', '768x768', '1024x1024', '1536x1536', '2048x2048'],
      supportedFormats: ['png'],
      maxPromptLength: 2000,
      supportsNegativePrompts: true,
      supportsStylePresets: true,
      maxBatchSize: 10,
      costPerImage: 0.02 // Approximate cost per credit usage
    };
  }

  estimateCost(params: UnifiedImageParams): CostEstimate {
    const { width, height } = this.standardizeImageSize(params.width, params.height);
    const pixelCount = width * height;
    
    // Base cost calculation (simplified)
    let creditsPerImage = 10; // Base credits for 512x512
    
    // Adjust for size
    if (pixelCount > 512 * 512) {
      creditsPerImage = Math.ceil(creditsPerImage * (pixelCount / (512 * 512)));
    }
    
    // Cost per credit (approximately $0.002 per credit)
    const costPerCredit = 0.002;
    const costPerImage = creditsPerImage * costPerCredit;
    
    const count = Math.min(params.count || 1, 10);
    const totalCost = costPerImage * count;
    
    return {
      totalCost,
      costPerImage,
      currency: 'USD',
      breakdown: {
        credits: creditsPerImage * count,
        baseGeneration: costPerImage * count
      }
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Check account balance as health indicator
      const response = await this.client.get('/user/balance');
      return response.status === 200 && response.data.credits > 0;
    } catch (error) {
      logger.error('Stability AI health check failed:', error);
      return false;
    }
  }

  private roundToDivisibleBy64(value: number): number {
    return Math.round(value / 64) * 64;
  }

  private mapToStylePreset(style: string): string | undefined {
    const styleMap: Record<string, string> = {
      'anime': 'anime',
      'digital-art': 'digital-art',
      'photographic': 'photographic',
      'pixel-art': 'pixel-art',
      'comic-book': 'comic-book',
      'fantasy-art': 'fantasy-art',
      'line-art': 'line-art',
      'neon-punk': 'neon-punk',
      'origami': 'origami'
    };
    
    return styleMap[style.toLowerCase()];
  }

  private calculateActualCost(params: StabilityRequest): number {
    const pixelCount = (params.width || 512) * (params.height || 512);
    const baseCredits = 10;
    const credits = Math.ceil(baseCredits * (pixelCount / (512 * 512)));
    const samples = params.samples || 1;
    
    return credits * samples * 0.002; // $0.002 per credit
  }

  // Optimize prompt specifically for Stable Diffusion
  private optimizePromptForSD(prompt: string): string {
    let optimized = prompt;
    
    // Add quality enhancers that work well with SD
    const qualityTerms = ['masterpiece', 'best quality', 'highly detailed'];
    const hasQualityTerms = qualityTerms.some(term => 
      optimized.toLowerCase().includes(term.toLowerCase())
    );
    
    if (!hasQualityTerms) {
      optimized += ', masterpiece, best quality, highly detailed';
    }
    
    // Replace natural language with SD-friendly terms
    const replacements: Record<string, string> = {
      'high resolution': '8k resolution',
      'good quality': 'best quality',
      'nice': 'beautiful',
      'photo': 'photorealistic'
    };
    
    for (const [from, to] of Object.entries(replacements)) {
      optimized = optimized.replace(new RegExp(from, 'gi'), to);
    }
    
    // Clean up
    optimized = optimized.replace(/\s+/g, ' ').trim();
    
    return optimized;
  }

  // Enhanced generation with SD-specific optimizations
  async generateImageWithOptimization(params: UnifiedImageParams): Promise<ImageResult> {
    const optimizedParams = {
      ...params,
      prompt: this.optimizePromptForSD(params.prompt),
      // Add common negative prompts if not specified
      negativePrompt: params.negativePrompt || 'blurry, low quality, distorted, bad anatomy'
    };
    
    return this.generateImage(optimizedParams);
  }

  // Advanced generation with custom parameters
  async generateImageAdvanced(
    params: UnifiedImageParams & {
      cfgScale?: number;
      steps?: number;
      sampler?: string;
      stylePreset?: string;
    }
  ): Promise<ImageResult> {
    // This would be implemented to use additional SD-specific parameters
    return this.generateImage(params);
  }

  // Get available engines/models
  async getAvailableEngines(): Promise<string[]> {
    try {
      const response = await this.client.get('/engines/list');
      return response.data.map((engine: any) => engine.id);
    } catch (error) {
      logger.error('Failed to get available engines:', error);
      return [this.engineId]; // Return current engine as fallback
    }
  }

  // Switch engine for different models
  setEngine(engineId: string): void {
    this.engineId = engineId;
  }

  getEngine(): string {
    return this.engineId;
  }
}