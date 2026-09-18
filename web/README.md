# Haru 앱 개발 안내

요약: 공개 anon SDK가 NAS Supabase의 제한된 DB 함수를 직접 호출한다. 핵심 앱·루틴·편집/복원과 정적 배포 파일을 구현했으며 공개 웹 배포는 아직이다.

## 실행과 검사

이 폴더에서 npm ci, npm run dev. .env.example을 참고해 NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY를 Git 제외 .env.local에 설정한다. 공개 anon 연결만 사용한다. service_role/관리 비밀키는 앱에 넣지 않는다. 공개 연결 변수를 바꾸면 다시 빌드한다.

npm test(48개), npm run build(일반 빌드/타입), npm run build:static(정적 배포/타입). 일반 빌드 후 npm start는 기존 Next 서버이며, 정적 빌드 후 npm run preview:static은 .next-static만 로컬 3217에 제공한다. 둘을 같은 포트에서 동시에 실행하지 않는다. node scripts/smoke-static.mjs는 정적 안내/JS/환경·소스 경로/폐기 API 404를 검사하며 DB 쓰기가 없다. scripts/integration.mjs의 임시 SQL 어댑터 검사는 실제 NAS 증거가 아니다.

## 실제 NAS와 남은 범위

SQL 0001~0009 적용, 테이블 16개, snapshot 6. haru_snapshot/haru_command/haru_export는 고정 공개 다이어리 경계다. 내부 테이블/임의 다이어리 접근은 차단한다. 이미 적용한 SQL을 재실행하거나 DB를 초기화하지 않는다. Studio 경로와 앱 API 루트를 구분한다.

[최신 구현/실제 검증/한계](../docs/implementation/ROUTINES-AND-HISTORY-2026-09-18.md). 승인 자료 영속 복원과 적용 전 프로젝트 백업 복구는 검증했다. 공개 웹 배포·별도 기기·최종 제출 증거·정기 백업/재부팅 복원·대량 자료·일부 브라우저 확인 경로는 남아 있다.

[현재 상태](../docs/CURRENT_STATE.md) · [다음 진행](../docs/implementation/NEXT-STEPS.md) · [데이터 계약](../docs/DATA-CONTRACT-v1.md) · [공개 배포 검토안](../docs/deployment/WEB-RELEASE-REVIEW-2026-09-18.md)
