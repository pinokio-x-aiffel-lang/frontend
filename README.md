# 피노키오X — 프론트엔드

AI 기반 뉴스 사실검증 시스템의 웹 프론트엔드.
기사 속 **통계 수치**를 통계청(KOSIS) 공식 자료와 대조해 **사실 / 거짓 / 오해 소지 / 확인 어려움** 4단계로 판정하고, 근거 자료까지 함께 보여줍니다.

- **스택**: React 19 · TypeScript · Vite 8 · TanStack Query · Zod · Tailwind CSS v4 · framer-motion
- **디자인**: 테마 `aurora` (글래스모피즘) + **라이트/다크 모드 토글**

---

## 빠른 시작

```bash
pnpm install            # 패키지 매니저는 pnpm 사용
cp .env.example .env    # 처음 한 번
pnpm dev                # http://localhost:5173
```

기본은 **mock 모드**(`VITE_USE_MOCK=true`)라 백엔드 없이 바로 동작합니다.
실 API와 연결하려면 `.env`에서 `VITE_USE_MOCK=false`로 바꾸고 `VITE_API_BASE_URL`을 백엔드 주소로 설정하세요. (자세한 내용은 아래 [백엔드 연동](#백엔드-연동-가이드) 참고)

### 스크립트

```bash
pnpm dev       # 개발 서버
pnpm build     # tsc -b && vite build
pnpm preview   # 빌드 결과물 미리보기
pnpm lint      # ESLint
```

---

## 디렉토리 구조

```
src/
├── lib/api/                ← 데이터 레이어 (백엔드 계약의 단일 출처)
│   ├── schema.ts           ← Zod 스키마 + 타입 (요청/응답 계약 ★)
│   ├── client.ts           ← fetch 래퍼 (타임아웃·에러 처리)
│   ├── verify.ts           ← POST /verify 호출 + 응답 검증
│   └── mock.ts             ← mock 시나리오 8종
├── lib/
│   ├── verdict.ts          ← 판정 코드 집계 헬퍼 (countByVerdict 등)
│   └── format.ts           ← 숫자 포맷 유틸
├── hooks/
│   ├── useVerifyArticle.ts ← TanStack Query mutation 래퍼
│   ├── usePipelineStepper.ts
│   └── useReducedMotion.ts
├── shared/
│   └── useDebugMode.ts     ← ?debug=1 또는 VITE_SHOW_DEBUG
├── themes/aurora/          ← UI (단일 테마)
│   ├── App.tsx             ← 화면 상태 머신 + 라이트/다크 토글
│   ├── tokens.css          ← 디자인 토큰 (다크 기본 + [data-mode='light'] 오버라이드)
│   └── components/         ← InputForm · PipelineProgress · ResultLayout
├── styles/base.css         ← 글로벌 reset
└── main.tsx                ← <AuroraApp /> 직접 렌더
```

> **레이어 분리 원칙**: `lib/api/`(데이터)와 `themes/`(UI)는 분리되어 있습니다.
> 백엔드 연동 시 UI는 거의 건드릴 필요가 없고, **`schema.ts`만 백엔드 응답과 맞으면** 됩니다.

---

## 라이트 / 다크 모드

- 우측 상단 **(☀) / (🌙) 토글**로 전환합니다.
- 기본값은 **라이트 모드**, 선택은 `localStorage`(`aurora-mode`)에 저장됩니다.
- 구현: `themes/aurora/tokens.css`가 다크를 기본으로 정의하고, `[data-theme='aurora'][data-mode='light']`에서 색 변수만 오버라이드합니다. (구조·레이아웃은 공유, 색만 분기)

---

## 백엔드 연동 가이드


### 1) 모드 전환

`.env`:
```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000   # 실제 백엔드 주소
```

### 2) 엔드포인트

```
POST {VITE_API_BASE_URL}/verify
Content-Type: application/json
```

### 3) 요청 (Request)

프론트는 **`content` 한 필드만** 보냅니다. 입력이 URL인지 본문인지는 **백엔드가 판별**합니다.

```jsonc
{ "content": "https://news.example.com/article/123" }   // URL
// 또는
{ "content": "2023년 청년 실업률은 5.9%였다 ..." }        // 본문 텍스트
```

### 4) 응답 (Response)

응답은 아래 형태여야 합니다. **프론트가 Zod로 응답을 재검증**하므로(`schema.ts`), 형식이 어긋나면
`"응답 형식이 예상과 다릅니다"` 에러가 납니다. → **`src/lib/api/schema.ts`가 계약의 단일 출처**입니다.

```jsonc
{
  "article": {
    "title": "기사 제목",
    "source": "조선일보",
    "published_at": "2024-01-15",
    "content": "기사 본문 전체 ..."
  },
  "claims": [
    {
      "claim_id": "c01",
      "sentence": "2023년 청년(15~29세) 실업률은 5.9%였다.",
      "claim_info": {
        "subject": "청년 실업률",
        "claim_type": "규모",
        "claim_value": "5.9",
        "normalized_value": "5.9",
        "unit": "%",
        "period": "2023",
        "compare_period": null,
        "population": "15~29세",
        "cited_source": "통계청"
      }
    }
  ],
  "verifications": {
    "summary": {
      "total_claims": 2,
      "overall_verdict": "T+F",
      "average_confidence": 0.91,
      "overview_reason": "공식 통계와 어긋나는 주장이 섞여 있어 일부 수치는 신중히 봐야 합니다."
    },
    "claim_results": [
      {
        "claim_id": "c01",
        "verdict": "T",
        "mismatch_type": null,
        "claim_value": "5.9",
        "kosis_value": "5.9",
        "explanation": "통계청 공식 수치와 일치합니다.",
        "confidence": 0.95,
        "evidence": [
          {
            "source": "KOSIS",
            "subject": "청년층 실업률",
            "value": "5.9",
            "unit": "%",
            "period": "2023",
            "population": "15~29세",
            "table_name": "경제활동인구조사",
            "url": "https://kosis.kr/statHtml/...",
            "last_updated": "2024-01-10"
          }
        ]
      }
    ]
  },

  // diagnostics는 선택(optional). 없으면 디버그 패널이 비활성.
  "diagnostics": {
    "request_id": "req_abc123",
    "pipeline": [
      { "step": 1, "name": "기사 추출", "status": "done", "duration_ms": 420 }
    ],
    "llm_calls": [
      { "stage": "claim_detection", "model": "HCX-DASH-002",
        "input_tokens": 1240, "output_tokens": 220, "latency_ms": 1850 }
    ],
    "retrieval": {
      "catalog_filtered": 32, "embedding_top50": 50,
      "rerank_top5": 5, "rag_top1_table_id": "DT_1DA7001"
    },
    "errors": [],
    "total_latency_ms": 9870
  }
}
```

### 5) 필드 의미

**판정 코드 (`claim_results[].verdict`)** — claim 단위
| 코드 | 의미 | UI 표기 |
|---|---|---|
| `T` | 공식 통계와 수치 일치 | 사실 (초록) |
| `F` | 공식 통계와 명확히 불일치 | 거짓 (빨강) |
| `M` | 맥락·단위·기간 왜곡으로 오인 가능 | 오해 소지 (노랑) |
| `NEI` | 대응 통계를 찾지 못함 | 확인 어려움 (회색) |

**`summary.overall_verdict`** — 기사 전체. claim 판정들의 조합 문자열입니다.
예: `"T"`, `"T+F"`, `"T+F+M+NEI"` 등. (UI에서는 분포 막대로 시각화)

**`summary.overview_reason`** — 기사 전체에 대한 **총평 한 문단**(자연어). 결과 화면의 분포 막대와 기사 원문 사이에 표시됩니다. 선택 필드(없어도 됨).

**핵심 설계 원칙** — *LLM은 판단만, 계산은 결정론적으로.*
`kosis_value`/`claim_value`는 백엔드에서 확정된 문자열을 그대로 내려주세요. 프론트는 표시만 합니다.

### 6) 에러 / 타임아웃 동작 (`client.ts`)

- 요청 타임아웃 **90초** → 초과 시 `ApiError(408, ...)`.
- `res.ok`가 아니면 `ApiError(status, 본문)`.
- 응답 JSON이 스키마와 다르면 → `"응답 형식이 예상과 다릅니다"` 에러 (개발 모드에선 콘솔에 mismatch 상세 출력).

---

## mock 시나리오 테스트

mock 모드에서 입력값(URL/본문)에 아래 키워드가 포함되면 해당 시나리오로 분기됩니다. (키워드 없으면 입력 해시 기반으로 자동 분기)

| 키워드 | 시나리오 | overall |
|---|---|---|
| `article-1`, `mixed` | 사실+거짓+오해 혼합 (3건) | `T+F+M` |
| `article-2`, `true` | 모두 사실 | `T` |
| `article-3`, `false` | 모두 거짓 | `F` |
| `article-4`, `mislead`, `ambig` | 오해 소지 위주 | `M` |
| `article-5`, `nei`, `none` | 매칭 통계 없음 | `NEI` |
| `article-6`, `all-four`, `mix-all` | 네 판정 모두 등장 | `T+F+M+NEI` |
| `article-7`, `mostly-true` | 사실 우세 | 사실 다수 |
| `article-8`, `mostly-false` | 거짓 우세 | 거짓 다수 |

---

## 디버그 패널

검증 파이프라인·LLM 호출·검색 단계 등 내부 진단(`diagnostics`)을 보려면:

- URL에 `?debug=1` 추가, 또는 `.env`의 `VITE_SHOW_DEBUG=true`
- 응답에 `diagnostics`가 있을 때만 표시됩니다.
- 공개 배포 시 `VITE_SHOW_DEBUG=false`로 두면 숨겨집니다.

---

## 환경변수

| 변수 | 기본 | 설명 |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | 백엔드 API 주소 |
| `VITE_USE_MOCK` | `true` | `true`=mock 데이터, `false`=실 API 호출 |
| `VITE_MOCK_DELAY` | `true` | mock 응답에 1.5~3초 지연 (로딩 UI 확인용) |
| `VITE_SHOW_DEBUG` | `false` | 디버그 패널 기본 노출 (`?debug=1`로도 토글) |

> `.env`는 커밋되지 않습니다(`.gitignore`). 새로 받으면 `cp .env.example .env`.
