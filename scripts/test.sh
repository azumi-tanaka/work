#!/bin/bash
# test.sh — render・lint の回帰テスト（エンジニアが流す。メンバーの Claude は流さない）
#
#   bash scripts/test.sh
#   KEEP=1 bash scripts/test.sh   （通っても一時ディレクトリを消さずに残す。中身を見たいとき）
#
# この repo を $TMPDIR の一時ディレクトリに写し、中身（プロジェクト・人・タスク・daily など）を入れて、
# 正常系（render・lint が通る）と異常系（規約から外れたものをエラー・注意で出す）を確かめる。
# この repo の中は書き換えない。1 つでも外れたら 1 で終わる。

set -u
SRC=$(cd "$(dirname "$0")/.." && pwd)
BASE=$(mktemp -d "${TMPDIR:-/tmp}/work-test.XXXXXX")
PASS=0
FAIL=0
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com

ok() { PASS=$((PASS + 1)); echo "  ok   $1"; }
ng() { FAIL=$((FAIL + 1)); echo "  NG   $1"; [[ -n "${2:-}" ]] && echo "$2" | sed 's/^/       | /'; }

# expect <名前> <期待する終了コード> <出力に含まれるべき文字列（空なら見ない）> <ディレクトリ> <コマンド...>
expect() {
  local name="$1" code="$2" want="$3" dir="$4"
  shift 4
  local out rc
  out=$(cd "$dir" && "$@" 2>&1)
  rc=$?
  if [[ "$rc" != "$code" ]]; then
    ng "${name}（終了コード ${rc}。期待は ${code}）" "$out"
  elif [[ -n "$want" && "$out" != *"$want"* ]]; then
    ng "${name}（「${want}」が出ない）" "$out"
  else
    ok "$name"
  fi
}

# 雛形のうち、規約・スキル・スクリプトだけを写し、データは空から作る
# （メンバーの repo で流しても、その repo のデータに左右されない）
copy_template() {
  mkdir -p "$1"
  (cd "$SRC" && tar -cf - CLAUDE.md RULES.md README.md .gitignore .gitattributes .claude scripts) | (cd "$1" && tar -xf -)
  (cd "$1" && mkdir -p projects daily tasks _inbox && for k in projects people tasks reminders; do printf '%s: []\n' "$k" > "$k.yaml"; done)
}

# --- 中身を入れた work repo（正常系の元） ---
GOOD="$BASE/good"
copy_template "$GOOD"
cd "$GOOD" || exit 1
cat > projects.yaml <<'EOF'
projects:
  - slug: kanri-office-move
    name: 事務所の移転
    status: active
    started: 2026-10-01
  - slug: keiyaku-tenant
    name: テナントの契約
    status: done
    started: 2026-09-01
    ended: 2026-10-15
    note: "更新済み: 2 年"
EOF
cat > people.yaml <<'EOF'
people:
  - id: shacho
    name: 山田 太郎
    call: 社長
    org: 自社
    role: 代表取締役
    contact: LINE
  - id: suzuki-abc
    name: 鈴木 花子
    org: ABC 不動産
    contact: メール
EOF
mkdir -p projects/kanri-office-move/_history/2026/10 projects/kanri-office-move/_files projects/kanri-office-move/resources projects/keiyaku-tenant daily/2026/10
cat > projects/kanri-office-move/README.md <<'EOF'
# 事務所の移転

- 状態: 見積もり待ち

## 中にあるもの

- [移転の段取り](plan/移転の段取り.md) … 11 月末までの流れ
- [業者選び](research/%E6%A5%AD%E8%80%85%E9%81%B8%E3%81%B3/README.md) … 3 社の比較（リンクはエンコードされていても辿れる）
- [社長への説明](draft/2026-10-21_社長への説明.md)
EOF
mkdir -p projects/kanri-office-move/plan projects/kanri-office-move/research/業者選び/見積もり projects/kanri-office-move/draft
printf '# 移転の段取り\n' > projects/kanri-office-move/plan/移転の段取り.md
printf '# 業者選び\n\n- [見積もり](見積もり/README.md)\n' > projects/kanri-office-move/research/業者選び/README.md
printf '# 見積もり\n\n- [A社](A社.md)\n' > projects/kanri-office-move/research/業者選び/見積もり/README.md
printf '# A社\n' > projects/kanri-office-move/research/業者選び/見積もり/A社.md
printf '# 社長への説明\n' > projects/kanri-office-move/draft/2026-10-21_社長への説明.md
printf '# テナントの契約\n\n- 状態: 終わった\n' > projects/keiyaku-tenant/README.md
cat > projects/kanri-office-move/_history/2026/10/20_mail_見積もりの依頼.md <<'EOF'
# 見積もりの依頼

- 日時: 2026-10-20 14:05
- 経路: mail
- 相手: suzuki-abc・shacho

---

お世話になっております。見積もりをお願いします。
EOF
printf 'dummy' > projects/kanri-office-move/_files/2026-10-20_見積書.pdf
cat > projects/kanri-office-move/resources/2026-10.yaml <<'EOF'
resources:
  - title: 見積書（ドラフト）
    url: https://docs.google.com/document/d/xxxx
    kind: doc
    added: 2026-10-20
    note: 先方に送る前の版
  - title: ABC 不動産の見積書
    path: projects/kanri-office-move/_files/2026-10-20_見積書.pdf
    kind: file
    added: 2026-10-20
    note: 1 社目
EOF
cat > projects/kanri-office-move/_history/2026/10/21_meeting_定例.md <<'EOF'
# 定例

- 日時: 2026-10-21 10:00
- 経路: meeting
- 元: calendar:abc123
- 相手: shacho
- メモ: https://docs.google.com/document/d/yyyy

---

## 決まったこと
- 11 月末に移る
EOF
cat > tasks.yaml <<'EOF'
tasks:
  - title: 見積もりを送る
    project: kanri-office-move
    status: todo
    added: 2026-10-20
    due: 2026-10-31
    people:
      - suzuki-abc
    links:
      - projects/kanri-office-move/_history/2026/10/20_mail_見積もりの依頼.md
    note: "#2 の件"
  # 引っ越し業者のこと
  - title: "[至急] 引っ越し業者を決める"
    project: kanri-office-move
    status: doing
    added: 2026-10-20
  - title: 鍵を返す
    project: kanri-office-move
    status: done
    added: 2026-10-19
    done: 2026-10-21
EOF
cat > reminders.yaml <<'EOF'
reminders:
  - title: 家賃の振込
    repeat: monthly 25
    project: kanri-office-move
  - title: 契約の更新の連絡
    date: 2026-11-30
EOF
cat > daily/2026/10/2026-10-20.yaml <<'EOF'
date: 2026-10-20
work:
  - project: kanri-office-move
    task: 見積もりの依頼を受けた
    hours:
EOF
cat > daily/2026/10/2026-10-21.yaml <<'EOF'
date: 2026-10-21
plan:
  - project: kanri-office-move
    task: 業者を探す
work:
  - project: kanri-office-move
    task: 業者を 3 社比べた
    hours: 1.5
  - project: kanri-office-move
    task: 社長と電話
    hours: unknown
candidates:
  - text: 来週の打ち合わせの日程を決める
filed:
  - "kanri-office-move: _history に会議 1 件（10/21 定例）"
  - people.yaml に鈴木さんを足した
intake: 2026-10-21 18:30
notes: |
  # 午後は外出
  - 直帰
EOF

echo "== 正常系"
expect "render が md を作る" 0 "更新: tasks.md" "$GOOD" ./scripts/work-render
expect "render --check が通る" 0 "すべて YAML と合っています" "$GOOD" ./scripts/work-render --check
expect "lint（日中）はエラー無し" 0 "注意: daily/2026/10/2026-10-20.yaml" "$GOOD" ./scripts/work-lint
expect "lint --close（今日）は前の日の空の hours で止まらない（#1）" 0 "「hours」が空です（その日の締めで入れる" "$GOOD" ./scripts/work-lint --close --date 2026-10-21
expect "lint --close（その日）は空の hours をエラーにする（#1）" 1 "締めでは必須" "$GOOD" ./scripts/work-lint --close --date 2026-10-20
expect "daily の md に unknown が「不明」で出て、合計から外れる" 0 "合計 1.5 時間。不明 1 件を除く" "$GOOD" cat daily/2026/10/2026-10-21.md
expect "tasks.md に相手の呼び方が出る" 0 "（相手: 鈴木 花子）" "$GOOD" cat tasks.md
expect "daily の md に記録に入れたもの（filed）が出る" 0 "- people.yaml に鈴木さんを足した" "$GOOD" cat daily/2026/10/2026-10-21.md
expect "daily の md に取り込みの時刻（intake）が出る" 0 "Google の取り込み: 2026-10-21 18:30 までの分" "$GOOD" cat daily/2026/10/2026-10-21.md
expect "自分で作るもの・resources の path・meeting に注意もエラーも出ない" 1 "" "$GOOD" sh -c './scripts/work-lint | grep -E "plan/|research/|draft/|resources/2026-10.yaml|meeting"'
expect "雛形の README に雛形の印がある（/daily が /setup へ案内する）" 0 "1" "$SRC" grep -c "member-work:template" README.md
expect "hook（UserPromptSubmit）は文を出して 0 で終わる" 0 "knowledge-recorder" "$GOOD" sh -c 'echo "{}" | ./scripts/work-hook-prompt'
expect "settings.json の hook が work-hook-prompt を指す" 0 "scripts/work-hook-prompt" "$GOOD" cat .claude/settings.json

git -C "$GOOD" init -q && git -C "$GOOD" add -A && git -C "$GOOD" commit -qm init

# move-done
D="$BASE/move"; cp -R "$GOOD" "$D"
expect "--move-done が終わったタスクを月のファイルへ移す" 0 "移した: 鍵を返す → tasks/2026-10.yaml" "$D" ./scripts/work-render --move-done
expect "移したあと tasks.yaml に終わったタスクが無い" 1 "" "$D" grep -q "鍵を返す" tasks.yaml
expect "移したあと tasks.yaml のコメントが残る" 0 "# 引っ越し業者のこと" "$D" cat tasks.yaml
expect "移したあと render → lint が通る" 0 "work-lint" "$D" sh -c './scripts/work-render >/dev/null; ./scripts/work-lint'
expect "移したあと tasks.md の終わったものに出る" 0 "| 10/21 | 完了 | kanri-office-move | 鍵を返す |" "$D" cat tasks.md
expect "2 回目の --move-done は何もしない" 0 "移すタスクはありません" "$D" ./scripts/work-render --move-done
printf 'tasks:\n  - title: 最後\n    project: kanri-office-move\n    status: done\n    added: 2026-10-01\n    done: 2026-10-22\n' > "$D/tasks.yaml"
expect "全部移すと tasks: [] になり、既存の月のファイルに足す" 0 "tasks: []" "$D" sh -c './scripts/work-render --move-done >/dev/null && cat tasks.yaml && grep -c "title:" tasks/2026-10.yaml'

# やめた（dropped）タスクも --move-done で月のファイルへ移る
D="$BASE/dropped"; cp -R "$GOOD" "$D"
cat >> "$D/tasks.yaml" <<'EOF'
  - title: 古い見積もりを取り直す
    project: kanri-office-move
    status: dropped
    added: 2026-09-01
    dropped: 2026-10-21
    note: 別の業者に決めたので不要
EOF
expect "dropped（日付と理由あり）は lint のエラーにならない" 0 "終わった・やめたタスクが 2 件残っています" "$D" sh -c './scripts/work-render >/dev/null; ./scripts/work-lint'
expect "--move-done が dropped も月のファイルへ移す" 0 "移した: 古い見積もりを取り直す → tasks/2026-10.yaml" "$D" ./scripts/work-render --move-done
expect "tasks.md の終わったものに「やめた」と理由が出る" 0 "| 10/21 | やめた | kanri-office-move | 古い見積もりを取り直す<br>別の業者に決めたので不要 |" "$D" sh -c './scripts/work-render >/dev/null; cat tasks.md'
expect "移したあと lint が通る" 0 "work-lint" "$D" ./scripts/work-lint

# 長く動いていないタスク（--stale）
D="$BASE/stale"; cp -R "$GOOD" "$D"
cat >> "$D/tasks.yaml" <<'EOF'
  - title: 名刺を作る
    project: kanri-office-move
    status: waiting
    added: 2026-08-01
  - title: 備品を数える
    project: kanri-office-move
    status: todo
    added: 2026-08-01
    updated: 2026-10-01
EOF
expect "--stale は 30 日以上動いていない todo・waiting を出す" 0 "動いていない: 名刺を作る（kanri-office-move・waiting・2026-08-01 から 81 日" "$D" ./scripts/work-lint --stale --date 2026-10-21
expect "--stale は updated から数える（20 日なら出さない）" 1 "" "$D" sh -c './scripts/work-lint --stale --date 2026-10-21 | grep -q 備品を数える'
expect "--stale は doing を出さない" 1 "" "$D" sh -c './scripts/work-lint --stale --date 2026-12-31 | grep -q 引っ越し業者'
expect "--stale はちょうど 30 日で出す" 0 "備品を数える" "$D" ./scripts/work-lint --stale --date 2026-10-31
expect "--stale で何も無いとき" 0 "30 日以上動いていないタスクはありません" "$GOOD" ./scripts/work-lint --stale --date 2026-10-21

# 改行の違い（#9）
D="$BASE/crlf"; cp -R "$GOOD" "$D"
(cd "$D" && perl -pi -e 's/\n/\r\n/' tasks.md && printf '\r\n\r\n' >> tasks.md)
expect "CRLF・末尾の改行の違いは「手で直した」にしない（#9）" 0 "すべて YAML と合っています" "$D" ./scripts/work-render --check

# 手で直した md（#4・#5）
D="$BASE/edit"; cp -R "$GOOD" "$D"
(cd "$D" && sed -i '' 's/| 未着手 | 10\/31 |/| 待ち | 11\/7 |/' tasks.md && sed -i '' 's/家賃の振込/家賃の振り込み/' reminders.md && git add -A && git commit -qm "md を手で直した")
expect "--check が手で直された md を出す" 1 "手で直された: tasks.md" "$D" ./scripts/work-render --check
expect "render は手で直された md を上書きせずに止まる" 1 "止めました: tasks.md" "$D" ./scripts/work-render
expect "止めたあとも md は手で直したまま" 0 "| 待ち | 11/7 |" "$D" cat tasks.md
expect "--diff が commit 済みの md の直しを出す（#4）" 0 "+ | 待ち | 11/7 |" "$D" ./scripts/work-render --diff tasks.md
expect "--diff の - は YAML から作った形（#4）" 0 "- | 未着手 | 10/31 |" "$D" ./scripts/work-render --diff tasks.md
expect "--diff（指定なし）は手で直された md を全部出す" 0 "=== reminders.md" "$D" ./scripts/work-render --diff
expect "--force に md が無いと止まる（#5）" 2 "--force には" "$D" ./scripts/work-render --force
expect "--force <md> はその 1 つだけ作り直す（#5）" 1 "止めました: reminders.md" "$D" ./scripts/work-render --force tasks.md
expect "--force したあとの tasks.md は YAML どおり" 0 "| 未着手 | 10/31 |" "$D" cat tasks.md
expect "--force していない reminders.md は手で直したまま（#5）" 0 "家賃の振り込み" "$D" cat reminders.md
expect "--force ./reminders.md（./ 付き）も受ける" 0 "更新: reminders.md" "$D" ./scripts/work-render --force ./reminders.md
expect "--force に生成物でないものを渡すと止まる" 2 "work-render が作る md ではありません" "$D" ./scripts/work-render --force RULES.md

# 締め忘れ（#2）
echo "== 締め忘れ（--unclosed）"
D="$BASE/first"; copy_template "$D"; git -C "$D" init -q
expect "初日（全部 untracked）は締め忘れにしない" 0 "締め忘れはありません" "$D" ./scripts/work-lint --unclosed --date 2026-10-21
expect "upstream が無いときは送り忘れの確認を飛ばす" 0 "確認は飛ばしました" "$D" ./scripts/work-lint --unclosed --date 2026-10-21
D="$BASE/unclosed"; cp -R "$GOOD" "$D"
printf 'date: 2026-10-22\nwork: []\n' > "$D/daily/2026/10/2026-10-22.yaml"
expect "今日の未コミットの daily は締め忘れにしない（2 回目の「おはよう」）" 0 "締め忘れはありません" "$D" ./scripts/work-lint --unclosed --date 2026-10-22
expect "今日より前の未コミットの daily は締め忘れ" 1 "締めていない日: 2026-10-22" "$D" ./scripts/work-lint --unclosed --date 2026-10-23
(cd "$D" && printf '  - project: kanri-office-move\n    task: 追記\n    hours: 1\n' >> daily/2026/10/2026-10-21.yaml)
expect "commit 済みの前の日の daily を変えたままも締め忘れ" 1 "締めていない日: 2026-10-21" "$D" ./scripts/work-lint --unclosed --date 2026-10-23
D="$BASE/upstream"; cp -R "$GOOD" "$D"; git init -q --bare "$BASE/remote.git"
(cd "$D" && git remote add origin "$BASE/remote.git" && git push -q -u origin HEAD 2>/dev/null)
expect "push 済みなら締め忘れなし" 0 "締め忘れはありません" "$D" ./scripts/work-lint --unclosed --date 2026-10-22
(cd "$D" && git commit -q --allow-empty -m "daily: 2026-10-21")
expect "送っていない commit を出す" 1 "GitHub に送っていない commit が 1 件" "$D" ./scripts/work-lint --unclosed --date 2026-10-22

# --- 異常系（正常系の元を写して 1 か所ずつ壊す） ---
echo "== 異常系"
# case <名前> <期待する終了コード> <出力に含まれるべき文字列> <壊すコマンド（作業ディレクトリで sh -c）> [lint の引数...]
N=0
case_() {
  local name="$1" code="$2" want="$3" breaker="$4"
  shift 4
  N=$((N + 1))
  local d="$BASE/case$N"
  cp -R "$GOOD" "$d"
  (cd "$d" && sh -c "$breaker")
  expect "$name" "$code" "$want" "$d" ./scripts/work-lint "$@"
}
case_ "知らないキー" 1 "知らないキー「owner」" "sed -i '' 's/^    due: 2026-10-31/    owner: me/' tasks.yaml"
case_ "台帳に無いプロジェクトを指す" 1 "プロジェクト「nothing」が台帳" "sed -i '' 's/^    project: kanri-office-move$/    project: nothing/' reminders.yaml"
case_ "台帳に無いディレクトリ" 1 "projects/extra: 台帳（projects.yaml）にありません" "mkdir projects/extra && touch projects/extra/README.md"
case_ "ディレクトリの無い台帳の行" 1 "projects/ghost/ がありません" "printf '  - slug: ghost\n    name: 幽霊\n    status: active\n    started: 2026-10-01\n' >> projects.yaml"
case_ "slug の重複" 1 "slug「kanri-office-move」が 2 回" "printf '  - slug: kanri-office-move\n    name: 二重\n    status: active\n    started: 2026-10-01\n' >> projects.yaml"
case_ "終わったプロジェクトに ended が無い" 1 "「ended」（終わった日）" "sed -i '' '/ended: 2026-10-15/d' projects.yaml"
case_ "プロジェクトの status の取れる値" 1 "active ／ paused ／ done" "sed -i '' 's/status: active/status: open/' projects.yaml"
case_ "people に無い人をタスクで指す" 1 "人「tanaka」が people.yaml にありません" "sed -i '' 's/      - suzuki-abc/      - tanaka/' tasks.yaml"
case_ "_history の相手が people に無い（注意）" 0 "相手「sato」が people.yaml" "sed -i '' 's/- 相手: suzuki-abc・shacho/- 相手: sato/' projects/kanri-office-move/_history/2026/10/20_mail_見積もりの依頼.md"
case_ "[ で始まる文字列は「囲む」を先に案内（#7）" 1 '値全体を "..." で囲んでください（例: "[至急] 見積もり [確認]"）' "sed -i '' 's/title: \"\\[至急\\] 引っ越し業者を決める\"/title: [至急] 見積もり [確認]/' tasks.yaml"
case_ "日本語のキーは「半角の英字」と出す（#7）" 1 "キー「タイトル」は半角の英字" "sed -i '' 's/^  - title: 鍵を返す/  - タイトル: 鍵を返す/' tasks.yaml"
case_ "トップの日本語のキー（#7）" 1 "キー「日付」は半角の英字" "printf '日付: 2026-10-21\n' >> daily/2026/10/2026-10-21.yaml"
case_ "キーの直後の # で値が消える（注意 #8）" 0 "「note」の値が # で始まる" "sed -i '' 's/    note: \"#2 の件\"/    note: #2 の件/' tasks.yaml && ./scripts/work-render >/dev/null"
case_ "hours が数字でも unknown でもない" 1 "「hours」は数字か unknown" "sed -i '' 's/hours: 1.5/hours: abc/' daily/2026/10/2026-10-21.yaml"
case_ "hours の .5" 1 "「hours」は数字か unknown" "sed -i '' 's/hours: 1.5/hours: .5/' daily/2026/10/2026-10-21.yaml"
case_ "daily の date がファイル名と違う" 1 "ファイル名と合っていません" "sed -i '' 's/^date: 2026-10-21/date: 2026-10-22/' daily/2026/10/2026-10-21.yaml"
case_ "daily の置き場の月が違う" 1 "日付がディレクトリ（2026/10）と合っていません" "printf 'date: 2026-11-01\nwork: []\n' > daily/2026/10/2026-11-01.yaml"
case_ "resources の added がファイルの月と違う" 1 "ファイルの月と違います" "sed -i '' 's/added: 2026-10-20/added: 2026-09-30/' projects/kanri-office-move/resources/2026-10.yaml"
case_ "tasks/ の done がファイルの月と違う" 1 "「done」（2026-10-21）がファイルの月と違います" "./scripts/work-render --move-done >/dev/null && mv tasks/2026-10.yaml tasks/2026-09.yaml"
case_ "tasks/ に終わっていないタスク" 1 "終わった・やめたタスク（status: done ・ dropped）だけ" "printf 'tasks:\n  - title: x\n    project: kanri-office-move\n    status: todo\n    added: 2026-10-01\n' > tasks/2026-10.yaml"
case_ "dropped に理由（note）が無い" 1 "やめた理由を書いて" "printf '  - title: x\n    project: kanri-office-move\n    status: dropped\n    added: 2026-10-01\n    dropped: 2026-10-21\n' >> tasks.yaml"
case_ "dropped に日付が無い" 1 "「dropped」（やめた日）" "printf '  - title: x\n    project: kanri-office-move\n    status: dropped\n    added: 2026-10-01\n    note: 不要\n' >> tasks.yaml"
case_ "dropped の日付があるのに status が dropped でない" 1 "「dropped」があるのに status が todo" "printf '  - title: x\n    project: kanri-office-move\n    status: todo\n    added: 2026-10-01\n    dropped: 2026-10-21\n' >> tasks.yaml"
case_ "tasks/ の dropped の日付がファイルの月と違う" 1 "「dropped」（2026-10-21）がファイルの月と違います" "printf 'tasks:\n  - title: x\n    project: kanri-office-move\n    status: dropped\n    added: 2026-09-01\n    dropped: 2026-10-21\n    note: 不要\n' > tasks/2026-09.yaml"
case_ "updated の形" 1 "「updated」は YYYY-MM-DD" "sed -i '' 's/^    due: 2026-10-31/    updated: 2026-10-32/' tasks.yaml"
case_ "done があるのに status が done でない" 1 "「done」があるのに status が todo" "sed -i '' 's/    status: done/    status: todo/' tasks.yaml"
case_ "_history の経路が違う" 1 "経路は claude" "mv projects/kanri-office-move/_history/2026/10/20_mail_見積もりの依頼.md projects/kanri-office-move/_history/2026/10/20_fax_見積もりの依頼.md"
case_ "_history の月のディレクトリが無い" 1 "年の下は月のディレクトリ" "mkdir -p projects/kanri-office-move/_history/2026/x"
case_ "_files のファイル名" 1 "<YYYY-MM-DD>_<名前>.<拡張子>" "touch projects/kanri-office-move/_files/見積書.pdf"
case_ "直下の決まりに無いファイル（注意）" 0 "注意: memo.txt: work repo の直下に置くものではありません" "touch memo.txt"
case_ "RULES.md が無い" 1 "RULES.md: ありません" "rm RULES.md"
case_ "締める日の daily が無い" 1 "締める日（2026-10-22）の daily がありません" "true" --close --date 2026-10-22
case_ "YAML を変えて render を流していない" 1 "tasks.yaml と合っていません" "sed -i '' 's/見積もりを送る/見積もりを出す/' tasks.yaml"
case_ "md を手で直した" 1 "手で直されています" "sed -i '' 's/見積もりを送る/見積もりを出す/' tasks.md"
case_ "reminders に date と repeat の両方" 1 "どちらか一方" "perl -0pi -e 's/    repeat: monthly 25\n/    repeat: monthly 25\n    date: 2026-11-25\n/' reminders.yaml"
case_ "repeat の形" 1 "「repeat」の形が違います" "sed -i '' 's/monthly 25/monthly 32/' reminders.yaml"
case_ "タブのインデント" 1 "タブは使えません" "printf 'tasks:\n\t- title: x\n' > tasks.yaml"
case_ "--date の形" 2 "--date は YYYY-MM-DD" "true" --close --date 2026-13-01

echo "== 自分で作るもの（plan・research・draft）・resources・daily の新しいキー"
P=projects/kanri-office-move
case_ "README から辿れないもの（注意）" 0 "plan/業者への電話.md: projects/kanri-office-move/README.md から辿れません" "printf 'x\n' > $P/plan/業者への電話.md"
case_ "話のディレクトリの README から辿れないもの（注意）" 0 "見積もり/B社.md: projects/kanri-office-move/research/業者選び/見積もり/README.md から辿れません" "printf 'x\n' > $P/research/業者選び/見積もり/B社.md"
case_ "話のディレクトリに README が無い（注意）" 0 "入口の README.md" "mkdir -p $P/draft/文面 && printf 'x\n' > $P/draft/文面/a.md && printf -- '- [文面](draft/文面/)\n' >> $P/README.md"
case_ "深すぎる（注意）" 0 "深すぎます" "mkdir -p $P/research/業者選び/見積もり/細目 && printf -- '- [細目](細目/README.md)\n' >> $P/research/業者選び/見積もり/README.md && printf '# 細目\n' > $P/research/業者選び/見積もり/細目/README.md"
case_ "名前に空白" 1 "名前に空白" "printf 'x\n' > '$P/plan/移転 の段取り.md'"
case_ "頭の日付がありえない" 1 "頭の日付がありえません（2026-13-01）" "printf 'x\n' > $P/draft/2026-13-01_x.md"
case_ "日付の形が違う" 1 "<YYYY-MM-DD>_ の形" "printf 'x\n' > $P/draft/20261021_x.md"
case_ "用途に無いディレクトリ（注意）" 0 "自分で作ったものは plan・research・draft へ" "mkdir -p $P/notes && printf 'x\n' > $P/notes/a.md"
case_ "plan がディレクトリでない" 1 "plan はディレクトリにします" "rm -r $P/plan && printf 'x\n' > $P/plan"
case_ "resources に url と path の両方" 1 "どちらか一方" "perl -0pi -e 's/    kind: doc\n/    kind: doc\n    path: projects\/kanri-office-move\/README.md\n/' $P/resources/2026-10.yaml"
case_ "resources に url も path も無い" 1 "どちらか一方" "sed -i '' '/url: https/d' $P/resources/2026-10.yaml"
case_ "resources の path の先が無い（注意）" 0 "path の先が見つかりません" "sed -i '' 's|_files/2026-10-20_見積書.pdf|_files/無い.pdf|' $P/resources/2026-10.yaml"
case_ "resources の path に URL" 1 "相対パスにします" "sed -i '' 's|path: projects/kanri-office-move/_files/2026-10-20_見積書.pdf|path: https://example.com/x|' $P/resources/2026-10.yaml"
case_ "resources の kind の取れる値" 1 "doc ／ sheet ／ slide ／ drive ／ notion ／ web ／ file ／ other" "sed -i '' 's/kind: file/kind: pdf/' $P/resources/2026-10.yaml"
case_ "daily の intake の形" 1 "「intake」は YYYY-MM-DD HH:MM" "sed -i '' 's/^intake: 2026-10-21 18:30/intake: 2026-10-21 25:00/' daily/2026/10/2026-10-21.yaml"
case_ "daily の filed は文字列のリスト" 1 "「filed」は文字列のリスト" "perl -0pi -e 's/  - people.yaml に鈴木さんを足した\n/  - text: x\n/' daily/2026/10/2026-10-21.yaml"
case_ "_history の経路は meeting まで" 1 "経路は claude ／ mail ／ chat ／ line ／ meeting ／ memo" "mv $P/_history/2026/10/21_meeting_定例.md $P/_history/2026/10/21_mtg_定例.md"

echo
echo "ok: $PASS ・ NG: $FAIL （一時ディレクトリ: ${BASE}）"
[[ $FAIL -eq 0 && -z "${KEEP:-}" ]] && rm -rf "$BASE"
[[ $FAIL -eq 0 ]]
