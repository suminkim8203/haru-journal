# Git 및 GitHub 운영

공개 저장소: https://github.com/suminkim8203/haru-journal

- 실제 앱은 web/. 기능별 브랜치 → 검사 → PR 검토 → main 통합.
- 실제 환경 변수, node_modules, .next, 로그는 추적하지 않습니다. .env.example은 빈 이름 예제만 유지합니다.
- 기존 시안/압축 아카이브/작업용 임시 파일 전체를 공개하지 않습니다. 변경 파일을 명시해서 스테이징합니다.
- Vercel의 Root Directory는 web로 설정할 예정입니다. 실제 배포는 아직 연결하지 않았습니다.
- 현재 구현 및 검증 상태는 CURRENT_STATE.md, 제품 계약은 IMPLEMENTATION-DECISIONS.md와 DATA-CONTRACT-v1.md를 참고합니다.
