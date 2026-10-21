<!-- member-work:template この印がある間は雛形のまま。メンバーの repo では /setup がこの README を本人向けに書き換え、印が消える -->
# member-work（メンバーの work repo の雛形）

非エンジニアのメンバーが Claude Code（Claude Desktop の Code タブ）で使う「プライベートナレッジスペース」の雛形。**この repo の中身を、そのまま各メンバーの private repo にして `~/work` に clone する。** この README はエンジニア向け（メンバーの Claude が読むのは `CLAUDE.md`・`RULES.md`・`.claude/`）。メンバーの repo では、最初の `/setup` がこの README を本人向けの短い説明に書き換える（エンジニア向けの説明は、この雛形の repo にだけ残る）。

## Summary

- メンバーの repo は、この repo を複製したもの。規約（`RULES.md`）・スキル（`/daily`・`/work-rules`・`/setup`・`/import`）・調べ役と記録係のエージェント・hook・render と lint（`scripts/`）・初期のファイルが全部入っていて、ほかから読ませるものは無い（粒度の目安 `project-catalog` と Google の接続 `google-workspace-connect` は、dev-tools の common のスキルを使う）。
- repo を作ったら、メンバーと一緒に `/setup` を 1 回回す。雛形の印（この README の 1 行目）が消え、`CLAUDE.md`・README・`people.yaml`・`projects.yaml` が本人のものになる。
- メンバーの Mac の守り（sandbox・directory-guard・`~/.claude/CLAUDE.md` の共通の決まり）は、dev-tools の member の profile が入れる。work 固有の説明は、この repo が持つ。
- render・lint は Node.js（dev-tools の `setup.sh` が要るので、メンバーの Mac に入っている）。依存は無い。

## 目次

- [ツリー](#ツリー)
- [dev-tools の member の profile との関係](#dev-tools-の-member-の-profile-との関係)
- [メンバーの repo を作る](#メンバーの-repo-を作る)
- [雛形の変更をメンバーの repo に届ける](#雛形の変更をメンバーの-repo-に届ける)
- [規約・スクリプトを直すとき](#規約スクリプトを直すとき)

## ツリー

```
member-work/（= メンバーの ~/work）
├── README.md                 この文書（エンジニア向け）
├── .gitattributes            雛形の更新を取り込むとき、/setup が書き換えた README.md は本人の版を残す（merge=ours）
├── CLAUDE.md                 メンバーの Claude への入口。短く、RULES.md とスキルを指す。「私のこと」は /setup が埋め、「私の好み」は本人が育てる
├── RULES.md                  規約の正（置き場・自分で作るもの・ファイル名・月での分け方・YAML の形・取り込み・会話の反映・scripts・git・やってはいけないこと）
├── .claude/
│   ├── settings.json         ./scripts/work-render ・ work-lint の許可と、UserPromptSubmit の hook（メンバーの Claude は書き換えられない）
│   ├── agents/
│   │   ├── intake-collector.md    調べ役（Sonnet）。カレンダー・Gmail・Chat・Drive の 1 経路を読むだけで集め、_inbox/intake/ に置いて一覧を返す
│   │   └── knowledge-recorder.md  記録係（Sonnet）。会話で分かった事実を README・people・_history・daily の候補へ裏で反映する
│   └── skills/
│       ├── daily/            /daily … 呼び出し 1 つで、時刻と状況から締め忘れの締め・始業・取り込み・日中・締めを決めて動き、動いたあとに確認を見せる
│       ├── work-rules/       /work-rules … RULES.md を読んで書く順番（置き場を決める → 自分で作るものを置く → 書く → render → lint）
│       ├── setup/            /setup … 雛形から作った直後に 1 回。Google を探して案を出し、CLAUDE.md・README・people・projects を本人のものにする
│       └── import/           /import … 最初の取り込み（Gmail・Chat・ChatGPT）。整理案 → 本人が直す → 反映 → 原文を _history へ
├── scripts/
│   ├── work-render           render.js を呼ぶ（YAML → md。--check ・ --diff ・ --force <md> ・ --move-done）
│   ├── work-lint             lint.js を呼ぶ（規約の検査。--close ・ --date ・ --unclosed ・ --stale）
│   ├── work-hook-prompt      UserPromptSubmit の hook。本人が送るたびに「新しい事実は記録係へ」を Claude に思い出させる
│   ├── render.js ・ lint.js
│   ├── lib/yaml-lite.js      制限付きの YAML 読み取り器（依存なし）
│   └── test.sh               回帰テスト（エンジニアが流す）
├── projects.yaml             プロジェクトの台帳（slug・name・status・started・ended）
├── people.yaml               人（id・name・call・org・role・contact・note）
├── projects/                 プロジェクトごとの README（入口）・plan・research・draft（自分で作るもの）・_history（月）・_files・resources（月。資料の索引）
├── tasks.yaml → tasks.md     終わっていないタスク
├── tasks/                    終わった・やめたタスク（tasks/<YYYY-MM>.yaml。締めで --move-done が移す）
├── reminders.yaml → reminders.md
├── daily/                    daily/<YYYY>/<MM>/<YYYY-MM-DD>.yaml（正）と .md（生成物）
└── _inbox/                   振り分け前のもの
```

[↑ 目次へ](#目次)

## dev-tools の member の profile との関係

| | dev-tools（member の profile。`setup.sh` が入れる） | この repo |
|---|---|---|
| Claude への決まり | `~/.claude/CLAUDE.md`（`CLAUDE.member.md`）: パスの書き方・触ってよい場所・止められたとき・送信しない・記憶は repo に置く・話し方 | `CLAUDE.md`・`RULES.md`・`.claude/skills/`: work repo の置き場・daily の回し方・git の範囲 |
| 守り | `~/.claude/settings.json`（sandbox・deny）と directory-guard。許可は `~/work` と `~/Downloads`。git が追っていないファイルの削除・上書きは確認が出る | `.claude/settings.json` で `./scripts/work-render`・`./scripts/work-lint` だけを allow に足す。hook（`UserPromptSubmit` → `./scripts/work-hook-prompt`）もここ |
| Google | `config.json` の `mcp.googleWorkspace`（メンバーの Mac は `mode: always`）と、common の `google-workspace-connect`（つなぐ・確かめる）・`project-catalog`（プロジェクトの粒度） | `/daily`・`/setup`・`/import` が、調べ役のエージェント（`intake-collector`）で読むだけ。送信はしない。見るアカウントは `CLAUDE.md` の「私のこと」に MCP のサーバー名で書く |
| スクリプトの呼び方 | directory-guard（member）はコマンド名で許可を見る（`MEMBER_ALLOWED_COMMANDS` に `work-render`・`work-lint` がある）。`./scripts/work-render` はコマンド名が `work-render` なので通る。`node scripts/render.js` の形は毎回確認が出る | スキルと `CLAUDE.md` は、repo のルートから `./scripts/work-render`・`./scripts/work-lint` で呼ぶ |
| 更新 | 「dev-tools を更新して」（`dev-tools-update`） | 下の「雛形の変更をメンバーの repo に届ける」（エンジニアが行う） |

- メンバーの Claude は、`.claude/settings*.json` を書けない（directory-guard の member の判定）。この repo の `.claude/settings.json` は、エンジニアが直して届ける。
- メンバーの Claude がする git の操作は、`/daily` の中の `git pull --ff-only`（始業）と `git add`・`git commit`・`git push`（締め）だけ（`RULES.md` の「git」）。

[↑ 目次へ](#目次)

## メンバーの repo を作る

dev-tools の `docs/member-setup.md` の 1〜4（Homebrew・ツール・GitHub のログイン・dev-tools）が済んでいる前提。`<member>` はメンバーの GitHub アカウント。コマンドは 1 行ずつ流す。

**1. メンバーの Mac（メンバーの gh でログイン済み）で、空の private repo を作り、エンジニアを collaborator に入れる**

```
gh repo create <member>/work --private
```

```
gh api -X PUT repos/<member>/work/collaborators/m-kawasaki-qwt -f permission=push
```

- 招待は、川崎さんの GitHub の通知か `https://github.com/<member>/work/invitations` で受ける。

**2. エンジニアの Mac で、この repo の中身（履歴ごと）をメンバーの repo へ送る**

```
gh repo clone m-kawasaki-qwt/member-work "$TMPDIR/work-seed"
```

```
git -C "$TMPDIR/work-seed" push https://github.com/<member>/work.git main:main
```

- 履歴ごと送るので、あとで雛形の変更を `git pull` でそのまま取り込める（下の「雛形の変更をメンバーの repo に届ける」）。
- ssh で GitHub に入っている場合は、URL を `git@github.com:<member>/work.git`（ホストの別名を使っているならその名前）にする。

**3. メンバーの Mac で clone して、動くことを確かめる**

```
gh repo clone <member>/work ~/work
```

```
~/work/scripts/work-render --check && ~/work/scripts/work-lint
```

- 「md はすべて YAML と合っています」「work-lint: 問題なし」と出れば OK。
- `git -C ~/work rev-parse --abbrev-ref @{u}` が `origin/main` を返すこと（締めの push と、始業の締め忘れの確認が送り先を使う）。

**4. Claude Desktop の Code タブで `~/work` を開き、メンバーと一緒に `/setup` を回す**

- 最初にフォルダの信頼（trust）を聞かれたら許可する。許可しないと、`.claude/settings.json` の hook が動かない（Claude Code はフォルダを信頼するまで hook を止める）。
- `/setup` は、Google（カレンダー・Gmail・Chat・Drive）を先に読んで案を出し、メンバーに直してもらって、`CLAUDE.md`・README・`people.yaml`・`projects.yaml` を埋め、commit・push まで行う（Google につながっていなければ `google-workspace-connect` を案内する）。終わると README の 1 行目の雛形の印が消える。途中でやめても、もう一度 `/setup` で続きから進む。
- そのあと「おはよう」で `/daily` が動くこと、夕方の「締めて」で commit・push まで通ることを見る。過去の分をまとめて入れるなら `/import`。

**（別のやり方）GitHub の template repo にする場合**

この repo を template にして、メンバーが「Use this template」で作ることもできる。ただし、メンバーがこの repo を読めること（collaborator に入れる）が要り、履歴がつながらないので、雛形の変更を取り込む最初の 1 回だけ `--allow-unrelated-histories` が要る。履歴ごと送る上のやり方を勧める。

```
gh repo edit m-kawasaki-qwt/member-work --template
```

```
gh repo create <member>/work --private --template m-kawasaki-qwt/member-work
```

[↑ 目次へ](#目次)

## 雛形の変更をメンバーの repo に届ける

スキル・規約・スクリプトを直したら、この repo の `main` にマージしてから、メンバーごとにエンジニアの Mac で取り込む（メンバーの Claude には git の pull 以外をさせないため、エンジニアが行う）。

```
gh repo clone <member>/work "$TMPDIR/work-<member>"
```

```
git -C "$TMPDIR/work-<member>" -c merge.ours.driver=true pull --no-rebase https://github.com/m-kawasaki-qwt/member-work.git main
```

```
bash "$TMPDIR/work-<member>/scripts/test.sh" && "$TMPDIR/work-<member>/scripts/work-lint" --root "$TMPDIR/work-<member>"
```

```
git -C "$TMPDIR/work-<member>" push
```

- メンバーの Mac には、次の始業の `git pull --ff-only` で届く。メンバーの Mac に送っていない commit があって履歴が分かれたときは、`/daily` が止まって「エンジニアに送ってください」とエラーを見せる。そのときは、メンバーの Mac で `git -C ~/work pull --no-rebase` をエンジニアが流す。
- `-c merge.ours.driver=true` は、`.gitattributes` の `README.md merge=ours` を効かせるため。メンバーの repo では `/setup` が README を本人向けに書き換えているので、雛形の README（この文書）の変更は取り込まず、本人の版を残す（付け忘れると README がぶつかる。そのときは本人の版を残す）。`/setup` の前なら、雛形の README の変更がそのまま入る。
- `CLAUDE.md` は、雛形は「この repo の決まり」の節だけを変え、`/setup` と本人は 1〜3 行目・「私のこと」・「私の好み」だけを変える。節が分かれているので、ふつうはぶつからない。ぶつかったら、「この repo の決まり」は雛形、ほかはメンバーの中身を残す。
- 雛形の `projects.yaml`・`people.yaml`・`tasks.yaml`・`reminders.yaml`・`tasks.md`・`reminders.md` は、配ったあとは変えない（メンバーのデータとぶつかる）。

[↑ 目次へ](#目次)

## 規約・スクリプトを直すとき

- 規約の正は `RULES.md`。キー・置き場・名前の決まりを変えたら、`scripts/lint.js`（md の形が変わるなら `scripts/render.js`）と `scripts/test.sh` も一緒に直す。
- スキルを足すときは `.claude/skills/<名前>/SKILL.md`、エージェントは `.claude/agents/<名前>.md`。置き場や YAML の形はスキルに書かず、`RULES.md` を指す。
- 配ったあとの雛形では、`README.md`（この文書）は自由に直してよい（メンバーには届かない）。`CLAUDE.md` は「この repo の決まり」の節だけを直す。
- メンバーの Claude が `scripts/` を書き換えたいと言うことがある（`RULES.md` の「scripts を書き換えるとき」で、本人に確かめてエンジニアに相談するよう伝える）。相談が来たら、ここで直して届ける。
- 直したら回帰テストを流す（この repo を `$TMPDIR` に写して中身を入れ、正常系と異常系を確かめる。この repo の中は書き換えない）。

```
bash scripts/test.sh
```

[↑ 目次へ](#目次)
