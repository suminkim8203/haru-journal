# 승인 일정 수정 배포

요약: 승인한 일정 사용성 수정과 월간 간략 목록을 https://haruleaf.com/ 에 배포했다. release approved-1cd31cf9a6ff, 정적 파일 23개 해시 일치·53개 기능 검사·빌드·공개 조회/내보내기 검증을 통과했다.

- 공개 주소: https://haruleaf.com/
- release: approved-1cd31cf9a6ff
- 이전 release: approved-bf7699862b88 (복구용 보존)
- archive SHA-256: 65cdec88a88bc743e74315b303865357c04d283c4e5a1b26a5699c073a88ba79
- HTML SHA-256: bd3a5fcae72507cc7b29af99964f38a66d1240f1417957dfd0a37d766b1be17f
- base revision: 87f1c7e6e70731ab3a6322c2c591a719c793ad60. 변경된 작업 트리에서 빌드했으며 이 commit 자체가 배포 소스와 동일하다는 의미가 아니다. Git commit/push는 이번 작업에서 수행하지 않았다.
- 기존 NGINX 이미지 digest·Supabase 라우팅·DB 자료·관리자 보호를 보존했다. 내부/공개 HTML 일치와 상태 검사가 통과했다.
- 환경/서버 키·관리 비밀번호를 패키지에 넣지 않았다. 빌드된 JWT 역할은 공개용 anon만 있으며 비밀 키 탐지 0개.

[구현과 검증 한계](../implementation/SCHEDULE-USABILITY-2026-09-18.md) · [공개 해시/API 검사](schedule-public-verification-2026-09-18.json).
