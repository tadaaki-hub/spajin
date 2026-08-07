# Googleマップ口コミ要約 自動化MVP

施設CSVの施設名を使い、Places Text SearchでPlace IDを照合してからPlaces API (New) の口コミを取得し、Geminiで要約・タグ化します。

## 注意

- Places APIが返す口コミは関連度順で最大5件です。全口コミの網羅収集ツールではありません。
- APIキーはファイルへ書かず、環境変数だけで渡します。
- Google Maps Platformの利用規約・表示要件・保存制限を確認して運用してください。
- 同じ施設を短時間に再処理しないよう、将来はキャッシュと差分更新を追加します。

## 入力

`input/facilities.example.csv` をコピーし、最低限 `facility_id` と `facility_name` を入力します。`prefecture` と `address` があると誤一致を減らせます。既知の `place_id` があれば検索を省略します。

照合が弱い候補は `place_match_status=needs_review` として要約せず、`place_candidates_json` に候補を残します。確認後にPlace IDを入力して再実行してください。

## 実行（PowerShell）

```powershell
cd C:\Users\tadaaaki\src\spajin\automation\review-summary
$env:GOOGLE_MAPS_API_KEY="..."
$env:GEMINI_API_KEY="..."
node src/cli.mjs --input input/facilities.csv --output output/facilities-with-review-summary.csv
```

出力列には `review_summary_gemini`、好評点、注意点、`facility_tags`、使用口コミ数、評価、GoogleマップURLが追加されます。

## テスト

```powershell
npm test
```

## 次の段階

1. 実際の施設マスター列を確定し、Place ID検索工程を追加
2. 前回結果との比較による差分更新・リトライ・API費用上限を追加
3. Cloud Run Job + Cloud Scheduler、またはGitHub Actionsの定期実行へ載せる
4. Google Sheetsへの書き戻しを追加

本番用のCloud Run JobとGoogle Sheets書き戻しは `docs/PRODUCTION.md` を参照してください。
