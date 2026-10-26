// 가상 Power Query 엔진: 표(table)에 변환 단계를 적용하고, 각 단계의 M 코드를 만든다. DOM에 의존하지 않는다.
// table = { cols: [이름], types: ['text'|'number'|'date'|'any'], rows: [[값...]] }  값: 숫자 | 문자열 | null | '#오류'
export const ERR = '#오류';
export const mk = (cols, rows, types) => ({ cols: cols.slice(), types: (types || cols.map(() => 'any')).slice(), rows: rows.map((r) => r.slice()) });
export const clone = (t) => mk(t.cols, t.rows, t.types);
export const isBlank = (v) => v === null || v === undefined || v === '';
const fail = (m) => { throw new Error(m); };
const ci = (t, name) => { const i = t.cols.indexOf(name); if (i < 0) fail(`열 '${name}'이(가) 없어요`); return i; };
const need = (p, k, msg) => { if (p[k] === undefined || p[k] === '' || (Array.isArray(p[k]) && !p[k].length)) fail(msg || `${k} 값을 정해 주세요`); };
const mref = (c) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(c) ? `[${c}]` : `[#"${c}"]`);
const mq = (s) => `"${String(s).replace(/"/g, '""')}"`;
const mlist = (a) => `{${a.map(mq).join(', ')}}`;
const mval = (v, type) => (type === 'number' && !isNaN(parseFloat(v)) ? String(parseFloat(v)) : mq(v));

export function parseNum(v) {
  if (typeof v === 'number') return v;
  if (isBlank(v)) return null;
  const s = String(v).trim().replace(/,/g, '').replace(/^\$/, '').replace(/원$/, '');
  if (s === '' || isNaN(Number(s))) return ERR;
  return Number(s);
}
const pad = (n) => String(n).padStart(2, '0');
export function parseDate(v) {
  if (isBlank(v)) return null;
  const s = String(v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (!m) m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s) && (() => { const q = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); return [null, q[3], q[1], q[2]]; })();
  if (!m) return ERR;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return ERR;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
const cmpVals = (a, b) => {
  if (isBlank(a) && isBlank(b)) return 0;
  if (isBlank(a)) return -1;
  if (isBlank(b)) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ko');
};
const keyOf = (vals) => JSON.stringify(vals);

const FILTER_OPS = [['eq', '같음 ='], ['ne', '같지 않음 ≠'], ['gt', '보다 큼 >'], ['ge', '이상 ≥'], ['lt', '보다 작음 <'], ['le', '이하 ≤'], ['contains', '포함'], ['starts', '다음으로 시작'], ['ends', '다음으로 끝남'], ['isnull', 'null(비어 있음)'], ['notnull', 'null이 아님']];
const FNS = [['sum', '합계'], ['avg', '평균'], ['count', '행 개수'], ['min', '최솟값'], ['max', '최댓값'], ['countd', '고유 개수']];
const FN_M = { sum: 'List.Sum', avg: 'List.Average', min: 'List.Min', max: 'List.Max', countd: 'List.NonNullCount(List.Distinct(' };
export const FILTER_OPS_LIST = FILTER_OPS;
export const FNS_LIST = FNS;

function test(op, cell, value, type) {
  if (op === 'isnull') return isBlank(cell);
  if (op === 'notnull') return !isBlank(cell);
  if (isBlank(cell)) return op === 'ne';
  let a = cell, b = value;
  if (type === 'number' || typeof cell === 'number') { a = typeof cell === 'number' ? cell : parseNum(cell); b = parseNum(value); if (a === ERR || b === ERR) return false; }
  switch (op) {
    case 'eq': return a === b;
    case 'ne': return a !== b;
    case 'gt': return a > b;
    case 'ge': return a >= b;
    case 'lt': return a < b;
    case 'le': return a <= b;
    case 'contains': return String(a).includes(String(b));
    case 'starts': return String(a).startsWith(String(b));
    case 'ends': return String(a).endsWith(String(b));
    default: return false;
  }
}
const OPSYM = { eq: '=', ne: '<>', gt: '>', ge: '>=', lt: '<', le: '<=' };

function aggregate(fn, vals) {
  const v = vals.filter((x) => !isBlank(x) && x !== ERR);
  if (fn === 'count') return vals.length;
  if (fn === 'countd') return new Set(v.map((x) => JSON.stringify(x))).size;
  if (!v.length) return null;
  const nums = v.map((x) => (typeof x === 'number' ? x : parseNum(x))).filter((x) => x !== ERR && x !== null);
  if (fn === 'sum') return round(nums.reduce((a, b) => a + b, 0));
  if (fn === 'avg') return round(nums.reduce((a, b) => a + b, 0) / nums.length);
  if (fn === 'min') return v.reduce((a, b) => (cmpVals(a, b) <= 0 ? a : b));
  if (fn === 'max') return v.reduce((a, b) => (cmpVals(a, b) >= 0 ? a : b));
  return null;
}
const round = (x) => Math.round(x * 1e6) / 1e6;

// ---------- 단계 정의 ----------
// params 종류: col, cols, text, num, select, query, qcols(다른 쿼리의 열 여러 개)
export const OPS = {
  promoteHeaders: { name: '첫 행을 머리글로 사용', cat: '시작', stepName: '승격된 헤더', desc: '맨 위 행을 열 이름으로 올려요.', params: [],
    apply(t) { if (!t.rows.length) fail('행이 없어요'); const names = t.rows[0].map((v, i) => (isBlank(v) ? `Column${i + 1}` : String(v))); const o = mk(names, t.rows.slice(1), t.cols.map(() => 'any')); return o; },
    m: (p, prev) => `Table.PromoteHeaders(${prev}, [PromoteAllScalars = true])` },
  demoteHeaders: { name: '머리글을 첫 행으로 내리기', cat: '시작', stepName: '내려간 헤더', desc: '열 이름을 첫 번째 데이터 행으로 내려요.', params: [],
    apply(t) { return mk(t.cols.map((_, i) => `Column${i + 1}`), [t.cols.slice(), ...t.rows], t.cols.map(() => 'any')); },
    m: (p, prev) => `Table.DemoteHeaders(${prev})` },
  changeType: { name: '데이터 형식 변경', cat: '열', stepName: '변경된 형식', desc: '열을 텍스트·숫자·날짜 중 하나로 바꿔요. 바꿀 수 없는 값은 오류가 돼요.',
    params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'type', kind: 'select', label: '형식', options: [['number', '숫자'], ['text', '텍스트'], ['date', '날짜']] }],
    apply(t, p) {
      need(p, 'col', '열을 고르세요'); need(p, 'type', '형식을 고르세요');
      const i = ci(t, p.col), o = clone(t);
      o.types[i] = p.type;
      o.rows = o.rows.map((r) => { const v = r[i]; if (isBlank(v)) { r[i] = null; return r; } if (p.type === 'number') r[i] = parseNum(v); else if (p.type === 'date') r[i] = parseDate(v); else r[i] = typeof v === 'number' ? String(v) : v; return r; });
      return o;
    },
    m: (p, prev) => `Table.TransformColumnTypes(${prev}, {{${mq(p.col)}, ${p.type === 'number' ? 'type number' : p.type === 'date' ? 'type date' : 'type text'}}})` },
  removeCols: { name: '열 제거', cat: '열', stepName: '제거된 열', desc: '선택한 열을 지워요.', params: [{ k: 'cols', kind: 'cols', label: '제거할 열' }],
    apply(t, p) { need(p, 'cols', '제거할 열을 고르세요'); const idx = p.cols.map((c) => ci(t, c)); const keep = t.cols.map((_, i) => i).filter((i) => !idx.includes(i)); return mk(keep.map((i) => t.cols[i]), t.rows.map((r) => keep.map((i) => r[i])), keep.map((i) => t.types[i])); },
    m: (p, prev) => `Table.RemoveColumns(${prev}, ${mlist(p.cols)})` },
  keepCols: { name: '열 선택(유지)', cat: '열', stepName: '다른 열 제거됨', desc: '고른 열만 남겨요. 고른 순서대로 배치돼요.', params: [{ k: 'cols', kind: 'cols', label: '남길 열' }],
    apply(t, p) { need(p, 'cols', '남길 열을 고르세요'); const idx = p.cols.map((c) => ci(t, c)); return mk(idx.map((i) => t.cols[i]), t.rows.map((r) => idx.map((i) => r[i])), idx.map((i) => t.types[i])); },
    m: (p, prev) => `Table.SelectColumns(${prev}, ${mlist(p.cols)})` },
  renameCol: { name: '열 이름 바꾸기', cat: '열', stepName: '이름이 바뀐 열', desc: '열 이름을 바꿔요.', params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'name', kind: 'text', label: '새 이름' }],
    apply(t, p) { need(p, 'col', '열을 고르세요'); need(p, 'name', '새 이름을 입력하세요'); const i = ci(t, p.col); if (p.name !== p.col && t.cols.includes(p.name)) fail(`'${p.name}' 열이 이미 있어요`); const o = clone(t); o.cols[i] = p.name; return o; },
    m: (p, prev) => `Table.RenameColumns(${prev}, {{${mq(p.col)}, ${mq(p.name)}}})` },
  filterRows: { name: '행 필터', cat: '행', stepName: '필터링된 행', desc: '조건에 맞는 행만 남겨요.',
    params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'op', kind: 'select', label: '조건', options: FILTER_OPS }, { k: 'value', kind: 'text', label: '값', optional: true }],
    apply(t, p) { need(p, 'col', '열을 고르세요'); need(p, 'op', '조건을 고르세요'); const i = ci(t, p.col); if (!['isnull', 'notnull'].includes(p.op) && isBlank(p.value)) fail('값을 입력하세요'); const o = clone(t); o.rows = o.rows.filter((r) => test(p.op, r[i], p.value, t.types[i])); return o; },
    m(p, prev, ctx) {
      const type = ctx && ctx.types ? ctx.types[p.col] : 'text';
      if (p.op === 'isnull') return `Table.SelectRows(${prev}, each ${mref(p.col)} = null)`;
      if (p.op === 'notnull') return `Table.SelectRows(${prev}, each ${mref(p.col)} <> null)`;
      if (p.op === 'contains') return `Table.SelectRows(${prev}, each Text.Contains(${mref(p.col)}, ${mq(p.value)}))`;
      if (p.op === 'starts') return `Table.SelectRows(${prev}, each Text.StartsWith(${mref(p.col)}, ${mq(p.value)}))`;
      if (p.op === 'ends') return `Table.SelectRows(${prev}, each Text.EndsWith(${mref(p.col)}, ${mq(p.value)}))`;
      return `Table.SelectRows(${prev}, each ${mref(p.col)} ${OPSYM[p.op]} ${mval(p.value, type)})`;
    } },
  sortRows: { name: '정렬', cat: '행', stepName: '정렬된 행', desc: '열 기준으로 오름·내림차순 정렬해요.', params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'dir', kind: 'select', label: '방향', options: [['asc', '오름차순'], ['desc', '내림차순']] }],
    apply(t, p) { need(p, 'col', '열을 고르세요'); need(p, 'dir', '방향을 고르세요'); const i = ci(t, p.col); const o = clone(t); const s = p.dir === 'desc' ? -1 : 1; o.rows = o.rows.map((r, n) => [r, n]).sort((a, b) => s * cmpVals(a[0][i], b[0][i]) || a[1] - b[1]).map((x) => x[0]); return o; },
    m: (p, prev) => `Table.Sort(${prev}, {{${mq(p.col)}, Order.${p.dir === 'desc' ? 'Descending' : 'Ascending'}}})` },
  removeDuplicates: { name: '중복 제거', cat: '행', stepName: '제거된 중복 항목', desc: '고른 열의 값이 같은 행은 첫 번째만 남겨요.', params: [{ k: 'cols', kind: 'cols', label: '기준 열' }],
    apply(t, p) { need(p, 'cols', '기준 열을 고르세요'); const idx = p.cols.map((c) => ci(t, c)); const seen = new Set(); const o = clone(t); o.rows = o.rows.filter((r) => { const k = keyOf(idx.map((i) => r[i])); if (seen.has(k)) return false; seen.add(k); return true; }); return o; },
    m: (p, prev) => `Table.Distinct(${prev}, ${mlist(p.cols)})` },
  removeBlankRows: { name: '빈 행 제거', cat: '행', stepName: '제거된 빈 행', desc: '모든 열이 비어 있는 행을 지워요.', params: [],
    apply(t) { const o = clone(t); o.rows = o.rows.filter((r) => r.some((v) => !isBlank(v))); return o; }, m: (p, prev) => `Table.SelectRows(${prev}, each not List.IsEmpty(List.RemoveMatchingItems(Record.FieldValues(_), {"", null})))` },
  removeErrors: { name: '오류 제거', cat: '행', stepName: '제거된 오류', desc: '선택한 열에 오류(#오류)가 있는 행을 지워요.', params: [{ k: 'col', kind: 'col', label: '열' }],
    apply(t, p) { need(p, 'col', '열을 고르세요'); const i = ci(t, p.col); const o = clone(t); o.rows = o.rows.filter((r) => r[i] !== ERR); return o; }, m: (p, prev) => `Table.RemoveRowsWithErrors(${prev}, {${mq(p.col)}})` },
  keepTop: { name: '상위 행 유지', cat: '행', stepName: '유지된 상위 행', desc: '맨 위에서 N개 행만 남겨요.', params: [{ k: 'n', kind: 'num', label: '행 수' }],
    apply(t, p) { const n = parseInt(p.n, 10); if (!(n >= 0)) fail('0 이상의 숫자를 입력하세요'); const o = clone(t); o.rows = o.rows.slice(0, n); return o; }, m: (p, prev) => `Table.FirstN(${prev}, ${parseInt(p.n, 10)})` },
  removeTop: { name: '상위 행 제거', cat: '행', stepName: '제거된 상위 행', desc: '맨 위에서 N개 행을 지워요.', params: [{ k: 'n', kind: 'num', label: '행 수' }],
    apply(t, p) { const n = parseInt(p.n, 10); if (!(n >= 0)) fail('0 이상의 숫자를 입력하세요'); const o = clone(t); o.rows = o.rows.slice(n); return o; }, m: (p, prev) => `Table.Skip(${prev}, ${parseInt(p.n, 10)})` },
  replaceValues: { name: '값 바꾸기', cat: '변환', stepName: '대체된 값', desc: '열에서 값이 정확히 같은 칸을 새 값으로 바꿔요. 찾을 값을 비워 두면 null을 바꿔요.',
    params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'find', kind: 'text', label: '찾을 값(비우면 null)', optional: true }, { k: 'repl', kind: 'text', label: '바꿀 값' }],
    apply(t, p) { need(p, 'col', '열을 고르세요'); const i = ci(t, p.col); const o = clone(t); const num = t.types[i] === 'number'; o.rows = o.rows.map((r) => { const v = r[i]; const hit = isBlank(p.find) ? isBlank(v) : (v === p.find || (num && typeof v === 'number' && v === parseNum(p.find))); if (hit) r[i] = num && !isBlank(p.repl) && parseNum(p.repl) !== ERR ? parseNum(p.repl) : p.repl; return r; }); return o; },
    m: (p, prev, ctx) => `Table.ReplaceValue(${prev}, ${isBlank(p.find) ? 'null' : mval(p.find, ctx && ctx.types && ctx.types[p.col])}, ${mval(p.repl, ctx && ctx.types && ctx.types[p.col])}, Replacer.ReplaceValue, {${mq(p.col)}})` },
  transformText: { name: '텍스트 서식', cat: '변환', stepName: '변환된 텍스트', desc: '공백 제거, 인쇄 불가 문자 제거, 대·소문자 변환.',
    params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'fn', kind: 'select', label: '변환', options: [['trim', '공백 제거(앞뒤)'], ['clean', '비인쇄 문자 제거'], ['upper', '대문자'], ['lower', '소문자'], ['proper', '단어 첫 글자 대문자']] }],
    apply(t, p) {
      need(p, 'col', '열을 고르세요'); need(p, 'fn', '변환을 고르세요'); const i = ci(t, p.col); const o = clone(t);
      const F = { trim: (s) => s.trim(), clean: (s) => s.replace(/[\u0000-\u001f\u007f]/g, ''), upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase(), proper: (s) => s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, a, b) => a + b.toUpperCase()) };
      o.rows = o.rows.map((r) => { if (typeof r[i] === 'string') r[i] = F[p.fn](r[i]); return r; }); return o;
    },
    m: (p, prev) => `Table.TransformColumns(${prev}, {{${mq(p.col)}, ${{ trim: 'Text.Trim', clean: 'Text.Clean', upper: 'Text.Upper', lower: 'Text.Lower', proper: 'Text.Proper' }[p.fn]}, type text}})` },
  splitColumn: { name: '열 분할(구분 기호)', cat: '변환', stepName: '열 분할', desc: '구분 기호로 열을 여러 열로 나눠요. 새 열 이름은 원래이름.1, .2 …',
    params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'delim', kind: 'text', label: '구분 기호' }],
    apply(t, p) {
      need(p, 'col', '열을 고르세요'); need(p, 'delim', '구분 기호를 입력하세요'); const i = ci(t, p.col);
      const parts = t.rows.map((r) => (isBlank(r[i]) ? [] : String(r[i]).split(p.delim)));
      const n = Math.max(1, ...parts.map((x) => x.length));
      const names = Array.from({ length: n }, (_, k) => `${p.col}.${k + 1}`);
      names.forEach((nm) => { if (t.cols.includes(nm)) fail(`'${nm}' 열이 이미 있어요`); });
      const cols = [...t.cols.slice(0, i), ...names, ...t.cols.slice(i + 1)];
      const types = [...t.types.slice(0, i), ...names.map(() => 'text'), ...t.types.slice(i + 1)];
      const rows = t.rows.map((r, ri) => [...r.slice(0, i), ...names.map((_, k) => (parts[ri][k] === undefined ? null : parts[ri][k])), ...r.slice(i + 1)]);
      return mk(cols, rows, types);
    },
    m: (p, prev, ctx) => `Table.SplitColumn(${prev}, ${mq(p.col)}, Splitter.SplitTextByDelimiter(${mq(p.delim)}, QuoteStyle.Csv), ${mlist(ctx && ctx.newCols ? ctx.newCols : [p.col + '.1', p.col + '.2'])})` },
  mergeCols: { name: '열 병합', cat: '변환', stepName: '병합된 열', desc: '여러 열을 구분 기호로 이어 붙여 새 열 하나로 만들어요. 원래 열은 사라져요.',
    params: [{ k: 'cols', kind: 'cols', label: '병합할 열(순서대로)' }, { k: 'sep', kind: 'text', label: '구분 기호', optional: true }, { k: 'name', kind: 'text', label: '새 열 이름' }],
    apply(t, p) {
      need(p, 'cols', '열을 2개 이상 고르세요'); if (p.cols.length < 2) fail('열을 2개 이상 고르세요'); need(p, 'name', '새 열 이름을 입력하세요');
      const idx = p.cols.map((c) => ci(t, c)); const sep = p.sep || '';
      if (t.cols.includes(p.name) && !p.cols.includes(p.name)) fail(`'${p.name}' 열이 이미 있어요`);
      const first = Math.min(...idx); const keep = t.cols.map((_, i) => i).filter((i) => !idx.includes(i));
      const cols = [], types = [], rows = t.rows.map(() => []);
      t.cols.forEach((c, i) => { if (i === first) { cols.push(p.name); types.push('text'); t.rows.forEach((r, ri) => rows[ri].push(idx.map((k) => (isBlank(r[k]) ? '' : String(r[k]))).join(sep))); } if (keep.includes(i)) { cols.push(c); types.push(t.types[i]); t.rows.forEach((r, ri) => rows[ri].push(r[i])); } });
      return mk(cols, rows, types);
    },
    m: (p, prev) => `Table.CombineColumns(${prev}, ${mlist(p.cols)}, Combiner.CombineTextByDelimiter(${mq(p.sep || '')}, QuoteStyle.None), ${mq(p.name)})` },
  extractText: { name: '텍스트 추출', cat: '변환', stepName: '추출된 텍스트', desc: '구분 기호 앞/뒤의 글자, 또는 앞/뒤 N글자만 남겨요(제자리 변환).',
    params: [{ k: 'col', kind: 'col', label: '열' }, { k: 'kind', kind: 'select', label: '방식', options: [['before', '구분 기호 앞'], ['after', '구분 기호 뒤'], ['first', '처음 N글자'], ['last', '마지막 N글자']] }, { k: 'arg', kind: 'text', label: '구분 기호 또는 N' }],
    apply(t, p) {
      need(p, 'col', '열을 고르세요'); need(p, 'kind', '방식을 고르세요'); need(p, 'arg', '값을 입력하세요'); const i = ci(t, p.col); const o = clone(t);
      const n = parseInt(p.arg, 10);
      o.rows = o.rows.map((r) => {
        const s = r[i]; if (isBlank(s)) return r; const str = String(s);
        if (p.kind === 'before') { const k = str.indexOf(p.arg); r[i] = k < 0 ? str : str.slice(0, k); }
        else if (p.kind === 'after') { const k = str.indexOf(p.arg); r[i] = k < 0 ? str : str.slice(k + p.arg.length); }
        else if (p.kind === 'first') { if (!(n >= 0)) fail('N은 0 이상의 숫자예요'); r[i] = str.slice(0, n); }
        else { if (!(n >= 0)) fail('N은 0 이상의 숫자예요'); r[i] = n === 0 ? '' : str.slice(-n); }
        return r;
      });
      o.types[i] = 'text'; return o;
    },
    m: (p, prev) => ({ before: `Table.TransformColumns(${prev}, {{${mq(p.col)}, each Text.BeforeDelimiter(_, ${mq(p.arg)}), type text}})`, after: `Table.TransformColumns(${prev}, {{${mq(p.col)}, each Text.AfterDelimiter(_, ${mq(p.arg)}), type text}})`, first: `Table.TransformColumns(${prev}, {{${mq(p.col)}, each Text.Start(_, ${parseInt(p.arg, 10)}), type text}})`, last: `Table.TransformColumns(${prev}, {{${mq(p.col)}, each Text.End(_, ${parseInt(p.arg, 10)}), type text}})` }[p.kind]) },
  addConditional: { name: '조건 열 추가', cat: '열 추가', stepName: '추가된 조건 열', desc: '조건에 맞으면 값1, 아니면 값2를 넣는 새 열을 만들어요.',
    params: [{ k: 'name', kind: 'text', label: '새 열 이름' }, { k: 'col', kind: 'col', label: '조건 열' }, { k: 'op', kind: 'select', label: '조건', options: FILTER_OPS.filter((o) => !['isnull', 'notnull', 'contains', 'starts', 'ends'].includes(o[0])) }, { k: 'value', kind: 'text', label: '비교 값' }, { k: 'then', kind: 'text', label: '맞으면' }, { k: 'else', kind: 'text', label: '아니면' }],
    apply(t, p) {
      need(p, 'name', '새 열 이름을 입력하세요'); need(p, 'col', '조건 열을 고르세요'); need(p, 'op', '조건을 고르세요'); need(p, 'value', '비교 값을 입력하세요');
      if (t.cols.includes(p.name)) fail(`'${p.name}' 열이 이미 있어요`); const i = ci(t, p.col); const o = clone(t);
      o.cols.push(p.name); o.types.push('text');
      o.rows = o.rows.map((r) => { r.push(test(p.op, r[i], p.value, t.types[i]) ? p.then : p.else); return r; }); return o;
    },
    m: (p, prev, ctx) => `Table.AddColumn(${prev}, ${mq(p.name)}, each if ${mref(p.col)} ${OPSYM[p.op]} ${mval(p.value, ctx && ctx.types && ctx.types[p.col])} then ${mq(p.then)} else ${mq(p.else)})` },
  addCustom: { name: '사용자 지정 열(계산)', cat: '열 추가', stepName: '추가된 사용자 지정', desc: '열 A와 열 B(또는 숫자)를 + − × ÷ 로 계산한 새 열을 만들어요.',
    params: [{ k: 'name', kind: 'text', label: '새 열 이름' }, { k: 'a', kind: 'col', label: '열 A' }, { k: 'op', kind: 'select', label: '연산', options: [['+', '＋'], ['-', '－'], ['*', '×'], ['/', '÷']] }, { k: 'b', kind: 'text', label: '열 B 이름 또는 숫자' }],
    apply(t, p) {
      need(p, 'name', '새 열 이름을 입력하세요'); need(p, 'a', '열 A를 고르세요'); need(p, 'op', '연산을 고르세요'); need(p, 'b', 'B를 입력하세요');
      if (t.cols.includes(p.name)) fail(`'${p.name}' 열이 이미 있어요`); const ia = ci(t, p.a); const ib = t.cols.indexOf(p.b); if (t.types[ia] !== 'number') fail(`'${p.a}' 열이 숫자 형식이 아니에요. 먼저 숫자로 바꾸세요`); if (ib >= 0 && t.types[ib] !== 'number') fail(`'${p.b}' 열이 숫자 형식이 아니에요. 먼저 숫자로 바꾸세요`);
      if (ib < 0 && parseNum(p.b) === ERR) fail(`'${p.b}'은(는) 열 이름도 숫자도 아니에요`);
      const o = clone(t); o.cols.push(p.name); o.types.push('number');
      o.rows = o.rows.map((r) => {
        const x = typeof r[ia] === 'number' ? r[ia] : parseNum(r[ia]); const yv = ib >= 0 ? r[ib] : p.b; const y = typeof yv === 'number' ? yv : parseNum(yv);
        let v; if (x === ERR || y === ERR) v = ERR; else if (x === null || y === null) v = null; else if (p.op === '+') v = x + y; else if (p.op === '-') v = x - y; else if (p.op === '*') v = x * y; else v = y === 0 ? ERR : x / y;
        r.push(typeof v === 'number' ? round(v) : v); return r;
      }); return o;
    },
    m: (p, prev, ctx) => `Table.AddColumn(${prev}, ${mq(p.name)}, each ${mref(p.a)} ${p.op} ${ctx && ctx.cols && ctx.cols.includes(p.b) ? mref(p.b) : parseNum(p.b)}, type number)` },
  dateParts: { name: '날짜 → 연/월/일 열 추가', cat: '열 추가', stepName: '추가된 날짜 열', desc: '날짜 열에서 연도·월·일·요일 등을 뽑은 새 열을 만들어요.',
    params: [{ k: 'col', kind: 'col', label: '날짜 열' }, { k: 'part', kind: 'select', label: '추출', options: [['year', '연도'], ['month', '월(숫자)'], ['day', '일'], ['weekday', '요일(월·화…)'], ['quarter', '분기']] }, { k: 'name', kind: 'text', label: '새 열 이름' }],
    apply(t, p) {
      need(p, 'col', '날짜 열을 고르세요'); need(p, 'part', '추출할 항목을 고르세요'); need(p, 'name', '새 열 이름을 입력하세요'); if (t.cols.includes(p.name)) fail(`'${p.name}' 열이 이미 있어요`);
      const i = ci(t, p.col); const o = clone(t); const W = ['일', '월', '화', '수', '목', '금', '토'];
      o.cols.push(p.name); o.types.push(p.part === 'weekday' ? 'text' : 'number');
      o.rows = o.rows.map((r) => { const d = parseDate(r[i]); if (d === null || d === ERR || t.types[i] !== 'date') { r.push(t.types[i] !== 'date' && !isBlank(r[i]) ? ERR : null); return r; } const [y, m, dd] = d.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, dd)); r.push({ year: y, month: m, day: dd, weekday: W[dt.getUTCDay()], quarter: Math.ceil(m / 3) }[p.part]); return r; }); return o;
    },
    m: (p, prev) => `Table.AddColumn(${prev}, ${mq(p.name)}, each ${{ year: `Date.Year(${mref(p.col)})`, month: `Date.Month(${mref(p.col)})`, day: `Date.Day(${mref(p.col)})`, weekday: `Date.ToText(${mref(p.col)}, "ddd", "ko-KR")`, quarter: `Date.QuarterOfYear(${mref(p.col)})` }[p.part]})` },
  fillDown: { name: '아래로 채우기', cat: '변환', stepName: '채워진 아래쪽', desc: '위 행의 값으로 아래쪽 null을 채워요.', params: [{ k: 'col', kind: 'col', label: '열' }],
    apply(t, p) { need(p, 'col', '열을 고르세요'); const i = ci(t, p.col); const o = clone(t); let last = null; o.rows = o.rows.map((r) => { if (isBlank(r[i])) r[i] = last; else last = r[i]; return r; }); return o; }, m: (p, prev) => `Table.FillDown(${prev}, {${mq(p.col)}})` },
  indexCol: { name: '인덱스 열 추가', cat: '열 추가', stepName: '추가된 인덱스', desc: '1부터(또는 0부터) 번호를 매긴 열을 추가해요.', params: [{ k: 'name', kind: 'text', label: '새 열 이름' }, { k: 'start', kind: 'select', label: '시작 값', options: [['0', '0부터'], ['1', '1부터']] }],
    apply(t, p) { need(p, 'name', '새 열 이름을 입력하세요'); if (t.cols.includes(p.name)) fail(`'${p.name}' 열이 이미 있어요`); const s = parseInt(p.start || '1', 10); const o = clone(t); o.cols.push(p.name); o.types.push('number'); o.rows = o.rows.map((r, n) => { r.push(n + s); return r; }); return o; },
    m: (p, prev) => `Table.AddIndexColumn(${prev}, ${mq(p.name)}, ${parseInt(p.start || '1', 10)}, 1, Int64.Type)` },
  groupBy: { name: '그룹화(집계)', cat: '구조', stepName: '그룹화된 행', desc: '기준 열 값이 같은 행끼리 묶어 합계·평균 등을 구해요.',
    params: [{ k: 'by', kind: 'cols', label: '그룹 기준 열' }, { k: 'f1', kind: 'select', label: '집계 1', options: FNS }, { k: 'c1', kind: 'col', label: '집계 1 대상 열', optional: true }, { k: 'n1', kind: 'text', label: '집계 1 새 열 이름' }, { k: 'f2', kind: 'select', label: '집계 2(선택)', options: [['', '(없음)'], ...FNS], optional: true }, { k: 'c2', kind: 'col', label: '집계 2 대상 열', optional: true }, { k: 'n2', kind: 'text', label: '집계 2 새 열 이름', optional: true }],
    apply(t, p) {
      need(p, 'by', '기준 열을 고르세요'); need(p, 'f1', '집계 방법을 고르세요'); need(p, 'n1', '집계 열 이름을 입력하세요');
      const aggs = [{ f: p.f1, c: p.c1, n: p.n1 }]; if (p.f2) { need(p, 'n2', '집계 2의 열 이름을 입력하세요'); aggs.push({ f: p.f2, c: p.c2, n: p.n2 }); }
      aggs.forEach((a) => { if (['sum', 'avg'].includes(a.f) && a.c) { const k = ci(t, a.c); if (t.types[k] !== 'number') fail(`'${a.c}' 열이 숫자 형식이 아니라서 ${a.f === 'sum' ? '합계' : '평균'}를 구할 수 없어요. 먼저 데이터 형식을 숫자로 바꾸세요`); if (t.rows.some((r) => r[k] === ERR)) fail(`'${a.c}' 열에 오류 값이 있어 계산할 수 없어요. 오류를 먼저 처리하세요`); } if (a.f !== 'count' && !a.c) fail(`'${FNS.find((x) => x[0] === a.f)[1]}'에는 대상 열이 필요해요`); if (t.cols.includes(a.n) && !p.by.includes(a.n)) fail(`'${a.n}' 열 이름이 이미 있어요`); });
      const bi = p.by.map((c) => ci(t, c)); const groups = new Map();
      t.rows.forEach((r) => { const k = keyOf(bi.map((i) => r[i])); if (!groups.has(k)) groups.set(k, { key: bi.map((i) => r[i]), rows: [] }); groups.get(k).rows.push(r); });
      const cols = [...p.by, ...aggs.map((a) => a.n)]; const types = [...bi.map((i) => t.types[i]), ...aggs.map((a) => (a.f === 'min' || a.f === 'max' ? t.types[ci(t, a.c)] : 'number'))];
      const rows = [...groups.values()].map((g) => [...g.key, ...aggs.map((a) => aggregate(a.f, a.f === 'count' ? g.rows.map(() => 1) : g.rows.map((r) => r[ci(t, a.c)])))]);
      return mk(cols, rows, types);
    },
    m(p, prev) {
      const one = (f, c, n) => { const r = f === 'count' ? 'Table.RowCount(_)' : f === 'countd' ? `List.NonNullCount(List.Distinct(Table.Column(_, ${mq(c)})))` : `${FN_M[f]}(Table.Column(_, ${mq(c)}))`; return `{${mq(n)}, each ${r}, ${f === 'min' || f === 'max' ? 'type any' : 'type number'}}`; };
      const parts = [one(p.f1, p.c1, p.n1)]; if (p.f2) parts.push(one(p.f2, p.c2, p.n2));
      return `Table.Group(${prev}, ${mlist(p.by)}, {${parts.join(', ')}})`;
    } },
  pivot: { name: '피벗 열', cat: '구조', stepName: '피벗된 열', desc: '한 열의 값들을 새 열 머리글로 펼치고, 값 열을 집계해 채워요.',
    params: [{ k: 'col', kind: 'col', label: '머리글이 될 열' }, { k: 'vcol', kind: 'col', label: '값 열' }, { k: 'fn', kind: 'select', label: '집계', options: FNS.filter((f) => f[0] !== 'count' && f[0] !== 'countd').concat([['count', '개수']]) }],
    apply(t, p) {
      need(p, 'col', '머리글로 쓸 열을 고르세요'); need(p, 'vcol', '값 열을 고르세요'); need(p, 'fn', '집계를 고르세요'); const hi = ci(t, p.col), vi = ci(t, p.vcol); if (hi === vi) fail('머리글 열과 값 열이 달라야 해요');
      if (['sum', 'avg'].includes(p.fn)) { if (t.types[vi] !== 'number') fail(`'${p.vcol}' 열이 숫자 형식이 아니라서 ${p.fn === 'sum' ? '합계' : '평균'}를 구할 수 없어요. 먼저 숫자 형식으로 바꾸세요`); if (t.rows.some((r) => r[vi] === ERR)) fail(`'${p.vcol}' 열에 오류 값이 있어요`); }
      const rest = t.cols.map((_, i) => i).filter((i) => i !== hi && i !== vi); const heads = [...new Set(t.rows.map((r) => (isBlank(r[hi]) ? '(null)' : String(r[hi]))))].sort((a, b) => a.localeCompare(b, 'ko'));
      heads.forEach((h) => { if (rest.some((i) => t.cols[i] === h)) fail(`'${h}' 열 이름이 겹쳐요`); });
      const groups = new Map(); t.rows.forEach((r) => { const k = keyOf(rest.map((i) => r[i])); if (!groups.has(k)) groups.set(k, { key: rest.map((i) => r[i]), cells: new Map() }); const h = isBlank(r[hi]) ? '(null)' : String(r[hi]); const g = groups.get(k); if (!g.cells.has(h)) g.cells.set(h, []); g.cells.get(h).push(r[vi]); });
      const rows = [...groups.values()].map((g) => [...g.key, ...heads.map((h) => (g.cells.has(h) ? aggregate(p.fn, g.cells.get(h)) : null))]);
      return mk([...rest.map((i) => t.cols[i]), ...heads], rows, [...rest.map((i) => t.types[i]), ...heads.map(() => 'number')]);
    },
    m: (p, prev) => `Table.Pivot(${prev}, List.Distinct(${prev}[${p.col.match(/^[A-Za-z_][A-Za-z0-9_]*$/) ? p.col : '#"' + p.col + '"'}]), ${mq(p.col)}, ${mq(p.vcol)}, ${p.fn === 'count' ? 'List.Count' : FN_M[p.fn]})` },
  unpivot: { name: '열 피벗 해제', cat: '구조', stepName: '피벗 해제된 열', desc: '가로로 펼쳐진 열들을 세로(특성·값 두 열)로 길게 바꿔요. "다른 열 피벗 해제"는 고른 열만 두고 나머지를 해제해요.',
    params: [{ k: 'cols', kind: 'cols', label: '열 선택' }, { k: 'mode', kind: 'select', label: '방식', options: [['selected', '선택한 열 피벗 해제'], ['others', '다른 열 피벗 해제(선택한 열은 유지)']] }, { k: 'attr', kind: 'text', label: '특성 열 이름', optional: true }, { k: 'val', kind: 'text', label: '값 열 이름', optional: true }],
    apply(t, p) {
      need(p, 'cols', '열을 고르세요'); need(p, 'mode', '방식을 고르세요'); const attr = p.attr || '특성', val = p.val || '값';
      const sel = p.cols.map((c) => ci(t, c)); const un = p.mode === 'others' ? t.cols.map((_, i) => i).filter((i) => !sel.includes(i)) : sel; const keep = t.cols.map((_, i) => i).filter((i) => !un.includes(i));
      if (!un.length) fail('피벗 해제할 열이 없어요'); [attr, val].forEach((n) => { if (keep.some((i) => t.cols[i] === n)) fail(`'${n}' 열 이름이 이미 있어요`); });
      const rows = []; t.rows.forEach((r) => un.forEach((i) => { if (isBlank(r[i])) return; rows.push([...keep.map((k) => r[k]), t.cols[i], r[i]]); }));
      return mk([...keep.map((i) => t.cols[i]), attr, val], rows, [...keep.map((i) => t.types[i]), 'text', un.every((i) => t.types[i] === 'number') ? 'number' : 'any']);
    },
    m: (p, prev) => { const attr = p.attr || '특성', val = p.val || '값'; return p.mode === 'others' ? `Table.UnpivotOtherColumns(${prev}, ${mlist(p.cols)}, ${mq(attr)}, ${mq(val)})` : `Table.Unpivot(${prev}, ${mlist(p.cols)}, ${mq(attr)}, ${mq(val)})`; } },
  mergeQueries: { name: '쿼리 병합(조인)', cat: '결합', stepName: '병합된 쿼리', desc: '다른 쿼리와 키 열로 결합해(조인) 필요한 열을 가져와요.',
    params: [{ k: 'other', kind: 'query', label: '병합할 쿼리' }, { k: 'lkey', kind: 'col', label: '현재 쿼리의 키 열' }, { k: 'rkey', kind: 'qcol', label: '병합할 쿼리의 키 열' }, { k: 'kind', kind: 'select', label: '조인 종류', options: [['leftouter', '왼쪽 외부(모두 + 일치)'], ['rightouter', '오른쪽 외부'], ['fullouter', '전체 외부'], ['inner', '내부(일치만)'], ['leftanti', '왼쪽 앤티(불일치)'], ['rightanti', '오른쪽 앤티']] }, { k: 'expand', kind: 'qcols', label: '가져올 열(확장)', optional: true }],
    apply(t, p, ctx) {
      need(p, 'other', '병합할 쿼리를 고르세요'); need(p, 'lkey', '키 열을 고르세요'); need(p, 'rkey', '상대 키 열을 고르세요'); need(p, 'kind', '조인 종류를 고르세요');
      const R = ctx && ctx.sources && ctx.sources[p.other]; if (!R) fail(`쿼리 '${p.other}'를 찾을 수 없어요`); const li = ci(t, p.lkey), ri = R.cols.indexOf(p.rkey); if (ri < 0) fail(`'${p.rkey}' 열이 없어요`);
      const kind = p.kind; const exp = (p.expand || []).filter((c) => c !== undefined);
      if (['leftanti', 'rightanti'].includes(kind)) {
        if (kind === 'leftanti') { const keys = new Set(R.rows.map((r) => keyOf([r[ri]]))); const o = clone(t); o.rows = o.rows.filter((r) => !keys.has(keyOf([r[li]]))); return o; }
        const keys = new Set(t.rows.map((r) => keyOf([r[li]]))); const o = clone(R); o.rows = o.rows.filter((r) => !keys.has(keyOf([r[ri]]))); return o;
      }
      const ei = exp.map((c) => { const k = R.cols.indexOf(c); if (k < 0) fail(`'${c}' 열이 없어요`); if (t.cols.includes(c)) fail(`'${c}' 열이 현재 쿼리에도 있어요. 이름을 먼저 바꾸거나 다른 열을 고르세요`); return k; });
      if (!ei.length && !p.noExpand) fail('가져올 열을 하나 이상 고르세요');
      const rIndex = new Map(); R.rows.forEach((r, n) => { const k = keyOf([r[ri]]); if (!rIndex.has(k)) rIndex.set(k, []); rIndex.get(k).push(n); });
      const cols = [...t.cols, ...exp], types = [...t.types, ...ei.map((i) => R.types[i])]; const rows = []; const used = new Set();
      t.rows.forEach((r) => { const m = isBlank(r[li]) ? undefined : rIndex.get(keyOf([r[li]])); if (m) { m.forEach((n) => { used.add(n); rows.push([...r, ...ei.map((i) => R.rows[n][i])]); }); } else if (kind === 'leftouter' || kind === 'fullouter') rows.push([...r, ...ei.map(() => null)]); });
      if (kind === 'rightouter' || kind === 'fullouter') R.rows.forEach((r, n) => { if (!used.has(n)) { const row = t.cols.map(() => null); row[li] = r[ri]; rows.push([...row, ...ei.map((i) => r[i])]); } });
      return mk(cols, rows, types);
    },
    m: (p, prev) => `Table.ExpandTableColumn(Table.NestedJoin(${prev}, {${mq(p.lkey)}}, ${mref2(p.other)}, {${mq(p.rkey)}}, ${mq(p.other)}, JoinKind.${{ leftouter: 'LeftOuter', rightouter: 'RightOuter', fullouter: 'FullOuter', inner: 'Inner', leftanti: 'LeftAnti', rightanti: 'RightAnti' }[p.kind]}), ${mq(p.other)}, ${mlist(p.expand || [])})` },
  appendQueries: { name: '쿼리 추가(위아래 합치기)', cat: '결합', stepName: '추가된 쿼리', desc: '다른 쿼리의 행을 아래에 이어 붙여요. 열 이름이 같은 것끼리 맞춰져요.', params: [{ k: 'other', kind: 'query', label: '추가할 쿼리' }],
    apply(t, p, ctx) { need(p, 'other', '추가할 쿼리를 고르세요'); const R = ctx && ctx.sources && ctx.sources[p.other]; if (!R) fail(`쿼리 '${p.other}'를 찾을 수 없어요`); const cols = [...t.cols]; const types = [...t.types]; R.cols.forEach((c, i) => { if (!cols.includes(c)) { cols.push(c); types.push(R.types[i]); } }); const rows = t.rows.map((r) => cols.map((c) => { const k = t.cols.indexOf(c); return k < 0 ? null : r[k]; })); R.rows.forEach((r) => rows.push(cols.map((c) => { const k = R.cols.indexOf(c); return k < 0 ? null : r[k]; }))); return mk(cols, rows, types); },
    m: (p, prev) => `Table.Combine({${prev}, ${mref2(p.other)}})` },
};
const mref2 = (n) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : `#"${n}"`);
export const OP_CATS = ['시작', '열', '행', '변환', '열 추가', '구조', '결합'];

// ---------- 실행 ----------
// source: 시작 표, steps: [{op, p}], ctx: { sources }  → { table, error?, failedAt?, log }
export function run(source, steps, ctx) {
  let t = clone(source); const log = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]; const def = OPS[s.op];
    if (!def) return { table: t, error: `알 수 없는 단계: ${s.op}`, failedAt: i, log };
    try { t = def.apply(t, s.p || {}, ctx || {}); log.push(clone(t)); } catch (e) { return { table: t, error: e.message, failedAt: i, log }; }
  }
  return { table: t, log };
}
// 단계별 결과를 보며 M 코드를 만든다.
export function toM(sourceName, sourceCode, source, steps, ctx) {
  const lines = []; let prev = '원본'; let t = clone(source); const names = [];
  lines.push(`    원본 = ${sourceCode || 'Excel.CurrentWorkbook(){[Name="' + sourceName + '"]}[Content]'}`);
  steps.forEach((s, i) => {
    const def = OPS[s.op]; const types = {}; t.cols.forEach((c, k) => { types[c] = t.types[k]; });
    let nt; try { nt = def.apply(t, s.p || {}, ctx || {}); } catch (e) { nt = t; }
    const newCols = nt.cols.filter((c) => !t.cols.includes(c));
    let name = def.stepName; let n = 2; while (names.includes(name)) name = def.stepName + ' ' + n++;
    names.push(name);
    lines.push(`    #"${name}" = ${def.m(s.p || {}, prev, { types, cols: t.cols, newCols })}`);
    prev = `#"${name}"`; t = nt;
  });
  const body = lines.map((l, i) => (i < lines.length - 1 ? l + ',' : l)).join('\n');
  return `let\n${body}\nin\n    ${prev}`;
}

// ---------- 비교 ----------
export function sameTable(a, b, opt = {}) {
  if (a.cols.length !== b.cols.length || a.cols.some((c, i) => c !== b.cols[i])) return { ok: false, why: `열이 달라요. 지금: ${a.cols.join(', ') || '(없음)'} / 목표: ${b.cols.join(', ')}` };
  if (a.rows.length !== b.rows.length) return { ok: false, why: `행 수가 달라요. 지금 ${a.rows.length}행 / 목표 ${b.rows.length}행` };
  if (opt.types) { for (let i = 0; i < a.cols.length; i++) if (a.types[i] !== b.types[i]) return { ok: false, why: `'${a.cols[i]}' 열의 데이터 형식이 달라요 (지금 ${tname(a.types[i])} / 목표 ${tname(b.types[i])})` }; }
  const ra = opt.unordered ? sortRowsKey(a.rows) : a.rows, rb = opt.unordered ? sortRowsKey(b.rows) : b.rows;
  for (let i = 0; i < ra.length; i++) for (let j = 0; j < a.cols.length; j++) {
    const x = ra[i][j], y = rb[i][j];
    const same = (isBlank(x) && isBlank(y)) || x === y || (typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) < 1e-6);
    if (!same) return { ok: false, why: `${i + 1}번째 행의 '${a.cols[j]}' 값이 달라요 (지금 ${fmt(x)} / 목표 ${fmt(y)})` };
  }
  return { ok: true };
}
const sortRowsKey = (rows) => rows.slice().sort((p, q) => keyOf(p).localeCompare(keyOf(q)));
export const tname = (t) => ({ number: '숫자', text: '텍스트', date: '날짜', any: '미지정' }[t] || t);
export const fmt = (v) => (v === null || v === undefined ? 'null' : v === '' ? '(빈 문자열)' : typeof v === 'number' ? String(Math.round(v * 1e4) / 1e4) : String(v));
