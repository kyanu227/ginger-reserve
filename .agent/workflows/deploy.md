---
description: フロントエンド＋GASの全体デプロイ手順
---

# デプロイ手順

## フロントエンドのデプロイ（Firebase Hosting）
// turbo-all

1. ビルドとデプロイを実行:
```bash
export PATH="$HOME/.local/node/bin:$PATH" && npm run build && firebase deploy --only hosting --project kouso-reserve
```

## GAS（バックエンド）のデプロイ

### 初回セットアップ（claspログイン）
1. claspにログイン:
```bash
npx -y @google/clasp login
```
2. ブラウザが開くのでGoogleアカウントでログイン

3. GASエディタのURL（`https://script.google.com/home/projects/XXXXX/edit`）からスクリプトIDをコピー

4. `.clasp.json` の `scriptId` にペースト

### GASコードのプッシュ
1. GASにコードをプッシュ:
```bash
npx -y @google/clasp push
```

### GAS Webアプリの再デプロイ
1. デプロイ一覧を確認:
```bash
npx -y @google/clasp list-deployments
```

2. 既存のデプロイメントを更新（`DEPLOYMENT_ID` を置き換え）:
```bash
npx -y @google/clasp update-deployment DEPLOYMENT_ID
```

> **注意**: 初回のみ手動で `clasp login` とスクリプトIDの設定が必要です。
> 以降は `clasp push` → `clasp update-deployment` でGASのデプロイが完了します。
