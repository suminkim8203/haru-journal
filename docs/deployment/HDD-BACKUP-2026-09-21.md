# HDD 100GB 백업 적용

요약: 사용자가 할당한 HDD 저장소의 100GiB 디스크를 실제 백업 위치로 적용했고, 새 HDD 백업 생성과 격리 복구까지 검증했다. 기존 운영 디스크 백업은 삭제하지 않았다.

## 실제 구성

- Proxmox VM의 scsi0은 운영 NVMe 100G, scsi1은 HDD 저장소의 100G로 확인했다. Ubuntu에서 scsi1은 ext4 파일시스템으로 이미 /backup에 마운트되어 있었다. 포맷/파티션 변경 없음.
- 현재 백업 위치: **/backup/haru-operations**. 이전 /opt/supabase/backups/haru-operations는 보존본이며 새로운 예약 백업 목적지가 아니다.
- 기존 파일 36개를 복사한 뒤 모든 파일 SHA-256 비교 통과. 원본 백업과 이관 전 스크립트/설정 보존.
- /etc/fstab의 기존 /backup 항목을 확인하고 유지했다. 임의로 디스크를 초기화하거나 재부팅하지 않았다.
- 서버의 /etc/haru-backup.json에 마운트 위치·실제 파일시스템 UUID·백업 디렉터리를 저장한다. 설정 파일은 600, 백업 디렉터리는 700. [설정 예시](../../infra/operations/haru-backup.example.json)는 실제 서버 설정으로 덮어쓰는 파일이 아니다.
- /usr/local/lib/haru-operations/backup.py 설치본과 [저장소 사본](../../infra/operations/backup.py)의 해시가 일치한다.
- 매일 한국 시간 04:10 + 최대 5분 자동 백업 유지. 현재 예약 active. 이번 관찰의 다음 예약은 2026-09-22 04:10:01 KST.

## 잘못된 저장 위치 차단

- systemd RequiresMountsFor=/backup과 ExecStartPre mountpoint 검사. [실제 drop-in과 같은 내용](../../infra/operations/haru-backup-hdd.conf).
- Python에서도 실제 독립 마운트 여부, 운영 파일시스템과의 분리, UUID, 목적지가 마운트 아래인지 검사한다. HDD가 연결되지 않았을 때 /backup 폴더를 운영 디스크 위에 만들어 저장하는 방식으로 대체하지 않는다.
- 틀린 UUID 설정과 마운트가 아닌 경로 설정으로 검사해, 쓰기 전에 실패하는 것을 확인했다. 실제 HDD를 분리/언마운트하는 장애 시험은 하지 않았다.
- 여유 공간 5GiB 미만 중단, 기존 백업 자동 삭제 없음, 실행 실패는 systemd에 기록. 외부 실패 알림은 미구성.

## 실제 검증

- 새 백업: /backup/haru-operations/20260921T010929Z, 약 9.58MB. 생성 Result=success, 파일 해시 정상, 전후 자료 revision 32 동일.
- postgres 및 _supabase 두 DB를 네트워크 없는 별도 컨테이너에 복구: 종료 코드 모두 0.
- 앱 16개 테이블 전체 행과 수정 이력 동일. snapshot은 태그 순서 정규화 후 전체 동일. 공개 함수 권한/비공개 스키마 경계 유지. 검사 컨테이너 중지.
- 운영 사이트 23개 파일 해시·자료 조회·내보내기·관리자 보호 재확인. 앱 재배포/자료 수정 없음.
- HDD 여유 약 96.8GiB. 실제 VM 할당은 100GiB이며 파일시스템 관리 영역과 예약 공간 때문에 가용량은 더 작다.

## 운영과 복구

백업 경로 검사(백업 생성 없음):

```sh
sudo python3 /usr/local/lib/haru-operations/backup.py --check-destination
sudo systemctl status haru-backup.timer
sudo systemctl show haru-backup.service -p Result
```

새 백업 수동 실행은 sudo systemctl start haru-backup.service. 백업 해시와 복구 검사 방법은 [백업·복구 기록](BACKUP-RESTORE-2026-09-21.md)을 따른다. 복구 검사 스크립트는 새 HDD 경로와 이전 보존 경로를 모두 허용한다. 설정/백업의 실제 비밀값은 Git에 올리지 않는다.

## 범위와 한계

운영 디스크와 다른 HDD 저장소에 사본을 두었지만 같은 NAS/Proxmox 안의 디스크다. 장비 전체 손상·도난·관리 권한 침해까지 대비하는 외부 장비/오프사이트 복제는 아니다. 호스트 HDD 미러 자체의 장애 복구는 이번 앱 작업에서 검증하지 않았다. 이번 경로 변경 후 재부팅은 수행하지 않았으며, 기존 마운트 설정·현재 실제 마운트·의존성과 목적지 차단 검사를 확인했다. 미래 예약 시각의 실행 자체는 아직 관찰하지 않았다.

근거: [HDD 검증 JSON](hdd-backup-verification-2026-09-21.json).
