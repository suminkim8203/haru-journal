# Haru 앱 개발 안내



## 2026-09-18 확인한 디자인 배포 완료

요약: 현재 공개 앱은 approved-bf7699862b88이다. 확인한 3217 디자인의 정적 파일 23개와 공개 파일이 동일하다. 이전 미배포/87f1c7e 문장은 당시 기록이다. 새로운 일정 피드백은 제안 상태로 분리한다. 최신 근거: [배포 검증](../docs/deployment/APPROVED-UI-RELEASE-2026-09-18.md).



## 2026-09-18 승인 화면 복원 후속 기록

요약: 이전 React 앱은 공개됐지만 최종 승인 시안과 달라 사용자가 작업 중단·복원을 요청했다. 현재 복원 후보는 로컬 3217이며 공개 사이트에는 아직 반영하지 않았다. 새 배포 완료 또는 사용자 화면 확인 완료로 해석하지 않는다.

[문서 전체 재검토](../docs/reviews/MD-REREAD-2026-09-18.md) · [차이와 복원·검증 한계](../docs/reviews/APPROVED-DESIGN-RESTORATION-2026-09-18.md). 원본 승인 기준은 Haru-design-study-05.html이며 승인 스타일을 직접 옮겼다. 공개 재배포 전 실제 복원 후보를 확인하고 기능 누락·검증 한계를 해결한다.

요약: 공개 anon SDK가 NAS Supabase의 제한된 DB 함수를 직접 호출한다. 핵심 앱·루틴·편집/복원과 정적 배포 파일을 구현했으며 공개 웹 배포는 아직이다.

## 실행과 검사

이 폴더에서 npm ci, npm run dev. .env.example을 참고해 NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY를 Git 제외 .env.local에 설정한다. 공개 anon 연결만 사용한다. service_role/관리 비밀키는 앱에 넣지 않는다. 공개 연결 변수를 바꾸면 다시 빌드한다.

npm test(48개), npm run build(일반 빌드/타입), npm run build:static(정적 배포/타입). 일반 빌드 후 npm start는 기존 Next 서버이며, 정적 빌드 후 npm run preview:static은 .next-static만 로컬 3217에 제공한다. 둘을 같은 포트에서 동시에 실행하지 않는다. node scripts/smoke-static.mjs는 정적 안내/JS/환경·소스 경로/폐기 API 404를 검사하며 DB 쓰기가 없다. scripts/integration.mjs의 임시 SQL 어댑터 검사는 실제 NAS 증거가 아니다.

## 실제 NAS와 남은 범위

SQL 0001~0009 적용, 테이블 16개, snapshot 6. haru_snapshot/haru_command/haru_export는 고정 공개 다이어리 경계다. 내부 테이블/임의 다이어리 접근은 차단한다. 이미 적용한 SQL을 재실행하거나 DB를 초기화하지 않는다. Studio 경로와 앱 API 루트를 구분한다.

[최신 구현/실제 검증/한계](../docs/implementation/ROUTINES-AND-HISTORY-2026-09-18.md). 승인 자료 영속 복원과 적용 전 프로젝트 백업 복구는 검증했다. 공개 웹 배포·별도 기기·최종 제출 증거·정기 백업/재부팅 복원·대량 자료·일부 브라우저 확인 경로는 남아 있다.

[현재 상태](../docs/CURRENT_STATE.md) · [다음 진행](../docs/implementation/NEXT-STEPS.md) · [데이터 계약](../docs/DATA-CONTRACT-v1.md) · [공개 배포 검토안](../docs/deployment/WEB-RELEASE-REVIEW-2026-09-18.md)


## 2026-09-18 승인 시안 복원 및 실제 DB 보완

요약: 최종 승인 Haru-design-study-05.html의 실제 스타일 13개와 화면 구획을 React에 복원했다. 로컬 후보는 http://127.0.0.1:3217/ 이며 공개 https://haruleaf.com/ 은 이전 87f1c7e 화면이다. 이번 후보를 공개 재배포하지 않았다.

공식 Markdown 121개를 다시 읽고 차이를 기록했다. NAS에 0010_improvement_edits.sql까지 적용했다. snapshot 6·테이블 16개·공개 RPC 3개는 유지하며, 가져온 개선점의 독립 수정과 수정 이력을 복구했다. 수정 본문은 원본 문구·원본/대상 계획 연결·중복 판정 키를 바꾸지 않는다. snapshot의 improvementEditing=true로 실제 지원을 확인한다.

적용 전 백업: NAS /opt/supabase/backups/approved-design-recovery-20260918/. 기존 snapshot을 새 선택 필드 제외 후 비교하여 동일함을 확인했고 revision은 15→15였다. anon 권한의 생성/수정 검증은 트랜잭션 rollback으로 영속 자료를 남기지 않았다. 비공개 함수 경계도 유지했다. SDK 읽기 재검증: 계획 1·할 일 5·실행 3·단상 1·회고 1·개선점 0. 관리자 키를 앱에 이전하지 않았다.

타입·정적 빌드·50개 테스트를 통과했다. 데스크톱 1280px/모바일 390px에서 실제 화면과 완료 상태 제한 등을 확인했다. 원본 file URL 접근 제한 때문에 자동 픽셀 비교는 완료하지 못했다. 전체 폰트 로딩·별도 기기·활성 기록 드래그의 이번 브라우저 전수 검증은 완료로 기록하지 않는다.
