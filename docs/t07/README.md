# T07 — 인증과 5일 사용

요약: T06에 이어 인증·계정별 접근 통제·검증 증거·실제 5일 기록을 추가한다. 2026-09-22 실제 서비스를 개인 계정 방식으로 전환했으며 사용자가 기존 자료 조회를 확인했다. 계정 간 접근 차단·로그아웃 후 재사용 거절을 실제 HTTP로 검증했다. 남은 기능·증거와 5일 사용은 진행 중이다.

- [작업 RULE](RULE.md): 사용자가 제공한 T07 지시문의 요구사항 요약. 원문 전문 복제본이 아니며 번호 기준을 유지한다.
- [인증·화면·온보딩 제안](AUTH-AND-ONBOARDING-PROPOSAL.md): 확정된 방향과 이번 승인 대기 세부안을 구분한다.
- [실제 Auth 설정 조회](auth-readonly-2026-09-21.json): 버전 및 비밀이 아닌 설정만 기록. 메일 발송 확인은 미완료.
- [T06 기준](T06-BASELINE.md): 제출 당시 소스 이력 보존.

다음: 남은 보안 증거·계정 관리 기능 → 실제 5일 사용과 규칙 변경 → 최종 제출 대조. [최신 진행 기록](IMPLEMENTATION-PROGRESS.md), [실제 HTTP 증거](evidence/private-http-2026-09-22.json)를 기준으로 판단한다. 아래 시안 링크는 설계 이력이다.


- [승인 정책·예외 계약](AUTH-FLOW-CONTRACT.md)
- [독립 인증 시안 01](studies/Haru-auth-study-01.html) — 실제 인증 없음, 시각 검토 대기

- [코치마크 시안과 범위](ONBOARDING-COACHMARK-STUDY.md) — 2026-09-22, 독립 검토용

- [승인 안내 실제 적용](../implementation/APPROVED-GUIDE-2026-09-22.md) — 공개 앱 수동 안내, 가입 후 자동 실행은 후속

- [7일 탈퇴 정책·실제 적용](ACCOUNT-DELETION.md)
