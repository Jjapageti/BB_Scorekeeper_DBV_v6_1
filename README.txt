BB Scorekeeper DBV v6.1 - Local Live Prototype
================================================

Node.js / npm 필요 없음.

실행:
  cd "C:\Users\Seokhyun.Choi\Desktop\개인\BB_Scorekeeper_DBV_v6_1"
  py -m http.server 8000

Scorer:
  http://localhost:8000/

Live:
  http://localhost:8000/live.html

또는 Scorer 상단의 ● LIVE 버튼을 누르면 새 탭으로 열립니다.

v6.1 추가:
- 기존 v6 자동 타격통계 유지
- Live 화면 추가
- 현재 이닝 / TOP·BOTTOM 표시
- 아웃카운트 표시
- 현재 1B / 2B / 3B 주자 표시
- 현재 타자 표시
- Guest / Home 점수 표시
- 최근 12개 Play-by-Play 표시
- Line Score 표시
- Scorekeeper가 localStorage와 Firebase Realtime Database에 저장하면 Live 화면이 실시간 갱신
- Quick Scoring 패널에서 타석 결과를 빠르게 입력 가능
- 빠른 입력이 주자 이동을 필요로 하면 자동으로 상세 입력창을 열어 보완 가능
- Firebase Realtime Database 주소와 공개 테스트 규칙 설정이 필요

현재 제한:
- 아직 한 팀 Scoresheet 기반이라 완전한 Home/Away 양쪽 Game State는 아님
- 영상 Live 없음
- 온라인 서버/WebSocket 없음 (같은 브라우저의 localhost용 prototype)
- 투수 현재 상태는 아직 자동 추적하지 않음
