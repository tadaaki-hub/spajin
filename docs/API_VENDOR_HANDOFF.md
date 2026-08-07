# スパ神 API 制作依頼書

## 概要

`ab-test.html` の診断結果後に表示される自由入力チャットを、サーバー側の OpenAI API と接続します。

施設推薦そのものは現在ブラウザ内の JavaScript で実行しています。本書の対象は、診断結果後のスパ神による会話文生成です。施設推薦もAPI化する場合は、別途 `/api/recommend` の設計が必要です。

## エンドポイント

- メソッド: `POST`
- パス: `/api/character-text`
- Content-Type: `application/json`
- 実装先: Cloud Run などのサーバー環境

OpenAI APIキーはHTMLやブラウザへ記載・返却せず、サーバーの環境変数または Secret Manager で管理してください。

## リクエスト例

```json
{
  "guardian_id": "yukawa",
  "guardian": {
    "name": "湯川明神"
  },
  "facility": {
    "id": "kanagawa_001",
    "name": "施設名",
    "area": "横浜・川崎",
    "quality": "天然温泉",
    "effects": "温まり感",
    "tags": ["サウナ", "おこもり"]
  },
  "review_signal": "休憩・長時間滞在の満足度が高い",
  "user_text": "混雑していないか気になります",
  "selection": {
    "variant": "A",
    "q1": "A",
    "q2": "INDOOR",
    "area": "横浜・川崎"
  }
}
```

## レスポンス例

```json
{
  "reply": "混み具合が気になる場合は、出発前にGoogleマップの混雑状況を確認しておくと安心です。",
  "expression": "worried"
}
```

- `reply`: 必須。画面に表示するスパ神の返答
- `expression`: 任意。返答時の表情

利用可能な表情指定:

```text
normal
smile
thinking
serious
worried
surprised
excited
relaxed
bored
```

## サーバー側の要件

- OpenAI APIキーをブラウザへ返さない
- リクエストの型・必須項目を検証する
- ユーザー入力の文字数制限を設ける
- タイムアウトとエラー処理を実装する
- 本番サイトのドメインだけをCORSで許可する
- OpenAI API障害時は適切なHTTPエラーを返す
- 不適切な入力に対する安全対策を設ける
- API利用量、応答時間、エラーをログで確認できるようにする
- レート制限を設ける

## フロントエンドとの接続

現在のHTMLは、URLの `api` パラメータで接続先を指定できます。

```text
https://サイトURL/ab-test.html?api=https%3A%2F%2Fapi.example.com%2Fapi%2Fcharacter-text
```

指定されたURLはブラウザの `localStorage` に保存されます。

`file:///` からの接続はCORSで失敗する場合があるため、ローカルHTTPサーバーまたは本番同等のHTTPS環境でテストしてください。

## 受け入れ確認

1. 自由入力を送信するとAPIへPOSTされる
2. `reply` がスパ神の返答として表示される
3. `expression` に対応して表情画像が切り替わる
4. APIエラー時はモック返答へフォールバックする
5. OpenAI APIキーがHTML、JavaScript、通信レスポンスに含まれない
6. 許可していないオリジンからのアクセスが拒否される
