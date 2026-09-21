# NAS 백업·복구 검증

요약: 2026-09-21 실제 NAS에서 두 DB 백업·격리 복구·자료 대조·정기 백업 첫 실행을 완료했다. 운영 DB를 덮어쓰거나 앱을 재배포하지 않았다. 실제 VM 재부팅은 아직 실행하지 않았다.

## 확인한 결과

- 앱/Supabase 컨테이너 12개 healthy, 재시작 정책 unless-stopped. Docker/Tailscale enabled·active.
- 최초 백업 이후 매일 실행할 동일 service로 새 백업 생성. 최신 백업 `/opt/supabase/backups/haru-operations/20260921T003409Z`, 약 9.56MB. postgres와 _supabase DB, DB 역할, 앱 공개 함수, 운영 설정, Storage 파일 경로, 웹 배포 파일, 컨테이너 구성 보존.
- 동일 운영 DB 이미지로 네트워크 none·공개 포트 없음·메모리 512MiB·CPU 0.5의 별도 검사 컨테이너에 두 DB 복구. 두 pg_restore 종료 코드 0.
- journal 16개 테이블의 모든 행 내용과 수정 이력·요청 영수증을 비교해 일치. 내부 _supavisor 5개 테이블도 일치.
- 계획 2 / 할 일 6 / 예정 3 / 실행 5 / 단상 1 / 회고 1. revision 32 유지. 기존 사용자 자료를 변경하지 않았다.
- anon 공개 조회/명령 함수 권한과 비공개 journal 스키마 직접 접근 차단 확인.
- snapshot은 태그 나열 순서에 차이가 있다. 태그 ID로 정렬했을 때 전체 내용이 같고, 실제 테이블의 행 해시도 같다. UI 태그 순서까지 동일한 복구라고 주장하지 않는다. 태그 순서 고정은 별도 개선 후보이며 이번 작업에서 UI/SQL 변경 없음.
- 모든 백업 파일 SHA-256 일치, 설정 압축 파일 전체 읽기 성공. 백업 디렉터리 700, 파일은 그룹/기타 접근 없음. 실제 비밀 설정·DB 내용은 NAS 제한 경로에만 보관하며 Git에는 포함하지 않는다.
- 검사 컨테이너는 모두 중지했으며 조사/복구 자료는 보존했다. 자동 삭제는 추가하지 않았다.

## 정기 백업

- 서비스: `haru-backup.service` / 예약: `haru-backup.timer`.
- 매일 한국 시간 04:10 + 최대 5분 분산. Persistent=true로 놓친 예약을 서버 시작 후 보충한다.
- 타이머 enabled·active, 같은 service의 실제 첫 실행 Result=success. 다음 예약은 2026-09-22 04:10:49 KST로 확인했다. 미래 예약 실행 자체는 아직 관찰하지 않았다.
- 실행 스크립트: `/usr/local/lib/haru-operations/backup.py`. [저장소 사본](../../infra/operations/backup.py)은 설치본 SHA-256과 일치한다.
- 동시 실행 잠금, 낮은 CPU/I/O 우선순위, 30분 제한. 여유 공간 5GiB 미만이면 실패 처리하며 기존 백업을 삭제하지 않는다. 현재 여유 약 68.2GiB.
- 실패는 systemd 상태/로그에 남는다. 외부 이메일·메신저 알림이나 별도 장비 복제는 구성하지 않았다.

관리 콘솔에서 확인:

```sh
sudo systemctl status haru-backup.timer
sudo systemctl show haru-backup.service -p Result
sudo journalctl -u haru-backup.service -n 30 --no-pager
sudo systemctl start haru-backup.service
```

## 복구 방법과 검증 범위

1. 복구할 백업 디렉터리의 backup-report.json과 파일 해시를 확인한다. 원본 백업을 수정하지 않는다.
2. 원본 DB의 초기 관리자 역할(OID 10)을 동일하게 사용한다. PostgreSQL 17에서는 다른 초기 역할로 pg_dumpall 역할 복구 시 GRANTED BY 권한 오류가 생겼다. 운영 역할/권한을 느슨하게 바꿔 우회하지 않았다.
3. 동일 이미지, 외부 네트워크 없는 새 컨테이너를 만든다. pg_stat_statements와 pg_net을 사전 로딩한다. pg_net 누락 시 전체 복구 오류 3건이 발생했으며 설정을 보완한 최종 시험은 오류 0건이다.
4. 역할 덤프와 postgres, _supabase 덤프를 복구하고 anon snapshot, 내부 경계, journal 모든 행과 수정 이력을 비교한다. [검사 스크립트](../../infra/operations/restore-check.py)는 명시한 백업을 새 검사 컨테이너에만 복구한다. 운영 DB 복구 명령이 아니다. 실행 시 현재 운영 자료가 백업 이후 변경됐다면 현재 자료와의 대조는 차이를 보고하므로 이를 백업 손상으로 단정하지 않는다.
5. 검사 컨테이너를 중지하고 근거를 보존한다. 운영으로 전환하는 복구는 별도 중단 시간·대상 확인 후 수행해야 한다.

## 아직 검증하지 않은 것

- VM 실제 재부팅 후 앱/API/관리자 보호·자료 자동 복원: 중단 시간 확인 필요.
- 새 장비에서 Supabase 모든 서비스를 다시 구성하는 재난 복구. 이번 결과는 두 DB 복구와 설정 파일의 보존/읽기 검증이며 전체 플랫폼 재구성 완료가 아니다.
- NAS 자체 디스크 손실에 대비한 다른 장비/외부 저장소 복제. 현재 백업은 같은 NAS에 있다.
- 외부 Caddy/Proxmox 호스트 전체 설정·인증서·VM 디스크 이미지·Docker 이미지 자체의 오프라인 보존은 이번 백업 범위에 포함하지 않았다.
- Storage 객체와 Auth 사용자는 현재 모두 0개다. 파일 업로드와 사용자 로그인은 앱 미사용 기능이므로 실제 비어 있지 않은 Storage/Auth 복구 흐름을 검증했다고 하지 않는다. 두 DB 덤프는 각각 일관된 스냅샷이며 DB와 파일 전체를 하나의 원자적 시점으로 보장하지 않는다.

근거: [검증 JSON](operations-verification-2026-09-21.json), [PostgreSQL 초기 관리자 역할 복구 논의](https://www.postgresql.org/message-id/CA%2BC_kKWHMP4c56jx1BPvP1jmjp2pmBu0Cw07fPVECUmkJSnT4w%40mail.gmail.com).
