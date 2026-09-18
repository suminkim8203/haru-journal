# NAS Supabase 설치와 운영 기록 — 공개용

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
