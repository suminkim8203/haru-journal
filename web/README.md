# Haru 앱 개발 안내

요약: 앱은 공개 anon으로 NAS Supabase의 제한된 DB 함수를 직접 호출한다. 현재 핵심 구현과 루틴/일부 UI/자료 복원/공개 웹 배포의 남은 범위를 구분한다.

## 실행과 검사

이 폴더에서 npm ci, npm run dev. .env.example을 참고해 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY를 로컬 .env.local에 설정한다. 공개 연결 정보만 사용하며 service_role/관리 비밀키는 앱에 넣지 않는다. 기존 서버 저장 API는 제거했다. 공개 연결 변수를 바꾸면 생산 빌드를 다시 한다.

검사는 npm run typecheck, npm test, npm run build. 빌드 후 node scripts/smoke.mjs는 정적 앱 HTTP·공개 안내·폐기한 저장 API 미제공을 확인한다. node scripts/integration.mjs는 SDK→임시 HTTP→anon SQL/PGlite를 확인하며 실제 NAS 증거가 아니다.

## 현재 NAS 연결

기존 NAS 0001~0007 적용, snapshot schemaVersion 4. haru_snapshot/haru_command/haru_export는 고정 단일 공개 diary만 접근한다. 내부 테이블과 임의 diary 호출은 막혀 있다. 이미 적용한 SQL을 다시 실행하거나 기존 DB를 초기화하지 않는다. Studio 관리 경로와 앱 API 루트는 다르다. 실제 값은 Git·소스·문서에 기록하지 않는다.

[최신 구현/실제 검증/한계](../docs/implementation/SUPABASE-BACKEND-2026-09-18.md). 공개 예시의 영속 자료 복원은 검증했고, 루틴·일부 UI·별도 기기·최종 제출 증거·공개 웹 앱 배포는 미완료이며 DB 서비스 설치/앱 연결/배포를 구분한다.

[현재 상태](../docs/CURRENT_STATE.md) · [다음 진행](../docs/implementation/NEXT-STEPS.md) · [데이터 계약](../docs/DATA-CONTRACT-v1.md) · [승인 디자인](../docs/design/DESIGN-BASELINE.md)
