// 프롬프트 엔진 단독 테스트 스크립트
import { promptEnhancer } from './backend/src/services/promptEnhancer.js';
import { promptTemplateService } from './backend/src/templates/promptTemplates.js';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

async function testPromptEngine() {
  console.log('🧠 AI 프롬프트 엔진 테스트 시작...\n');

  // 테스트 케이스들
  const testCases = [
    {
      input: 'a cat',
      category: 'PORTRAIT',
      stylePreferences: { lighting: 'natural', mood: 'peaceful' }
    },
    {
      input: 'mountain sunset',
      category: 'LANDSCAPE',
      stylePreferences: { lighting: 'golden hour', mood: 'serene' }
    },
    {
      input: 'futuristic city',
      category: 'CONCEPT',
      stylePreferences: { artStyle: 'cyberpunk', colorScheme: 'neon' }
    },
    {
      input: 'smartphone',
      category: 'PRODUCT',
      stylePreferences: { lighting: 'studio', quality: 'hd' }
    },
    {
      input: 'anime girl',
      category: 'ANIME',
      stylePreferences: { artStyle: 'manga', mood: 'kawaii' }
    }
  ];

  console.log('📋 테스트 케이스:');
  testCases.forEach((test, i) => {
    console.log(`${i + 1}. "${test.input}" (${test.category})`);
  });
  console.log('\n' + '='.repeat(80) + '\n');

  // 각 테스트 케이스 실행
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`🎯 테스트 ${i + 1}: "${testCase.input}" → ${testCase.category}`);
    console.log('입력 스타일:', JSON.stringify(testCase.stylePreferences, null, 2));
    
    try {
      const startTime = Date.now();
      
      // 프롬프트 향상 실행
      const result = await promptEnhancer.enhancePrompt(testCase);
      
      const duration = Date.now() - startTime;
      
      console.log('\n✅ 향상된 프롬프트:');
      console.log(`"${result.enhanced}"`);
      
      console.log('\n📊 메타데이터:');
      console.log(`• 처리 시간: ${duration}ms`);
      console.log(`• 단어 추가: ${result.metadata.wordsAdded}개`);
      console.log(`• 신뢰도: ${(result.metadata.confidenceScore * 100).toFixed(1)}%`);
      
      // 프로바이더별 최적화 테스트
      console.log('\n🔄 프로바이더별 최적화:');
      const template = promptTemplateService.getTemplatesByCategory(testCase.category)[0];
      if (template) {
        console.log(`• DALL-E 3: "${template.providerAdaptations.dalleE3(result.enhanced)}"`);
        console.log(`• Imagen 4: "${template.providerAdaptations.imagen4(result.enhanced)}"`);
        console.log(`• Stable Diffusion: "${template.providerAdaptations.stableDiffusion(result.enhanced)}"`);
      }
      
    } catch (error) {
      console.log('❌ 오류 발생:', error.message);
    }
    
    console.log('\n' + '-'.repeat(80) + '\n');
  }

  // 템플릿 시스템 테스트
  console.log('📝 템플릿 시스템 테스트:');
  const categories = ['PORTRAIT', 'LANDSCAPE', 'CONCEPT', 'PRODUCT'];
  
  categories.forEach(category => {
    const templates = promptTemplateService.getTemplatesByCategory(category);
    console.log(`${category}: ${templates.length}개 템플릿 사용 가능`);
    templates.forEach(template => {
      console.log(`  • ${template.name}: ${template.description}`);
    });
  });

  console.log('\n🎉 프롬프트 엔진 테스트 완료!');
}

// 실행
if (process.env.OPENAI_API_KEY) {
  testPromptEngine().catch(console.error);
} else {
  console.log('❌ OPENAI_API_KEY가 설정되지 않았습니다.');
  console.log('backend/.env 파일에 API 키를 설정하고 다시 시도하세요.');
}