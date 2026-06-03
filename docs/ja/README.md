# 日本語セクション：Linux Device AI Relay Package

このプロジェクトは、小型 Linux デバイスや小規模サーバーを、常時稼働する AI relay ノードとして使うための実用的なデプロイ構成から始まりました。

N1 ボックスだけを対象にしたものではありません。N1 風の構成は出発点であり、現在の目的は Raspberry Pi、Linux が動作する TV ボックス、ARM ボード、ミニ PC、ホームサーバー、小規模 VPS、Ubuntu / Debian / Armbian などを使う Linux ホストへ広げることです。

## プロジェクトの位置づけ

このリポジトリは `CLIProxyAPI`、`openclaw-zero-token`、そして Linux 向けのデプロイ層をまとめています。

主に解決したい問題は次の通りです。

- サービスを systemd で常駐させ、再起動後も復帰させること;
- 小型デバイスが同時リクエストで過負荷にならないようにすること;
- ブラウザログインや attach-only Web モデルを扱いやすくすること;
- LAN と公開サーバーの両方に対応したアクセス設定を用意すること;
- token、cookie、ブラウザ状態、ACCESS ファイルなどの実行時データを GitHub に混ぜないこと;
- デプロイ失敗時にサービス状態やログを確認しやすくすること。

このリポジトリの価値は、単に 2 つの上流プロジェクトを同じ場所に置くことではありません。それらを小型 Linux ホスト上で運用できるようにするサービス構成、キュー、診断、公開時の安全境界をまとめることです。

## 対象デバイス

想定している対象は次のような Linux ホストです。

- Raspberry Pi;
- Linux 対応 TV ボックス;
- ARM64 開発ボード;
- ミニ PC;
- ホームサーバー;
- 小規模 VPS;
- x86_64 または ARM64 Linux マシン。

推奨 OS は次の通りです。

- Ubuntu;
- Debian;
- Armbian;
- systemd と apt-get に近い動作を持つ Linux ディストリビューション。

最小構成のコンテナ環境は現在の対象ではありません。インストーラーは systemd、ローカルポート、永続ディレクトリ、サービスのヘルスチェックを前提にしています。

## インストール前チェック

対象ホスト上でリポジトリを clone します。

```bash
git clone https://github.com/feijieni/n1-box-integrated-relay.git
cd n1-box-integrated-relay
```

破壊的でないチェックを実行します。

```bash
bash scripts/doctor.sh
bash scripts/check-repo-health.sh
bash scripts/check-publish-safety.sh
```

これらのチェックはパッケージをインストールしたり、サービスを起動したり、システムファイルを書き換えたりしません。リポジトリ構成、必要ファイル、ポート、シェル構文、ドキュメントリンク、明らかな秘密情報の混入を確認するためのものです。

## デプロイ

メインのインストーラーは次のファイルです。

```bash
install_n1.sh
```

ファイル名に `n1` が残っているのは後方互換のためです。N1 専用という意味ではありません。

### LAN デバイスまたはホームサーバー

```bash
chmod +x install_n1.sh
sudo N1_LAN_IP=192.168.1.100 ./install_n1.sh
```

`192.168.1.100` は Raspberry Pi、TV ボックス、ミニ PC、ホームサーバー、またはその他の Linux relay ホストの LAN IP に置き換えてください。

### 公開サーバーまたはリバースプロキシ構成

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=203.0.113.10 \
  PRIMARY_ACCESS_HOST=203.0.113.10 \
  CONTROL_UI_EXTRA_ORIGINS=https://openclaw.example.com \
  ./install_n1.sh
```

`N1_LAN_IP` は元のスクリプトとの互換性のために残っている変数名です。任意の Linux relay ホストの LAN IP またはプライベート IP として使えます。

## インストーラーが行うこと

インストーラーは次の処理を行います。

- 必要なプロジェクトファイル、設定テンプレート、systemd サービス、HAProxy キュー設定を確認する;
- `curl`、`jq`、`haproxy`、`xvfb`、`x11vnc`、`websockify`、`novnc`、ビルドツール、Python などをインストールする;
- Chrome / Chromium を検出またはインストールする;
- 必要に応じて Node.js 22 をインストールする;
- Corepack 経由で pnpm を有効化する;
- `CLIProxyAPI` を `/opt/cli-proxy-api` にコピーする;
- `openclaw-zero-token` を `/opt/openclaw-zero-token` にコピーする;
- ホストのアーキテクチャに応じて `cli-proxy-api` をインストールまたはビルドする;
- OpenClaw の実行時依存関係をインストールする;
- systemd サービスをインストールする;
- HAProxy のシリアルキューを設定する;
- API key と gateway token を生成する;
- ローカルのアクセス情報ファイルを書き込む;
- UFW が有効な場合に必要なポートを許可する;
- サービスを起動し、ヘルスチェックを行う。

## デプロイ後の使い方

インストール後、アクセス情報は対象ホスト上のローカルファイルに保存されます。

```text
/opt/cli-proxy-api/ACCESS.txt
/opt/openclaw-zero-token/ACCESS.txt
```

確認方法：

```bash
sudo cat /opt/cli-proxy-api/ACCESS.txt
sudo cat /opt/openclaw-zero-token/ACCESS.txt
```

主な URL：

| サービス | デフォルト URL パターン |
| --- | --- |
| CLIProxyAPI 管理画面 | `http://<host>:8317/management.html` |
| CLIProxyAPI API | `http://<host>:8317` |
| OpenClaw control UI | `http://<host>:3001/#token=<OPENCLAW_GATEWAY_TOKEN>` |
| OpenClaw OpenAI-compatible API | `http://<host>:3002/v1` |
| Chrome debug endpoint | `http://127.0.0.1:9222/json/version` |
| noVNC browser login page | `http://<host>:6080/vnc.html` |

OpenClaw API クライアントでは次のように設定します。

```text
Base URL: http://<host>:3002/v1
API Key:  /opt/openclaw-zero-token/ACCESS.txt を確認
```

CLIProxyAPI クライアントでは次のように設定します。

```text
Base URL: http://<host>:8317
API Key:  /opt/cli-proxy-api/ACCESS.txt を確認
```

Web ログインが必要な場合は、手動でブラウザログインサービスを起動します。

```bash
sudo systemctl start openclaw-auth-browser.service
```

その後、`/opt/openclaw-zero-token/ACCESS.txt` に表示される noVNC URL を開きます。

## よく使う保守コマンド

サービス状態を確認：

```bash
sudo systemctl status cliproxyapi.service
sudo systemctl status openclaw-chrome-debug.service
sudo systemctl status openclaw-zero-token.service
sudo systemctl status openclaw-api-queue.service
```

ログを確認：

```bash
sudo journalctl -u cliproxyapi.service -n 100 --no-pager
sudo journalctl -u openclaw-zero-token.service -n 100 --no-pager
sudo journalctl -u openclaw-api-queue.service -n 100 --no-pager
sudo journalctl -u openclaw-chrome-debug.service -n 100 --no-pager
```

サービス再起動：

```bash
sudo systemctl restart cliproxyapi.service
sudo systemctl restart openclaw-zero-token.service
sudo systemctl restart openclaw-api-queue.service
sudo systemctl restart openclaw-chrome-debug.service
```

## セキュリティ注意事項

次の内容を GitHub にコミットしないでください。

- `.openclaw-upstream-state/`;
- `auth-profiles.json`;
- 実際の `ACCESS.txt`;
- 実際の `config.yaml`;
- cookies;
- bearer tokens;
- アカウントログ;
- ブラウザ profile;
- マシン固有の実行時ディレクトリ。

公開リポジトリには、ソースコード、サンプル設定、サービステンプレート、インストールロジック、ドキュメントだけを置くべきです。実際の秘密情報や実行時状態は対象ホスト上に保存してください。
