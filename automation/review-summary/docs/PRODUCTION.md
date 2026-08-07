# 本番運用（神奈川県）

## 構成

`Cloud Scheduler → Cloud Run Job → Places API (New) / Gemini API → Google Sheets`

- 対象: `神奈川県_スパ人_AI連携マスター` の `神奈川県_施設マスター`
- 既存要約がある行はスキップし、途中失敗後も再実行可能
- Place IDが曖昧な施設は書き込まず、Cloud Loggingへ `needs_review` と候補を出す
- APIの429/5xxは指数バックオフで最大5回試行
- 逐次処理でAPI負荷と書き込み競合を抑制

## 1. Gemini APIキーをSecret Managerへ登録

Google Cloud ConsoleのSecret Managerで次を作成します。

- `spajin-gemini-api-key`

Places API (New) はCloud RunのサービスアカウントによるOAuth認証を使うため、本番環境にGoogle Maps APIキーを保存しません。Geminiキーもソース、Dockerイメージ、通常の環境変数へ平文保存しません。

## 2. デプロイ

Google Cloud CLIへログイン後、PowerShellで実行します。

```powershell
cd C:\Users\tadaaaki\src\spajin\automation\review-summary
gcloud auth login
.\deploy\cloud-run-job.ps1 -ProjectId "YOUR_PROJECT_ID"
```

表示されるサービスアカウントのメールアドレスを、対象Google Sheetへ「編集者」として共有します。

## 3. 初回実行

初回は定期実行にせず、手動で動作確認します。

```powershell
gcloud run jobs execute spajin-review-summary-kanagawa --region asia-northeast1 --wait
gcloud run jobs executions list --job spajin-review-summary-kanagawa --region asia-northeast1
```

確認項目:

- 自動一致した施設だけ更新されている
- F/G列へPlace IDとMaps URL
- P〜T列へ評価・口コミ件数・要約・タグ
- AB列へ更新日時
- `needs_review` の施設は変更されていない

## 4. 定期実行

初回検証後にCloud SchedulerからCloud Run Jobを起動します。口コミの変化速度と費用を考え、月1回を初期値にします。定期更新時はJobの `FORCE_REFRESH=true` を設定します。

## 5. IAM

Job専用サービスアカウントを使い、最低限以下だけを許可します。

- Secret Manager Secret Accessor
- 対象Google Sheetの編集権限（シート共有で付与）

デプロイ担当者側にはCloud Build、Artifact Registry、Cloud Run Job更新に必要な権限が別途必要です。

## 6. 費用・安全対策

- Cloud Billingの予算アラートを作成
- Places APIの割り当て上限を74施設の月次処理に合わせて設定
- Places APIはサービスアカウントOAuth、GeminiキーはSecret Managerで分離
- Cloud Loggingで `failed` と `needs_review` を監視
- フロントエンドへキーを渡さない
- いきなり全行を更新せず、初回は `MAX_ROWS=5` で確認する
