import { GoogleAuth } from 'google-auth-library';
import axios, { AxiosInstance } from 'axios';
import { BaseImageProvider, UnifiedImageParams, ProviderCapabilities, CostEstimate } from './baseProvider';
import { ImageResult } from '../types';
import { logger } from '../utils/logger';

interface ImagenResponse {
  predictions: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}

export class ImagenProvider extends BaseImageProvider {
  private auth: GoogleAuth;
  private client: AxiosInstance;
  private projectId: string;
  private location: string;

  constructor(projectId: string, location: string = 'us-central1') {
    super('imagen4', process.env.GOOGLE_AI_API_KEY || '');
    this.projectId = projectId;
    this.location = location;
    
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    this.client = axios.create({
      baseURL: `https://${location}-aiplatform.googleapis.com/v1`,
      timeout: 60000,
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

      // Get authentication token
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();
      
      if (!accessToken.token) {
        throw new Error('Failed to obtain Google Cloud access token');
      }

      const { width, height } = this.standardizeImageSize(params.width, params.height);
      const aspectRatio = this.mapToValidAspectRatio(width, height);
      
      const endpoint = `/projects/${this.projectId}/locations/${this.location}/publishers/google/models/imagen-3.0-generate-002:predict`;
      
      const requestBody = {
        instances: [{
          prompt: this.truncatePrompt(params.prompt, 2048),
          negativePrompt: params.negativePrompt || '',
          imageCount: Math.min(params.count || 1, 4),
          aspectRatio,
          personGeneration: 'allow',
          safetyFilterLevel: 'block_some',
          addWatermark: false
        }],
        parameters: {
          sampleCount: Math.min(params.count || 1, 4)
        }
      };

      const response = await this.retryWithBackoff(async () => {
        return await this.client.post<ImagenResponse>(endpoint, requestBody, {
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          }
        });
      });

      const predictions = response.data.predictions;
      if (!predictions || predictions.length === 0) {
        throw new Error('No images returned from Imagen');
      }

      // Convert base64 to data URL
      const imageUrl = `data:${predictions[0].mimeType};base64,${predictions[0].bytesBase64Encoded}`;
      
      const cost = this.calculateActualCost(requestBody.instances[0]);
      const duration = Date.now() - startTime;

      const result: ImageResult = {
        id: requestId,
        imageUrl,
        thumbnailUrl: imageUrl, // Use same image as thumbnail for now
        metadata: {
          provider: 'imagen4',
          prompt: params.prompt,
          settings: {
            aspectRatio,
            imageCount: requestBody.instances[0].imageCount,
            safetyLevel: requestBody.instances[0].safetyFilterLevel
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

    if (params.prompt && params.prompt.length > 2048) {
      errors.push('Prompt exceeds maximum length of 2048 characters');
    }

    if (params.negativePrompt && params.negativePrompt.length > 2048) {
      errors.push('Negative prompt exceeds maximum length of 2048 characters');
    }

    if (params.count && params.count > 4) {
      errors.push('Imagen supports maximum 4 images per request');
    }

    if (params.seed) {
      errors.push('Imagen does not support seed parameter');
    }

    // Check if Google Cloud credentials are available
    try {
      await this.auth.getClient();
    } catch (error) {
      errors.push('Google Cloud authentication not configured properly');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxImageSize: { width: 1536, height: 1536 },
      supportedSizes: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      supportedFormats: ['png', 'jpeg'],
      maxPromptLength: 2048,
      supportsNegativePrompts: true,
      supportsStylePresets: false,
      maxBatchSize: 4,
      costPerImage: 0.03 // Estimated cost
    };
  }

  estimateCost(params: UnifiedImageParams): CostEstimate {
    // Imagen pricing is typically based on input characters and image generation
    const baseCharacterCost = 0.0008; // Per 1000 characters
    const baseImageCost = 0.03; // Per image generation
    
    const promptLength = params.prompt.length + (params.negativePrompt?.length || 0);
    const characterCost = (promptLength / 1000) * baseCharacterCost;
    
    const count = Math.min(params.count || 1, 4);
    const imageCost = baseImageCost * count;
    
    const totalCost = characterCost + imageCost;
    
    return {
      totalCost,
      costPerImage: totalCost / count,
      currency: 'USD',
      breakdown: {
        characterProcessing: characterCost,
        imageGeneration: imageCost
      }
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Simple health check by attempting to get auth token
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();
      return !!accessToken.token;
    } catch (error) {
      logger.error('Imagen health check failed:', error);
      return false;
    }
  }

  private mapToValidAspectRatio(width: number, height: number): string {
    const ratio = width / height;
    
    // Map to closest valid aspect ratio
    if (Math.abs(ratio - 1) < 0.1) return '1:1';           // Square
    if (Math.abs(ratio - 16/9) < 0.2) return '16:9';       // Landscape
    if (Math.abs(ratio - 9/16) < 0.2) return '9:16';       // Portrait
    if (Math.abs(ratio - 4/3) < 0.2) return '4:3';         // Classic landscape
    if (Math.abs(ratio - 3/4) < 0.2) return '3:4';         // Classic portrait
    
    // Default to square if no close match
    return '1:1';
  }

  private calculateActualCost(params: any): number {
    // Simplified cost calculation for Imagen
    const baseImageCost = 0.03;
    const characterCost = ((params.prompt?.length || 0) + (params.negativePrompt?.length || 0)) / 1000 * 0.0008;
    
    return baseImageCost + characterCost;
  }

  // Provider-specific optimization for Imagen
  optimizePromptForImagen(prompt: string): string {
    // Imagen works well with natural language descriptions
    let optimized = prompt;
    
    // Remove technical photography terms that might not work well
    const technicalTerms = ['ISO', 'aperture', 'f/1.4', 'depth of field'];
    for (const term of technicalTerms) {
      optimized = optimized.replace(new RegExp(term, 'gi'), '');
    }
    
    // Add descriptive qualifiers that work well with Imagen
    if (optimized.split(' ').length < 8) {
      optimized += ', detailed, high quality';
    }
    
    // Clean up
    optimized = optimized.replace(/\s+/g, ' ').trim();
    
    return optimized;
  }

  // Enhanced generation with Imagen-specific optimizations
  async generateImageWithOptimization(params: UnifiedImageParams): Promise<ImageResult> {
    const optimizedParams = {
      ...params,
      prompt: this.optimizePromptForImagen(params.prompt)
    };
    
    return this.generateImage(optimizedParams);
  }

  // Method to upload base64 image to storage (if needed)
  private async convertBase64ToUrl(base64Data: string, mimeType: string): Promise<string> {
    // In a real implementation, you would upload this to your storage service
    // and return the URL. For now, returning data URL
    return `data:${mimeType};base64,${base64Data}`;
  }

  // Batch generation support
  async generateMultipleImages(params: UnifiedImageParams): Promise<ImageResult[]> {
    if (!params.count || params.count <= 1) {
      return [await this.generateImage(params)];
    }

    const batchSize = Math.min(params.count, 4); // Imagen max batch size
    const results: ImageResult[] = [];
    
    for (let i = 0; i < params.count; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, params.count - i);
      const batchParams = { ...params, count: currentBatchSize };
      
      const result = await this.generateImage(batchParams);
      results.push(result);
    }
    
    return results;
  }
}