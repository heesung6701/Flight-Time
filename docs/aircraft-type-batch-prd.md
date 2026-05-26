# 항공기번호 자동 기종 조회 배치 PRD

## 1. 개요

Flight Time 웹사이트는 사용자가 업로드한 CPS `original` 데이터의 `A/C No`를 기준으로 logbook 출력의 `AIRCRAFT TYPE`을 채웁니다. 이 PRD는 웹 logbook 변환 자체가 아니라, 항공기 등록번호를 배치로 수집하고 RapidAPI의 AeroDataBox API를 통해 기종 정보를 자동 보강하는 기능을 정의합니다.

현재 구현 기준 파일:

- `scripts/update-aircraft-types.mjs`
- `.github/workflows/update-aircraft-types.yml`
- `data/aircraft-types.json`
- `src/core/flighttime-core.js`
- `app.js`

## 2. 문제 정의

수동으로 항공기번호별 기종 매핑을 관리하면 다음 문제가 발생합니다.

- 새 항공기번호가 등장할 때마다 사용자가 직접 기종을 찾아 입력해야 합니다.
- 브라우저 localStorage 기반 config는 사용자/브라우저별로 분산되어 일관성이 낮습니다.
- GitHub Pages에 배포되는 기본 DB가 비어 있으면 신규 사용자에게 자동 보정 효과가 없습니다.
- 원본 CPS 데이터의 `Type` 값이 누락되거나 부정확한 경우 logbook 출력의 품질이 떨어집니다.

## 3. 목표

이 기능의 목표는 `data/aircraft-types.json`을 중앙 항공기번호 DB로 사용하고, 기종이 비어 있는 등록번호를 정기 배치로 조회해 기본 config 품질을 높이는 것입니다.

성공 기준:

- 등록번호가 DB에 존재하고 `aircraftType`이 비어 있으면 배치가 AeroDataBox에서 기종 정보를 조회합니다.
- 조회 성공 시 `aircraftType`에는 ICAO 기종 코드가 우선 저장됩니다.
- 조회 실패, 미발견, API 오류 상태가 DB에 기록되어 운영자가 후속 조치를 할 수 있습니다.
- 변경된 DB는 GitHub Actions가 커밋/푸시하여 GitHub Pages 정적 자산으로 배포될 수 있습니다.
- 사용자의 개인 비행 데이터나 원본 spreadsheet는 배치 입력/출력으로 커밋되지 않습니다.

## 4. 비목표

이 PRD의 범위에 포함하지 않는 항목:

- CPS original 파일에서 항공기번호를 자동 추출해 원격 서버에 업로드하는 기능
- 사용자의 개인 비행기록, original spreadsheet, local fixture 저장
- 브라우저 UI에서 RapidAPI를 직접 호출하는 기능
- 항공기 이미지, 항공사 운영 상태, 상세 제원 표시
- logbook 출력 컬럼 계산 로직 변경

## 5. 사용자 및 이해관계자

| 사용자 | 니즈 |
|---|---|
| Logbook 사용자 | 항공기번호만 있어도 가능한 한 정확한 기종이 자동 적용되길 원함 |
| 저장소 운영자 | 기본 항공기 DB를 반복 수작업 없이 최신화하고 싶음 |
| 유지보수자 | API 오류, quota, 미발견 데이터를 추적 가능한 형태로 관리하고 싶음 |

## 6. 주요 사용 시나리오

### 6.1 정기 자동 업데이트

1. 운영자가 `data/aircraft-types.json`에 항공기 등록번호를 추가합니다.
2. 매일 03:10 KST에 GitHub Actions 배치가 실행됩니다.
3. 배치는 `aircraftType`이 비어 있고 `lookup.status`가 `not_found`가 아닌 항목만 후보로 선택합니다.
4. 후보별로 AeroDataBox `GET /aircrafts/reg/{registration}` API를 호출합니다.
5. 성공한 항목은 기종, 모델, source metadata를 DB에 저장합니다.
6. DB 변경이 있으면 Action이 `data/aircraft-types.json` 변경분을 커밋하고 푸시합니다.

### 6.2 수동 등록번호 조회

1. 운영자가 GitHub Actions `workflow_dispatch`를 실행합니다.
2. `registrations` 입력에 쉼표 또는 공백으로 구분된 등록번호를 넣습니다.
3. 배치는 입력값을 정규화하고 DB에 레코드를 생성한 뒤 조회합니다.
4. 조회 결과는 정기 배치와 동일한 구조로 저장됩니다.

### 6.3 웹사이트 적용

1. 사용자가 Flight Time 웹사이트를 엽니다.
2. 앱은 `data/aircraft-types.json`을 fetch합니다.
3. DB의 `aircraft` 객체를 `A/C No -> aircraftType` 매핑으로 파싱합니다.
4. uploaded/pasted original 행의 `A/C No`가 DB에 있으면 original `Type`보다 DB 값을 우선 사용합니다.
5. 사용자가 Config 팝업 또는 workbook `config` 시트로 local override를 저장하면 local 값이 DB보다 우선 적용됩니다.

## 7. 기능 요구사항

| ID | 요구사항 |
|---|---|
| FR-1 | 배치는 `data/aircraft-types.json`을 읽고 없거나 손상된 경우 기본 schema를 사용할 수 있어야 한다. |
| FR-2 | 등록번호는 앞뒤 공백 제거, 대문자 변환, `A-Z`, `0-9`, `-` 외 문자 제거 방식으로 정규화한다. |
| FR-3 | `AIRCRAFT_REGISTRATIONS` 환경변수로 수동 등록번호를 추가할 수 있어야 한다. |
| FR-4 | 조회 후보는 `aircraftType`이 비어 있고 `lookup.status`가 `not_found`가 아닌 항목이어야 한다. |
| FR-5 | 한 번의 실행에서 API 호출 수는 `AERODATABOX_MAX_REQUESTS`로 제한하며 기본값은 25이다. |
| FR-6 | RapidAPI 인증은 `AERODATABOX_API_KEY` 또는 `RAPIDAPI_KEY` 환경변수를 사용한다. |
| FR-7 | API host는 기본적으로 `aerodatabox.p.rapidapi.com`을 사용하되 `AERODATABOX_RAPIDAPI_HOST`로 변경 가능해야 한다. |
| FR-8 | 조회 endpoint는 `/aircrafts/reg/{registration}`이고 `withImage=false`, `withRegistrations=false`를 사용한다. |
| FR-9 | 조회 성공 시 `icaoCode`, `modelCode`, `iataType`, `iataCodeShort` 순으로 `aircraftType` 후보를 선택한다. |
| FR-10 | 조회 성공 레코드는 `source`, `sourceId`, `fetchedAt`, `lookup.status`를 포함해야 한다. |
| FR-11 | 404 응답은 오류로 중단하지 않고 `lookup.status = "not_found"`로 저장한다. |
| FR-12 | API 오류는 해당 레코드에 `lookup.status = "error"`와 오류 메시지를 저장하고 다음 후보 처리를 계속한다. |
| FR-13 | API key 누락은 배치 설정 오류로 간주해 실행을 실패시켜야 한다. |
| FR-14 | 저장 전 DB의 `aircraft` 키는 등록번호 오름차순으로 정렬한다. |
| FR-15 | 변경이 발생하면 DB 루트의 `updatedAt`을 갱신한다. |
| FR-16 | GitHub Actions는 DB 변경이 있을 때만 `data/aircraft-types.json`을 커밋/푸시한다. |

## 8. 데이터 모델

`data/aircraft-types.json` 루트 구조:

```json
{
  "schemaVersion": 1,
  "description": "Aircraft registration to aircraft type database. Add registrations under aircraft; GitHub Actions fills aircraftType from AeroDataBox.",
  "updatedAt": "2026-05-26T00:00:00.000Z",
  "aircraft": {}
}
```

성공 레코드 예시:

```json
{
  "registration": "HL8329",
  "aircraftType": "B38M",
  "icaoCode": "B38M",
  "iataType": "7M8",
  "iataCodeShort": "7M8",
  "model": "Boeing 737 MAX 8",
  "modelCode": "B38M",
  "typeName": "Boeing 737 MAX 8",
  "airlineName": "Example Air",
  "active": true,
  "verified": true,
  "source": "AeroDataBox",
  "sourceId": 12345,
  "fetchedAt": "2026-05-26T00:00:00.000Z",
  "lookup": { "status": "ok" }
}
```

미발견 레코드 예시:

```json
{
  "registration": "HL0000",
  "aircraftType": "",
  "fetchedAt": "2026-05-26T00:00:00.000Z",
  "lookup": {
    "status": "not_found",
    "fetchedAt": "2026-05-26T00:00:00.000Z"
  }
}
```

오류 레코드 예시:

```json
{
  "registration": "HL9999",
  "aircraftType": "",
  "lookup": {
    "status": "error",
    "message": "AeroDataBox 429: quota exceeded",
    "fetchedAt": "2026-05-26T00:00:00.000Z"
  }
}
```

## 9. API 연동

| 항목 | 값 |
|---|---|
| Provider | AeroDataBox via RapidAPI |
| Method | `GET` |
| Path | `/aircrafts/reg/{registration}` |
| Query | `withImage=false`, `withRegistrations=false` |
| Auth Header | `X-RapidAPI-Key` |
| Host Header | `X-RapidAPI-Host` |

API 응답 필드 중 현재 저장 대상:

- `icaoCode`
- `iataType`
- `iataCodeShort`
- `model`
- `modelCode`
- `typeName`
- `airlineName`
- `active`
- `verified`
- `id`

## 10. 운영 요구사항

| 항목 | 요구사항 |
|---|---|
| 실행 주기 | 매일 03:10 KST |
| 수동 실행 | GitHub Actions `workflow_dispatch` 지원 |
| 동시 실행 | `update-aircraft-types` concurrency group으로 중복 실행 방지 |
| 권한 | GitHub Actions `contents: write` |
| Secret | `AERODATABOX_API_KEY` |
| Node 버전 | GitHub Actions Node 22 |
| 배포 | GitHub Pages 정적 배포에 `data/aircraft-types.json` 포함 |

## 11. 보안 및 개인정보

- API key는 GitHub Actions secret으로만 관리합니다.
- 브라우저 클라이언트에는 RapidAPI key를 노출하지 않습니다.
- 커밋 대상은 `data/aircraft-types.json`으로 제한합니다.
- 개인 비행 데이터, original spreadsheet, local fixture, ignored file은 커밋하지 않습니다.
- 배치 입력은 항공기 등록번호 목록으로 제한하고 비행 일자, 승무원, 노선, 시간 정보는 다루지 않습니다.

## 12. 실패 처리

| 상황 | 처리 |
|---|---|
| API key 없음 | 실행 실패 |
| 등록번호 404 | `not_found` 기록 후 계속 |
| API 4xx/5xx | `error` 기록 후 계속 |
| API 응답 JSON 파싱 실패 | raw text 일부를 오류 분석용 body로 보관 |
| 후보 없음 | 정렬된 DB를 저장하고 정상 종료 |
| DB 파일 없음 | 기본 schema로 생성 |

## 13. 검증 기준

자동화 테스트는 다음 항목을 보장해야 합니다.

- `npm test`가 통과해야 합니다.
- `data/aircraft-types.json`이 GitHub Pages 빌드 산출물에 포함되어야 합니다.
- `parseAircraftTypeDatabase`가 DB JSON을 `A/C No -> aircraftType` 매핑으로 변환해야 합니다.
- `.github/workflows/update-aircraft-types.yml`이 정기 배치와 수동 실행을 정의해야 합니다.
- 버전 배지와 cache-busting query string은 `package.json` 버전과 일치해야 합니다.

수동 검증은 다음 흐름을 확인합니다.

1. `AIRCRAFT_REGISTRATIONS`와 API key를 설정합니다.
2. `npm run update:aircraft-types`를 실행합니다.
3. `data/aircraft-types.json`에 조회 결과가 저장되는지 확인합니다.
4. 웹사이트에서 동일 등록번호가 original `Type`보다 DB `aircraftType`을 우선 사용하는지 확인합니다.

## 14. 향후 개선 후보

- original 업로드 후 미등록 항공기번호만 추출해 운영자에게 DB 추가 후보로 보여주기
- `lookup.status = "error"` 레코드의 재시도 정책과 backoff 추가
- `not_found` 항목의 장기 재검증 정책 추가
- DB schema validation 추가
- GitHub Actions summary에 조회 성공/실패/미발견 카운트 출력
- API quota 보호를 위한 요청 간 delay 또는 rate-limit 설정
