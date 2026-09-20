# HaruLeaf / Haru

요약: 승인된 Haru 디자인과 일정 사용성 수정을 구현·배포했고 2026-09-21 사용자 화면 확인을 받았다. 현재 공개 release는 approved-1cd31cf9a6ff이며 제출·운영 검증을 마무리하는 단계다.

[서비스 열기](https://haruleaf.com/) · [현재 상태](docs/CURRENT_STATE.md) · [문서 목차](docs/README.md) · [제출 자료](docs/submission/T06-SUBMISSION.md)

계획·할 일·일정 배치와 실제 실행을 연결하고 단상·회고를 남기는 Plan–Do–See 다이어리다. React/Next.js 정적 앱이 NAS의 Supabase 공개 anon SDK와 제한된 DB 함수를 사용한다. 관리자 비밀키를 앱에 넣지 않는다. T06은 로그인 없는 공개 단일 다이어리이며 남이 봐도 괜찮은 자료만 입력한다.

## 개발

web 폴더에서 npm ci 후 .env.example에 따라 Git 제외 .env.local을 설정한다. npm run dev로 개발, npm test로 기능 검증, npm run build:static으로 배포 파일을 만든다. 자세한 방법은 [앱 개발 안내](web/README.md).

## 승인 기준과 검증

- [과제 RULE](docs/T06-ASSIGNMENT-RULE.md): 예시·더미 허용 외 나머지 필수 기준 유지.
- [현재 디자인 기준](docs/design/CURRENT-3217-DESIGN-BASELINE.md): 승인된 제호 좌측 정렬·무채색·기존 서체와 기능 유지.
- [일정 수정 및 검증](docs/implementation/SCHEDULE-USABILITY-2026-09-18.md): 53개 검사, 데스크톱/모바일, 배포 파일 23개 일치.
- [실제 배포 기록](docs/deployment/SCHEDULE-RELEASE-2026-09-18.md), [남은 검증](docs/implementation/NEXT-STEPS.md).

최신 구현은 이 저장소의 소스를 기준으로 한다. 초기 시안/인계 당시 상태는 [과거 안내 보관본](docs/archive/pre-finalization-2026-09-21/README.md)에 보존했다.
