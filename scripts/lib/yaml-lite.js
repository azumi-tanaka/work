/**
 * yaml-lite.js
 *
 * work repo の YAML だけを読むための、制限付きの YAML パーサー。
 * メンバーの Mac に PyYAML などを入れずに済むよう、Node.js の標準機能だけで書いている。
 * 書き方の決まりは RULES.md の「YAML の書き方」。そこから外れる書き方はエラーにする
 * （work-lint がそのまま行番号つきで知らせる）。
 * エラーにはしないが、書いた人の意図と違う読み方になりそうなもの（キーの直後の # で値が消える など）は、
 * parse(text, { warnings: [] }) の warnings に行番号つきで入れる（work-lint が注意として出す）。
 *
 * 読めるもの:
 *   - ブロック形式のマッピング（key: value）とシーケンス（- item）。シーケンスの中のマッピング（- key: value）
 *   - スカラー: 素の文字列・"..."・'...'・数値・true / false・null（~ ・空）
 *   - フロー形式のリストは、スカラーだけのもの（[a, b]・[]）。{} は空のときだけ
 *   - 複数行の文字列（| と |-）
 *   - # から行末までのコメント
 * 読まないもの（エラー）: タブのインデント・アンカー（& *）・タグ（!）・> の折り返し・入れ子のフロー形式
 */

'use strict';

class YamlError extends Error {
  constructor(message, lineNo) {
    super(lineNo ? `${lineNo} 行目: ${message}` : message);
    this.lineNo = lineNo;
  }
}

const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):(?:[ ]+(.*))?$/;
// 「キー: 値」に見えるが、キーが半角英字でないもの（タイトル: … など）
const LOOSE_KEY_RE = /^([^\s:#"'\-[{][^:]*?):(?:[ ]|$)/;

/** 「キー: 値」の形でない行のエラー。日本語のキーなら、そう言う */
function badLineError(text, lineNo, fallback) {
  const m = text.match(LOOSE_KEY_RE);
  if (m) return new YamlError(`キー「${m[1]}」は半角の英字で書いてください（使えるキーは RULES.md）: ${text}`, lineNo);
  return new YamlError(`${fallback}: ${text}`, lineNo);
}

/** 文字列を "..." で囲んだ例 */
function quoted(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function isSkippable(line) {
  const t = line.text.trim();
  return t === '' || t.startsWith('#') || t === '---';
}

/** 行末のコメント（空白 + #）を外す。引用符の中の # は残す */
function stripComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (quote === '"' && c === '\\') {
        i++;
      } else if (c === quote) {
        if (quote === "'" && s[i + 1] === "'") i++;
        else quote = null;
      }
    } else if (c === '"' || c === "'") {
      if (i === 0 || /[\s[,]/.test(s[i - 1])) quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s.trimEnd();
}

function parseDoubleQuoted(s, lineNo) {
  let out = '';
  let i = 1;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"') break;
    if (c === '\\') {
      const n = s[++i];
      const map = { n: '\n', t: '\t', '"': '"', '\\': '\\', '/': '/', r: '\r', 0: '\0' };
      if (n === 'u') {
        out += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16));
        i += 4;
      } else if (n in map) {
        out += map[n];
      } else {
        throw new YamlError(`"..." の中の \\${n} は使えません`, lineNo);
      }
    } else {
      out += c;
    }
  }
  if (i >= s.length) throw new YamlError('"..." が閉じていません', lineNo);
  return { value: out, rest: s.slice(i + 1) };
}

function parseSingleQuoted(s, lineNo) {
  let out = '';
  let i = 1;
  for (; i < s.length; i++) {
    if (s[i] === "'") {
      if (s[i + 1] === "'") {
        out += "'";
        i++;
      } else {
        break;
      }
    } else {
      out += s[i];
    }
  }
  if (i >= s.length) throw new YamlError("'...' が閉じていません", lineNo);
  return { value: out, rest: s.slice(i + 1) };
}

/** 素の文字列を型つきの値にする */
function plainValue(s, lineNo) {
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^[&*!%@`|>]/.test(s)) {
    throw new YamlError(`「${s[0]}」で始まる文字列は、値全体を "..." で囲んでください（例: ${quoted(s)}）: ${s}`, lineNo);
  }
  if (/: /.test(s) || s.endsWith(':')) {
    throw new YamlError(`「: 」を含む文字列は、値全体を "..." で囲んでください（例: ${quoted(s)}）: ${s}`, lineNo);
  }
  return s;
}

/** 1 行の中の値（キーの右側・- の右側）を読む */
function inlineValue(raw, lineNo) {
  const s = raw.trim();
  if (s.startsWith('"') || s.startsWith("'")) {
    const r = s.startsWith('"') ? parseDoubleQuoted(s, lineNo) : parseSingleQuoted(s, lineNo);
    const rest = stripComment(r.rest).trim();
    if (rest !== '') throw new YamlError(`引用符の後ろに余計な文字があります: ${rest}`, lineNo);
    return r.value;
  }
  const v = stripComment(s);
  if (v.startsWith('[')) {
    // [至急] 見積もり のような文字列が多いので、先に「"..." で囲む」を案内する
    const body = v.endsWith(']') ? v.slice(1, -1).trim() : null;
    if (body === null || /[[\]{}]/.test(body)) {
      throw new YamlError(`[ で始まる文字列は、値全体を "..." で囲んでください（例: ${quoted(v)}）。リストのつもりなら、- の形にしてください`, lineNo);
    }
    if (body === '') return [];
    return splitFlow(body, lineNo).map((item) => {
      const t = item.trim();
      if (t.startsWith('"')) return parseDoubleQuoted(t, lineNo).value;
      if (t.startsWith("'")) return parseSingleQuoted(t, lineNo).value;
      return plainValue(t, lineNo);
    });
  }
  if (v.startsWith('{')) {
    if (v === '{}') return {};
    throw new YamlError('{ } の形は使えません。キーごとに行を分けてください', lineNo);
  }
  return plainValue(v, lineNo);
}

function splitFlow(body, lineNo) {
  const items = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"') cur += body[++i] || '';
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ',') {
      items.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (quote) throw new YamlError('[ ] の中の引用符が閉じていません', lineNo);
  items.push(cur);
  return items;
}

/**
 * YAML の文字列を読んで値を返す（トップレベルはマッピングに限る）
 * @param {string} text
 * @param {{warnings?: string[]}} [options] - warnings に、エラーではないが意図と違いそうな読み方を足す
 * @returns {object}
 */
function parse(text, options = {}) {
  const warnings = options.warnings || [];
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((raw, i) => {
      const m = raw.match(/^([ \t]*)(.*)$/);
      return { indent: m[1].length, lead: m[1], text: m[2], no: i + 1, raw };
    });
  let pos = 0;

  function skip() {
    while (pos < lines.length && isSkippable(lines[pos])) pos++;
  }
  function peek() {
    skip();
    if (pos >= lines.length) return null;
    const l = lines[pos];
    if (l.lead.includes('\t')) throw new YamlError('インデントにタブは使えません（半角スペース 2 つ）', l.no);
    return l;
  }
  function isSeqLine(l) {
    return l.text === '-' || l.text.startsWith('- ');
  }

  function parseNode(indent) {
    const l = peek();
    if (!l || l.indent < indent) return null;
    if (isSeqLine(l)) return parseSeq(l.indent);
    if (KEY_RE.test(stripComment(l.text))) return parseMap(l.indent);
    throw badLineError(l.text, l.no, '読めない行です');
  }

  function parseBlockScalar(parentIndent, style, lineNo) {
    const body = [];
    let contentIndent = null;
    while (pos < lines.length) {
      const l = lines[pos];
      if (l.text.trim() === '') {
        body.push('');
        pos++;
        continue;
      }
      if (l.indent <= parentIndent) break;
      if (l.lead.includes('\t')) throw new YamlError('インデントにタブは使えません（半角スペース 2 つ）', l.no);
      if (contentIndent === null) contentIndent = l.indent;
      if (l.indent < contentIndent) throw new YamlError('| の中のインデントがずれています', l.no);
      body.push(l.raw.slice(contentIndent));
      pos++;
    }
    if (contentIndent === null) throw new YamlError('| の下に中身がありません', lineNo);
    while (body.length > 0 && body[body.length - 1] === '') body.pop();
    const joined = body.join('\n');
    return style === '|-' ? joined : `${joined}\n`;
  }

  function parseMap(indent) {
    const obj = {};
    for (;;) {
      const l = peek();
      if (!l || l.indent < indent) break;
      if (l.indent > indent) throw new YamlError('インデントがずれています', l.no);
      if (isSeqLine(l)) throw new YamlError('キーと - が同じ深さに混ざっています', l.no);
      const m = stripComment(l.text).match(KEY_RE);
      if (!m) throw badLineError(l.text, l.no, '「キー: 値」の形になっていません');
      const key = m[1];
      if (Object.prototype.hasOwnProperty.call(obj, key)) throw new YamlError(`キー「${key}」が 2 回あります`, l.no);
      const restRaw = l.text.slice(l.text.indexOf(':') + 1);
      const rest = stripComment(restRaw).trim();
      pos++;
      if (rest === '|' || rest === '|-') {
        obj[key] = parseBlockScalar(indent, rest, l.no);
      } else if (rest === '>' || rest === '>-' || /^[|>][0-9+-]/.test(rest)) {
        throw new YamlError('複数行は | か |- で書いてください', l.no);
      } else if (rest === '') {
        const next = peek();
        if (next && next.indent === indent && isSeqLine(next)) obj[key] = parseSeq(indent);
        else if (next && next.indent > indent) obj[key] = parseNode(next.indent);
        else {
          obj[key] = null;
          // note: #2 の件 … # からがコメントとして読み捨てられ、値が空になる
          const after = restRaw.trim();
          if (after.startsWith('#') && after.length > 1) {
            warnings.push(`${l.no} 行目: 「${key}」の値が # で始まるので、コメントとして読み捨てられ空になりました。値なら "..." で囲んでください（例: ${key}: ${quoted(after)}）`);
          }
        }
      } else {
        obj[key] = inlineValue(restRaw, l.no);
      }
    }
    return obj;
  }

  function parseSeq(indent) {
    const arr = [];
    for (;;) {
      const l = peek();
      if (!l || l.indent < indent) break;
      if (l.indent > indent) throw new YamlError('インデントがずれています', l.no);
      if (!isSeqLine(l)) break;
      const after = l.text.slice(1);
      const content = after.trimStart();
      const contentIndent = indent + 1 + (after.length - content.length);
      if (content === '' || content.startsWith('#')) {
        pos++;
        const next = peek();
        arr.push(next && next.indent > indent ? parseNode(next.indent) : null);
      } else if (KEY_RE.test(stripComment(content))) {
        // - key: value … この行をキーの位置から始まる行に置き換えて、マッピングとして読む
        lines[pos] = { ...l, indent: contentIndent, lead: ' '.repeat(contentIndent), text: content };
        arr.push(parseMap(contentIndent));
      } else if (content === '|' || content === '|-' || content.startsWith('- ')) {
        throw new YamlError('- の右に | や - は書けません', l.no);
      } else if (!/^["']/.test(content) && LOOSE_KEY_RE.test(stripComment(content))) {
        const k = content.match(LOOSE_KEY_RE)[1];
        throw new YamlError(`キー「${k}」は半角の英字で書いてください（使えるキーは RULES.md）。キーではなく文字列なら、値全体を "..." で囲んでください（例: - ${quoted(content)}）`, l.no);
      } else {
        pos++;
        arr.push(inlineValue(content, l.no));
      }
    }
    return arr;
  }

  const first = peek();
  if (!first) return {};
  if (first.indent !== 0) throw new YamlError('1 行目から字下げされています', first.no);
  const doc = parseNode(0);
  const rest = peek();
  if (rest) throw badLineError(rest.text, rest.no, '読めない行です');
  if (doc === null || Array.isArray(doc) || typeof doc !== 'object') {
    throw new YamlError('いちばん外側は「キー: 値」の形にしてください', first.no);
  }
  return doc;
}

module.exports = { parse, YamlError };
