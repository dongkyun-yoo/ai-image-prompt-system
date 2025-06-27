import { PromptCategory, PromptTemplate } from '../types';

export interface TemplateRule {
  condition: string;
  addition: string;
  weight: number;
}

export interface ProviderAdaptation {
  dalleE3: (prompt: string) => string;
  imagen4: (prompt: string) => string;
  stableDiffusion: (prompt: string) => string;
}

export class PromptTemplateService {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Portrait templates
    this.registerTemplate({
      id: 'portrait-professional',
      name: 'Professional Portrait',
      category: 'PORTRAIT',
      description: 'High-quality professional headshot style',
      baseStructure: '{subject} portrait, {pose}, {expression}, {clothing}, professional {lighting}, {background}, {camera_angle}, high-quality photography',
      enhancementRules: [
        {
          condition: 'professional',
          addition: 'studio lighting, sharp focus, 85mm lens, professional makeup',
          weight: 1.0
        },
        {
          condition: 'business',
          addition: 'corporate attire, confident expression, neutral background',
          weight: 0.8
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `${prompt}, photorealistic, high detail`,
        imagen4: (prompt: string) => `professional photography of ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, professional portrait photography, masterpiece, best quality, ultra detailed`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    this.registerTemplate({
      id: 'portrait-artistic',
      name: 'Artistic Portrait',
      category: 'PORTRAIT',
      description: 'Creative and artistic portrait style',
      baseStructure: '{subject} artistic portrait, {artistic_style}, {lighting}, {mood}, {composition}, creative {background}',
      enhancementRules: [
        {
          condition: 'artistic',
          addition: 'dramatic lighting, creative composition, artistic vision',
          weight: 1.0
        },
        {
          condition: 'creative',
          addition: 'unique perspective, bold colors, experimental style',
          weight: 0.9
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `artistic ${prompt}, creative photography`,
        imagen4: (prompt: string) => `artistic portrait of ${prompt}, creative style`,
        stableDiffusion: (prompt: string) => `${prompt}, artistic portrait, creative photography, fine art style`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    // Landscape templates
    this.registerTemplate({
      id: 'landscape-natural',
      name: 'Natural Landscape',
      category: 'LANDSCAPE',
      description: 'Beautiful natural scenery and environments',
      baseStructure: '{location} landscape, {time_of_day}, {weather}, {season}, {camera_angle}, natural {lighting}, {atmospheric_effects}',
      enhancementRules: [
        {
          condition: 'natural',
          addition: 'pristine nature, untouched wilderness, natural beauty',
          weight: 1.0
        },
        {
          condition: 'scenic',
          addition: 'breathtaking views, panoramic vista, scenic beauty',
          weight: 0.9
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `beautiful ${prompt}, natural photography`,
        imagen4: (prompt: string) => `scenic landscape of ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, landscape photography, natural lighting, high resolution, detailed`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    // Concept art templates
    this.registerTemplate({
      id: 'concept-futuristic',
      name: 'Futuristic Concept',
      category: 'CONCEPT',
      description: 'Sci-fi and futuristic concept art',
      baseStructure: 'futuristic {subject}, {technology}, {environment}, {lighting}, sci-fi {style}, {color_scheme}, advanced {details}',
      enhancementRules: [
        {
          condition: 'futuristic',
          addition: 'advanced technology, sleek design, neon lighting, cyberpunk elements',
          weight: 1.0
        },
        {
          condition: 'sci-fi',
          addition: 'space age, holographic elements, metallic surfaces, glowing accents',
          weight: 0.9
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `futuristic concept art of ${prompt}`,
        imagen4: (prompt: string) => `sci-fi concept art featuring ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, futuristic concept art, sci-fi style, digital art, highly detailed`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    // Product photography templates
    this.registerTemplate({
      id: 'product-commercial',
      name: 'Commercial Product',
      category: 'PRODUCT',
      description: 'Professional product photography',
      baseStructure: '{product} product photography, {materials}, {finish}, professional {lighting}, {background}, commercial {style}, high-end {presentation}',
      enhancementRules: [
        {
          condition: 'commercial',
          addition: 'professional studio lighting, clean background, perfect exposure',
          weight: 1.0
        },
        {
          condition: 'luxury',
          addition: 'premium materials, elegant presentation, sophisticated styling',
          weight: 0.8
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `professional product photography of ${prompt}`,
        imagen4: (prompt: string) => `commercial photography featuring ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, product photography, commercial lighting, professional, clean background`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    // Architecture templates
    this.registerTemplate({
      id: 'architecture-modern',
      name: 'Modern Architecture',
      category: 'ARCHITECTURE',
      description: 'Contemporary architectural photography',
      baseStructure: 'modern {building_type}, {architectural_style}, {materials}, {environment}, {lighting}, {perspective}, contemporary {design}',
      enhancementRules: [
        {
          condition: 'modern',
          addition: 'clean lines, minimalist design, contemporary materials, geometric forms',
          weight: 1.0
        },
        {
          condition: 'sustainable',
          addition: 'eco-friendly design, green architecture, sustainable materials',
          weight: 0.7
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `modern architecture photography of ${prompt}`,
        imagen4: (prompt: string) => `contemporary architectural view of ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, modern architecture, architectural photography, clean design`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    // Abstract art templates
    this.registerTemplate({
      id: 'abstract-geometric',
      name: 'Geometric Abstract',
      category: 'ABSTRACT',
      description: 'Abstract geometric compositions',
      baseStructure: 'abstract geometric {composition}, {shapes}, {patterns}, {colors}, {style}, {movement}, artistic {expression}',
      enhancementRules: [
        {
          condition: 'geometric',
          addition: 'precise shapes, mathematical patterns, clean lines, structured composition',
          weight: 1.0
        },
        {
          condition: 'dynamic',
          addition: 'flowing movement, energy, rhythm, dynamic balance',
          weight: 0.8
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `abstract geometric art featuring ${prompt}`,
        imagen4: (prompt: string) => `geometric abstract composition with ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, abstract geometric art, digital art, colorful, high contrast`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    // Anime style templates
    this.registerTemplate({
      id: 'anime-character',
      name: 'Anime Character',
      category: 'ANIME',
      description: 'Anime and manga style characters',
      baseStructure: 'anime {character}, {style}, {expression}, {clothing}, {pose}, {background}, {art_style}, {details}',
      enhancementRules: [
        {
          condition: 'anime',
          addition: 'manga style, cel shading, bright colors, expressive eyes',
          weight: 1.0
        },
        {
          condition: 'kawaii',
          addition: 'cute style, soft features, pastel colors, adorable expression',
          weight: 0.9
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `anime style illustration of ${prompt}`,
        imagen4: (prompt: string) => `anime character design featuring ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, anime style, manga art, cel shading, vibrant colors`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });

    // Realistic photography templates
    this.registerTemplate({
      id: 'realistic-photography',
      name: 'Realistic Photography',
      category: 'REALISTIC',
      description: 'Photorealistic imagery',
      baseStructure: 'realistic {subject}, {lighting}, {composition}, {camera_settings}, {environment}, photographic {quality}, {details}',
      enhancementRules: [
        {
          condition: 'realistic',
          addition: 'photorealistic, natural lighting, authentic details, real-world accuracy',
          weight: 1.0
        },
        {
          condition: 'documentary',
          addition: 'documentary style, candid moment, natural environment, authentic emotion',
          weight: 0.8
        }
      ],
      providerAdaptations: {
        dalleE3: (prompt: string) => `photorealistic ${prompt}, natural photography`,
        imagen4: (prompt: string) => `realistic photograph of ${prompt}`,
        stableDiffusion: (prompt: string) => `${prompt}, photorealistic, natural lighting, high detail, professional photography`
      },
      isPublic: true,
      usageCount: 0,
      createdBy: 'system'
    });
  }

  private registerTemplate(template: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>): void {
    const fullTemplate: PromptTemplate = {
      ...template,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.templates.set(template.id, fullTemplate);
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  getPublicTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.isPublic);
  }

  applyTemplate(templateId: string, variables: Record<string, string>): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let result = template.baseStructure;
    
    // Replace variables in the template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    // Remove unused placeholders
    result = result.replace(/{[^}]+}/g, '').replace(/\s+/g, ' ').trim();

    return result;
  }

  adaptPromptForProvider(prompt: string, provider: 'dalleE3' | 'imagen4' | 'stableDiffusion', templateId?: string): string {
    if (templateId) {
      const template = this.getTemplate(templateId);
      if (template && template.providerAdaptations) {
        const adaptation = template.providerAdaptations[provider];
        return adaptation ? adaptation(prompt) : prompt;
      }
    }

    // Default adaptations if no template specified
    switch (provider) {
      case 'dalleE3':
        return prompt; // DALL-E 3 works best with natural language
      
      case 'imagen4':
        return prompt; // Imagen 4 also prefers natural language
      
      case 'stableDiffusion':
        // Stable Diffusion often benefits from more technical terms
        return `${prompt}, masterpiece, best quality, highly detailed, professional`;
      
      default:
        return prompt;
    }
  }

  incrementUsage(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.usageCount++;
      template.updatedAt = new Date();
    }
  }

  getPopularTemplates(limit: number = 10): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.isPublic)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }
}

export const promptTemplateService = new PromptTemplateService();