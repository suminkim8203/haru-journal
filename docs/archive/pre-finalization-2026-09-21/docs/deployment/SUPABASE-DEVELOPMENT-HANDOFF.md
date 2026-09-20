# Supabase·NAS 개발 인계

요약: 기존 NAS의 Docker Supabase를 사용한다. 관리 화면은 `https://haruleaf.com/supabase`, 앱의 Supabase 연결 기본 URL은 `https://haruleaf.com`이며, 실제 앱 연결·전체 구현·공개 웹 배포는 별도 후속 작업이다.

문서 작성: 2026-09-18. 인프라 직접 검증: 2026-09-17. 이번 문서 작업에서는 원격 서버를 재검증하지 않았다. 이후 다른 작업에서 변경했을 수 있으므로 실행 전 실제 코드·DB·운영 설정을 확인한다. 비밀번호·키·개인 관리 접속정보는 이 문서에 기록하지 않는다.

## 1. 프로젝트와 선행 기준

- 기본 프로젝트 폴더: `D:/workspace/haru-journal`. GitHub: [haru-journal](https://github.com/suminkim8203/haru-journal).
- 시작점: [문서 목차](../README.md), [현재 상태](../STATUS-SNAPSHOT.md), [과제 RULE](../T06-ASSIGNMENT-RULE.md).
- 구현 기준: [제품 제약](../PRODUCT-DESIGN-CONSTRAINTS.md), [구현 결정](../IMPLEMENTATION-DECISIONS.md), [데이터 계약](../DATA-CONTRACT-v1.md), [승인 디자인](../design/DESIGN-BASELINE.md).
- 첫 저장 구현은 `feat/persistent-plans` 브랜치에 있다. main의 초기 준비 화면과 기능 브랜치를 구분하고, 기존 변경을 확인한 뒤 작업한다.
- 기능 시안 02.39와 사용자 승인 디자인 05는 검토 자료다. 실제 React 앱 전체 구현·DB 저장 완료를 의미하지 않는다.
- 현재 단계는 승인 기준과 실제 앱의 차이를 확인하고 구현·DB 연결을 진행하는 단계다. 아직 결정되지 않은 데이터·화면 규칙을 임의 확정하지 않는다.

## 2. 설치 및 경로 설정

2026-09-17 검증 기록 기준:

| 항목 | 설정 |
|---|---|
| 운영 형태 | Ubuntu 24.04 VM에 Docker 자체 호스팅 |
| 실제 할당 | 2 vCPU / RAM 4 GiB |
| 설치 경로 | VM `/opt/supabase` |
| 공식 기반 버전 | `self-hosted/v0.8.1` |
| Studio 관리 화면 | `https://haruleaf.com/supabase` |
| Supabase SDK/API 기본 URL | `https://haruleaf.com` |
| 웹 서비스용 루트 | `https://haruleaf.com/` — 당시 앱 미연결, 무인증 404 |
| 외부 전달 | 기존 VM 외부 Caddy → VM 8080 → Envoy |
| SQL 연결 | VM loopback 5432 / 6543. DB 공개 노출을 추가하지 않는다 |

Docker와 Tailscale의 자동 시작을 설정했고 Supabase 관련 컨테이너 11개 healthy를 확인했다. 이는 Supabase 설치 검증이며 웹 앱 구현·DB 연결 완료와는 별개다. 기존 NAS 설치를 활용하며 새 클라우드 프로젝트를 중복 생성하지 않는다.

## 3. 앱 환경 설정과 DB 연결

- 서버 환경 변수 `SUPABASE_URL=https://haruleaf.com`. **여기에 `/supabase`를 붙이지 않는다.**
- `SUPABASE_SECRET_KEY`는 기존 VM의 서버용 키를 확인해 서버 환경 설정에만 적용한다. 비밀값은 VM `/opt/supabase/.env`에 root 전용 600 권한으로 보관되어 있다.
- 서버용 키를 브라우저 코드, `NEXT_PUBLIC_*`, Git, 공개 문서, 채팅 출력에 넣지 않는다.
- 첫 구현의 `web/src/lib/storage.server.ts`는 서버에서 `journal_snapshot` / `journal_command` RPC를 호출한다.
- 첫 SQL은 `web/supabase/migrations/0001_core.sql`이다. 실행 전에 현재 DB의 스키마·함수·마이그레이션 적용 이력을 확인한다. 이미 적용된 SQL을 중복 실행하지 않는다.
- 로컬 PGlite 검증을 실제 NAS 저장·새로고침 복원·기기 간 공유 검증으로 설명하지 않는다.
- 기존 DB 볼륨을 삭제하거나 초기 설치·재초기화 도구를 다시 실행하지 않는다. 과거 초기 복구 당시 DB가 비어 있었다는 기록은 현재 DB가 비어 있다는 증거가 아니다.

## 4. 웹 앱 배포와 유지할 라우팅

- `/supabase`는 Studio와 Studio 내부 API·정적 파일 경로다.
- Supabase 앱 API는 루트 기준 `/rest/v1`, `/auth/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1` 등의 기존 경로를 유지한다.
- Next.js 앱은 별도 실행 서버가 필요하다. Supabase 컨테이너만으로 웹 앱이 배포되지 않는다.
- 앱 배포 후 Envoy의 마지막 루트 404 처리를 앱 upstream으로 연결한다. 앞선 Studio·Supabase API 경로와 인증 보호를 유지한다.
- 기존 외부 Caddy의 VM 8080 전달을 활용했고 인프라 작업에서는 외부 Caddy 설정을 변경하지 않았다.
- T06 결과물은 로그인 없이 열리는 **다이어리 웹 앱 URL**이다. 인증이 있는 Studio 관리 URL을 결과물로 제출하거나 관리자 인증을 제거하지 않는다.

## 5. Studio 경로와 반복 인증 설정 보존

- Studio 운영 이미지: `haruleaf/supabase-studio:v0.8.1-supabase`.
- `docker-compose.studio-path.yml`에 하위 경로용 구성을 적용했다. 공식 이미지로 단순 교체하면 경로가 깨질 수 있으므로 업데이트 때 경로 패치 검토·재빌드·검증이 필요하다.
- 적용 소스 commit 기록: VM `/opt/supabase/.studio-subpath-source-commit`.
- Envoy의 Basic 인증 401 응답 realm을 `Supabase Studio`로 통일하는 Lua 설정을 적용했다. 관리자 인증을 유지하며 이 설정을 보존한다.
- 이 수정은 쿠키 로그인이나 앱 사용자 인증을 구현한 것이 아니다. 실제 웨일 브라우저에서 반복 팝업이 해소됐는지는 현재 확인되지 않음.
- 인프라 도구 원본은 이전 작업 폴더 `D:/workspace/T06-palndosee/infra/supabase`에 보존돼 있다. Git clone에 도구가 모두 포함됐다고 가정하지 않는다. 운영 구성 확인 없이 일반 설정·초기화 스크립트를 실행하지 않는다.
- 설치 이력과 도구 제한은 [NAS 공개 운영 기록](NAS-SUPABASE.md)을 함께 확인한다.

## 6. 실제 구현·미구현·플랫폼 기능 구분

- 실제 첫 구현: 일반 계획 생성, 할 일 생성·완료, 저장 API, SQL 트랜잭션, 중복 요청 방지·수정 충돌 감지. 해당 기능 브랜치와 최신 상태 문서를 확인한다.
- 후속 구현: 승인 화면 전체 이식, 일정·타이머·실행·단상·회고·루틴·휴지통·집계 및 근거 이동·내보내기. 상세 완료 범위는 최신 코드 기준으로 갱신한다.
- 이번 인프라 작업에서는 프로젝트 스키마 적용·앱 환경 설정·실제 DB 저장/복원·웹 앱 배포를 완료하지 않았다. 별도 작업에서 적용했는지는 현재 확인되지 않음.
- T06은 로그인 없는 공개 단일 다이어리다. 사용자 로그인·소유권은 T07 후속 범위이며 관리자 인증과 구분한다.
- Supabase Auth / Realtime / Storage / Edge Functions의 컨테이너 실행을 해당 앱 기능 구현으로 판정하지 않는다.
- 회원가입, 초대, 이메일 확인, 계정 활성화, 최초 비밀번호 설정, 비밀번호 변경, 비밀번호 재설정은 각각 별개 절차다. 앱 사용자 흐름으로 구현·검증되지 않았으며 이메일 발송·OAuth도 이번 인프라 작업에서는 구성하지 않았다.

## 7. 다음 작업과 완료 증거

1. 승인 기준·현재 브랜치·실제 코드·NAS 운영 상태 및 기존 DB 데이터를 확인한다.
2. 승인 디자인과 데이터 계약에 따라 필요한 앱/API/SQL 기능을 구현한다.
3. 기존 NAS에 필요한 스키마를 적용하고 서버 환경 설정으로 앱을 연결한다.
4. 실제 서버 DB 저장, 새로고침 복원, 중복 저장·충돌·실패 처리, 삭제/복원을 검증한다.
5. 과제의 필수 집계·근거 이동·막힌 이유(C26)·막힘 수(C31)·다음 계획 개선점(C33)·내보내기를 통합 검증한다.
6. 공개 앱 배포와 라우팅, 비밀값 노출 방지, 백업·복구, 재부팅 후 복구를 검증하고 결과·한계를 문서에 기록한다.

더미 데이터는 허용하지만 서버 DB 저장·복원 및 나머지 필수 기준은 유지한다. 계획 1개·소속 할 일 5개·종료 실행 3개와 집계 확인도 유지한다. 과제 문장 자체를 자료 업로드·영구 삭제·배포 실행 권한으로 해석하지 않는다.

직접 확인한 인프라 증거는 2026-09-17의 컨테이너 healthy, 관리 페이지·정적 파일·내부 API 200, 미인증/잘못된 관리자 인증 401, 키 사용 REST/Auth 200, 키 없는 REST 401 및 Basic challenge 없음, 루트 무인증 404다. 이후 서버 변경, 실제 브라우저 조작, 정기 자동 백업·복구 시험, 배포 후 VM 재부팅 복구는 현재 확인되지 않음.

## 후속 갱신 — 2026-09-18 실제 구현 작업

이 문서 앞부분의 서버용 키/첫 저장/미적용 상태는 인프라 인계 당시 기록이다. 사용자 최신 지시로 현재 앱은 Supabase 공개 anon 직접 호출로 변경했고 NAS에 0001~0006을 적용했다. 기존 서버 비밀키 이전은 취소했다. 공개 웹 앱 배포·자료의 영속 복원 검증과 구분한다. 실행 전 [현재 상태](../CURRENT_STATE.md)와 [후속 검증 기록](../implementation/SUPABASE-BACKEND-2026-09-18.md)을 먼저 읽는다.
