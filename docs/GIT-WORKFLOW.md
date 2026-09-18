# Git·GitHub 작업 기준

요약: 기존 변경을 보존하고 기능별 브랜치에서 검사 후 PR로 main에 통합합니다. 기본 폴더와 GitHub 반영 상태를 구분합니다.

- 공개 저장소: https://github.com/suminkim8203/haru-journal. 기본 폴더 D:/workspace/haru-journal, 앱 web/.
- 새 작업 브랜치는 codex/ 접두사를 기본으로 사용합니다. 기존 feat/persistent-plans는 첫 저장 소스이며 자동으로 main과 같다고 취급하지 않습니다.
- 환경 변수/키/로그/node_modules/.next/작업 임시 자료는 추적하지 않습니다. 변경 파일을 명시해서 스테이징합니다.
- 다른 작업의 미커밋 지침/인계/목차를 동의 없이 함께 커밋하지 않습니다. 로컬 저장·커밋·push·PR·main 통합을 각각 보고합니다.
- 현재 운영 연결은 기존 NAS 인계를 따릅니다. 이전 Vercel Root Directory 제안은 새 배포 지시가 아닙니다.
- 문서 정리로 기능 코드/DB를 자동 통합·변경하지 않습니다. 현재 구현과 검사 결과는 [현재 상태](CURRENT_STATE.md)에 기록합니다.

[다음 작업](implementation/NEXT-STEPS.md) · [NAS 인계](deployment/SUPABASE-DEVELOPMENT-HANDOFF.md)
