# HaruLeaf / Haru

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

백엔드는 기존 NAS Supabase를 사용하며 앱은 공개 anon으로 제한된 DB 함수를 직접 호출한다. 관리 비밀키를 앱에 설정하는 이전 방식은 취소했다. NAS 0001~0009 적용(16개 테이블, 스냅샷 버전 6)과 실제 조회/롤백 검사를 완료했다. 사용자 승인 공개 예시의 NAS 영속 저장·새 SDK 재접속·앱 새로고침·집계/근거·내보내기를 검증했다. 루틴 생성·예외·중단·복원과 삭제된 계획의 실행 이력 보존을 구현했다. 48개 테스트와 정적 빌드/제공 검사를 통과했다. 최신 구현은 [codex/plan-task-fields](https://github.com/suminkim8203/haru-journal/tree/codex/plan-task-fields/web)에 있다. 공개 웹 배포와 main 통합은 아직이다. [현재 상태](docs/CURRENT_STATE.md), [구현과 검증](docs/implementation/SUPABASE-BACKEND-2026-09-18.md).

- [루틴·이력 구현 및 검증](docs/implementation/ROUTINES-AND-HISTORY-2026-09-18.md)
- [공개 웹 배포 검토안](docs/deployment/WEB-RELEASE-REVIEW-2026-09-18.md)
