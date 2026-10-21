# DM-川崎誠士

- 日時: 2026-10-21 06:40
- 経路: chat
- 元: chat:spaces/niaUfsAAAAE/messages/kghe241xiaU.kghe241xiaU
- 元: chat:spaces/niaUfsAAAAE/messages/y2Kx9-27apI.y2Kx9-27apI
- 元: chat:spaces/niaUfsAAAAE/messages/Uef0NefoWyw.Uef0NefoWyw
- 元: chat:spaces/niaUfsAAAAE/messages/XxhEYCXNQ40.XxhEYCXNQ40
- 元: chat:spaces/niaUfsAAAAE/messages/fbeZ9FxSFAA.fbeZ9FxSFAA
- 元: chat:spaces/niaUfsAAAAE/messages/TBZj9bwH30o.TBZj9bwH30o
- 元: chat:spaces/niaUfsAAAAE/messages/Kbx2U0vvGoU.Kbx2U0vvGoU
- 元: chat:spaces/niaUfsAAAAE/messages/0CGFXx5JvnY.0CGFXx5JvnY
- 元: chat:spaces/niaUfsAAAAE/messages/_ckk9PJGMUE._ckk9PJGMUE
- 元: chat:spaces/niaUfsAAAAE/messages/apRAWqwUMlY.apRAWqwUMlY
- 元: chat:spaces/niaUfsAAAAE/messages/jtdzQVqKwfs.jtdzQVqKwfs
- 相手: kawasaki

---

（スペース: Direct message（川崎 誠士））

[06:40] 田中梓美:
おはようございます。
スプシに日毎にまとめる感じにしたいと思います！
追ってURLを共有します。

[10:24] 川崎誠士:
日報の件で、昨日考えていて、ただエンジニア以外にも受け入れられるかちょっと迷っていて、愛知マリア終わった後とかに、相談の時間もらえますか？

私の方でやっている自分のタスク管理方法を見て欲しいです。

[13:38] 田中梓美:
承知いたしました。今お時間いかがでしょうか

[14:14] 川崎誠士:
1. シェルと Homebrew
ログインシェルが zsh かを確かめる（/bin/zsh と出れば OK）。
echo $SHELL
zsh でなければ zsh にして、ターミナルを開き直す。
chsh -s /bin/zsh
Homebrew を入れる（管理者のパスワードを聞かれる。Xcode の Command Line Tools（git）も一緒に入る）。
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
このターミナルで brew を使えるようにする（~/.zshrc への追記は、あとで setup.sh が行う。インストーラが案内する ~/.zprofile への追記はしない）。
eval "$(/opt/homebrew/bin/brew shellenv)"
/opt/homebrew は Apple Silicon（M1 以降）の Mac の場所。Intel の Mac では /usr/local になるので、上の 1 行は eval "$(/usr/local/bin/brew shellenv)" にする（どちらの Mac かは、アップルメニュー →「この Mac について」のチップ／プロセッサで分かる）。setup.sh が ~/.zshrc に足す分は、両方の場所を見る。
↑ 目次へ
2. ツールを入れるbrew install node gh uvbrew install --cask claude-codebrew install --cask claude
claude-code は setup.sh がプラグインを入れるのに使う CLI。claude は Claude Desktop。
入ったかを確かめる:
node --version && gh --version && uvx --version && claude --version && git --version
↑ 目次へ
3. GitHub にログインする
ブラウザで田中さんのアカウントにログインする（GitHub.com → HTTPS → Login with a web browser）。
gh auth login
git の push・pull が gh のログインを使うようにする。
gh auth setup-git
commit に残る名前とメールを入れる（メールは GitHub の Settings → Emails にある …@users.noreply.github.com）。
git config --global user.name "<田中さんの名前>"git config --global user.email "<noreply のアドレス>"
↑ 目次へ
4. dev-tools を入れるgh repo clone qwintet-dev/dev-tools ~/dev-toolscp ~/dev-tools/config.member.example.json ~/dev-tools/config.json
config.json の allowedDirectories は ["work", "Downloads"]（~/work と ~/Downloads）。work repo を別の場所に置くときだけ直す。
先に、一時ディレクトリに出して中身を確かめる（何も書き換えない。claude のコマンドも流れない）。
HOME=$(mktemp -d) DRY_RUN=1 bash /Users/<ユーザー名>/dev-tools/setup.sh
最後に「書き出したファイル」が並ぶ。.claude/settings.json と .claude/CLAUDE.md を開いて、profile: member の中身になっていることを見る。
本番を流す（Claude Code にまだログインしていなくて claude plugin が止まったら、claude を起動してログインしてから、もう一度流す）。
bash ~/dev-tools/setup.sh
ターミナルを開き直して、PATH と環境変数が入ったかを見る。
echo $DEV_TOOLS_REPO_PATH && which dev-tools-update && tail -3 ~/.zshrc

[14:21] 田中梓美:
ip-192-168-22-212:~ azumi-tanaka$ brew install node gh uvbrew install --cask claude-codebrew install --cask claude
Warning: Cask 'node' is unavailable: No Cask with this name exists.
==> Searching for similarly named casks...
==> Casks
capslocknodelay (disabled)                nano-node (disabled)                      nodeterm
font-ubuntu-mono-derivative-powerline     nodebox

To install capslocknodelay (disabled), run:
  brew install --cask capslocknodelay (disabled)

[14:23] 川崎誠士:
brew install nodenv gh uv

brew install --cask claude-code

brew install --cask claude

brew install git

[14:27] 川崎誠士:
https://chat.google.com/room/AAQAkigknyQ/xGaztUJYrws/47wFv9x2JQY?cls=10

[14:33] 川崎誠士:
Host gitlab.com
  HostName gitlab.com
  User git
  Port 22
  IdentityFile ~/.ssh/id_ed25519_gitlab
  IdentitiesOnly yes
  AddKeysToAgent no

[14:33] 川崎誠士:
Host github.com.qwt
  HostName github.com
  User git
  Port 22
  IdentityFile ~/.ssh/id_ed25519_qwt
  IdentitiesOnly yes
  AddKeysToAgent no

[14:50] 川崎誠士:
cp ~/dev-tools/config.member.example.json ~/dev-tools/config.json

HOME=$(mktemp -d) DRY_RUN=1 bash ~/github.com/dev-tools/setup.sh

bash ~/dev-tools/setup.sh

echo $DEV_TOOLS_REPO_PATH && which dev-tools-update && tail -3 ~/.zshrc

mkdir -p ~/.google_workspace_mcp

mv ~/Downloads/client_secret.json ~/.google_workspace_mcp/client_secret.json


［認証情報］
https://drive.google.com/file/d/1_5zdx_g84tgm5TjJsaE-D78vmtWpuu-h/view?usp=drive_link
[添付: client_secret_［認証情報］.json]

[15:32] 田中梓美:
Look over repo files and git state
確認してください: git remote は確認してから実行します
R=/Users/azumi-tanaka/github.com/work; ls -la $R; echo ---; find $R -not -path '/.git/' -not -name '.env*' -type f | sort; echo ---; git -C $R log --oneline -5; git -C $R remote -v; echo ---; head -30 $R/README.md
