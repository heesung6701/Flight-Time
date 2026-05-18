# Flight Time Test Harness

이 폴더는 `flighttime_web_prd.md`의 계산 요구사항을 코드로 검증하기 위한 하네스 영역이다.

## 기준

- 입력 fixture는 CPS `original` 형식의 TSV/XLSX에서 만든다.
- 계산은 `src/core/flighttime-core.js`만 대상으로 검증한다.
- UI는 코어 결과를 표시하는 레이어로 취급한다.

## 커버해야 하는 회귀 항목

1. `original` 파싱 및 `계` 합계 행 제거
2. Duty `O`, `EX`, `2F` 제외
3. A/C No -> aircraft type 매핑
4. 미등록 항공기 탐지
5. `0xxx`, `1xxx` 짝수 편명 예외 규칙
6. DAY/NIGHT T/O/L/D 분류
7. CONDITION DAY/NIGHT, ACTUAL INST., B/T, F/O 계산
8. 19행 페이지 배정
9. PAGE/PREVIOUS/NEW TOTAL 계산
10. 기존 엑셀 output과 페이지 단위 비교

## 실행

```bash
npm test
```

## 보안 원칙

- 실제 `original` 데이터, 실제 항공기 등록번호, 개인 비행기록에서 추출한 회귀 fixture는 GitHub에 커밋하지 않는다.
- 공개 repo의 fixture는 합성 데이터만 사용한다.
- 실제 엑셀 비교는 로컬 전용 fixture 폴더에서만 실행한다.

## 다음 단계

- 로컬 전용 fixture 디렉터리를 만들고 `.gitignore`에 유지한다.
- 브라우저 UI 스모크 테스트를 추가해 paste -> render -> totals 표시 흐름을 검증한다.
