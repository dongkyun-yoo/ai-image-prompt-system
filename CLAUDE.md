# CLAUDE.md - AI Image Prompt System

## 프로젝트 개요
상세한 묘사를 생성하는 AI 이미지 프롬프트 작성기 + 멀티 프로바이더 이미지 생성 통합 시스템

### 핵심 기능
- 간단한 사용자 입력 → 상세한 프롬프트 자동 생성
- 다중 AI 이미지 생성 API 통합 (DALL-E 3, Imagen 4, Stable Diffusion)
- 실시간 생성 상태 추적 및 결과 갤러리
- 프롬프트 템플릿 시스템 및 스타일 최적화

## MCP 권한 설정

### 활성화된 MCP 서버
```yaml
Context7 (C7):
  - 용도: AI 이미지 생성 API 공식 문서 조회
  - 권한: 모든 라이브러리 문서 접근 허용
  - 자동 활성화: 외부 API 통합 시

Sequential:
  - 용도: 복잡한 시스템 아키텍처 분석 및 디버깅
  - 권한: 전체 사고 과정 실행 허용
  - 자동 활성화: 멀티스텝 문제 해결 시

Magic:
  - 용도: React 컴포넌트 및 UI 생성
  - 권한: 모든 UI 컴포넌트 생성 허용
  - 자동 활성화: 프론트엔드 개발 시

Puppeteer:
  - 용도: 이미지 생성 결과 테스트 및 UI 검증
  - 권한: 브라우저 자동화 실행 허용
  - 자동 활성화: E2E 테스트 시
```

### 자동 MCP 활성화 규칙
- API 통합 관련 → C7 자동 활성화
- 복잡한 시스템 분석 → Sequential 자동 활성화
- UI/컴포넌트 개발 → Magic 자동 활성화
- 테스트 및 검증 → Puppeteer 자동 활성화

## 개발 환경 설정

### 기술 스택
```yaml
Backend:
  - Node.js + Express/Fastify
  - TypeScript
  - PostgreSQL + Redis
  - Bull Queue (작업 큐)

Frontend:
  - React 18 + TypeScript
  - Vite
  - Tailwind CSS + Framer Motion
  - Zustand + React Query

AI Integration:
  - OpenAI API (DALL-E 3)
  - Google AI API (Imagen 4)
  - Stability AI API (Stable Diffusion)
  - GPT-4o (프롬프트 향상)
```

### 핵심 명령어
```bash
# 개발 서버 실행
npm run dev          # 전체 개발 환경
npm run dev:backend  # 백엔드만
npm run dev:frontend # 프론트엔드만

# 데이터베이스
npm run db:migrate   # 마이그레이션 실행
npm run db:seed     # 시드 데이터 생성

# 테스트
npm run test        # 전체 테스트
npm run test:api    # API 테스트
npm run test:e2e    # E2E 테스트

# 빌드 & 배포
npm run build       # 프로덕션 빌드
npm run deploy      # 배포 실행
```

## 프로젝트 구조
```
ai-image-prompt-system/
├── backend/          # Node.js API 서버
├── frontend/         # React 웹 앱
├── docs/            # 문서 및 아키텍처
├── scripts/         # 자동화 스크립트
└── data/           # 샘플 데이터 및 설정
```

## 개발 모드
- **architect**: 시스템 설계 및 아키텍처 결정
- **frontend**: UI/UX 개발 및 컴포넌트 구현
- **backend**: API 개발 및 데이터 처리

---
*AI Image Prompt System v1.0 | 상세 프롬프트 생성 → 멀티 프로바이더 이미지 생성*