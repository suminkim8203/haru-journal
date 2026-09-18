# Haru 앱 개발 안내

요약: 현재 기본 폴더의 codex/plan-task-fields에는 일반 계획/할 일 첫 저장 기반과 필수 항목 보정이 있습니다. GitHub main의 초기 화면·실제 NAS 연결·전체 제품 구현과 구분합니다.

## 실행과 검사

이 폴더에서 npm ci, npm run dev. 검사는 npm run typecheck, npm test, npm run build. 빌드 후 node scripts/smoke.mjs(연결 없는 오류/HTTP), node scripts/integration.mjs(임시 로컬 SDK/RPC/PGlite 통합)를 실행합니다. 통합 테스트는 실제 NAS 검증이 아닙니다.

일반 계획 생성/수정·수정 전 이력, 우선순위·독립 예상 시간 입력, 할 일 생성/수정·완료/취소·여러 태그·검색/상태/태그 필터·정렬을 구현했습니다. 전체 일정/실행/단상/회고/루틴/휴지통/집계/내보내기는 후속입니다. [이번 구현 기록](../docs/implementation/PLAN-TASK-FIELDS-2026-09-18.md)을 확인합니다.

## 기존 NAS 연결

먼저 [개발 인계](../docs/deployment/SUPABASE-DEVELOPMENT-HANDOFF.md)를 읽고 실제 DB 적용 이력을 확인합니다. 새 클라우드 프로젝트 생성이나 기존 DB 초기화는 하지 않습니다. 0001은 원본, 0002는 후속 마이그레이션이며 이미 적용한 SQL은 재실행하지 않습니다. 현재 코드의 snapshot은 schemaVersion=2가 필요하고 구형 저장소에는 쓰기를 차단합니다. 실제 NAS 적용은 아직입니다.

SUPABASE_URL은 SDK 루트이며 Studio의 /supabase 관리 경로와 다릅니다. SUPABASE_SECRET_KEY는 서버에만 설정하고 브라우저/NEXT_PUBLIC/Git/채팅에 넣지 않습니다. HTTPS 프록시 배포에는 APP_ORIGIN을 실제 앱의 공개 Origin(스킴+호스트+포트)으로 명시합니다. 개발 기본은 요청 Host를 확인하며 forwarded 헤더를 기본 신뢰하지 않습니다. 이 검사는 T06 사용자 인증이 아닙니다. .env.example에는 실제 값이 없습니다.

## 디자인과 후속

기능 시안 02.39·디자인 05 승인 기준. 초기 계획 화면에는 기존 승인 3가족 웹폰트와 브랜드/서체 역할을 지정했습니다. 전체 화면 이식과 실제 브라우저/모바일·폰트 로딩은 후속입니다. HTML 시안을 완성 앱으로 삽입하거나 접근 제한을 우회하려고 로컬 시안을 앱으로 제공하지 않습니다.

[현재 상태](../docs/CURRENT_STATE.md) · [다음 진행](../docs/implementation/NEXT-STEPS.md) · [데이터 계약](../docs/DATA-CONTRACT-v1.md) · [승인 디자인](../docs/design/DESIGN-BASELINE.md)
