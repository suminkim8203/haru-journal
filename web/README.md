# Haru 앱 개발 안내

요약: 승인된 Haru 디자인과 일정 사용성 수정을 구현·배포했고 2026-09-21 사용자 화면 확인을 받았다. 현재 공개 release는 approved-1cd31cf9a6ff이며 제출·운영 검증을 마무리하는 단계다.

## 실행

이 폴더에서 npm ci를 실행하고 .env.example을 참고해 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 Git 제외 .env.local에 설정한다. API 기본 URL은 https://haruleaf.com이며 /supabase를 붙이지 않는다. 공개 anon만 사용하고 관리자/service_role 키를 넣지 않는다.

- npm run dev: 개발 서버.
- npm test: 로컬 SQL/시간/집계/월간 기능 검사 53개. 실제 NAS 검증과 구분한다.
- npm run build:static: TypeScript 검사를 포함한 정적 빌드.
- npm run preview:static: .next-static을 로컬 3217에서 제공.
- node scripts/smoke-static.mjs: 정적 공개 안내·JS·환경/소스 경로 차단 검사. DB 쓰기 없음.

## 현재 구조

React/Next.js 정적 앱 → Supabase SDK → 고정 단일 다이어리 공개 함수 haru_snapshot/haru_command/haru_export. SQL 0001–0010, snapshot 6, 개선점 독립 편집 지원. 실제 상태는 [현재 상태](../docs/CURRENT_STATE.md). 환경 변수를 변경하면 다시 빌드한다.

서버용 키를 이전하는 옛 인계는 폐기됐다. Auth/Realtime/Storage/Edge Functions는 앱에서 사용하지 않는다. Studio 관리자 인증과 앱 사용자 인증은 별개다. 운영 DB에 초기화 스크립트를 다시 실행하지 않는다.

[배포 기록](../docs/deployment/SCHEDULE-RELEASE-2026-09-18.md) · [과거 안내](../docs/archive/pre-finalization-2026-09-21/web/README.md).
