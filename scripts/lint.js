#!/usr/bin/env node
/**
 * lint.js — work repo が規約（RULES.md）どおりかを機械で検査する
 *
 *   ./scripts/work-lint [--close] [--date <YYYY-MM-DD>] [--root <work repo>]
 *   ./scripts/work-lint --unclosed [--date <YYYY-MM-DD>] [--root <work repo>]
 *   ./scripts/work-lint --stale [--date <YYYY-MM-DD>] [--root <work repo>]
 *
 * エラー（直してから commit する）と注意（直さなくても動くが、規約から外れている）を出す。
 * エラーが 1 件でもあれば 1 で終わる。規約を変えたら、ここと RULES.md を一緒に直す。
 *
 * --close:    締めのときに付ける。締める日（--date。省くと今日）の daily だけ、work の hours を必須にする。
 *             前の日の daily の空の hours は注意にとどめる（前の日の空欄で、以後の締めが止まらないように）。
 * --unclosed: 始業で使う。締め忘れ（今日より前の日付の daily で、commit していないもの）と、
 *             GitHub に送っていない commit を出す。送り先（upstream）が無いときは、送り忘れの確認を飛ばす。
 *             見つかれば 1、無ければ 0 で終わる。
 * --stale:    始業で使う。todo ・ waiting のまま STALE_DAYS 日以上動いていない（updated、無ければ added から）タスクを出す。
 *             「やめますか・続けますか」と聞くための一覧。いつも 0 で終わる。
 * --date:     「今日」の代わりに使う日付（締め忘れた日を締めるとき）。
 * --root:     work repo の場所（省くと、このスクリプトの 1 つ上のディレクトリ）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parse } = require('./lib/yaml-lite');
const { buildAll, staleOutputs, resolveRoot, isWorkRepo } = require('./render');

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2}) ([01]\d|2[0-3]):[0-5]\d$/;
const ROUTES = ['claude', 'mail', 'chat', 'line', 'meeting', 'memo'];
const TASK_STATUSES = ['todo', 'doing', 'waiting', 'done', 'dropped'];
const CLOSED = ['done', 'dropped']; // 終わった・やめた（締めで tasks/ の月のファイルへ移す）
const STALE_STATUSES = ['todo', 'waiting'];
const STALE_DAYS = 30; // これだけ動いていないタスクを、始業で「やめますか・続けますか」と聞く（RULES.md と揃える）
const PROJECT_STATUSES = ['active', 'paused', 'done'];
const RESOURCE_KINDS = ['doc', 'sheet', 'slide', 'drive', 'notion', 'web', 'file', 'other'];
const TOP_LEVEL = [
  'CLAUDE.md', 'README.md', 'RULES.md', '.gitignore', 'scripts',
  'projects.yaml', 'people.yaml', 'tasks.yaml', 'tasks.md', 'tasks', 'reminders.yaml', 'reminders.md',
  'projects', 'daily', '_inbox',
];
const REQUIRED_TOP = ['CLAUDE.md', 'RULES.md', 'projects.yaml', 'people.yaml', 'tasks.yaml', 'reminders.yaml'];
// 自分で作るもの（計画・調べもの・下書き）の用途のディレクトリ
const WORK_DIRS = ['plan', 'research', 'draft'];
const WORK_DEPTH = 2; // 用途のディレクトリの下に、話のディレクトリを何段まで作ってよいか
const PROJECT_CHILDREN = ['README.md', ...WORK_DIRS, '_history', '_files', 'resources'];
const IGNORED = ['.git', '.claude', '.DS_Store', '.gitkeep', '.gitattributes', 'node_modules', '_tmp_copy.txt', '_tmp_message.md'];

// YAML の各項目の形（RULES.md と同じ）
//   type: string | number | date | datetime（YYYY-MM-DD HH:MM） | list（文字列のリスト） | hours（数字か unknown）
//   required: 必須 ／ requiredAtClose: 締める日の daily でだけ必須 ／ enum: 取れる値
//   project: projects.yaml の slug ／ people: people.yaml の id のリスト
const SCHEMAS = {
  project: {
    slug: { type: 'string', required: true, pattern: SLUG_RE },
    name: { type: 'string', required: true },
    status: { type: 'string', required: true, enum: PROJECT_STATUSES },
    started: { type: 'date', required: true },
    ended: { type: 'date' },
    note: { type: 'string' },
  },
  person: {
    id: { type: 'string', required: true, pattern: SLUG_RE },
    name: { type: 'string', required: true },
    call: { type: 'string' },
    org: { type: 'string' },
    role: { type: 'string' },
    contact: { type: 'string' },
    note: { type: 'string' },
  },
  task: {
    title: { type: 'string', required: true },
    project: { type: 'string', required: true, project: true },
    status: { type: 'string', required: true, enum: TASK_STATUSES },
    added: { type: 'date', required: true },
    due: { type: 'date' },
    done: { type: 'date' },
    dropped: { type: 'date' },
    updated: { type: 'date' },
    people: { type: 'list', people: true },
    links: { type: 'list' },
    note: { type: 'string' },
  },
  reminder: {
    title: { type: 'string', required: true },
    date: { type: 'date' },
    repeat: { type: 'string', pattern: /^(daily|weekly (sun|mon|tue|wed|thu|fri|sat)|monthly ([1-9]|[12]\d|3[01])|yearly (0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/ },
    project: { type: 'string', project: true },
    note: { type: 'string' },
  },
  plan: {
    project: { type: 'string', required: true, project: true },
    task: { type: 'string', required: true },
  },
  work: {
    project: { type: 'string', required: true, project: true },
    task: { type: 'string', required: true },
    hours: { type: 'hours', requiredAtClose: true },
    links: { type: 'list' },
  },
  candidate: {
    text: { type: 'string', required: true },
    project: { type: 'string', project: true },
  },
  resource: {
    title: { type: 'string', required: true },
    url: { type: 'string', pattern: /^https?:\/\// },
    path: { type: 'string' },
    kind: { type: 'string', required: true, enum: RESOURCE_KINDS },
    added: { type: 'date', required: true },
    note: { type: 'string' },
  },
};

function isValidDateTime(s) {
  const m = String(s).match(DATETIME_RE);
  return Boolean(m) && isValidDate(m[1]);
}

/** README の本文（リンクの %XX を戻したもの）。日本語のファイル名がエンコードされたリンクでも名前で探せるようにする */
function readmeText(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  try {
    return `${raw}\n${decodeURIComponent(raw.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))}`;
  } catch (e) {
    return raw;
  }
}

function isUrlLike(s) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
}

function isValidDate(s) {
  const m = String(s).match(DATE_RE);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** この Mac の時計での今日（YYYY-MM-DD） */
function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseArgs(argv) {
  const opts = { close: false, unclosed: false, stale: false, date: null, root: null };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--close') opts.close = true;
    else if (a === '--unclosed') opts.unclosed = true;
    else if (a === '--stale') opts.stale = true;
    else if (a === '--date' || a === '--root') {
      const v = argv[++k];
      if (!v || v.startsWith('--')) throw new Error(`${a} の後ろに値を付けてください`);
      opts[a.slice(2)] = v;
    } else throw new Error(`知らない引数です: ${a}`);
  }
  if (opts.date && !isValidDate(opts.date)) throw new Error(`--date は YYYY-MM-DD にしてください（${opts.date}）`);
  return opts;
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

/** --unclosed: 締め忘れ（今日より前の、commit していない daily）と、送っていない commit */
function unclosed(root, today) {
  const found = [];
  let status;
  try {
    status = git(root, ['status', '--porcelain', '--untracked-files=all', '--', 'daily']);
  } catch (e) {
    console.log(`git の状態が読めませんでした: ${String(e.stderr || e.message).trim()}`);
    return 1;
  }
  const days = new Set();
  for (const line of status.split('\n')) {
    const m = line.slice(3).match(/daily\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})\.(yaml|md)$/);
    if (m && m[1] < today) days.add(m[1]);
  }
  for (const d of [...days].sort()) found.push(`締めていない日: ${d}（daily/${d.slice(0, 4)}/${d.slice(5, 7)}/${d}.yaml が commit されていません）`);

  let upstream = null;
  try {
    upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).trim();
  } catch (e) {
    console.log('送り先（upstream）が決まっていないので、GitHub に送り忘れた commit の確認は飛ばしました');
  }
  if (upstream) {
    const log = git(root, ['log', '--oneline', `${upstream}..HEAD`]).trim();
    if (log) found.push(`GitHub に送っていない commit が ${log.split('\n').length} 件あります（${upstream}）:\n${log.split('\n').map((l) => `  ${l}`).join('\n')}`);
  }
  for (const f of found) console.log(f);
  if (found.length === 0) console.log('締め忘れはありません');
  return found.length > 0 ? 1 : 0;
}

/** 日付の差（日数）。a - b */
function daysBetween(a, b) {
  const t = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((t(a) - t(b)) / 86400000);
}

/** --stale: 長く動いていないタスク（todo ・ waiting のまま STALE_DAYS 日以上） */
function stale(root, today) {
  let doc;
  try {
    doc = parse(fs.readFileSync(path.join(root, 'tasks.yaml'), 'utf-8'));
  } catch (e) {
    console.log(`tasks.yaml が読めませんでした（${e.message}）。./scripts/work-lint で直す`);
    return 0;
  }
  const found = [];
  (Array.isArray(doc.tasks) ? doc.tasks : []).forEach((t, i) => {
    if (!t || !STALE_STATUSES.includes(t.status)) return;
    const since = isValidDate(t.updated) ? String(t.updated) : isValidDate(t.added) ? String(t.added) : null;
    if (!since) return;
    const days = daysBetween(today, since);
    if (days >= STALE_DAYS) found.push({ i, t, since, days });
  });
  found.sort((a, b) => b.days - a.days);
  for (const f of found) {
    console.log(`動いていない: ${f.t.title}（${f.t.project}・${f.t.status}・${f.since} から ${f.days} 日。tasks の ${f.i + 1} 件目）`);
  }
  console.log(found.length === 0 ? `${STALE_DAYS} 日以上動いていないタスクはありません` : `${STALE_DAYS} 日以上動いていないタスク: ${found.length} 件`);
  return 0;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`エラー: ${e.message}`);
    process.exit(2);
  }
  const root = resolveRoot(opts.root);
  if (!isWorkRepo(root)) {
    console.error(`エラー: work repo ではないようです（RULES.md も tasks.yaml もありません）: ${root}`);
    process.exit(2);
  }
  const today = opts.date || localToday();
  if (opts.unclosed) process.exit(unclosed(root, today));
  if (opts.stale) process.exit(stale(root, today));

  const errors = [];
  const warnings = [];
  const err = (file, msg) => errors.push(`${file}: ${msg}`);
  const warn = (file, msg) => warnings.push(`${file}: ${msg}`);
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const list = (rel) => fs.readdirSync(path.join(root, rel), { withFileTypes: true }).filter((e) => !IGNORED.includes(e.name));

  /** YAML を読む。読めなければエラーにして null。意図と違いそうな読み方は注意にする */
  function load(rel) {
    const yamlWarnings = [];
    try {
      const doc = parse(fs.readFileSync(path.join(root, rel), 'utf-8'), { warnings: yamlWarnings });
      for (const w of yamlWarnings) warn(rel, w);
      return doc;
    } catch (e) {
      err(rel, `YAML が読めません（${e.message}）`);
      return null;
    }
  }

  /** トップレベルの 1 キーにリストを持つ YAML を読んで、形だけ確かめる（中身の検査は checkItem） */
  function loadList(rel, key) {
    const doc = load(rel);
    if (!doc) return null;
    for (const k of Object.keys(doc)) if (k !== key) err(rel, `知らないキー「${k}」（${key}: だけを書く）`);
    if (doc[key] === undefined || doc[key] === null) {
      err(rel, `「${key}:」がありません（空なら ${key}: []）`);
      return null;
    }
    if (!Array.isArray(doc[key])) {
      err(rel, `「${key}」は - のリストにしてください`);
      return null;
    }
    return doc[key];
  }

  // --- 台帳（projects.yaml）と people.yaml を先に読む（ほかの YAML がここを参照する） ---
  const ledger = exists('projects.yaml') ? loadList('projects.yaml', 'projects') || [] : [];
  const people = exists('people.yaml') ? loadList('people.yaml', 'people') || [] : [];
  const projectStatus = {};
  for (const p of ledger) if (p && p.slug) projectStatus[String(p.slug)] = p.status;
  const personIds = new Set(people.filter((p) => p && p.id).map((p) => String(p.id)));

  /**
   * 1 件（マッピング）を SCHEMAS で検査する
   * @param {boolean} [closingThis] - 締める日の daily か（hours を必須にする）
   */
  function checkItem(file, where, item, schemaName, closingThis = false) {
    const schema = SCHEMAS[schemaName];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      err(file, `${where}: 「キー: 値」の形になっていません`);
      return;
    }
    for (const key of Object.keys(item)) {
      if (!schema[key]) err(file, `${where}: 知らないキー「${key}」（使えるのは ${Object.keys(schema).join('・')}）`);
    }
    for (const [key, rule] of Object.entries(schema)) {
      const v = item[key];
      if (v === undefined || v === null || v === '') {
        if (rule.required) err(file, `${where}: 「${key}」がありません`);
        if (rule.requiredAtClose) {
          if (closingThis) err(file, `${where}: 「${key}」がありません（締めでは必須。本人にも分からないときは ${key}: unknown）`);
          else warn(file, `${where}: 「${key}」が空です（その日の締めで入れる。分からないときは ${key}: unknown）`);
        }
        continue;
      }
      if (rule.type === 'string' && typeof v !== 'string' && typeof v !== 'number') err(file, `${where}: 「${key}」は文字列にしてください（[ で始まる文字列は、値全体を "..." で囲む）`);
      if (rule.type === 'hours' && typeof v !== 'number' && v !== 'unknown') err(file, `${where}: 「${key}」は数字か unknown にしてください（例: 1.5。.5 ではなく 0.5）（${v}）`);
      if (rule.type === 'date' && !isValidDate(v)) err(file, `${where}: 「${key}」は YYYY-MM-DD の日付にしてください（${v}）`);
      if (rule.type === 'datetime' && !isValidDateTime(v)) err(file, `${where}: 「${key}」は YYYY-MM-DD HH:MM の日時にしてください（${v}）`);
      if (rule.type === 'list' && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) err(file, `${where}: 「${key}」は文字列のリストにしてください`);
      if (rule.enum && !rule.enum.includes(v)) err(file, `${where}: 「${key}」は ${rule.enum.join(' ／ ')} のどれかにしてください（${v}）`);
      if (rule.pattern && !rule.pattern.test(String(v))) err(file, `${where}: 「${key}」の形が違います（${v}）`);
      if (rule.project && !(String(v) in projectStatus)) err(file, `${where}: プロジェクト「${v}」が台帳（projects.yaml）にありません（先に台帳と projects/${v}/README.md を作る）`);
      if (rule.people && Array.isArray(v)) {
        for (const id of v) if (!personIds.has(String(id))) err(file, `${where}: 人「${id}」が people.yaml にありません（先に people.yaml に足す）`);
      }
    }
    // リンク先（work repo からの相対パス）が無いものは注意だけにする（URL は見ない）
    if (Array.isArray(item.links) && item.links.every((x) => typeof x === 'string')) {
      for (const l of item.links) {
        if (!isUrlLike(l) && !exists(l)) warn(file, `${where}: リンク先が見つかりません（${l}）`);
      }
    }
  }

  /** 状態と日付の組み合わせ（status: done ⇔ 終わった日） */
  function checkDone(file, where, item, doneKey) {
    if (!item || typeof item !== 'object') return;
    if (item.status === 'done' && !item[doneKey]) err(file, `${where}: status: done のときは「${doneKey}」（終わった日）を書いてください`);
    if (item.status !== 'done' && item[doneKey]) err(file, `${where}: 「${doneKey}」があるのに status が ${item.status} です`);
  }

  /** タスクの「やめた」（status: dropped ⇔ dropped の日と理由の note） */
  function checkDropped(file, where, item) {
    if (!item || typeof item !== 'object') return;
    if (item.status === 'dropped') {
      if (!item.dropped) err(file, `${where}: status: dropped のときは「dropped」（やめた日）を書いてください`);
      if (!item.note) err(file, `${where}: status: dropped のときは「note」にやめた理由を書いてください`);
    } else if (item.dropped) err(file, `${where}: 「dropped」があるのに status が ${item.status} です`);
  }

  /**
   * 自分で作るもの（plan ・ research ・ draft）の中を見る
   * @param {string} dirRel - 見るディレクトリ
   * @param {string} entryRel - そのディレクトリの中身を辿る入口（1 つ上の README.md）
   * @param {number} depth - 用途のディレクトリから何段下か（用途のディレクトリが 0）
   */
  function checkWorkDir(dirRel, entryRel, depth) {
    const entry = exists(entryRel) ? readmeText(path.join(root, entryRel)) : null;
    for (const e of list(dirRel)) {
      const erel = `${dirRel}/${e.name}`;
      if (depth > 0 && e.name === 'README.md') continue;
      if (/\s/.test(e.name) || /[\\:*?"<>|]/.test(e.name) || e.name.startsWith('.')) {
        err(erel, '名前に空白や \\ : * ? " < > | を使わない（空白は - か _ にする）');
      }
      const dm = e.name.match(/^(\d{4}-\d{2}-\d{2})_/);
      if (dm && !isValidDate(dm[1])) err(erel, `頭の日付がありえません（${dm[1]}）`);
      else if (!dm && /^\d{4}-?\d{2}-?\d{2}/.test(e.name)) err(erel, '日付を付けるときは、頭に <YYYY-MM-DD>_ の形で付けます');
      if (entry !== null && !entry.includes(e.name)) {
        warn(erel, `${entryRel} から辿れません（リンクと 1 行の説明を書く）`);
      }
      if (e.isDirectory()) {
        if (depth + 1 > WORK_DEPTH) {
          warn(erel, `深すぎます（${dirRel.split('/').slice(0, 3).join('/')} の下は ${WORK_DEPTH} 段まで）`);
          continue;
        }
        if (!exists(`${erel}/README.md`)) warn(erel, '話のディレクトリには、入口の README.md（要約と中のファイルへのリンク）を置きます');
        checkWorkDir(erel, `${erel}/README.md`, depth + 1);
      }
    }
  }

  // --- 直下 ---
  for (const e of list('.')) {
    if (!TOP_LEVEL.includes(e.name)) warn(e.name, 'work repo の直下に置くものではありません（projects/<slug>/ か _inbox/ へ）');
  }
  for (const required of REQUIRED_TOP) {
    if (!exists(required)) err(required, 'ありません（雛形の repo からコピーする。エンジニアに伝える）');
  }

  // --- projects.yaml（台帳）---
  const seenSlugs = new Set();
  ledger.forEach((p, i) => {
    const where = `projects の ${i + 1} 件目`;
    checkItem('projects.yaml', where, p, 'project');
    checkDone('projects.yaml', where, p, 'ended');
    if (p && p.slug) {
      if (seenSlugs.has(String(p.slug))) err('projects.yaml', `${where}: slug「${p.slug}」が 2 回あります`);
      seenSlugs.add(String(p.slug));
      if (!exists(`projects/${p.slug}`)) err('projects.yaml', `${where}: projects/${p.slug}/ がありません（README.md を作る）`);
    }
  });

  // --- people.yaml ---
  const seenIds = new Set();
  people.forEach((p, i) => {
    checkItem('people.yaml', `people の ${i + 1} 件目`, p, 'person');
    if (p && p.id) {
      if (seenIds.has(String(p.id))) err('people.yaml', `people の ${i + 1} 件目: id「${p.id}」が 2 回あります`);
      seenIds.add(String(p.id));
    }
  });

  // --- tasks.yaml ・ tasks/<YYYY-MM>.yaml ・ reminders.yaml ---
  const checkTask = (file, t, i) => {
    const where = `tasks の ${i + 1} 件目`;
    checkItem(file, where, t, 'task');
    checkDone(file, where, t, 'done');
    checkDropped(file, where, t);
    if (t && !CLOSED.includes(t.status) && projectStatus[t.project] === 'done') warn(file, `${where}: 終わったプロジェクト（${t.project}）に、終わっていないタスクがあります`);
  };
  if (exists('tasks.yaml')) {
    const tasks = loadList('tasks.yaml', 'tasks') || [];
    tasks.forEach((t, i) => checkTask('tasks.yaml', t, i));
    const done = tasks.filter((t) => t && CLOSED.includes(t.status)).length;
    if (done > 0) warn('tasks.yaml', `終わった・やめたタスクが ${done} 件残っています（./scripts/work-render --move-done で tasks/ の月のファイルへ移す）`);
  }
  if (exists('tasks')) {
    for (const f of list('tasks')) {
      const frel = `tasks/${f.name}`;
      const fm = f.name.match(/^(\d{4})-(0[1-9]|1[0-2])\.yaml$/);
      if (!f.isFile() || !fm) {
        err(frel, 'tasks/ の中は <YYYY-MM>.yaml（その月に終わった・やめたタスク）だけにします');
        continue;
      }
      (loadList(frel, 'tasks') || []).forEach((t, i) => {
        checkTask(frel, t, i);
        const key = t && t.status === 'dropped' ? 'dropped' : 'done';
        if (t && !CLOSED.includes(t.status)) err(frel, `tasks の ${i + 1} 件目: tasks/ には終わった・やめたタスク（status: done ・ dropped）だけを置きます`);
        else if (t && isValidDate(t[key]) && !String(t[key]).startsWith(`${fm[1]}-${fm[2]}-`)) err(frel, `tasks の ${i + 1} 件目: 「${key}」（${t[key]}）がファイルの月と違います`);
      });
    }
  }
  if (exists('reminders.yaml')) {
    (loadList('reminders.yaml', 'reminders') || []).forEach((r, i) => {
      checkItem('reminders.yaml', `reminders の ${i + 1} 件目`, r, 'reminder');
      if (r && typeof r === 'object' && !r.date === !r.repeat) err('reminders.yaml', `reminders の ${i + 1} 件目: 「date」（1 回だけ）か「repeat」（繰り返し）のどちらか一方を書いてください`);
    });
  }

  // --- projects/<slug>/ ---
  for (const e of exists('projects') ? list('projects') : []) {
    const rel = `projects/${e.name}`;
    if (!e.isDirectory()) {
      warn(rel, 'projects/ の直下にはプロジェクトのディレクトリだけを置きます');
      continue;
    }
    if (!SLUG_RE.test(e.name)) err(rel, 'プロジェクトの名前（slug）は半角の英小文字・数字・ハイフンだけにしてください');
    if (!(e.name in projectStatus)) err(rel, '台帳（projects.yaml）にありません（slug・name・status・started を足す）');
    if (!exists(`${rel}/README.md`)) warn(rel, 'README.md（いまの状態）がありません');
    for (const c of list(rel)) {
      if (!PROJECT_CHILDREN.includes(c.name)) warn(`${rel}/${c.name}`, 'プロジェクトの中に置くのは README.md・plan/・research/・draft/・_history/・_files/・resources/ だけです（自分で作ったものは plan・research・draft へ）');
    }

    // plan/ ・ research/ ・ draft/（自分で作るもの）。名前の形・深さ・1 つ上の入口から辿れるか
    for (const w of WORK_DIRS) {
      const wrel = `${rel}/${w}`;
      if (!exists(wrel)) continue;
      if (!fs.statSync(path.join(root, wrel)).isDirectory()) {
        err(wrel, `${w} はディレクトリにします（中に 1 つの話を 1 ファイルで置く）`);
        continue;
      }
      checkWorkDir(wrel, `${rel}/README.md`, 0);
    }

    // _history/<YYYY>/<MM>/<DD>_<経路>_<件名>.md
    const hist = `${rel}/_history`;
    if (exists(hist)) {
      for (const y of list(hist)) {
        if (!y.isDirectory() || !/^\d{4}$/.test(y.name)) {
          err(`${hist}/${y.name}`, '_history の下は年のディレクトリ（YYYY）だけにします');
          continue;
        }
        for (const m of list(`${hist}/${y.name}`)) {
          if (!m.isDirectory() || !/^(0[1-9]|1[0-2])$/.test(m.name)) {
            err(`${hist}/${y.name}/${m.name}`, '年の下は月のディレクトリ（MM）だけにします');
            continue;
          }
          for (const f of list(`${hist}/${y.name}/${m.name}`)) {
            const frel = `${hist}/${y.name}/${m.name}/${f.name}`;
            const fm = f.name.match(/^(\d{2})_([a-z]+)_(.+)\.md$/);
            if (!f.isFile() || !fm) {
              err(frel, `ファイル名は <DD>_<経路>_<件名>.md にします（経路: ${ROUTES.join(' ／ ')}）`);
              continue;
            }
            if (!ROUTES.includes(fm[2])) err(frel, `経路は ${ROUTES.join(' ／ ')} のどれかにします（${fm[2]}）`);
            if (!isValidDate(`${y.name}-${m.name}-${fm[1]}`)) err(frel, `日付がありえません（${y.name}-${m.name}-${fm[1]}）`);
            // 「- 相手: 」は people.yaml の id（・ で区切って複数）
            const head = fs.readFileSync(path.join(root, frel), 'utf-8').split(/\r?\n/).slice(0, 12);
            const who = head.map((l) => l.match(/^- 相手:\s*(.*)$/)).find(Boolean);
            if (who) {
              for (const id of who[1].split(/[・,、]\s*/).map((s) => s.trim()).filter(Boolean)) {
                if (!personIds.has(id)) warn(frel, `相手「${id}」が people.yaml の id にありません（people.yaml に足して、id で書く）`);
              }
            }
          }
        }
      }
    }

    // _files/<YYYY-MM-DD>_<名前>.<拡張子>
    const files = `${rel}/_files`;
    if (exists(files)) {
      for (const f of list(files)) {
        const frel = `${files}/${f.name}`;
        if (f.isDirectory()) {
          err(frel, '_files の中にディレクトリは作りません');
          continue;
        }
        const fm = f.name.match(/^(\d{4}-\d{2}-\d{2})_.+\.[A-Za-z0-9]+$/);
        if (!fm) err(frel, 'ファイル名は <YYYY-MM-DD>_<名前>.<拡張子> にします');
        else if (!isValidDate(fm[1])) err(frel, `日付がありえません（${fm[1]}）`);
      }
    }

    // resources/<YYYY-MM>.yaml
    const res = `${rel}/resources`;
    if (exists(res)) {
      for (const f of list(res)) {
        const frel = `${res}/${f.name}`;
        const fm = f.name.match(/^(\d{4})-(0[1-9]|1[0-2])\.yaml$/);
        if (!f.isFile() || !fm) {
          err(frel, 'resources の中は <YYYY-MM>.yaml（登録した月）だけにします');
          continue;
        }
        (loadList(frel, 'resources') || []).forEach((r, i) => {
          checkItem(frel, `resources の ${i + 1} 件目`, r, 'resource');
          if (r && typeof r === 'object' && !r.url === !r.path) err(frel, `resources の ${i + 1} 件目: 「url」（外部の資料）か「path」（repo の中のファイル）のどちらか一方を書いてください`);
          if (r && typeof r.path === 'string' && r.path) {
            if (isUrlLike(r.path)) err(frel, `resources の ${i + 1} 件目: 「path」は work repo からの相対パスにします（URL は url に）`);
            else if (!exists(r.path)) warn(frel, `resources の ${i + 1} 件目: path の先が見つかりません（${r.path}）`);
          }
          if (r && isValidDate(r.added) && !String(r.added).startsWith(`${fm[1]}-${fm[2]}-`)) {
            err(frel, `resources の ${i + 1} 件目: 「added」（${r.added}）がファイルの月と違います。登録した月のファイルに書きます`);
          }
        });
      }
    }
  }

  // --- daily/<YYYY>/<MM>/<YYYY-MM-DD>.yaml ・ .md ---
  if (exists('daily')) {
    for (const y of list('daily')) {
      if (!y.isDirectory() || !/^\d{4}$/.test(y.name)) {
        err(`daily/${y.name}`, 'daily の下は年のディレクトリ（YYYY）だけにします');
        continue;
      }
      for (const m of list(`daily/${y.name}`)) {
        const mrel = `daily/${y.name}/${m.name}`;
        if (!m.isDirectory() || !/^(0[1-9]|1[0-2])$/.test(m.name)) {
          err(mrel, '年の下は月のディレクトリ（MM）だけにします');
          continue;
        }
        for (const f of list(mrel)) {
          const frel = `${mrel}/${f.name}`;
          const fm = f.name.match(/^(\d{4}-\d{2}-\d{2})\.(yaml|md)$/);
          if (!f.isFile() || !fm) {
            err(frel, 'daily の中は <YYYY-MM-DD>.yaml と、生成した .md だけにします');
            continue;
          }
          if (!fm[1].startsWith(`${y.name}-${m.name}-`) || !isValidDate(fm[1])) {
            err(frel, `日付がディレクトリ（${y.name}/${m.name}）と合っていません`);
          }
          if (fm[2] === 'md') {
            if (!exists(`${mrel}/${fm[1]}.yaml`)) err(frel, '対になる YAML がありません（md は生成物。正は YAML）');
            continue;
          }
          const doc = load(frel);
          if (!doc) continue;
          const allowed = ['date', 'plan', 'work', 'candidates', 'rejected', 'filed', 'intake', 'notes'];
          for (const k of Object.keys(doc)) if (!allowed.includes(k)) err(frel, `知らないキー「${k}」（使えるのは ${allowed.join('・')}）`);
          if (String(doc.date) !== fm[1]) err(frel, `「date」（${doc.date}）がファイル名と合っていません`);
          if (doc.work === undefined || doc.work === null) err(frel, '「work:」がありません（無い日は work: []）');
          const closingThis = opts.close && fm[1] === today;
          for (const [key, schemaName] of [['plan', 'plan'], ['work', 'work'], ['candidates', 'candidate'], ['rejected', 'candidate']]) {
            if (doc[key] === undefined || doc[key] === null) continue;
            if (!Array.isArray(doc[key])) {
              err(frel, `「${key}」は - のリストにしてください`);
              continue;
            }
            doc[key].forEach((item, i) => checkItem(frel, `${key} の ${i + 1} 件目`, item, schemaName, closingThis));
          }
          if (doc.notes !== undefined && doc.notes !== null && typeof doc.notes !== 'string') err(frel, '「notes」は文字列にしてください');
          if (doc.filed !== undefined && doc.filed !== null && (!Array.isArray(doc.filed) || doc.filed.some((x) => typeof x !== 'string'))) {
            err(frel, '「filed」は文字列のリストにしてください（1 行ずつ - で。: を含む行は "..." で囲む）');
          }
          if (doc.intake !== undefined && doc.intake !== null && !isValidDateTime(doc.intake)) err(frel, `「intake」は YYYY-MM-DD HH:MM の日時にしてください（${doc.intake}）`);
        }
      }
    }
  }
  if (opts.close) {
    const rel = `daily/${today.slice(0, 4)}/${today.slice(5, 7)}/${today}.yaml`;
    if (!exists(rel)) err(rel, `締める日（${today}）の daily がありません（date・work を書いて作る）`);
  }

  // --- 生成物（md）が YAML と合っているか ---
  const { outputs } = buildAll(root);
  for (const o of staleOutputs(root, outputs)) {
    if (o.handEdited) err(o.md, `手で直されています。直した中身を YAML に戻してから --force ${o.md} で作り直す（/daily の「本人が md を直したとき」）`);
    else err(o.md, `${o.yaml} と合っていません。./scripts/work-render を流す`);
  }

  for (const w of warnings) console.log(`注意: ${w}`);
  for (const e of errors) console.log(`エラー: ${e}`);
  console.log(errors.length === 0 && warnings.length === 0 ? 'work-lint: 問題なし' : `work-lint: エラー ${errors.length} 件・注意 ${warnings.length} 件`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
