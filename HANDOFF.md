# spajin 作業引き継ぎ（Codex ⇔ Cursor）

## 正本

| 項目 | 値 |
|------|-----|
| ローカル正本 | `C:\Users\tadaaaki\src\spajin` |
| リモート | https://github.com/tadaaki-hub/spajin |
| ブランチ | `main` |

Codex / Cursor とも **このフォルダだけ** を開く。  
`Documents\Codex\日付\...` や旧 `spajin-publish` では作業しない。

## 切り替え手順

1. 作業中ツールで変更を commit（必要なら `git push`）
2. 未コミットの文脈はこのファイルの「現在の状態」「未完了」を更新してから commit
3. もう一方のツールで同じフォルダを開き、次を指示する:

> `HANDOFF.md` と直近の Git 履歴を読み、現在の状態・未完了・次の作業を確認して引き継いでください。変更前に理解内容を簡潔に説明してください。

## 現在の状態（2026-08-06）

- 正本を `C:\Users\tadaaaki\src\spajin` に固定した（GitHub から clone）
- HEAD: `df13a9a` — Disable tired mode guardians
- working tree はクリーン
- 旧 `Documents\Codex\spajin-publish` には `MOVED.md` のみ残してある

## 未完了タスク

- Googleマップ口コミ要約の自動化MVPを `automation/review-summary` に追加（未コミット）
  - Places API (New) から最大5件の口コミ・評価・Maps URLを取得
  - 神奈川県AI連携マスターの74施設を `input/facilities.kanagawa.csv` に反映
  - 施設名＋都県からPlaces Text SearchでPlace IDを照合。弱い一致は `needs_review` で停止
  - 本番用Cloud Run Job、Dockerfile、デプロイ用PowerShell、運用手順を追加
  - 本番Places APIはAPIキーではなくCloud RunサービスアカウントのOAuthで認証
  - Google Sheets F〜AB列へ結果を書き戻し、既処理行はスキップして途中再開可能
  - Google Cloud `spajin-review-summary` へCloud Run Jobをデプロイ済み（asia-northeast1）
  - 神奈川県マスターをJob専用サービスアカウントへ共有し、先頭5施設の本番テスト成功
  - `kanagawa_001`〜`005` のPlace ID、Maps URL、評価、口コミ数、Gemini要約・好評点・注意点・更新日時をシートへ書き戻し済み
  - 2026-08-07に残り69施設の本番処理を実行
    - 最終結果: 新規要約35、既存要約13、施設候補の要確認26、API失敗0（全74行を判定済み）
    - Gemini無料APIの日次20件制限を検出し、本番ジョブを課金済みVertex AI＋サービスアカウント認証へ移行
  - Cloud Scheduler `spajin-review-summary-kanagawa-monthly` を有効化
  - 毎月1日 03:00（Asia/Tokyo）に全74件を再取得・再要約。次回は2026-09-01 03:00
  - 同じDriveフォルダ内の他府県11ファイルにも口コミ要約自動化を展開（2026-08-07）
    - 対象: 兵庫57、大阪78、千葉53、愛知50、岐阜30、京都36、滋賀24、三重37、静岡67、埼玉72、東京82（合計586施設）
    - 既存表を保護し、各対象タブのZ:AHへPlace ID、Maps URL、評価、口コミ数、要約、好評点、注意点、更新日時、処理状態を追加
    - 初回結果: 要約完了276、施設候補の要確認310、API失敗0、空欄0
    - 各ファイルを `spajin-review-job@spajin-review-summary.iam.gserviceaccount.com` にwriter共有済み
    - Cloud Run Job 11本とCloud Scheduler 11本を作成済み。毎月1日03:10〜04:50に10分間隔で実行
    - 神奈川を含む月次Scheduler全12本がENABLEDであることを確認済み
  - スカイスパYOKOHAMAが屋外条件で誤推薦された問題を修正
    - モックのQ2を OUTDOOR / SCENIC / INDOOR / LONG_STAY に分離
    - OUTDOORは適合施設がない場合に別施設へフォールバックせず、候補なしを案内
    - スカイスパは SCENIC,INDOOR / 屋内展望 / 露天なし / 外気浴なしへ変更
    - 神奈川県マスターへ設備事実7列（AD:AJ）を追加し、スカイスパ行を更新
  - Gemini structured outputで要約・好評点・注意点・施設タグを生成
  - CSV入力/出力、環境変数、サンプル、Node標準テストを実装
  - 次: 神奈川26施設と他府県310施設の `needs_review` を目視確認してPlace IDを確定し、設備事実を公式情報で監査・入力
- 着手前から `ab-test.html` と `assets/guardians/expressions/` に別作業の未コミット変更あり。口コミ要約作業では変更していない

## 注意

- チャット履歴はツール間で同期されない。引き継ぎ文脈の正本はこのファイルと Git 履歴
- `.env`・APIキー・認証情報は commit しない
- Codex の日付フォルダに新規クローンを作らない。必ずこのパスを開く
