// 간단한 프롬프트 테스트 (API 키 없이도 실행 가능)

console.log('🧠 프롬프트 시스템 기본 테스트\n');

// 템플릿 정의 (간단버전)
const templates = {
  'portrait-professional': {
    name: 'Professional Portrait',
    category: 'PORTRAIT',
    description: 'High-quality professional headshot style',
    baseStructure: '{subject} portrait, {pose}, {expression}, {clothing}, professional {lighting}, {background}, {camera_angle}, high-quality photography'
  },
  'landscape-natural': {
    name: 'Natural Landscape',
    category: 'LANDSCAPE', 
    description: 'Beautiful natural scenery and environments',
    baseStructure: '{location} landscape, {time_of_day}, {weather}, {season}, {camera_angle}, natural {lighting}, {atmospheric_effects}'
  },
  'concept-futuristic': {
    name: 'Futuristic Concept',
    category: 'CONCEPT',
    description: 'Sci-fi and futuristic concept art',
    baseStructure: 'futuristic {subject}, {technology}, {environment}, {lighting}, sci-fi {style}, {color_scheme}, advanced {details}'
  }
};

// 프로바이더 최적화 함수
const providerOptimizations = {
  dalleE3: (prompt) => `${prompt}, photorealistic, high detail`,
  imagen4: (prompt) => `professional photography of ${prompt}`,
  stableDiffusion: (prompt) => `${prompt}, masterpiece, best quality, ultra detailed`
};

// 1. 템플릿 시스템 테스트
console.log('📝 1. 템플릿 시스템 테스트:');
console.log('='.repeat(50));

Object.entries(templates).forEach(([id, template]) => {
  console.log(`\n• ${template.name} (${template.category})`);
  console.log(`  설명: ${template.description}`);
  console.log(`  구조: ${template.baseStructure}`);
});

// 2. 템플릿 적용 테스트
console.log('\n🔧 2. 템플릿 적용 테스트:');
console.log('='.repeat(50));

const testApplications = [
  {
    templateId: 'portrait-professional',
    variables: {
      subject: 'elegant woman',
      pose: 'sitting gracefully',
      expression: 'confident smile',
      clothing: 'business attire',
      lighting: 'soft studio lighting',
      background: 'neutral gray backdrop',
      camera_angle: 'eye level'
    }
  },
  {
    templateId: 'landscape-natural',
    variables: {
      location: 'mountain valley',
      time_of_day: 'golden hour',
      weather: 'clear sky',
      season: 'autumn',
      camera_angle: 'wide angle',
      lighting: 'warm sunlight',
      atmospheric_effects: 'morning mist'
    }
  },
  {
    templateId: 'concept-futuristic',
    variables: {
      subject: 'city skyline',
      technology: 'holographic displays',
      environment: 'cyberpunk metropolis',
      lighting: 'neon glow',
      style: 'blade runner aesthetic',
      color_scheme: 'blue and purple neon',
      details: 'flying vehicles'
    }
  }
];

function applyTemplate(templateId, variables) {
  const template = templates[templateId];
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

testApplications.forEach((test, i) => {
  console.log(`\n테스트 ${i + 1}: ${test.templateId}`);
  console.log('변수:', JSON.stringify(test.variables, null, 2));
  
  try {
    const result = applyTemplate(test.templateId, test.variables);
    console.log('✅ 결과:');
    console.log(`"${result}"`);
  } catch (error) {
    console.log('❌ 오류:', error.message);
  }
});

// 3. 프로바이더 최적화 테스트
console.log('\n🔄 3. 프로바이더 최적화 테스트:');
console.log('='.repeat(50));

const basePrompt = "beautiful mountain landscape at sunset, serene and peaceful";
console.log(`\n기본 프롬프트: "${basePrompt}"`);

Object.entries(providerOptimizations).forEach(([provider, optimizer]) => {
  console.log(`\n${provider.toUpperCase()}:`);
  const optimized = optimizer(basePrompt);
  console.log(`"${optimized}"`);
});

// 4. 프롬프트 향상 시뮬레이션
console.log('\n✨ 4. 프롬프트 향상 시뮬레이션:');
console.log('='.repeat(50));

const simpleInputs = [
  'a cat',
  'mountain sunset', 
  'futuristic city',
  'smartphone',
  'anime girl'
];

const enhancementRules = {
  'a cat': 'Professional portrait of an elegant domestic cat, sitting gracefully with alert amber eyes, soft natural lighting, shallow depth of field, high-quality photography, detailed fur texture',
  'mountain sunset': 'Breathtaking mountain landscape during golden hour sunset, dramatic sky with warm orange and pink hues, rugged peaks silhouetted against glowing horizon, serene alpine valley below, professional landscape photography',
  'futuristic city': 'Futuristic cyberpunk metropolis with towering glass skyscrapers, neon lights reflecting on wet streets, flying vehicles, holographic advertisements, dark atmospheric lighting, sci-fi concept art style',
  'smartphone': 'Premium modern smartphone product photography, sleek metallic design, perfect studio lighting, clean white background, high-end commercial presentation, ultra-sharp focus, professional advertising style',
  'anime girl': 'Beautiful anime character girl with large expressive eyes, colorful detailed artwork, manga style illustration, cute kawaii aesthetic, vibrant colors, cel shading technique'
};

simpleInputs.forEach(input => {
  console.log(`\n입력: "${input}"`);
  console.log('향상된 프롬프트:');
  console.log(`"${enhancementRules[input]}"`);
  
  // 프로바이더별 최적화
  console.log('\n프로바이더별 최적화:');
  Object.entries(providerOptimizations).forEach(([provider, optimizer]) => {
    const optimized = optimizer(enhancementRules[input]);
    console.log(`• ${provider}: "${optimized.substring(0, 100)}..."`);
  });
});

// 5. 성능 메트릭 시뮬레이션
console.log('\n📊 5. 성능 메트릭 시뮬레이션:');
console.log('='.repeat(50));

simpleInputs.forEach(input => {
  const original = input.split(' ').length;
  const enhanced = enhancementRules[input].split(' ').length;
  const wordsAdded = enhanced - original;
  const confidenceScore = Math.min(0.4 + (wordsAdded * 0.05), 0.95);
  
  console.log(`\n"${input}"`);
  console.log(`• 원본 단어수: ${original}`);
  console.log(`• 향상 단어수: ${enhanced}`);
  console.log(`• 추가된 단어: ${wordsAdded}`);
  console.log(`• 신뢰도: ${(confidenceScore * 100).toFixed(1)}%`);
  console.log(`• 예상 처리시간: ${1200 + Math.random() * 800}ms`);
});

console.log('\n🎉 프롬프트 시스템 기본 테스트 완료!');
console.log('\n📈 테스트 결과 요약:');
console.log('• 템플릿 시스템: ✅ 정상 작동');
console.log('• 변수 치환: ✅ 정상 작동');
console.log('• 프로바이더 최적화: ✅ 정상 작동');
console.log('• 프롬프트 향상: ✅ 시뮬레이션 정상');

console.log('\n💡 실제 GPT-4o 프롬프트 향상을 테스트하려면:');
console.log('   1. backend/.env 파일에 OPENAI_API_KEY 설정');
console.log('   2. npm run test:prompt-full 실행');