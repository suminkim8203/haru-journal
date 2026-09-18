# 정적 프런트 배포 준비

요약: build:static으로 생성한 .next-static 웹 파일을 내부 NGINX에 제공하고, 사용자 공개 배포 승인 후 기존 Envoy의 마지막 루트 처리만 연결한다. 이 구성은 준비 파일이며 아직 NAS에서 실행하지 않았다.

백엔드는 기존 Supabase의 고정 다이어리 RPC다. 개발은 기존 Next dev/일반 build/start를 유지한다. 정적 빌드는 별도 선택지이며 T07 구조를 미리 확정하지 않는다.

compose.yaml은 NAS에서 실제 확인한 supabase_default 네트워크를 사용한다. 새 호스트 공개 포트는 없다. HARU_WEB_RELEASE에 검토한 정적 파일 폴더를 지정한다. .env/소스/비밀키는 컨테이너에 넣지 않는다. nginx.conf는 정적 파일과 healthz만 제공하며 앱 API를 구현하지 않는다.

이미지 nginx:1.30.4-alpine의 공식 등록은 [공식 이미지 목록](https://github.com/docker-library/official-images/blob/master/library/nginx)으로 확인했다. 배포 시 이미지 digest를 확인·기록하고 nginx -t/health/파일 검사를 통과한 뒤 실제 공개 경로를 변경한다. 이미지 실행·NGINX 설정 검사·기존 Envoy 수정은 아직이며 로컬 파일 검사로 대신하지 않는다.

[구체 공개 배포 검토안](../../docs/deployment/WEB-RELEASE-REVIEW-2026-09-18.md)을 따른다. 이미 적용한 DB SQL 재실행·DB 초기화·Studio 관리자 인증 제거는 필요하지 않다.

## NAS에서 준비한 라우터 후보

prepare-envoy.py는 현행 LDS/CDS를 읽어 private 후보만 생성하며 활성화하거나 라우터를 재시작하지 않는다. 2026-09-18 NAS의 /opt/supabase/backups/haru-web-prepared-20260918/에 후보와 원본 백업·review.json을 생성했다. 마지막 루트 404만 haru_web으로 바꾸고 haru-web:8080 upstream을 추가하며 기존 7개 upstream과 관리/API 경로 설정은 유지했다. activated:false를 확인했다.

전환 전에 review.json의 sourceHashes와 현행 파일을 비교하고 후보 해시도 확인한다. 차이가 나면 최신 현행 설정에서 다시 검토한다. 후보 준비는 운영 설정 검증이나 실제 전환을 완료했다는 뜻이 아니다.
