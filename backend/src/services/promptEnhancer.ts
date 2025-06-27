import OpenAI from 'openai';
import { PromptCategory, StylePreferences } from '../types';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';

export interface EnhancePromptRequest {
  input: string;
  category: PromptCategory;
  stylePreferences?: StylePreferences;
}

export interface EnhancedPrompt {
  enhanced: string;
  original: string;
  category: PromptCategory;
  metadata: {
    enhancementTime: number;
    wordsAdded: number;
    confidenceScore: number;
  };
}

export class PromptEnhancerService {
  private openai: OpenAI;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async enhancePrompt(request: EnhancePromptRequest): Promise<EnhancedPrompt> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = await cache.get<EnhancedPrompt>(cacheKey);
      
      if (cached) {
        logger.info(`Prompt enhancement cache hit for: ${request.input.substring(0, 50)}`);
        return cached;
      }

      // Generate enhancement prompt based on category and style
      const systemPrompt = this.buildSystemPrompt(request.category, request.stylePreferences);
      const userPrompt = this.buildUserPrompt(request.input, request.category);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const enhancedText = response.choices[0]?.message?.content?.trim();
      
      if (!enhancedText) {
        throw new Error('No enhancement generated');
      }

      const enhancementTime = Date.now() - startTime;
      const originalWords = request.input.split(' ').length;
      const enhancedWords = enhancedText.split(' ').length;

      const result: EnhancedPrompt = {
        enhanced: enhancedText,
        original: request.input,
        category: request.category,
        metadata: {
          enhancementTime,
          wordsAdded: enhancedWords - originalWords,
          confidenceScore: this.calculateConfidenceScore(enhancedText, request.input)
        }
      };

      // Cache the result
      await cache.set(cacheKey, result, this.CACHE_TTL);
      
      logger.info(`Prompt enhanced successfully: ${originalWords} → ${enhancedWords} words in ${enhancementTime}ms`);
      
      return result;

    } catch (error) {
      logger.error('Prompt enhancement failed:', error);
      throw new Error(`Prompt enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildSystemPrompt(category: PromptCategory, stylePreferences?: StylePreferences): string {
    const basePrompt = `You are an expert AI image prompt writer specializing in creating detailed, vivid descriptions for AI image generation.

Your task is to enhance simple user inputs into rich, detailed prompts that will produce high-quality images.

CATEGORY: ${category.toLowerCase()}

GUIDELINES:
- Transform simple inputs into detailed, descriptive prompts
- Add specific details about lighting, composition, style, mood
- Include technical photography/art terms when appropriate
- Be specific about colors, textures, materials
- Add atmospheric and environmental details
- Ensure prompts are 30-80 words long
- Maintain the core subject/intent of the original input
- Use vivid, sensory language`;

    if (stylePreferences) {
      let styleAdditions = '\n\nSTYLE PREFERENCES:';
      
      if (stylePreferences.artStyle) {
        styleAdditions += `\n- Art Style: ${stylePreferences.artStyle}`;
      }
      if (stylePreferences.lighting) {
        styleAdditions += `\n- Lighting: ${stylePreferences.lighting}`;
      }
      if (stylePreferences.mood) {
        styleAdditions += `\n- Mood: ${stylePreferences.mood}`;
      }
      if (stylePreferences.colorScheme) {
        styleAdditions += `\n- Color Scheme: ${stylePreferences.colorScheme}`;
      }
      if (stylePreferences.composition) {
        styleAdditions += `\n- Composition: ${stylePreferences.composition}`;
      }
      if (stylePreferences.cameraAngle) {
        styleAdditions += `\n- Camera Angle: ${stylePreferences.cameraAngle}`;
      }
      
      return basePrompt + styleAdditions;
    }

    return basePrompt + this.getCategorySpecificGuidelines(category);
  }

  private getCategorySpecificGuidelines(category: PromptCategory): string {
    const guidelines = {
      PORTRAIT: `
- Focus on facial features, expressions, and emotions
- Include details about pose, clothing, and background
- Specify lighting setup (studio, natural, dramatic)
- Add details about hair, skin tone, and accessories`,

      LANDSCAPE: `
- Describe the environment in detail (mountains, forests, water)
- Include weather conditions and time of day
- Specify the perspective and depth of field
- Add atmospheric elements (mist, clouds, sunlight)`,

      CONCEPT: `
- Focus on abstract ideas and symbolic elements
- Include surreal or fantastical details
- Emphasize mood and atmosphere
- Use creative and imaginative descriptions`,

      PRODUCT: `
- Include materials, textures, and finish details
- Specify lighting setup for product photography
- Add background and context information
- Focus on showcasing key features`,

      ARCHITECTURE: `
- Detail the structural elements and materials
- Include environmental context and surroundings
- Specify architectural style and period
- Add lighting and weather conditions`,

      ABSTRACT: `
- Focus on colors, shapes, and patterns
- Include motion and energy descriptions
- Emphasize artistic techniques and styles
- Use expressive and creative language`,

      ANIME: `
- Include character design details and expressions
- Specify art style (studio, manga influence)
- Add clothing and accessory details
- Include background and scene setting`,

      REALISTIC: `
- Focus on photorealistic details and accuracy
- Include camera settings and photography terms
- Specify materials and surface textures
- Add natural lighting and environmental details`
    };

    return guidelines[category] || '';
  }

  private buildUserPrompt(input: string, category: PromptCategory): string {
    return `Original input: "${input}"

Please enhance this into a detailed, vivid prompt for ${category.toLowerCase()} image generation. 

Return only the enhanced prompt text, no explanations or additional formatting.`;
  }

  private generateCacheKey(request: EnhancePromptRequest): string {
    const key = `prompt_enhance:${request.input}:${request.category}`;
    if (request.stylePreferences) {
      const styleKey = Object.entries(request.stylePreferences)
        .sort()
        .map(([k, v]) => `${k}:${v}`)
        .join('|');
      return `${key}:${styleKey}`;
    }
    return key;
  }

  private calculateConfidenceScore(enhanced: string, original: string): number {
    // Simple confidence calculation based on enhancement quality
    const enhancedWords = enhanced.split(' ').length;
    const originalWords = original.split(' ').length;
    
    // Base score on word count increase
    let score = Math.min((enhancedWords / originalWords) * 0.3, 0.5);
    
    // Bonus for descriptive words
    const descriptiveWords = ['beautiful', 'detailed', 'vivid', 'stunning', 'dramatic', 'professional', 'high-quality'];
    const descriptiveMatches = descriptiveWords.filter(word => 
      enhanced.toLowerCase().includes(word)
    ).length;
    
    score += descriptiveMatches * 0.1;
    
    // Bonus for technical terms
    const technicalTerms = ['lighting', 'composition', 'depth of field', 'bokeh', 'resolution', 'texture'];
    const technicalMatches = technicalTerms.filter(term => 
      enhanced.toLowerCase().includes(term)
    ).length;
    
    score += technicalMatches * 0.15;
    
    return Math.min(score, 1.0);
  }

  async getPromptSuggestions(category: PromptCategory, count: number = 5): Promise<string[]> {
    const cacheKey = `prompt_suggestions:${category}:${count}`;
    const cached = await cache.get<string[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Generate ${count} creative prompt starters for ${category.toLowerCase()} image generation. Each should be 3-8 words and inspire detailed enhancement.`
          },
          {
            role: 'user',
            content: `Create ${count} inspiring prompt starters for ${category.toLowerCase()} images.`
          }
        ],
        temperature: 0.8,
        max_tokens: 200,
      });

      const suggestions = response.choices[0]?.message?.content
        ?.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, count) || [];

      await cache.set(cacheKey, suggestions, this.CACHE_TTL * 24); // Cache for 24 hours
      
      return suggestions;

    } catch (error) {
      logger.error('Failed to generate prompt suggestions:', error);
      return [];
    }
  }
}

export const promptEnhancer = new PromptEnhancerService();