# NAS Supabase 설치와 운영 기록 — 공개용

> 2026-09-21 현행 안내: 승인 앱 배포 완료, release approved-1cd31cf9a6ff, NAS SQL 0001–0010/snapshot 6. 공개 anon 직접 호출이며 서버 비밀키 이전은 취소됐다. 아래 날짜별 설치·미완료 문장은 당시 이력이다. 최신 완료/미확인은 [현재 상태](../CURRENT_STATE.md)를 따른다.




## 2026-09-18 확인한 디자인 배포 완료

요약: 현재 공개 앱은 approved-bf7699862b88이다. 확인한 3217 디자인의 정적 파일 23개와 공개 파일이 동일하다. 이전 미배포/87f1c7e 문장은 당시 기록이다. 새로운 일정 피드백은 제안 상태로 분리한다. 최신 근거: [배포 검증](APPROVED-UI-RELEASE-2026-09-18.md).

요약: 별도 인프라 작업의 설치·API/관리 인증 검증 기록이 있으나 다이어리 앱 연결·공개 배포와 운영 복구 확인은 완료되지 않았습니다. 기준: 2026-09-17 기록, 문서 정리 2026-09-18. 이번 작업은 원격 서버를 재검증하지 않았습니다.

## 기록된 설치 구성

- Proxmox의 Ubuntu 24.04 VM, 2 vCPU / RAM 4 GiB.
- 공식 Supabase self-hosted/v0.8.1 기반 Docker 구성, Caddy → Envoy 경로, Tailscale 관리 연결.
- Studio는 /supabase 하위 경로. 클라이언트 API 기본 URL에 /supabase를 붙이지 않음.
- Studio 하위 경로를 위한 별도 이미지/Compose 확장과 고정 소스 commit 기록. 이미지 업데이트 시 경로 패치 재검토/재빌드 필요.
- DB/Auth/REST/Realtime/Storage/Studio/Meta/Pooler/Imgproxy/Edge Functions/Envoy 11개 컨테이너 healthy 확인 기록.
- 컨테이너 로그 10 MB × 3개 제한, 비밀 환경 파일은 서버 root 전용 600 권한.

## 확인 기록

내부/외부 API 키 사용 Auth health·REST 200, 관리 화면·파일·API 200, 미인증/잘못된 관리 인증 401, API 키 없는 REST 401 및 Basic challenge 없음. 관리 HTTP BasicAuth realm 통일. 사용자 앱 인증 절차가 새로 구현된 것이 아닙니다.

초기 설치 권한 문제로 SQL 초기화가 일부 중단됐으며 사용자 테이블/Auth 사용자/Storage 객체가 비어 있음을 확인한 뒤 덤프·환경 설정·이전 DB 디렉터리를 보존하고 초기화를 복구했습니다. 이전 데이터 디렉터리를 영구 삭제하지 않았습니다. 덤프와 비밀 백업 권한을 제한했습니다.

Studio 이미지 빌드에서 메모리 문제가 있어 Webpack 메모리 절약 옵션·단일 작업자·임시 스왑을 사용했고 빌드 완료 후 임시 스왑/빌드 컨테이너를 정리했습니다. 기록상 운영 컨테이너 healthy를 확인했습니다.

## 도구와 적용 제한

원본 로컬 경로 infra/supabase에는 install.sh, configure.sh, fix-studio-realm.sh, build-studio-subpath.sh, check-studio-subpath.sh, configure-studio-subpath.sh, repair-bootstrap.sh, reinitialize-empty.sh가 있습니다. 이번 문서 정리에서 실행하지 않았습니다. 초기 설치/복구 도구를 운영 데이터가 있는 설치에 재실행하지 않습니다. 현재 하위 경로 구성은 일반 configure 대신 검증을 거치는 전용 경로 구성 도구를 사용한 기록입니다.

## 미완료와 운영 후속

- 앱 환경 설정·프로젝트 스키마 적용·실제 DB 저장/새로고침 복원·앱 upstream 연결·공개 결과물 배포.
- 정기 자동 백업과 실제 복구 시험, VM 재부팅 후 전체 서비스 복구 시험.
- 브라우저에서의 실제 Studio 조작/반복 팝업 해소 확인.
- 앱 회원가입·초대·이메일 확인·계정 활성화·최초 비밀번호 설정·변경·재설정·OAuth/이메일 발송.

앱 배포 시 기존 /supabase 관리자 보호와 Supabase API 라우팅을 유지합니다. 관리자 인증을 제거하지 않습니다. T06의 무인증 공개 다이어리 URL과 관리자 URL을 구별합니다. 개인 IP·Tailscale DNS·관리 계정명·키·비밀번호·일회용 링크·설치 로그는 공개 문서에 포함하지 않습니다. 현재 접속 주소와 비밀 환경 값은 기존 서버에서 확인합니다.

## 기존 참고 자료

- [Supabase Docker 자체 호스팅](https://supabase.com/docs/guides/self-hosting/docker)
- [고정 버전 공식 설치 도구](https://raw.githubusercontent.com/supabase/supabase/self-hosted/v0.8.1/docker/setup.sh)
- [Compose 병합](https://docs.docker.com/reference/compose-file/merge/)

문서 원문은 이전 로컬 작업 폴더 infra/supabase/README.md에 보존되어 있습니다. 이 공개 요약은 원문 삭제나 서버 구성 변경을 의미하지 않습니다.


## 2026-09-18 승인 시안 복원 및 실제 DB 보완

요약: 최종 승인 Haru-design-study-05.html의 실제 스타일 13개와 화면 구획을 React에 복원했다. 로컬 후보는 http://127.0.0.1:3217/ 이며 공개 https://haruleaf.com/ 은 이전 87f1c7e 화면이다. 이번 후보를 공개 재배포하지 않았다.

공식 Markdown 121개를 다시 읽고 차이를 기록했다. NAS에 0010_improvement_edits.sql까지 적용했다. snapshot 6·테이블 16개·공개 RPC 3개는 유지하며, 가져온 개선점의 독립 수정과 수정 이력을 복구했다. 수정 본문은 원본 문구·원본/대상 계획 연결·중복 판정 키를 바꾸지 않는다. snapshot의 improvementEditing=true로 실제 지원을 확인한다.

적용 전 백업: NAS /opt/supabase/backups/approved-design-recovery-20260918/. 기존 snapshot을 새 선택 필드 제외 후 비교하여 동일함을 확인했고 revision은 15→15였다. anon 권한의 생성/수정 검증은 트랜잭션 rollback으로 영속 자료를 남기지 않았다. 비공개 함수 경계도 유지했다. SDK 읽기 재검증: 계획 1·할 일 5·실행 3·단상 1·회고 1·개선점 0. 관리자 키를 앱에 이전하지 않았다.

타입·정적 빌드·50개 테스트를 통과했다. 데스크톱 1280px/모바일 390px에서 실제 화면과 완료 상태 제한 등을 확인했다. 원본 file URL 접근 제한 때문에 자동 픽셀 비교는 완료하지 못했다. 전체 폰트 로딩·별도 기기·활성 기록 드래그의 이번 브라우저 전수 검증은 완료로 기록하지 않는다.
