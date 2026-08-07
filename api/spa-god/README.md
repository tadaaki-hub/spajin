# スパ神 AI API

GitHub Pages のブラウザから OpenAI を直接呼ばず、Cloud Run を経由してキャラクター返答を生成するAPIです。

## ローカル確認

PowerShellで環境変数を設定し、`npm start` を実行します。秘密鍵を `.env` やHTMLへ保存しないでください。

```powershell
$env:OPENAI_API_KEY="..."
$env:ALLOWED_ORIGINS="http://localhost:8000"
npm start
```

フロントは次のURLでAPIを一時設定できます。

`http://localhost:8000/ab-test.html?api=http://localhost:8080/api/character-text`

## Cloud Run

```powershell
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/PROJECT_ID/spajin/spa-god-api
gcloud run deploy spa-god-api --image asia-northeast1-docker.pkg.dev/PROJECT_ID/spajin/spa-god-api --region asia-northeast1 --allow-unauthenticated --set-env-vars "OPENAI_MODEL=gpt-5.6-luna,ALLOWED_ORIGINS=https://tadaaki-hub.github.io,REQUESTS_PER_MINUTE=20" --set-secrets "OPENAI_API_KEY=spajin-openai-api-key:latest"
```

1. Secret Manager に `spajin-openai-api-key` を作成する。
2. Cloud Run のサービスアカウントへ Secret Manager Secret Accessor を付与する。
3. デプロイ後、`https://SERVICE_URL/healthz` が `{"ok":true}` を返すことを確認する。
4. 公開ページを `?api=https://SERVICE_URL/api/character-text` 付きで一度開く。エンドポイントはブラウザのlocalStorageへ保存される。

本公開前に Cloud Logging の5xx/429監視、Cloud Billing予算通知、OpenAI Projectの月額上限を設定してください。CORSはブラウザ以外からの悪用を防がないため、アクセスが増えた段階でAPI GatewayまたはCloud Armorによる制限を追加してください。
