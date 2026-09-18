# 개발·배포 계획 — 기존 NAS 활용

요약: PC에서 앱을 개발하고 기존 NAS Supabase에 연결합니다. 인프라 설치와 웹 앱 배포는 별개이며 새 클라우드 프로젝트를 만들거나 기존 DB를 초기화하지 않습니다.

## 실제 설치 기록과 앱 상태

2026-09-17 NAS 설치 기록: Ubuntu 24.04 VM, 2 vCPU/4 GiB, Docker Supabase self-hosted/v0.8.1, 컨테이너 11개 healthy. 관리 화면은 https://haruleaf.com/supabase, SDK 기본 URL은 https://haruleaf.com 입니다. 이번 문서 정리에서 원격 상태를 재검증하지 않았습니다.

React/Next.js/TypeScript 첫 저장 소스는 feat/persistent-plans에 있고 main은 준비 화면입니다. 실제 NAS의 프로젝트 스키마·앱 환경 설정·DB 저장/새로고침 복원·공개 앱 배포는 완료 확인되지 않음. Spring 백엔드는 구현하지 않았습니다. 이전 클라우드/Vercel 탐색은 현재의 새 프로젝트 생성 지시로 적용하지 않습니다.

## 보존해야 할 운영 구성

- 먼저 [Supabase·NAS 개발 인계](SUPABASE-DEVELOPMENT-HANDOFF.md)를 읽고 현재 DB/적용 이력/라우팅을 확인합니다.
- Studio 하위 경로 이미지·관리 Basic 인증과 기존 API 루트 경로를 유지합니다. 관리자 인증과 앱 사용자 인증을 혼동하지 않습니다.
- Next.js는 별도 서버/upstream이 필요합니다. Supabase 설치만으로 웹 앱/API가 배포되지 않습니다.
- 서버 비밀값은 서버에만 보관하고 채팅/Git/NEXT_PUBLIC로 전달하지 않습니다. DB 볼륨 삭제·재초기화 금지.
- 설치 도구 원본은 이전 D:/workspace/T06-palndosee/infra/supabase에 있습니다. 새 clone에 모든 도구가 있다고 가정하지 않습니다.

## 후속 진행

1. 첫 저장 기능·필수 필드/API/SQL을 검토·보정하고 앱 개발 화면을 구성합니다.
2. NAS의 현 상태와 적용 이력을 확인한 뒤 필요한 후속 마이그레이션·서버 환경 설정으로 연결합니다.
3. 서버 저장/조회·새로고침 복원·오류/재시도·전체 기능과 집계/내보내기를 검증합니다.
4. 앱 실행 서버·기존 API/Studio 라우팅·HTTPS와 공개 첫 화면 안내를 점검합니다.
5. 백업/실제 복구·업데이트/되돌리기·재부팅 복구·제출 증거를 확인합니다.

T06 제출은 로그인 없이 열리는 제품 URL입니다. Tailscale 내부 접속이나 인증이 있는 Studio 주소를 제품 URL로 대신하지 않습니다. 공개 단일 다이어리의 열람·편집 의미를 실제 공개 전 다시 안내합니다. 과제 문장은 운영 서버 변경 실행 권한 자체가 아닙니다.

## 확인이 남은 사항

현재 원격 스키마/다른 작업의 변경, 앱 실행 서버 설정, 정기 백업·복구 시험, 재부팅 복구, 실제 장비 부하, 브라우저 동작은 현재 확인되지 않음. 외부 공개에 쓸 자료와 구체 운영 변경은 검토 가능한 상태에서 확인합니다. 사용자에게 비밀 키·DB 비밀번호를 채팅으로 요청하지 않습니다.

[현재 상태](../CURRENT_STATE.md) · [진행 계획과 사용자 할 일](../implementation/NEXT-STEPS.md) · [정리 전 선택 이력](../archive/current-before-consolidation-2026-09-18/docs/deployment/DEPLOYMENT-PLAN.md)

## 2026-09-18 연결 방식 갱신

백엔드는 NAS Supabase 테이블·DB 함수/접근 정책이다. 앱에는 공개 연결 변수 NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY만 설정하며 기존 서버 전용 키 이전 계획은 취소했다. Next 저장 API를 제거해 현재 화면은 정적 렌더링 가능하다. 실제 공개 웹 호스팅 형태·배포 승인·Studio/API 경로 보존·복구 시험은 아직이며 이번 작업이 웹 배포 완료를 의미하지 않는다. [적용/검사 기록](../implementation/SUPABASE-BACKEND-2026-09-18.md).

## 2026-09-18 최신 상태 — 공개 배포 파일 준비

앞 절의 첫 저장/미적용 상태는 당시 기록이다. 현재 NAS 0001~0009/16테이블/snapshot 6, 핵심 앱과 루틴 구현·실제 자료 검증·프로젝트 백업 복구를 확인했다. 브라우저 직접 Supabase 연결이라 Next 서버 없이 정적 파일을 제공할 수 있으며 선택적 정적 export와 내부 NGINX 배포 파일을 준비했다. 기존 일반 Next 개발/실행도 유지한다. [실제 검증](../implementation/ROUTINES-AND-HISTORY-2026-09-18.md), [사용자 확인 대상과 구체 공개 배포안](WEB-RELEASE-REVIEW-2026-09-18.md)을 최신 기준으로 읽는다. 아직 공개 웹 앱 배포·별도 기기·정기 백업/재부팅 복원·전체 플랫폼 복구는 완료하지 않았다.
