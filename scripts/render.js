#!/usr/bin/env node
/**
 * render.js — work repo の YAML（正）から、人が見る md（生成物）を作る
 *
 *   ./scripts/work-render [--check | --diff [<md>] | --force <md> | --move-done] [--root <work repo>]
 *
 *   tasks.yaml ＋ tasks/<YYYY-MM>.yaml（最新の月） → tasks.md
 *   reminders.yaml                                → reminders.md
 *   daily/<YYYY>/<MM>/<日付>.yaml                  → daily/<YYYY>/<MM>/<日付>.md
 *
 * 引数なし:     YAML と合っていない md を書き直す。手で直された md は上書きせずに止まる（1 で終わる）
 * --check:      書かずに、YAML と合っていない md を「手で直された」「古い」に分けて出す（合っていなければ 1）
 * --diff [<md>]: 手で直された md（<md> を付けたらその 1 つ）について、YAML から作った形と今の md の差分を出す
 *               （- が YAML から作った形、+ が今の md。本人が md で何を変えたかを読むのに使う）
 * --force <md>: その 1 つの md だけ、手で直されていても YAML から作り直す（YAML に戻し終えたときだけ使う）
 * --move-done:  tasks.yaml の status: done ・ dropped のタスクを、done ・ dropped の日の月の tasks/<YYYY-MM>.yaml へ移す（締めで使う）
 * --root:       work repo の場所（省くと、このスクリプトの 1 つ上のディレクトリ）
 *
 * md の 1 行目に、render が書いた本文のハッシュ（sha:...）を残す。本文がそれと合わない md は
 * 「手で直された」とみなし、YAML に戻すまで上書きしない（/daily の「本人が md を直したとき」）。
 * 改行の違い（CRLF・末尾の改行の数）は、手で直したことにしない。
 * YAML の形は RULES.md が正。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('./lib/yaml-lite');

const STATUS_LABELS = { doing: '進行中', todo: '未着手', waiting: '待ち', done: '完了', dropped: 'やめた' };
const CLOSED = ['done', 'dropped'];
/** 終わった（done）・やめた（dropped）日 */
const closedOn = (t) => (t.status === 'dropped' ? t.dropped : t.done);
const KIND_ORDER = ['doing', 'todo', 'waiting'];
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAY_KEYS = { sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土' };
const TASK_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])\.yaml$/;
const HEADER_NOTE = '手で直したときは「md を直した」と伝える（/daily が YAML に戻す）';

/** 改行を LF に揃え、末尾の改行を 1 つにする（改行の違いを「手で直した」と扱わない） */
function normalize(s) {
  return s.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function hashOf(rest) {
  return crypto.createHash('sha256').update(normalize(rest), 'utf-8').digest('hex').slice(0, 12);
}

/** 1 行目（生成物の印とハッシュ）を付けて、md の中身にする */
function withHeader(source, body) {
  const rest = `\n${body}`;
  return `<!-- 生成物: ${source} から ./scripts/work-render が作る。${HEADER_NOTE} sha:${hashOf(rest)} -->\n${rest}`;
}

/** md が手で直されているか（1 行目のハッシュと本文が合わない・生成物の印が無い） */
function isHandEdited(content) {
  const c = normalize(content);
  const nl = c.indexOf('\n');
  const first = nl === -1 ? c : c.slice(0, nl);
  const m = first.match(/sha:([0-9a-f]{12}) -->$/);
  if (!m) return true;
  return hashOf(nl === -1 ? '' : c.slice(nl + 1)) !== m[1];
}

/** 表のセルに入れられる形にする */
function cell(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function isUrl(s) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
}

/**
 * リンクを md のリンクにする。work repo からの相対パスは、md の置き場から見た相対パスに直す
 * @param {string[]} links
 * @param {string} mdDir - md を置くディレクトリ（work repo からの相対）
 */
function renderLinks(links, mdDir) {
  if (!Array.isArray(links) || links.length === 0) return '';
  return links
    .map((l, i) => {
      const s = String(l);
      if (isUrl(s)) return `[${i + 1}](${s})`;
      const rel = path.relative(mdDir, s).split(path.sep).join('/') || '.';
      return `[${path.basename(s)}](<${rel}>)`;
    })
    .join(' ');
}

function shortDate(d) {
  if (!d) return '';
  const m = String(d).match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : String(d);
}

function weekday(date) {
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return WEEKDAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
}

function byDueThenAdded(a, b) {
  const da = a.due ? String(a.due) : '9999-99-99';
  const db = b.due ? String(b.due) : '9999-99-99';
  if (da !== db) return da < db ? -1 : 1;
  return String(a.added || '') < String(b.added || '') ? -1 : 1;
}

/** people.yaml の id → 表示名（呼び方があればそれ） */
function peopleNames(root) {
  const p = path.join(root, 'people.yaml');
  const names = {};
  if (!fs.existsSync(p)) return names;
  try {
    const doc = parse(fs.readFileSync(p, 'utf-8'));
    for (const x of Array.isArray(doc.people) ? doc.people : []) {
      if (x && x.id) names[String(x.id)] = String(x.call || x.name || x.id);
    }
  } catch (e) {
    // people.yaml が読めないときは id のまま出す（エラーは work-lint が出す）
  }
  return names;
}

function taskTitle(t, names) {
  let s = cell(t.title);
  if (Array.isArray(t.people) && t.people.length > 0) s += `（相手: ${t.people.map((id) => cell(names[id] || id)).join('・')}）`;
  if (t.note) s += `<br>${cell(t.note)}`;
  return s;
}

/**
 * @param {object} doc - tasks.yaml
 * @param {{file: string, doc: object}|null} latestMonth - 最新の tasks/<YYYY-MM>.yaml
 * @param {object} names - peopleNames()
 */
function renderTasks(doc, latestMonth, names) {
  const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
  const out = ['# タスク', ''];
  const open = tasks.filter((t) => t && !CLOSED.includes(t.status));
  const doneHere = tasks.filter((t) => t && CLOSED.includes(t.status));
  const doneMonth = latestMonth && Array.isArray(latestMonth.doc.tasks) ? latestMonth.doc.tasks.filter(Boolean) : [];

  out.push(`## やること（${open.length} 件）`, '');
  if (open.length === 0) {
    out.push('なし', '');
  } else {
    out.push('| 状態 | 期日 | プロジェクト | 内容 | リンク |', '|---|---|---|---|---|');
    for (const kind of KIND_ORDER) {
      for (const t of open.filter((x) => x.status === kind).sort(byDueThenAdded)) {
        out.push(`| ${STATUS_LABELS[kind]} | ${shortDate(t.due)} | ${cell(t.project)} | ${taskTitle(t, names)} | ${renderLinks(t.links, '.')} |`);
      }
    }
    // 取れる値の外の status も落とさずに出す（エラーは work-lint が出す）
    for (const t of open.filter((x) => !KIND_ORDER.includes(x.status))) {
      out.push(`| ${cell(t.status)} | ${shortDate(t.due)} | ${cell(t.project)} | ${taskTitle(t, names)} | ${renderLinks(t.links, '.')} |`);
    }
    out.push('');
  }

  const done = [...doneHere, ...doneMonth];
  const where = latestMonth ? `${latestMonth.file} の分。前の月は tasks/ の月のファイル` : 'tasks/ の月のファイルに移る';
  out.push(`## 終わったもの（${done.length} 件。${where}）`, '');
  if (done.length === 0) {
    out.push('なし', '');
  } else {
    out.push('| 終わった日 | 状態 | プロジェクト | 内容 |', '|---|---|---|---|');
    const sorted = [...done].sort((a, b) => (String(closedOn(a) || '') < String(closedOn(b) || '') ? 1 : -1));
    for (const t of sorted) {
      // やめたものは、理由（note）も出す
      const title = t.status === 'dropped' && t.note ? `${cell(t.title)}<br>${cell(t.note)}` : cell(t.title);
      out.push(`| ${shortDate(closedOn(t))} | ${STATUS_LABELS[t.status] || cell(t.status)} | ${cell(t.project)} | ${title} |`);
    }
    out.push('');
  }
  const source = latestMonth ? `tasks.yaml・${latestMonth.file}` : 'tasks.yaml';
  return withHeader(source, out.join('\n'));
}

function describeRepeat(r) {
  if (!r) return '';
  const s = String(r).trim();
  let m;
  if (s === 'daily') return '毎日';
  if ((m = s.match(/^weekly (sun|mon|tue|wed|thu|fri|sat)$/))) return `毎週${WEEKDAY_KEYS[m[1]]}曜`;
  if ((m = s.match(/^monthly (\d{1,2})$/))) return `毎月${Number(m[1])}日`;
  if ((m = s.match(/^yearly (\d{2})-(\d{2})$/))) return `毎年${Number(m[1])}/${Number(m[2])}`;
  return s;
}

function renderReminders(doc) {
  const items = Array.isArray(doc.reminders) ? doc.reminders : [];
  const out = ['# リマインダー', ''];
  if (items.length === 0) {
    out.push('なし', '');
    return withHeader('reminders.yaml', out.join('\n'));
  }
  const once = items.filter((r) => r && r.date).sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
  const repeat = items.filter((r) => r && !r.date);
  out.push('| いつ | 内容 | プロジェクト | メモ |', '|---|---|---|---|');
  for (const r of [...once, ...repeat]) {
    const when = r.date ? `${r.date}（${weekday(r.date)}）` : describeRepeat(r.repeat);
    out.push(`| ${when} | ${cell(r.title)} | ${cell(r.project)} | ${cell(r.note)} |`);
  }
  out.push('');
  return withHeader('reminders.yaml', out.join('\n'));
}

function renderDaily(doc, yamlPath) {
  const mdDir = path.dirname(yamlPath);
  const out = [`# ${doc.date}（${weekday(doc.date)}）`, ''];
  const plan = Array.isArray(doc.plan) ? doc.plan : [];
  const work = Array.isArray(doc.work) ? doc.work.filter(Boolean) : [];
  const candidates = Array.isArray(doc.candidates) ? doc.candidates : [];

  if (plan.length > 0) {
    out.push('## 今日の予定', '');
    for (const p of plan) if (p) out.push(`- ${p.project ? `[${p.project}] ` : ''}${String(p.task || '').trim()}`);
    out.push('');
  }

  // 合計は数字の時間だけ。unknown（本人にも分からない）と空欄は数えずに、件数を添える
  const total = Math.round(work.reduce((s, w) => s + (typeof w.hours === 'number' ? w.hours : 0), 0) * 100) / 100;
  const unknown = work.filter((w) => w.hours === 'unknown').length;
  const blank = work.filter((w) => w.hours === undefined || w.hours === null || w.hours === '').length;
  const excluded = [unknown ? `不明 ${unknown} 件` : '', blank ? `未記入 ${blank} 件` : ''].filter(Boolean).join('・');
  out.push(`## やったこと（合計 ${total} 時間${excluded ? `。${excluded}を除く` : ''}）`, '');
  if (work.length === 0) {
    out.push('なし', '');
  } else {
    out.push('| プロジェクト | 内容 | 時間 | リンク |', '|---|---|---|---|');
    for (const w of work) {
      const hours = w.hours === 'unknown' ? '不明' : cell(w.hours);
      out.push(`| ${cell(w.project)} | ${cell(w.task)} | ${hours} | ${renderLinks(w.links, mdDir)} |`);
    }
    out.push('');
  }

  if (candidates.length > 0) {
    out.push('## タスクの候補（返事待ち）', '');
    for (const c of candidates) if (c) out.push(`- ${c.project ? `[${c.project}] ` : ''}${String(c.text || '').trim()}`);
    out.push('');
  }

  const filed = Array.isArray(doc.filed) ? doc.filed.filter((f) => typeof f === 'string' && f.trim()) : [];
  if (filed.length > 0 || doc.intake) {
    out.push('## 記録に入れたもの（取り込み・会話から）', '');
    if (doc.intake) out.push(`Google の取り込み: ${doc.intake} までの分`, '');
    for (const f of filed) out.push(`- ${f.trim()}`);
    if (filed.length > 0) out.push('');
  }

  if (doc.notes) {
    // 引用にして、本文の # や - が md の見出し・リストにならないようにする
    out.push('## メモ', '', ...String(doc.notes).trimEnd().split('\n').map((l) => (l ? `> ${l}` : '>')), '');
  }
  return withHeader(path.basename(yamlPath), out.join('\n'));
}

/** daily/ の下の YAML を集める（work repo からの相対パス） */
function listDailyYaml(root) {
  const base = path.join(root, 'daily');
  const found = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.yaml')) found.push(path.relative(root, p).split(path.sep).join('/'));
    }
  };
  walk(base);
  return found.sort();
}

/** tasks/<YYYY-MM>.yaml を古い順に（work repo からの相対パス） */
function listTaskMonths(root) {
  const dir = path.join(root, 'tasks');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && TASK_MONTH_RE.test(e.name))
    .map((e) => `tasks/${e.name}`)
    .sort();
}

/**
 * 作るべき md の一覧と中身を返す。YAML が読めないものは errors に入れる
 * @param {string} root - work repo のルート
 * @returns {{outputs: {yaml: string, md: string, content: string}[], errors: {file: string, message: string}[]}}
 */
function buildAll(root) {
  const outputs = [];
  const errors = [];
  const read = (rel) => parse(fs.readFileSync(path.join(root, rel), 'utf-8'));

  if (fs.existsSync(path.join(root, 'tasks.yaml'))) {
    const months = listTaskMonths(root);
    const latest = months[months.length - 1];
    let reading = latest;
    try {
      const latestMonth = latest ? { file: latest, doc: read(latest) } : null;
      reading = 'tasks.yaml';
      outputs.push({ yaml: 'tasks.yaml', md: 'tasks.md', content: renderTasks(read('tasks.yaml'), latestMonth, peopleNames(root)) });
    } catch (e) {
      errors.push({ file: reading || 'tasks.yaml', message: e.message });
    }
  }
  const targets = [];
  if (fs.existsSync(path.join(root, 'reminders.yaml'))) targets.push(['reminders.yaml', 'reminders.md', (d) => renderReminders(d)]);
  for (const y of listDailyYaml(root)) targets.push([y, y.replace(/\.yaml$/, '.md'), (d) => renderDaily(d, y)]);
  for (const [yaml, md, render] of targets) {
    try {
      outputs.push({ yaml, md, content: render(read(yaml)) });
    } catch (e) {
      errors.push({ file: yaml, message: e.message });
    }
  }
  return { outputs, errors };
}

/** YAML と合っていない md（無い・中身が違う）を返す。手で直されたものには handEdited: true を付ける */
function staleOutputs(root, outputs) {
  const stale = [];
  for (const o of outputs) {
    const p = path.join(root, o.md);
    if (!fs.existsSync(p)) {
      stale.push({ ...o, handEdited: false });
      continue;
    }
    const current = fs.readFileSync(p, 'utf-8');
    if (normalize(current) !== normalize(o.content)) stale.push({ ...o, handEdited: isHandEdited(current) });
  }
  return stale;
}

/**
 * 行の差分（LCS）。前後 2 行を添えて、変わった所だけを返す
 * @param {string[]} a - YAML から作った形
 * @param {string[]} b - 今の md
 * @returns {string[]}
 */
function lineDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push(['  ', a[i]]);
      i++;
      j++;
    } else if (j < m && (i === n || dp[i][j + 1] > dp[i + 1][j])) {
      ops.push(['+ ', b[j++]]);
    } else {
      ops.push(['- ', a[i++]]);
    }
  }
  const keep = ops.map(() => false);
  ops.forEach(([op], k) => {
    if (op !== '  ') for (let x = Math.max(0, k - 2); x <= Math.min(ops.length - 1, k + 2); x++) keep[x] = true;
  });
  const out = [];
  ops.forEach(([op, line], k) => {
    if (keep[k]) out.push(`${op}${line}`);
    else if (k > 0 && keep[k - 1]) out.push('  …');
  });
  return out;
}

/** 1 行目（生成物の印）を外した本文の行 */
function bodyLines(content) {
  const c = normalize(content);
  return c.slice(c.indexOf('\n') + 1).replace(/\n$/, '').split('\n');
}

/** --move-done: tasks.yaml の status: done ・ dropped のタスクを、done ・ dropped の日の月の tasks/<YYYY-MM>.yaml へ移す */
function moveDone(root) {
  const tasksPath = path.join(root, 'tasks.yaml');
  const text = normalize(fs.readFileSync(tasksPath, 'utf-8'));
  const doc = parse(text);
  const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
  const isMovable = (t) => t && CLOSED.includes(t.status) && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(String(closedOn(t) || ''));
  if (!tasks.some(isMovable)) {
    console.log('移すタスクはありません（tasks.yaml に status: done と done の日付、または status: dropped と dropped の日付があるものが無い）');
    return 0;
  }

  // テキストのまま、1 件ずつの塊に分ける（書き直さないので、コメントや書き方はそのまま残る）
  const lines = text.replace(/\n$/, '').split('\n');
  const head = lines.findIndex((l) => /^tasks:\s*(#.*)?$/.test(l));
  const firstItem = lines.findIndex((l, k) => k > head && /^\s*- /.test(l));
  if (head === -1 || firstItem === -1) throw new Error('tasks.yaml の「tasks:」の下のリストが見つかりません。移していません');
  const indent = lines[firstItem].match(/^(\s*)- /)[1];
  const itemStart = new RegExp(`^${indent}- `);
  const blocks = [];
  let pending = [];
  for (let k = head + 1; k < lines.length; k++) {
    const l = lines[k];
    if (itemStart.test(l)) blocks.push([...pending, l]), (pending = []);
    else if (blocks.length === 0 || /^\s*#/.test(l) || l.trim() === '') pending.push(l);
    else if (/^\S/.test(l)) throw new Error(`tasks.yaml の ${k + 1} 行目より後ろに、tasks 以外のものがあります。移していません`);
    else blocks[blocks.length - 1].push(...pending, l), (pending = []);
  }
  if (blocks.length !== tasks.length) throw new Error('tasks.yaml の 1 件ずつの区切りを読み切れませんでした。移していません');

  // 移す先の書き方（インデント 2）に揃える
  const reindent = (block) =>
    block.map((l) => (l.trim() === '' ? '' : l.startsWith(indent) ? `  ${l.slice(indent.length)}` : l)).filter((l, k, arr) => !(l === '' && k === arr.length - 1));

  const keep = [];
  const byMonth = {};
  blocks.forEach((b, k) => {
    if (isMovable(tasks[k])) {
      const month = String(closedOn(tasks[k])).slice(0, 7);
      (byMonth[month] = byMonth[month] || []).push({ block: reindent(b.filter((l) => l.trim() !== '' || false)), title: tasks[k].title });
    } else {
      keep.push(...b);
    }
  });

  const written = [];
  for (const [month, items] of Object.entries(byMonth)) {
    const rel = `tasks/${month}.yaml`;
    const p = path.join(root, rel);
    let body;
    if (fs.existsSync(p)) {
      const cur = normalize(fs.readFileSync(p, 'utf-8'));
      parse(cur); // 読めない月のファイルには足さない
      body = /^tasks:\s*\[\]\s*$/m.test(cur) ? cur.replace(/^tasks:\s*\[\]\s*$/m, 'tasks:') : cur;
      body = body.replace(/\n*$/, '\n');
    } else {
      body = 'tasks:\n';
    }
    body += `${items.map((x) => x.block.join('\n')).join('\n')}\n`;
    parse(body);
    written.push([p, body]);
    for (const x of items) console.log(`移した: ${x.title} → ${rel}`);
  }
  const before = lines.slice(0, head);
  const rest = keep.filter((l, k, arr) => !(l.trim() === '' && (k === arr.length - 1 || arr[k + 1].trim() === '')));
  const newTasks = `${[...before, rest.some((l) => itemStart.test(l)) ? 'tasks:' : 'tasks: []', ...(rest.some((l) => itemStart.test(l)) ? rest : [])].join('\n')}\n`;
  const after = parse(newTasks);
  const moved = Object.values(byMonth).reduce((s, x) => s + x.length, 0);
  if ((Array.isArray(after.tasks) ? after.tasks.length : 0) !== tasks.length - moved) throw new Error('移したあとの tasks.yaml の件数が合いません。移していません');

  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  for (const [p, body] of written) fs.writeFileSync(p, body, 'utf-8');
  fs.writeFileSync(tasksPath, newTasks, 'utf-8');
  return 0;
}

/** 引数を読む */
function parseArgs(argv) {
  const opts = { check: false, diff: false, diffTarget: null, force: null, moveDone: false, root: null };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    const next = argv[k + 1] && !argv[k + 1].startsWith('--') ? argv[k + 1] : null;
    if (a === '--check') opts.check = true;
    else if (a === '--move-done') opts.moveDone = true;
    else if (a === '--diff') (opts.diff = true), next && ((opts.diffTarget = next), k++);
    else if (a === '--force') {
      if (!next) throw new Error('--force には、作り直す md を 1 つ付けてください（例: --force tasks.md）');
      opts.force = next;
      k++;
    } else if (a === '--root') {
      if (!next) throw new Error('--root には work repo の場所を付けてください');
      opts.root = next;
      k++;
    } else throw new Error(`知らない引数です: ${a}`);
  }
  return opts;
}

/** md の指定を work repo からの相対パスにする（./ ・絶対パスも受ける） */
function toRel(root, p) {
  return path.relative(root, path.resolve(root, p)).split(path.sep).join('/');
}

function resolveRoot(arg) {
  return arg ? path.resolve(arg) : path.resolve(__dirname, '..');
}

function isWorkRepo(root) {
  return fs.existsSync(path.join(root, 'RULES.md')) || fs.existsSync(path.join(root, 'tasks.yaml'));
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

  if (opts.moveDone) {
    try {
      process.exit(moveDone(root));
    } catch (e) {
      console.error(`エラー: ${e.message}`);
      process.exit(1);
    }
  }

  const { outputs, errors } = buildAll(root);
  for (const e of errors) console.error(`エラー: ${e.file}: ${e.message}`);
  const stale = staleOutputs(root, outputs);

  if (opts.check) {
    for (const o of stale) {
      console.log(o.handEdited ? `手で直された: ${o.md}（YAML に戻してから work-render を流す）` : `古い: ${o.md}（${o.yaml} と合っていません）`);
    }
    if (stale.length === 0 && errors.length === 0) console.log('md はすべて YAML と合っています');
    process.exit(stale.length > 0 || errors.length > 0 ? 1 : 0);
  }

  if (opts.diff) {
    const target = opts.diffTarget && toRel(root, opts.diffTarget);
    const list = target ? outputs.filter((o) => o.md === target) : stale.filter((o) => o.handEdited);
    if (target && list.length === 0) {
      console.error(`エラー: ${target} は work-render が作る md ではありません`);
      process.exit(2);
    }
    for (const o of list) {
      const p = path.join(root, o.md);
      if (!fs.existsSync(p)) {
        console.log(`=== ${o.md}: まだありません（work-render で作る）`);
        continue;
      }
      const d = lineDiff(bodyLines(o.content), bodyLines(fs.readFileSync(p, 'utf-8')));
      if (d.length === 0) {
        console.log(`=== ${o.md}: YAML から作った形と同じです`);
        continue;
      }
      console.log(`=== ${o.md}（- が YAML（${o.yaml}）から作った形、+ が今の md）`);
      for (const l of d) console.log(l);
    }
    if (list.length === 0) console.log('手で直された md はありません');
    process.exit(errors.length > 0 ? 1 : 0);
  }

  const forced = opts.force && toRel(root, opts.force);
  if (forced && !outputs.some((o) => o.md === forced)) {
    console.error(`エラー: ${forced} は work-render が作る md ではありません`);
    process.exit(2);
  }
  let blocked = 0;
  for (const o of stale) {
    if (o.handEdited && o.md !== forced) {
      console.error(`止めました: ${o.md} は手で直されています。直した中身を ${o.yaml} に戻してから、--force ${o.md} で作り直してください`);
      blocked++;
      continue;
    }
    fs.mkdirSync(path.dirname(path.join(root, o.md)), { recursive: true });
    fs.writeFileSync(path.join(root, o.md), o.content, 'utf-8');
    console.log(`更新: ${o.md}`);
  }
  if (stale.length === 0 && errors.length === 0) console.log('md はすべて YAML と合っています');
  process.exit(errors.length > 0 || blocked > 0 ? 1 : 0);
}

module.exports = { buildAll, staleOutputs, resolveRoot, isWorkRepo, listDailyYaml, listTaskMonths, normalize };

if (require.main === module) main();
