# Git 및 GitHub 운영

로컬 Git 저장소를 main 브랜치로 초기화했습니다. GitHub 원격 저장소는 아직 연결하지 않았습니다.

- 실제 앱: web/. 승인 시안: outputs/T06-flow-v2.24.html. 결정 기록: docs/IMPLEMENTATION-DECISIONS.md.
- .env 실제 값, node_modules, .next, 로그는 추적하지 않습니다. .env.example만 빈 이름 예제로 추적합니다.
- 기능별 브랜치 → 검사 → PR 검토 → main 통합을 기준으로 합니다. GitHub 계정/저장소가 정해진 뒤 원격 연결합니다.
- Vercel 프로젝트 Root Directory는 web로 설정할 예정입니다. PR 검토용 배포와 운영 DB는 분리합니다. 실제 배포 연결은 미구현입니다.
- 기존 시안 아카이브/zip 전체를 무조건 공개 저장소에 올리지 않습니다. 추적할 파일과 비밀값 포함 여부를 먼저 검토합니다.
- GitHub CLI/연결 도구는 현재 확인되지 않았습니다. 저장소 주소/계정/이름은 사용자 입력 대기 중입니다.
