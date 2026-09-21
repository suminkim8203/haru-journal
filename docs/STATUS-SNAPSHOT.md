# 현재 상태 요약

요약: 공개 배포·DB 저장·두 DB 복구·VM 재부팅 자동 복구를 검증했고, 사용자가 할당한 HDD 100GB를 자동 백업 저장소로 적용했다. 외부 장비 복제는 아직이다.

- 공개: https://haruleaf.com/ · release approved-1cd31cf9a6ff.
- 소스: main에 0a98d3b 통합·원격 반영.
- 실제 DB: NAS SQL 0001–0010·snapshot 6·공개 RPC 3개.
- [제출문](submission/T06-SUBMISSION.md) · [최종 확인과 한계](submission/FINAL-CHECK-2026-09-21.md).
- 남은 운영 단계: 외부/별도 장비 백업 장소 결정. VM 정상 재부팅 검사는 완료.


## 2026-09-21 운영 검증 완료

요약: 공개 배포·GitHub main·휴대폰 조회·제출문 확인에 이어 NAS 두 DB 백업과 격리 복구, 정기 백업 첫 실행을 완료했다. 실제 VM 재부팅과 별도 장비 백업은 아직이다. [상세 및 복구 방법](deployment/BACKUP-RESTORE-2026-09-21.md). Tailscale 로그인 대기는 해소됐다. 매일 04:10~04:15 KST 백업, 16개 앱 테이블 및 내부 DB 5개 테이블 대조 통과. 재부팅 시험은 서비스 중단 시점 확인 후 진행한다.


## 2026-09-21 실제 재부팅 후속 완료

사용자 승인 후 Ubuntu VM 정상 재부팅을 수행했다. 서비스 12개 healthy, 16개 테이블 동일, 공개 파일 23개 일치, 관리자 보호·내보내기·자동 백업 예약 정상. [검증 근거](deployment/REBOOT-VERIFICATION-2026-09-21.md). 위 이전 단계의 재부팅 미실행/시간 확인 대기는 이 결과로 해소됐다.


## HDD 백업 적용 — 2026-09-21

새 자동 백업은 /backup/haru-operations에 저장한다. 기존 운영 디스크 백업 36개 파일 복사·해시 확인, 새 HDD 백업 생성·두 DB 격리 복구·앱 16개 테이블 대조 통과. HDD 미연결/UUID 불일치 시 운영 디스크 대체 저장 차단. [현재 백업 구성](deployment/HDD-BACKUP-2026-09-21.md). 같은 NAS 안의 별도 HDD이며 외부 장비 복제와 구분한다.
