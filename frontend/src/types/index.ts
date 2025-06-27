export interface User {
  id: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  creditsRemaining: number;
  createdAt: string;
}

export interface Prompt {
  id: string;
  originalInput: string;
  enhancedPrompt: string;
  category: PromptCategory;
  stylePreferences: StylePreferences;
  createdAt: string;
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
  createdAt: string;
  completedAt?: string;
}

export type ImageProvider = 'dalleE3' | 'imagen4' | 'stableDiffusion';

export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ImageRequest {
  prompt: string;
  provider?: ImageProvider;
  settings: ImageSettings;
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

export interface PromptTemplate {
  id: string;
  name: string;
  category: PromptCategory;
  description: string;
  baseStructure: string;
  isPublic: boolean;
  usageCount: number;
}

export interface UserCollection {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationHistory {
  id: string;
  prompt: Prompt;
  images: ImageGeneration[];
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
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

export interface PromptBuilderState {
  simpleInput: string;
  advancedMode: boolean;
  selectedCategory: PromptCategory;
  stylePreferences: StylePreferences;
  selectedTemplate?: PromptTemplate;
}

export interface GenerationState {
  isGenerating: boolean;
  queuePosition?: number;
  estimatedTime?: number;
  currentStage?: 'queued' | 'enhancing' | 'generating' | 'processing';
  progress?: number;
}

export interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  currentView: 'prompt' | 'gallery' | 'collections' | 'settings';
}

export interface ErrorState {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

// Component Props Types
export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

export interface ImageCardProps {
  image: ImageGeneration;
  onSelect?: (image: ImageGeneration) => void;
  onSave?: (image: ImageGeneration) => void;
  onShare?: (image: ImageGeneration) => void;
  selected?: boolean;
}

export interface StatusIndicatorProps {
  status: GenerationStatus;
  progress?: number;
  queuePosition?: number;
  estimatedTime?: number;
}

export interface TemplateCardProps {
  template: PromptTemplate;
  onSelect: (template: PromptTemplate) => void;
  selected?: boolean;
}

// API Types
export interface EnhancePromptRequest {
  input: string;
  category: PromptCategory;
  stylePreferences?: StylePreferences;
}

export interface GenerateImageRequest {
  prompt: string;
  provider?: ImageProvider;
  settings: ImageSettings;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface AddToCollectionRequest {
  imageId: string;
  collectionId: string;
}