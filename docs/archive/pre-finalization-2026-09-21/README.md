# HaruLeaf / Haru



## 2026-09-18 확인한 디자인 배포 완료

요약: 현재 공개 앱은 approved-bf7699862b88이다. 확인한 3217 디자인의 정적 파일 23개와 공개 파일이 동일하다. 이전 미배포/87f1c7e 문장은 당시 기록이다. 새로운 일정 피드백은 제안 상태로 분리한다. 최신 근거: [배포 검증](docs/deployment/APPROVED-UI-RELEASE-2026-09-18.md).



## 2026-09-18 승인 화면 복원 후속 기록

요약: 이전 React 앱은 공개됐지만 최종 승인 시안과 달라 사용자가 작업 중단·복원을 요청했다. 현재 복원 후보는 로컬 3217이며 공개 사이트에는 아직 반영하지 않았다. 새 배포 완료 또는 사용자 화면 확인 완료로 해석하지 않는다.

[문서 전체 재검토](docs/reviews/MD-REREAD-2026-09-18.md) · [차이와 복원·검증 한계](docs/reviews/APPROVED-DESIGN-RESTORATION-2026-09-18.md). 원본 승인 기준은 Haru-design-study-05.html이며 승인 스타일을 직접 옮겼다. 공개 재배포 전 실제 복원 후보를 확인하고 기능 누락·검증 한계를 해결한다.

요약: Plan → Do → See로 계획과 실행 시간을 연결하고 하루를 회고하는 다이어리 프로젝트입니다. 일반 표기는 **Haru**, 가장 큰 제호는 **HaruLeaf**를 사용합니다.

- [프로젝트 문서 시작점](docs/README.md): 설계·디자인·개발·배포·변경 기록 전체 목차
- [현재 구현 상태](docs/STATUS-SNAPSHOT.md): HTML 시안, React 앱, NAS 설치, DB 연결, 공개 제품 배포 구분
- [과제 작업 RULE](docs/T06-ASSIGNMENT-RULE.md): 사용자 지정 더미 허용 예외 및 나머지 필수 기준
- [승인 디자인 기준](docs/design/DESIGN-BASELINE.md): 서체·여백·색·화면 구성
- [다음 진행과 사용자 할 일](docs/implementation/NEXT-STEPS.md)
- [앱 개발 안내](web/README.md)

## 저장소와 작업 위치

기본 작업 폴더는 D:/workspace/haru-journal입니다. 기존 T06-palndosee의 설계 문서를 주제별로 정리했습니다. 현재 main의 앱은 초기 준비 화면입니다. 첫 저장 기능 소스는 [feat/persistent-plans](https://github.com/suminkim8203/haru-journal/tree/feat/persistent-plans/web)에 있으며, 문서 정리를 이유로 기능 코드를 main에 합치지 않습니다.

HTML 시안·이미지·압축 아카이브·작업용 코드와 실제 환경 설정 값은 이번 문서 업로드에 포함하지 않습니다. 시안별 위치와 상태는 [자료 목록](docs/ARTIFACT-CATALOG.md)에 기록합니다. Markdown만으로 실행 화면을 재현했다고 설명하지 않습니다.

## 최신 구현 상태 — 2026-09-18

백엔드는 기존 NAS Supabase를 사용하며 앱은 공개 anon으로 제한된 DB 함수를 직접 호출한다. 관리 비밀키를 앱에 설정하는 이전 방식은 취소했다. NAS 0001~0009 적용(16개 테이블, 스냅샷 버전 6)과 실제 조회/롤백 검사를 완료했다. 사용자 승인 공개 예시의 NAS 영속 저장·새 SDK 재접속·앱 새로고침·집계/근거·내보내기를 검증했다. 루틴 생성·예외·중단·복원과 삭제된 계획의 실행 이력 보존을 구현했다. 48개 테스트와 정적 빌드/제공 검사를 통과했다. 최신 구현은 [codex/plan-task-fields](https://github.com/suminkim8203/haru-journal/tree/codex/plan-task-fields/web)에 있다. 이전 화면은 공개됐으나 승인 시안과 달라 복원 중이며 main 통합은 아직이다. [현재 상태](docs/CURRENT_STATE.md), [구현과 검증](docs/implementation/SUPABASE-BACKEND-2026-09-18.md).

- [루틴·이력 구현 및 검증](docs/implementation/ROUTINES-AND-HISTORY-2026-09-18.md)
- [공개 웹 배포 검토안](docs/deployment/WEB-RELEASE-REVIEW-2026-09-18.md)


## 2026-09-18 승인 시안 복원 및 실제 DB 보완

요약: 최종 승인 Haru-design-study-05.html의 실제 스타일 13개와 화면 구획을 React에 복원했다. 로컬 후보는 http://127.0.0.1:3217/ 이며 공개 https://haruleaf.com/ 은 이전 87f1c7e 화면이다. 이번 후보를 공개 재배포하지 않았다.

공식 Markdown 121개를 다시 읽고 차이를 기록했다. NAS에 0010_improvement_edits.sql까지 적용했다. snapshot 6·테이블 16개·공개 RPC 3개는 유지하며, 가져온 개선점의 독립 수정과 수정 이력을 복구했다. 수정 본문은 원본 문구·원본/대상 계획 연결·중복 판정 키를 바꾸지 않는다. snapshot의 improvementEditing=true로 실제 지원을 확인한다.

적용 전 백업: NAS /opt/supabase/backups/approved-design-recovery-20260918/. 기존 snapshot을 새 선택 필드 제외 후 비교하여 동일함을 확인했고 revision은 15→15였다. anon 권한의 생성/수정 검증은 트랜잭션 rollback으로 영속 자료를 남기지 않았다. 비공개 함수 경계도 유지했다. SDK 읽기 재검증: 계획 1·할 일 5·실행 3·단상 1·회고 1·개선점 0. 관리자 키를 앱에 이전하지 않았다.

타입·정적 빌드·50개 테스트를 통과했다. 데스크톱 1280px/모바일 390px에서 실제 화면과 완료 상태 제한 등을 확인했다. 원본 file URL 접근 제한 때문에 자동 픽셀 비교는 완료하지 못했다. 전체 폰트 로딩·별도 기기·활성 기록 드래그의 이번 브라우저 전수 검증은 완료로 기록하지 않는다.
