import { BaseImageProvider, UnifiedImageParams, CostEstimate } from '../providers/baseProvider';
import { DalleProvider } from '../providers/dalleProvider';
import { ImagenProvider } from '../providers/imagenProvider';
import { StableDiffusionProvider } from '../providers/stableDiffusionProvider';
import { ImageResult, ImageProvider } from '../types';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';

export interface ProviderConfig {
  enabled: boolean;
  priority: number;
  maxRetries: number;
  healthCheckInterval: number;
  costWeight: number;
  qualityWeight: number;
  speedWeight: number;
}

export interface ProviderSelection {
  provider: ImageProvider;
  reason: string;
  estimatedCost: number;
  confidence: number;
}

export class ProviderManager {
  private providers: Map<ImageProvider, BaseImageProvider> = new Map();
  private config: Map<ImageProvider, ProviderConfig> = new Map();
  private healthStatus: Map<ImageProvider, boolean> = new Map();
  private lastHealthCheck: Map<ImageProvider, number> = new Map();

  constructor() {
    this.initializeProviders();
    this.initializeDefaultConfig();
    this.startHealthMonitoring();
  }

  private initializeProviders(): void {
    try {
      // Initialize DALL-E provider
      if (process.env.OPENAI_API_KEY) {
        const dalleProvider = new DalleProvider(process.env.OPENAI_API_KEY);
        this.providers.set('dalleE3', dalleProvider);
        this.healthStatus.set('dalleE3', false);
        logger.info('DALL-E provider initialized');
      }

      // Initialize Imagen provider
      if (process.env.GOOGLE_PROJECT_ID) {
        const imagenProvider = new ImagenProvider(
          process.env.GOOGLE_PROJECT_ID,
          process.env.GOOGLE_LOCATION || 'us-central1'
        );
        this.providers.set('imagen4', imagenProvider);
        this.healthStatus.set('imagen4', false);
        logger.info('Imagen provider initialized');
      }

      // Initialize Stable Diffusion provider
      if (process.env.STABILITY_API_KEY) {
        const sdProvider = new StableDiffusionProvider(
          process.env.STABILITY_API_KEY,
          process.env.SD_ENGINE_ID || 'stable-diffusion-xl-1024-v1-0'
        );
        this.providers.set('stableDiffusion', sdProvider);
        this.healthStatus.set('stableDiffusion', false);
        logger.info('Stable Diffusion provider initialized');
      }

      if (this.providers.size === 0) {
        throw new Error('No image generation providers configured');
      }

    } catch (error) {
      logger.error('Failed to initialize providers:', error);
      throw error;
    }
  }

  private initializeDefaultConfig(): void {
    const defaultConfig: ProviderConfig = {
      enabled: true,
      priority: 1,
      maxRetries: 3,
      healthCheckInterval: 300000, // 5 minutes
      costWeight: 0.4,
      qualityWeight: 0.4,
      speedWeight: 0.2
    };

    // DALL-E config - high quality, medium cost
    this.config.set('dalleE3', {
      ...defaultConfig,
      priority: 2,
      costWeight: 0.3,
      qualityWeight: 0.5,
      speedWeight: 0.2
    });

    // Imagen config - balanced
    this.config.set('imagen4', {
      ...defaultConfig,
      priority: 1,
      costWeight: 0.4,
      qualityWeight: 0.4,
      speedWeight: 0.2
    });

    // Stable Diffusion config - low cost, customizable
    this.config.set('stableDiffusion', {
      ...defaultConfig,
      priority: 3,
      costWeight: 0.6,
      qualityWeight: 0.3,
      speedWeight: 0.1
    });
  }

  async generateImage(params: UnifiedImageParams): Promise<ImageResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      logger.info(`Provider manager generating image ${requestId}:`, {
        requestId,
        prompt: params.prompt.substring(0, 100),
        preferredProvider: params.provider
      });

      // Select the best provider
      const selection = await this.selectProvider(params);
      const provider = this.providers.get(selection.provider);
      
      if (!provider) {
        throw new Error(`Provider ${selection.provider} not available`);
      }

      logger.info(`Selected provider ${selection.provider} for ${requestId}:`, {
        reason: selection.reason,
        estimatedCost: selection.estimatedCost,
        confidence: selection.confidence
      });

      // Generate image with fallback
      const result = await this.generateWithFallback(provider, params, requestId);
      
      // Update metrics
      await this.recordSuccess(selection.provider, Date.now() - startTime, result.metadata.cost);
      
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Provider manager failed for ${requestId}:`, {
        requestId,
        duration,
        error: error instanceof Error ? error.message : error
      });
      
      await this.recordFailure(params.provider || 'unknown', duration);
      throw error;
    }
  }

  private async selectProvider(params: UnifiedImageParams): Promise<ProviderSelection> {
    // If user specified a provider, try to use it
    if (params.provider && this.isProviderAvailable(params.provider)) {
      const provider = this.providers.get(params.provider)!;
      const validation = await provider.validateParams(params);
      
      if (validation.valid) {
        const cost = provider.estimateCost(params);
        return {
          provider: params.provider,
          reason: 'User specified',
          estimatedCost: cost.totalCost,
          confidence: 1.0
        };
      }
    }

    // Auto-select based on requirements and provider capabilities
    const candidates = await this.evaluateProviders(params);
    
    if (candidates.length === 0) {
      throw new Error('No suitable providers available');
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);
    
    const best = candidates[0];
    return {
      provider: best.provider,
      reason: best.reason,
      estimatedCost: best.estimatedCost,
      confidence: best.score
    };
  }

  private async evaluateProviders(params: UnifiedImageParams): Promise<Array<{
    provider: ImageProvider;
    score: number;
    reason: string;
    estimatedCost: number;
  }>> {
    const candidates = [];

    for (const [providerName, provider] of this.providers.entries()) {
      if (!this.isProviderAvailable(providerName)) {
        continue;
      }

      const validation = await provider.validateParams(params);
      if (!validation.valid) {
        continue;
      }

      const capabilities = provider.getCapabilities();
      const costEstimate = provider.estimateCost(params);
      const config = this.config.get(providerName)!;
      
      // Calculate score based on multiple factors
      const score = this.calculateProviderScore(params, capabilities, costEstimate, config);
      
      candidates.push({
        provider: providerName,
        score,
        reason: this.generateSelectionReason(score, costEstimate, capabilities),
        estimatedCost: costEstimate.totalCost
      });
    }

    return candidates;
  }

  private calculateProviderScore(
    params: UnifiedImageParams,
    capabilities: any,
    cost: CostEstimate,
    config: ProviderConfig
  ): number {
    let score = 0;

    // Cost score (lower cost = higher score)
    const maxCost = 0.20; // Max expected cost per image
    const costScore = Math.max(0, (maxCost - cost.costPerImage) / maxCost);
    score += costScore * config.costWeight;

    // Quality score (based on capabilities)
    let qualityScore = 0.5; // Base quality
    if (capabilities.maxImageSize.width >= 1024) qualityScore += 0.2;
    if (capabilities.supportsNegativePrompts) qualityScore += 0.1;
    if (capabilities.supportsStylePresets) qualityScore += 0.1;
    if (capabilities.maxPromptLength >= 2000) qualityScore += 0.1;
    score += Math.min(qualityScore, 1.0) * config.qualityWeight;

    // Speed score (estimated based on provider)
    const speedScores: Record<string, number> = {
      'stableDiffusion': 0.6,
      'dalleE3': 0.8,
      'imagen4': 0.7
    };
    const speedScore = speedScores[capabilities.name] || 0.5;
    score += speedScore * config.speedWeight;

    // Priority bonus
    score += config.priority * 0.1;

    // Health penalty
    if (!this.healthStatus.get(capabilities.name)) {
      score *= 0.5;
    }

    return Math.min(score, 1.0);
  }

  private generateSelectionReason(score: number, cost: CostEstimate, capabilities: any): string {
    if (score > 0.8) return 'Optimal cost/quality balance';
    if (cost.costPerImage < 0.05) return 'Best cost efficiency';
    if (capabilities.maxImageSize.width >= 1024) return 'High quality capabilities';
    return 'Available and suitable';
  }

  private async generateWithFallback(
    primaryProvider: BaseImageProvider, 
    params: UnifiedImageParams,
    requestId: string
  ): Promise<ImageResult> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    // Try primary provider
    try {
      return await primaryProvider.generateImage(params);
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Primary provider ${primaryProvider.getName()} failed for ${requestId}, trying fallbacks:`, error);
    }

    // Try fallback providers
    const fallbackProviders = this.getFallbackProviders(primaryProvider.getName());
    
    for (const fallbackName of fallbackProviders) {
      try {
        const provider = this.providers.get(fallbackName);
        if (!provider || !this.isProviderAvailable(fallbackName)) {
          continue;
        }

        const validation = await provider.validateParams(params);
        if (!validation.valid) {
          continue;
        }

        logger.info(`Trying fallback provider ${fallbackName} for ${requestId}`);
        return await provider.generateImage(params);

      } catch (error) {
        lastError = error as Error;
        logger.warn(`Fallback provider ${fallbackName} failed for ${requestId}:`, error);
      }
    }

    // All providers failed
    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  private getFallbackProviders(excludeProvider: ImageProvider): ImageProvider[] {
    const allProviders: ImageProvider[] = ['dalleE3', 'imagen4', 'stableDiffusion'];
    return allProviders
      .filter(p => p !== excludeProvider && this.providers.has(p))
      .sort((a, b) => {
        const configA = this.config.get(a)!;
        const configB = this.config.get(b)!;
        return configB.priority - configA.priority;
      });
  }

  private isProviderAvailable(provider: ImageProvider): boolean {
    return this.providers.has(provider) && 
           this.config.get(provider)?.enabled === true &&
           this.healthStatus.get(provider) === true;
  }

  private async startHealthMonitoring(): void {
    // Initial health check
    await this.performHealthChecks();

    // Schedule periodic health checks
    setInterval(async () => {
      await this.performHealthChecks();
    }, 60000); // Check every minute
  }

  private async performHealthChecks(): Promise<void> {
    for (const [providerName, provider] of this.providers.entries()) {
      const config = this.config.get(providerName)!;
      const lastCheck = this.lastHealthCheck.get(providerName) || 0;
      const now = Date.now();

      if (now - lastCheck < config.healthCheckInterval) {
        continue;
      }

      try {
        const isHealthy = await provider.checkHealth();
        this.healthStatus.set(providerName, isHealthy);
        this.lastHealthCheck.set(providerName, now);
        
        logger.debug(`Health check ${providerName}: ${isHealthy ? 'OK' : 'FAIL'}`);
      } catch (error) {
        this.healthStatus.set(providerName, false);
        this.lastHealthCheck.set(providerName, now);
        logger.error(`Health check failed for ${providerName}:`, error);
      }
    }
  }

  private async recordSuccess(provider: ImageProvider, duration: number, cost: number): Promise<void> {
    const metrics = {
      provider,
      success: true,
      duration,
      cost,
      timestamp: Date.now()
    };

    await cache.set(`metrics:${provider}:${Date.now()}`, metrics, 86400); // 24 hours
  }

  private async recordFailure(provider: ImageProvider, duration: number): Promise<void> {
    const metrics = {
      provider,
      success: false,
      duration,
      timestamp: Date.now()
    };

    await cache.set(`metrics:${provider}:${Date.now()}`, metrics, 86400); // 24 hours
  }

  private generateRequestId(): string {
    return `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for management
  async getProviderStatus(): Promise<Record<ImageProvider, { healthy: boolean; enabled: boolean; lastCheck: number }>> {
    const status: any = {};
    
    for (const [providerName] of this.providers.entries()) {
      status[providerName] = {
        healthy: this.healthStatus.get(providerName) || false,
        enabled: this.config.get(providerName)?.enabled || false,
        lastCheck: this.lastHealthCheck.get(providerName) || 0
      };
    }
    
    return status;
  }

  enableProvider(provider: ImageProvider): void {
    const config = this.config.get(provider);
    if (config) {
      config.enabled = true;
      logger.info(`Provider ${provider} enabled`);
    }
  }

  disableProvider(provider: ImageProvider): void {
    const config = this.config.get(provider);
    if (config) {
      config.enabled = false;
      logger.info(`Provider ${provider} disabled`);
    }
  }

  getAvailableProviders(): ImageProvider[] {
    return Array.from(this.providers.keys()).filter(p => this.isProviderAvailable(p));
  }

  async estimateCost(params: UnifiedImageParams): Promise<Record<ImageProvider, CostEstimate>> {
    const estimates: any = {};
    
    for (const [providerName, provider] of this.providers.entries()) {
      if (this.isProviderAvailable(providerName)) {
        const validation = await provider.validateParams(params);
        if (validation.valid) {
          estimates[providerName] = provider.estimateCost(params);
        }
      }
    }
    
    return estimates;
  }
}

export const providerManager = new ProviderManager();