# Flight-Time

Flight Time Logbook은 CPS `original` 비행 로그 데이터를 logbook 출력 형식으로 변환하는 정적 웹앱입니다.

업로드한 비행 데이터는 브라우저 안에서만 처리되며, 서버로 전송하지 않습니다.

## 로컬 실행

```bash
python3 -m http.server 4173
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4173
```

## 테스트

```bash
npm test
```

## 항공기 타입 맵 업데이트

앱은 기본 항공기번호 -> 항공기 타입 맵을 아래 파일에서 불러옵니다.

```text
data/aircraft-types.json
```

비개발자는 이 JSON 파일을 직접 수정하지 말고 GitHub Issue를 만들어 업데이트를 요청하면 됩니다. Issue가 생성되면 GitHub Actions가 내용을 읽어 자동으로 JSON을 수정하고 커밋합니다.

### 항공기 타입 추가 또는 수정

1. GitHub 저장소에서 `Issues` 메뉴를 엽니다.
2. `New issue`를 누릅니다.
3. `Aircraft type map update` 템플릿을 선택합니다.
4. `Change type`을 `Add or update registrations`로 선택합니다.
5. `Aircraft type map` 칸에 한 줄에 하나씩 `항공기번호 타입`을 입력합니다.

예시:

```tsv
HL8513 B73M
HL8737 B738
HL8211 A332
```

6. 이슈를 생성합니다.

자동화가 실행되면 `data/aircraft-types.json`이 업데이트되고, 변경 커밋이 생성됩니다. 완료 후 이슈 댓글에 추가/수정/삭제 내역과 최종 맵이 남고 이슈가 닫힙니다.

### Config 팝업 익명 요청

Vercel 배포에서는 Config 팝업의 `DB 업데이트 요청` 버튼이 `/api/aircraft-type-issue` 서버리스 함수로 익명 요청을 보냅니다. 이 함수가 GitHub Issue를 만들려면 Vercel project 환경변수에 `GITHUB_ISSUE_TOKEN`을 설정해야 합니다.

토큰은 GitHub fine-grained personal access token을 권장합니다.

- Repository access: `heesung6701/Flight-Time`
- Repository permissions: `Issues: Read and write`

토큰이 없거나 API 요청이 실패하면 앱은 기존처럼 GitHub Issue 작성 화면을 새 탭으로 엽니다.

### 항공기 타입 삭제

1. GitHub 저장소에서 `Issues` 메뉴를 엽니다.
2. `New issue`를 누릅니다.
3. `Aircraft type map update` 템플릿을 선택합니다.
4. `Change type`을 `Delete registrations`로 선택합니다.
5. `Aircraft type map` 칸에 삭제할 항공기번호만 한 줄에 하나씩 입력합니다.

예시:

```tsv
HL8513
HL8514
HL8579
HL8580
```

타입은 입력하지 않습니다.

6. 이슈를 생성합니다.

자동화가 실행되면 해당 항공기번호가 맵에서 삭제됩니다. 완료 후 이슈 댓글에 삭제 내역과 최종 맵이 남고 이슈가 닫힙니다.

### 처리 결과 확인

자동화가 끝나면 이슈 댓글에서 결과를 확인할 수 있습니다.

댓글에는 다음 내용이 표시됩니다.

- 변경 커밋 링크
- 추가된 항공기번호
- 수정된 항공기번호
- 삭제된 항공기번호
- 최종 항공기 타입 맵

변경할 내용이 이미 반영되어 있으면 새 커밋을 만들지 않고 “already up to date” 댓글만 남깁니다.

## GitHub Pages 배포

이 저장소는 `.github/workflows/pages.yml` GitHub Actions workflow로 GitHub Pages에 배포됩니다.

배포 절차:

1. `main` 브랜치에 변경사항을 push합니다.
2. GitHub 저장소의 `Settings -> Pages`로 이동합니다.
3. `Source`를 `GitHub Actions`로 설정합니다.
4. workflow가 테스트를 실행한 뒤 정적 사이트를 배포합니다.

예상 Pages 주소:

```text
https://heesung6701.github.io/Flight-Time/
```

## Vercel 배포

Vercel 배포 주소:

```text
https://flight-logbook-five.vercel.app/
```

이 저장소는 Vercel에서 GitHub repository를 import해 자동 배포합니다. 별도 GitHub Actions Vercel workflow는 필요하지 않습니다. Vercel project 설정은 `vercel.json`에 고정되어 있습니다.

```text
Build Command: npm run build:pages
Output Directory: dist
```

환경변수는 필요하지 않습니다.

## 참고

- 이 앱은 정적 웹앱이며 브라우저에서 실행됩니다.
- 업로드한 비행 데이터는 브라우저 로컬에서 파싱됩니다.
- `original` 데이터가 주요 비행 로그 입력입니다.
- `data/aircraft-types.json`은 공통 기본 항공기 타입 config입니다.
- 앱의 `Config` 팝업에서 브라우저별 local override를 입력할 수 있습니다.
