export interface User {
  id: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  creditsRemaining: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Prompt {
  id: string;
  userId: string;
  originalInput: string;
  enhancedPrompt: string;
  category: PromptCategory;
  stylePreferences: StylePreferences;
  createdAt: Date;
}

export type PromptCategory = 
  | 'portrait' 
  | 'landscape' 
  | 'concept' 
  | 'product' 
  | 'architecture' 
  | 'abstract' 
  | 'anime' 
  | 'realistic';

export interface StylePreferences {
  artStyle?: string;
  lighting?: string;
  mood?: string;
  colorScheme?: string;
  composition?: string;
  cameraAngle?: string;
  quality?: 'standard' | 'hd' | 'ultra';
}

export interface ImageGeneration {
  id: string;
  promptId: string;
  provider: ImageProvider;
  status: GenerationStatus;
  imageUrl?: string;
  thumbnailUrl?: string;
  generationTimeMs?: number;
  costCents: number;
  metadata: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

export type ImageProvider = 'dalleE3' | 'imagen4' | 'stableDiffusion';

export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ImageRequest {
  prompt: string;
  provider?: ImageProvider;
  settings: ImageSettings;
  userId: string;
}

export interface ImageSettings {
  size: ImageSize;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  negativePrompt?: string;
  steps?: number;
  seed?: number;
}

export type ImageSize = 
  | '256x256' 
  | '512x512' 
  | '1024x1024' 
  | '1024x1792' 
  | '1792x1024';

export interface ImageResult {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  metadata: {
    provider: ImageProvider;
    prompt: string;
    settings: ImageSettings;
    generationTime: number;
    cost: number;
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: PromptCategory;
  baseStructure: string;
  enhancementRules: EnhancementRule[];
  providerAdaptations: ProviderAdaptations;
  isPublic: boolean;
  createdBy: string;
}

export interface EnhancementRule {
  condition: string;
  addition: string;
  weight: number;
}

export interface ProviderAdaptations {
  dalleE3: (prompt: string) => string;
  imagen4: (prompt: string) => string;
  stableDiffusion: (prompt: string) => string;
}

export interface QueueJob {
  id: string;
  type: 'image_generation' | 'prompt_enhancement';
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay?: number;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UserCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  images: ImageGeneration[];
  createdAt: Date;
  updatedAt: Date;
}