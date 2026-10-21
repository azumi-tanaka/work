# work repo の規約（正）

この repo の置き場・ファイル名・月での分け方・YAML の形・やってはいけないことの定義。ここが正で、`CLAUDE.md` とスキル（`/daily`・`/work-rules`・`/setup`・`/import`）はここを指す。`./scripts/work-lint` はこの文書のとおりに検査する。
**この文書を変えたら、`scripts/lint.js`（と、md の形が変わるなら `scripts/render.js`）も一緒に直す。** 変えるのはエンジニア。Claude は変えない。

## ツリー

```
work/
├── CLAUDE.md                      誰の repo か・本人のこと・本人の好み（/setup が埋め、本人が育てる）
├── RULES.md                       この文書（規約の正）
├── README.md                      この repo の説明（本人向け。雛形のあいだはエンジニア向け）
├── .claude/                       Claude のスキル（daily・work-rules・setup・import）・調べ役のエージェント・設定
├── scripts/                       work-render（YAML → md）・work-lint（規約の検査）・hook のスクリプト
├── projects.yaml                  プロジェクトの台帳（状態・始めた日・終わった日）
├── people.yaml                    人（社長・社内の人・取引先の担当者など）
├── projects/<slug>/
│   ├── README.md                  いちばん上の抽象。いまの状態・次の一手・中にあるものへの入口
│   ├── plan/                      自分で作るもの: 計画・実行プラン・段取り
│   ├── research/                  自分で作るもの: 調べもの・比べたもの・まとめ
│   ├── draft/                     自分で作るもの: 資料・文面の下書き、叩き台
│   ├── _history/<YYYY>/<MM>/      やりとりの原文・会議の記録。1 件 1 ファイル: <DD>_<経路>_<件名>.md
│   ├── _files/                    受け取った実物（PDF・PNG など）: <YYYY-MM-DD>_<名前>.<拡張子>
│   └── resources/<YYYY-MM>.yaml   資料の索引（外部の URL と repo の中のファイル）。登録した月のファイルに 1 件ずつ
├── tasks.yaml  → tasks.md         終わっていないタスク（正は YAML。md は生成物）
├── tasks/<YYYY-MM>.yaml           その月に終わった・やめたタスク（締めで tasks.yaml から移す）
├── reminders.yaml → reminders.md  期日・定期の用事
├── daily/<YYYY>/<MM>/<YYYY-MM-DD>.yaml   正。その日の予定と作業
├── daily/<YYYY>/<MM>/<YYYY-MM-DD>.md     生成物
└── _inbox/                        振り分け前のもの（取り込みの途中・どこにも入れられなかったもの）。中は自由
```

- 直下・プロジェクトの中に置くのは上のものだけ。**決まりに無い置き場を足さない**（足したいときはエンジニアに伝える）。
- `.gitkeep`・`.DS_Store`・`.gitattributes` は検査しない。

## 受け取ったもの・作ったものの置き場

| もの | 置き場 | 名前・形 |
|---|---|---|
| 「こういう作業をやった」 | 今日の `daily/<YYYY>/<MM>/<日付>.yaml` の `work` | `project`・`task`・`hours`（時間は本人の言ったまま。言っていなければ `hours:` を空にしておき、締めで聞く） |
| メール・チャット・LINE の文面、Claude との相談の中身 | `projects/<slug>/_history/<YYYY>/<MM>/` | `<DD>_<経路>_<件名>.md`。1 件 1 ファイル。原文をそのまま（要約しない） |
| 会議（Google カレンダーの予定と、Gemini のメモ・文字起こし） | `projects/<slug>/_history/<YYYY>/<MM>/` | `<DD>_meeting_<会議の名前>.md`。原文の代わりに、メモ・文字起こしへのリンクと要約（下の「`_history` のファイルの中身」） |
| PDF・画像などのファイル | `projects/<slug>/_files/` | `<YYYY-MM-DD>_<名前>.<拡張子>`。Downloads から移すときは、移す前に名前を見せる |
| Google ドキュメント・スプレッドシート・Drive・Notion などの URL | `projects/<slug>/resources/<YYYY-MM>.yaml` | 登録した月のファイルに 1 件ずつ。概要（`note`）と URL |
| 自分で作るもの（計画・実行プラン・資料の叩き台・調べもの・まとめ） | `projects/<slug>/plan/`・`research/`・`draft/` | 下の「プロジェクトの中で自分で作るもの」 |
| やること（本人が「タスクにして」と言ったもの） | `tasks.yaml` | 下の「tasks」 |
| 期日・定期の用事 | `reminders.yaml` | `date`（1 回だけ）か `repeat`（繰り返し） |
| 新しく出てきた人（取引先の担当者など） | `people.yaml` | 下の「people.yaml」 |
| どこにも決まらないもの・取り込みの途中のもの | `_inbox/` | 自由。あとでプロジェクトへ振り分ける |
| 案件の「いまの状態」 | `projects/<slug>/README.md` | 状態・関係する人・次の一手と、中にあるもの（自分で作ったもの）への入口。資料の一覧は `resources` が持つ |

- **4 つを混ぜない。** `_history` はやりとりの原文（相手がいるもの・会議）、`_files` は受け取った実物、`resources` は資料の索引（URL と概要）、`plan`・`research`・`draft` は自分で作るもの。自分で作った計画を `resources` や `_history` に入れない。
- 日付・時刻は推測しない。`date +%F`（日付）・`date '+%F %H:%M'`（日時）で取る。

## プロジェクト

- **単位はプロジェクトだけ。** 事業などの上の階層は作らない。契約・労務・管理まわりも 1 つのプロジェクトとして切る。仕事は全部どれかのプロジェクトに入れる。
- 分けて並べたいときは、slug の頭に区分を付けてよい（例: `keiyaku-tenant`・`roumu-nenmatsu`・`kanri-office`）。区分は、台帳に既にあるものに揃える（同じものに別の区分を作らない）。粒度と区分の目安は、dev-tools の `project-catalog` スキル。
- 新しく作るときは、名前（日本語）を本人に確かめ、slug を決めて、**台帳 `projects.yaml` に 1 件足し、`projects/<slug>/README.md` を作る**（README の 1 行目は `# <日本語の名前>`）。
- **終わったプロジェクトも、ディレクトリは動かさない。** 台帳の `status` を `done` にして `ended` を書く。

### projects.yaml（台帳）

```yaml
projects:
  - slug: kanri-office-move         # 必須。projects/ のディレクトリ名。半角の英小文字・数字・ハイフン
    name: 事務所の移転                # 必須。日本語の名前
    status: active                  # 必須。active（進行中）／ paused（休止）／ done（終わった）
    started: 2026-10-20             # 必須。始めた日
    ended: 2026-12-01               # status: done のとき必須。終わった日（done 以外では書かない）
    note: 年内に移る                  # 任意
```

- 台帳にあるものと `projects/` のディレクトリは 1 対 1（どちらかだけにあるものは lint のエラー）。
- 足した順に下へ足す。消さない。

### プロジェクトの README.md

プロジェクトの中で、いちばん上の抽象。開けば「いまどうなっているか」と「中に何があるか」が分かるようにする。

```markdown
# 事務所の移転

- 状態: 業者の見積もり待ち（10/25 に 3 社そろう）
- 関係する人: 社長（shacho）・ABC 不動産の鈴木さん（suzuki-abc）
- 次の一手: 見積もりがそろったら、比べた表を社長に見せる

## 中にあるもの

- [移転の段取り](plan/移転の段取り.md) … 11 月末までの流れ
- [業者選び](research/業者選び/README.md) … 3 社の比較
- [社長への説明の下書き](draft/社長への説明.md)

資料（外部の URL と、受け取ったファイル）は `resources/`、やりとりは `_history/`。
```

- 「中にあるもの」には、`plan`・`research`・`draft` の直下に置いたものを全部、1 行の説明つきで並べる。

## プロジェクトの中で自分で作るもの（計画・調べもの・下書き）

**浅い階層 ＝ 抽象・よく見るもの、深い階層 ＝ 具体・たまにしか見ないもの。** プロジェクトの `README.md` がいちばん上。その下に用途の 3 つのディレクトリを置き、細かいものほど深く置く。

| ディレクトリ | 置くもの | 例 |
|---|---|---|
| `plan/` | 計画・実行プラン・段取り・スケジュール | `移転の段取り.md` |
| `research/` | 調べもの・比べたもの・まとめ・議事のまとめ（自分で書いたもの） | `業者選び/README.md` |
| `draft/` | 資料・文面・メールの下書き、叩き台 | `社長への説明.md`・`2026-10-21_見積もりの依頼文.md` |

- 用途のディレクトリはこの 3 つだけ。使うものだけ作る（空のディレクトリは作らない）。迷ったら、「これからやること」は `plan`、「分かったこと」は `research`、「人に出すものの下書き」は `draft`。
- **1 つの話は 1 ファイル**（`<名前>.md`）。同じ話が育って何ファイルにもなったら、話のディレクトリ（`<名前>/`）を作り、入口の `README.md`（要約と、中のファイルへのリンク）と、細かいファイルを入れる。
- **深さは、用途のディレクトリの下に 2 段まで**（`research/業者選び/見積もり/A社.md` まで）。それより深くしない。
- **足したら、1 つ上の入口から辿れるようにする。** 用途のディレクトリの直下に足したものはプロジェクトの `README.md` の「中にあるもの」に、話のディレクトリの中に足したものはその `README.md` に、リンクと 1 行の説明を書く。
- 名前: 日本語でよい。空白は `-` か `_` にする。`/ \ : * ? " < > |` は使わない。日付は付けない（中身を育てていくもの）。**その日の版として残すもの**（出した文面・ある日の時点のまとめ）だけ、頭に `<YYYY-MM-DD>_` を付ける。
- 中身は md が基本。表計算・スライドなどは Google の側で作り、URL を `resources` に入れる（repo の中に置くのは、本人が手元で作ったファイルだけ）。
- 古くなった計画も消さない。`README.md` の「中にあるもの」で、いま見るものはどれかが分かるように書く（古いものは「（古い。〇〇に置き換え）」と添える）。

## people.yaml（人）

社長・社内の人・取引先の担当者などを、プロジェクトの外のここ 1 か所にまとめる。`_history` とタスクからは `id` で指す。

```yaml
people:
  - id: shacho                      # 必須。半角の英小文字・数字・ハイフン。指すときに使う
    name: 山田 太郎                   # 必須。名前
    call: 社長                       # 任意。呼び方（md にはこれが出る）
    org: 自社                        # 任意。所属
    role: 代表取締役                  # 任意。役割
    contact: LINE                   # 任意。連絡の経路（メール・LINE・電話など。アドレスや番号は書かない）
    note: 急ぎは LINE で              # 任意
```

- 初めての相手が出てきたら、先にここへ足してから `_history` やタスクで指す。

## 名前の決まり

| もの | 形 | 例 |
|---|---|---|
| プロジェクト（slug） | 半角の英小文字・数字・ハイフン（`^[a-z0-9][a-z0-9-]*$`） | `kanri-office-move` |
| 人（id） | 同じ | `shacho`・`suzuki-abc` |
| `_history` のファイル | `<YYYY>/<MM>/<DD>_<経路>_<件名>.md` | `2026/10/20_mail_見積もりの依頼.md` |
| 経路 | `claude`（Claude・ChatGPT など AI との会話）・`mail`・`chat`（Google Chat など）・`line`（社長との LINE も）・`meeting`（会議）・`memo`（本人のメモ・電話） | |
| 件名 | `/` を含まない。空白は `-` にする | `見積もりの依頼` |
| `_files` のファイル | `<YYYY-MM-DD>_<名前>.<拡張子>`。日付は受け取った日（分からなければ置いた日）。サブディレクトリは作らない | `2026-10-20_見積書.pdf` |
| `plan`・`research`・`draft` の中 | `<名前>.md`・`<名前>/README.md`。その日の版だけ `<YYYY-MM-DD>_<名前>.md` | `移転の段取り.md` |
| `resources` のファイル | `<YYYY-MM>.yaml`（登録した月） | `2026-10.yaml` |
| `tasks` の月のファイル | `tasks/<YYYY-MM>.yaml`（終わった月） | `tasks/2026-10.yaml` |
| daily | `daily/<YYYY>/<MM>/<YYYY-MM-DD>.yaml` | `daily/2026/10/2026-10-20.yaml` |

**月で切る。** `_history`・`daily` は月のディレクトリ、`resources`・終わったタスクは月のファイル。**前の月のファイルに追記しない**（今月のファイルに書く）。
- `_history` だけは、やりとりのあった日の月のディレクトリに入れる（取り込みで前の月のやりとりを入れるのはよい。1 件 1 ファイルなので、既にあるファイルに書き足すことにはならない）。

## `_history` のファイルの中身

```markdown
# 見積もりの依頼

- 日時: 2026-10-20 14:05
- 経路: mail
- 相手: suzuki-abc

---

（原文をそのまま。要約しない）
```

- `相手` は `people.yaml` の `id`。複数なら `・` で区切る（`shacho・suzuki-abc`）。経路が `claude`・`memo` で相手がいないときは、行ごと省く。
- メールは 1 通 1 ファイル（同じスレッドの返信も 1 通ずつ）。チャットは、同じ日の同じスレッド（DM なら同じ日の一続きの会話）を 1 ファイルにまとめてよい。
- 原文の中のメールアドレス・電話番号・口座番号などは `［メールアドレス］`・`［電話番号］` のように伏せる（下の「やってはいけないこと」）。ほかは変えない。
- 取り込んだもの（Gmail・Google Chat から）は、`- 日時` の下に `- 元: <Gmail のスレッドやメッセージの ID・チャットのスペースとメッセージの ID>` を 1 行足す（同じものを 2 回取り込まないため）。

**会議（`meeting`）** は、原文の代わりにリンクと要約を書く:

```markdown
# 定例（愛知マリアクリニック）

- 日時: 2026-10-21 10:00
- 経路: meeting
- 相手: aichi-maria-tanaka・shacho
- メモ: https://docs.google.com/document/d/xxxx （Gemini のメモ）
- 文字起こし: https://docs.google.com/document/d/yyyy

---

## 決まったこと
- …

## 宿題
- …（誰が・いつまで）

## 出た数字
- …
```

- メモ・文字起こしが見つからなかった会議は、予定の名前・日時・相手と「メモなし」だけを書く（中身を推測で書かない）。

## YAML の書き方（全部の YAML に共通）

- インデントは半角スペース 2 つ。タブは使わない。
- キーは半角の英字（と `_`）。下の各ファイルにあるキーだけを使う。
- 日付は `YYYY-MM-DD`、引用符なし。日時は `YYYY-MM-DD HH:MM`、引用符なし。
- 時間などの数字は `1.5`・`0.5` と書く（`.5` は数字として読まれない）。
- 文字列に `: `（コロンと空白）・` #` が入るとき、または `- [ { " ' & * ! | > % @ #` で始まるときは、値全体を `"..."` で囲む。
  - 例: `title: "[至急] 見積もりを送る"`・`task: "打ち合わせ: 10 時から"`・`note: "#2 の件"`
- 複数行の文は `|` で書く（`>` は使わない）。
- 空のリストは `[]`。使わないキーは書かない（`null` を書かない）。
- アンカー（`&`・`*`）・タグ（`!`）・`{ }` の形は使わない。
- 知らないキーは lint のエラー。キーを足すときは、この文書と `scripts/lint.js` を直してから（エンジニア）。

## tasks

終わっていないタスクは `tasks.yaml`、終わった・やめたタスクはその月の `tasks/<YYYY-MM>.yaml`。1 つのファイルに終わったものが溜まり続けないようにする。

```yaml
tasks:
  - title: 見積もりを送る           # 必須。何をするか
    project: kanri-office-move     # 必須。台帳の slug
    status: todo                   # 必須。todo（未着手）／ doing（進行中）／ waiting（待ち）／ done（完了）／ dropped（やめた）
    added: 2026-10-20              # 必須。足した日
    updated: 2026-10-22            # 任意。最後に状態を変えた日・「続けます」と言われた日（無ければ added から数える）
    due: 2026-10-31                # 任意。期日
    done: 2026-10-25               # status: done のとき必須。終わった日（done 以外では書かない）
    people:                        # 任意。関係する人（people.yaml の id）
      - suzuki-abc
    links:                         # 任意。work repo からの相対パスか URL
      - projects/kanri-office-move/_history/2026/10/20_mail_見積もりの依頼.md
    note: 先方は月末締め            # 任意
```

- 足した順に下へ足す。
- **タスクにするのは、本人が「はい」と言ったものだけ。** 取り込み・会話から見つけた「やることに見えるもの」は、daily の `candidates` に入れて本人に聞く。
- 状態（`status`）を変えたら、`updated` をその日にする。
- 終わったら `status: done`・`done: <日付>` にする（その場では消さない）。
- **やめたら**（やらなくなった・要らなくなった・ほかのタスクに吸収された）`status: dropped`・`dropped: <やめた日>` にし、`note` にやめた理由を書く（どちらも必須）。消さない。
  ```yaml
  - title: 古い見積もりを取り直す
    project: kanri-office-move
    status: dropped
    added: 2026-09-01
    dropped: 2026-10-21
    note: 別の業者に決めたので不要
  ```
- 締めで `./scripts/work-render --move-done` が、終わったもの・やめたものを `tasks/<done か dropped の日の YYYY-MM>.yaml` へ機械で移す（手で切り貼りしない）。
- `tasks/<YYYY-MM>.yaml` の形は `tasks.yaml` と同じ（中身は `status: done` か `dropped` で、その日付がその月のものだけ。`status` で見分ける）。
- **長く動いていないタスク**: `todo`・`waiting` のまま **30 日以上**（`updated`、無ければ `added` から）動いていないものは、始業で `./scripts/work-lint --stale` が挙げ、「やめますか・続けますか」と本人に聞く（3 件まで）。「続けます」なら `updated` をその日に、「やめます」なら上の「やめたら」のとおりに。返事が無ければそのまま残す（**勝手に dropped にしない**）。

## reminders.yaml

```yaml
reminders:
  - title: 家賃の振込                # 必須
    repeat: monthly 25             # date か repeat のどちらか一方
    project: kanri-office-move     # 任意
    note: 25 日が休みなら前の営業日   # 任意
  - title: 契約の更新の連絡
    date: 2026-11-30               # 1 回だけのもの
```

- `repeat` の形: `daily` ／ `weekly mon`（`sun` `mon` `tue` `wed` `thu` `fri` `sat`）／ `monthly 25`（1〜31）／ `yearly 04-01`

## daily/<YYYY>/<MM>/<YYYY-MM-DD>.yaml

```yaml
date: 2026-10-20                   # 必須。ファイル名と同じ日付
plan:                              # 任意。始業で決めた今日の予定
  - project: kanri-office-move
    task: 見積もりの下書き
work:                              # 必須（無い日は work: []）。やったこと 1 行ずつ
  - project: kanri-office-move
    task: 見積もりの下書きを作った
    hours: 1.5                     # その日の締めでは必須。本人の申告のまま（日中は空でよい: hours:）
    links:                         # 任意
      - projects/kanri-office-move/draft/見積もりの依頼文.md
candidates:                        # 任意。「これはタスクではありませんか」と聞いて返事が無かったもの
  - text: 来週の打ち合わせの日程を決める
    project: kanri-office-move     # 任意
rejected:                          # 任意。候補のうち、本人が「違う」と言ったもの（次から出さない）
  - text: 前の週の会議の資料を探す
    project: kanri-office-move     # 任意
filed:                             # 任意。取り込み・会話から、記録に入れたもの（1 行ずつ。確認で本人に見せる）
  - "kanri-office-move: _history にメール 2 件（ABC 不動産の見積もり）"
  - "people.yaml: 鈴木さんの役割を「営業」に"
intake: 2026-10-20 17:40           # 任意。Google（カレンダー・Gmail・Chat・Drive）の取り込みを、どの時刻までの分まで済ませたか
notes: |                           # 任意。その日のメモ
  午後は外出
```

- `project` は台帳にある slug だけ（無ければ先に台帳と `projects/<slug>/README.md` を作る）。
- **時間が分からないとき**: 本人に聞いても分からない作業は `hours: unknown` と書く（空のままにしない。推測で数字を入れない）。md では「不明」と出て、合計には入らない。
- 締めで `hours` が必須になるのは、締める日の daily だけ。前の日の daily に空の `hours` が残っていても、lint は注意を出すだけで締めは止まらない（気づいたら本人に聞いて、数字か `unknown` を入れる）。
- 返事が「はい」の候補は `tasks.yaml` へ移し、`candidates` からは消す。「違う」の候補は `rejected` へ移す。
- `intake` は、取り込みを回すたびにその日の daily に上書きする。次の取り込みは、いちばん新しい `intake` の時刻から先の分だけを見る。

## projects/<slug>/resources/<YYYY-MM>.yaml

`resources` は、そのプロジェクトの**資料の索引**。外部の資料（Google のドキュメント・スプレッドシートなど）は URL を、repo の中のファイル（`_files` の実物など）は相対パスを、概要と一緒に書く。

```yaml
resources:
  - title: 見積書（ドラフト）          # 必須
    url: https://docs.google.com/document/d/xxxx   # url か path のどちらか一方。url は http(s)
    kind: doc                       # 必須。doc ／ sheet ／ slide ／ drive ／ notion ／ web ／ file ／ other
    added: 2026-10-20               # 必須。ファイルの月と同じ月
    note: 先方に送る前の版。金額は未記入   # 概要。何の資料か・何が書いてあるか 1〜2 行（なるべく書く）
  - title: ABC 不動産の見積書
    path: projects/kanri-office-move/_files/2026-10-20_見積書.pdf   # work repo からの相対パス
    kind: file                      # repo の中のファイルは file
    added: 2026-10-20
    note: 3 社のうち 1 社目。月額の内訳つき
```

- 自分で作ったもの（`plan`・`research`・`draft`）は、プロジェクトの `README.md` から辿る。`resources` には入れない。
- 同じ URL を 2 回入れない（前の月のファイルにあれば、足さない）。

## 取り込み（Google カレンダー・Gmail・Google Chat・Drive）

`/daily`（と最初の `/import`）が、本人の Google のアカウントから材料を集め、プロジェクトへ振り分けて格納する。

- **送信は絶対にしない。** メール・チャットの送信・返信・下書きの作成、予定の作成・変更、ファイルの共有・変更・削除はしない。頼まれても、ここではしない（本人が自分で送る）。
- 読むのは、本人が入っているもの（受信箱・送ったもの・本人が入っているスペースと DM・本人の予定・本人に共有されたファイル）だけ。宣伝・一斉配信・自動の通知は外す。Notion は見ない。
- 集めるのは調べ役のエージェント（`.claude/agents/intake-collector.md`）。経路ごとに分けて並べて回し、生のメール・チャットはメインの会話に入れない。集めたものは、いったん `_inbox/intake/<YYYY-MM-DD-HHMM>/` に置く。
- メインは、集めたものの一覧を見てプロジェクトと人を決め、`_history`・`resources`・daily の `candidates` へ**本人に 1 件ずつ聞かずに**入れる（拙くても入れる。違っていたら、本人に言われたとおりに直す）。入れたものは、その日の daily の `filed` に 1 行ずつ残す。どこにも入れられなかったものは `_inbox/intake/` に残す。
- 新しいプロジェクトが要りそうなときだけは、作る前に本人に聞く（名前と slug を決めるため）。新しい人は、`people.yaml` に足してよい（足したことを `filed` に残す）。
- 見る Google のアカウントは、`CLAUDE.md` の「私のこと」にある MCP のサーバー名（`google-workspace` など）。アカウントを足したら、そこに 1 行足す。
- つながっていない（ツールが無い・認証が切れた）ときは、dev-tools の `google-workspace-connect` スキルを案内して、取り込み無しで先へ進む。

## 会話で分かったことの反映

本人との会話で新しい事実（相手・期日・決まったこと・状態の変化・やるべきこと）が分かったら、裏で記録に反映する。

- 反映するのは記録係のエージェント（`.claude/agents/knowledge-recorder.md`）。メインは渡すだけで、本人との会話を止めない。
- 反映先: プロジェクトの `README.md`（状態・次の一手）・`people.yaml`（人の役割・所属など）・`_history`（本人から聞いた中身を `<DD>_claude_<件名>.md` に）・その日の daily の `candidates`（やるべきこと。タスクにはしない）。反映したことは、その日の daily の `filed` に 1 行ずつ残す。
- 本人には、まとめて短く伝える（区切りのよいところか、daily の確認で）。毎回の返事に混ぜない。
- 仕組み: `.claude/settings.json` の hook（`UserPromptSubmit`）が `./scripts/work-hook-prompt` を流し、本人が何か送るたびに「新しい事実があれば記録係に渡す」を Claude に思い出させる。

## scripts を書き換えるとき

- `scripts/`（`work-render`・`work-lint`・`render.js`・`lint.js`・hook のスクリプトなど）を書き換えるときは、**先に本人に確認する。** 変えると、この規約やほかのファイル（スキル・YAML・md）と食い違いが起きることがあるので、「エンジニアに相談してから進めてください」と本人に伝える。
- 本人が「エンジニアに相談した」「そのまま進めて」と言ったら書き換えてよい。書き換えたら、`./scripts/work-render --check` と `./scripts/work-lint` を流して、ほかが壊れていないかを見せる。

## 生成物（md）

- `tasks.md`・`reminders.md`・`daily/.../<日付>.md` は `./scripts/work-render` が YAML から作る。Claude は手で直さない。
- md の 1 行目に、render が書いた本文のハッシュ（`sha:…`）が入る。本文がそれと合わない md は「手で直された」とみなす（改行の違いだけなら、直したことにしない）。
  - `work-render` は手で直された md を上書きせずに止まる。`work-render --check` は「手で直された」と「古い（render を流していない）」を分けて出す。
  - 本人が md を直したときは、`/daily` の「本人が md を直したとき」で差分（`work-render --diff`）を YAML に戻してから、`work-render --force <その md>` で作り直す。

## git

- **git の操作は、`/daily` の始業の pull と締めの add・commit・push、`/setup` の最後の add・commit・push だけ。** それ以外（reset・checkout・restore・switch・branch・rebase・merge・stash・clean など）は、Claude はしない。頼まれても「エンジニアに頼んでください」と伝える。
- git で困ったこと（push・pull が通らない）は、エラーの原文を本人に見せて、エンジニアに送ってもらう。

## やってはいけないこと

- 月をまたいで追記しない（前の月の `resources`・`daily`・`tasks/<YYYY-MM>.yaml`、`_history` の既にあるファイルに書き足さない）。
- 生成物の md を直接直さない。YAML を直して `./scripts/work-render`。
- `_history` の原文を書き換えない・要約で置き換えない（機微な値を伏せるのは除く）。間違いを見つけたら本人に伝える。
- ファイルを消さない。不要に見えても本人に聞く。
- パスワード・口座番号・マイナンバー・メールアドレス・電話番号などの機微な値は書かない。書くよう頼まれたら、書かずにそう伝える。原文に入っているものは伏せる。
- メール・チャットを送らない。予定・Google のファイルを作らない・変えない（「取り込み」）。
- work repo と `~/Downloads` の外には書かない。
- この文書に無いキー・ディレクトリを足さない。
- `RULES.md`・`.claude/settings.json` を変えない（エンジニアが直す）。`scripts/` は「scripts を書き換えるとき」のとおり。

## lint が見るもの（`./scripts/work-lint`）

| 種類 | 見ること |
|---|---|
| エラー | 名前の決まり（slug・id・`_history` の年月と日付・経路・`_files` の日付・`resources` と `tasks/` の月・`plan`・`research`・`draft` の中の名前と日付）／ YAML が読めない・知らないキー・必須のキーが無い・値の形（日付・日時・数字・取れる値）／ `project` が台帳に無い・台帳と `projects/` が 1 対 1 でない・slug や id の重複／ `people` が `people.yaml` に無い／ `status: done` と終わった日・`status: dropped` とやめた日と理由（`note`）の組み合わせ／ `resources` の `added`・`tasks/` の `done`・`dropped` がファイルの月と違う・`url` と `path` の両方か、どちらも無い／ daily の `date` がファイル名と違う／ md が YAML と合っていない（手で直されたか、render を流していない）／ `CLAUDE.md`・`RULES.md`・`projects.yaml`・`people.yaml`・`tasks.yaml`・`reminders.yaml` が無い／（`--close` のときだけ）締める日の daily が無い・その `work` の `hours` が空 |
| 注意 | 直下・プロジェクトの中の、決まりに無いファイル／ プロジェクトの `README.md` が無い／ `plan`・`research`・`draft` の中で、1 つ上の入口（プロジェクトの `README.md`・話のディレクトリの `README.md`）から辿れないもの・話のディレクトリに `README.md` が無い・深すぎる（用途のディレクトリの下に 3 段以上）／ `links`・`resources` の `path` のリンク先が無い／ 空の `hours`（締める日以外）／ キーの直後が `#` で値が空になったもの（`note: #2 の件`）／ `_history` の `相手` が `people.yaml` に無い／ `tasks.yaml` に終わった・やめたタスクが残っている／ 終わったプロジェクトに終わっていないタスク |

- 日中は `./scripts/work-lint`、締めは `./scripts/work-lint --close`（締め忘れた日を締めるときは `--close --date <その日>`）。
- 始業の締め忘れの確認は `./scripts/work-lint --unclosed`、長く動いていないタスクは `./scripts/work-lint --stale`。
