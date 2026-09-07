/**
 * [aichat 배치5 후속] 훅 deps 배열의 TDZ 참조 검사.
 *
 * ## 왜 필요한가
 *
 * `const f = useCallback(..., [g])` 에서 `g`가 **아래쪽에** `const g = useCallback(...)`으로
 * 선언돼 있으면, deps 배열은 useCallback 호출의 인자라 렌더 시점에 평가되고 그 지점은
 * `g`의 TDZ 구간이다 → `ReferenceError: Cannot access 'g' before initialization`.
 * 컴포넌트가 **한 번도 렌더되지 않는다**(화이트스크린).
 *
 * 이 저장소는 실제로 그렇게 배포될 뻔했다(ChatPageV2의 handleV2StreamError).
 * 그리고 **기존 검증이 셋 다 통과시켰다**:
 *   · `vite build` — 번들만 만든다, 실행하지 않는다
 *   · `not exported` grep — 이건 export 문제가 아니다
 *   · dev 서버 `await import()` 모듈 평가 — 모듈 **본문**만 돌고 컴포넌트를 렌더하지 않는다
 * 렌더해야 터지는 오류라 정적 검사가 가장 싼 그물이다.
 *
 * ## 한계 (정직하게)
 * 정규식 기반이라 AST가 아니다. **최상위 선언 경계로 파일을 세그먼트로 자르고**
 * 같은 세그먼트 안에서만 선언↔참조를 짝짓는다 — 파일 안에 컴포넌트/훅이 여럿일 때
 * 다른 스코프의 동명 식별자를 잘못 엮지 않기 위해서다(실제로 그 오탐이 났다:
 * `useSequentialTypewriter(parts, …)`의 **파라미터** parts와 다른 컴포넌트의 `const parts`).
 * 보지 않는 것: 조건부 선언 · 중첩 함수 안의 재선언 · 구조분해 선언(`const [a, setA] = …`) ·
 * `}, [` 형태가 아닌 deps(예: 한 줄짜리 `useCallback(fn, [x])`).
 * 놓칠 수는 있어도 **오탐은 없어야 한다**는 쪽으로 항상 기울인다.
 *
 * 적대적 검토(2026-09-07)가 초판의 그물 구멍 3종을 잡아 이 판에서 메웠다:
 * ① 멀티라인 deps 배열(이 리포에 실재 4곳) → 대괄호 균형으로 읽는다
 * ② deps가 아래쪽 **평범한 화살표 const**를 참조 → DECL을 `const 이름 =` 전부로 넓혔다
 * ③ deps가 아래쪽 `useRef`/`useState` 결과를 참조 → 같은 확장으로 함께 덮인다
 *
 * ## 왜 ESLint 규칙이 아니라 이 스크립트인가
 * `no-use-before-define`이 정답처럼 보이지만 **텍스트 순서만** 본다 — 콜백 **본문** 안의
 * 나중 선언 참조(호출 시점엔 이미 초기화됨, 안전)까지 전부 잡는다. 실측: src 전체에서 28건이
 * 걸리는데 **28건 전부 본문**이고 deps 배열은 0건이었다. 그 소음을 지우려면 대규모 리팩터가
 * 선행돼야 하고, `npm run lint`는 이미 다른 이유로 241건 실패 중이라 게이트가 못 된다.
 * 이 스크립트는 **deps 배열만** 본다 — 오늘 exit 0인, 실제로 걸 수 있는 그물이다.
 *
 * 더 깊게 감사할 땐 진짜 파서를 한 번 돌려 본문/deps를 분류하라(오탐 분류는 수동):
 *   npx eslint --config <(echo "...no-use-before-define...") src
 *
 * 사용: node scripts/check-hook-tdz.mjs [파일...]   (인자 없으면 src 전체)
 * 종료코드 1 = 위반 발견.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

// 선언: `const 이름 =` 전부. 처음엔 useCallback/useMemo만 봤는데, deps가 아래쪽의 **평범한
//   화살표 const**나 `useRef`/`useState` 결과를 참조해도 같은 ReferenceError가 난다.
//   (구조분해 `const [a, setA] = useState()`는 이 정규식에 안 걸린다 — 이름이 하나가 아니라
//    짝지을 수 없고, 배열 구조분해 자체가 deps에 그 이름으로 오는 일이 없어 무해하다.)
const DECL = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=/;
// deps 배열의 시작. 한 줄로 닫히든(`}, [a, b]);`) 여러 줄에 걸치든 여기서 잡고,
//   실제 범위는 아래 readDeps가 대괄호 균형으로 닫는다. 처음엔 한 줄짜리만 봐서
//   이 리포에 실재하는 멀티라인 deps 4곳(TheaterPlayPage ×3 · useTheaterStream)이 그물 밖이었다.
const DEPS_OPEN = /^\s*\}\s*,\s*\[/;

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, out);
    else if ([".js", ".jsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : collect("src");
let violations = 0;

/** 최상위(들여쓰기 0) 함수·컴포넌트 선언이 시작되는 줄 번호들 — 스코프 경계 근사. */
const TOP_LEVEL = /^(export\s+default\s+)?(function|const|class)\s+[A-Za-z_$]/;

/**
 * `}, [` 로 시작하는 deps 배열의 내용을 대괄호 균형으로 읽는다(멀티라인 지원).
 * 배열이 닫히기 전에 세그먼트가 끝나면 null(=포기) — 놓칠지언정 오탐은 만들지 않는다.
 */
function readDeps(lines, startIdx, segEnd) {
  let depth = 0, out = "", started = false;
  for (let i = startIdx; i <= segEnd; i++) {
    const line = i === startIdx ? lines[i].slice(lines[i].indexOf("[")) : lines[i];
    for (const ch of line) {
      if (ch === "[") { depth++; if (depth === 1) { started = true; continue; } }
      else if (ch === "]") { depth--; if (depth === 0) return out; }
      if (started) out += ch;
    }
    out += ",";   // 줄바꿈을 구분자로 — 항목이 붙어 버리지 않게
  }
  return null;
}

function segmentsOf(lines) {
  const starts = [];
  lines.forEach((l, i) => { if (TOP_LEVEL.test(l)) starts.push(i); });
  if (starts.length === 0) return [[0, lines.length - 1]];
  const segs = [];
  for (let k = 0; k < starts.length; k++) {
    segs.push([starts[k], (k + 1 < starts.length ? starts[k + 1] - 1 : lines.length - 1)]);
  }
  return segs;
}

for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  for (const [from, to] of segmentsOf(lines)) {
    // 이 세그먼트 안의 선언 이름 → 최초 선언 줄(1-indexed)
    const declaredAt = new Map();
    for (let i = from; i <= to; i++) {
      const m = DECL.exec(lines[i]);
      if (m && !declaredAt.has(m[1])) declaredAt.set(m[1], i + 1);
    }

    for (let i = from; i <= to; i++) {
      if (!DEPS_OPEN.test(lines[i])) continue;
      const inner = readDeps(lines, i, to);
      if (inner === null) continue;
      const lineNo = i + 1;
      for (const raw of inner.split(",")) {
        const dep = raw.trim().split(/[.?[]/)[0]; // v2Room?.heroines → v2Room
        if (!dep) continue;
        const declLine = declaredAt.get(dep);
        if (declLine !== undefined && declLine > lineNo) {
          violations++;
          console.error(
            `${file}:${lineNo}  TDZ 참조 — deps의 '${dep}'가 아래(${declLine}행)에서 선언된다.\n` +
            `    → 선언을 이 지점 위로 옮겨라. 지금 그대로면 렌더 시 ReferenceError로 컴포넌트가 죽는다.`
          );
        }
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n✗ 훅 deps TDZ 위반 ${violations}건`);
  process.exit(1);
}
console.log(`✓ 훅 deps TDZ 위반 없음 (${files.length}개 파일)`);
