# スパ人 A/Bモック仕様

## 目的

モック段階で、診断入力の違いによる体験差を比較する。

- A案：選択カードだけで完走する診断
- B案：選択カード + 任意の一言入力で、AI占い感を足す診断

施設データ、スパ神、結果表示の世界観は既存モックを引き継ぐ。

## 今回追加したスパ神案内演出

- 起動時にランダムで1人のスパ神が登場する
- 診断欄の上に「TONIGHT'S GUIDE」カードを表示する
- 質問を選ぶたびに、担当スパ神の案内セリフが次の質問へ進行する
- 最後の結果では、基本的に登場したスパ神がそのまま案内する
- 施設タグや自由入力が強く反応した場合は、別のスパ神に引き継がれる余地を残す

この設計により「スパ神がただ表示されている」のではなく、「最初から最後まで案内してくれる」体験に寄せる。

## OpenAI APIの扱い

モックではOpenAI APIを直接呼ばない。

理由：

- APIキーをフロントエンドに置かないため
- A/B検証段階では体験確認が主目的のため
- 本番ではCloud RunのサーバーAPIへ差し替えるため

本番想定：

```text
Webサイト
  ↓
Cloud Run API
  ↓
OpenAI API
```

想定エンドポイント：

```http
POST /api/character-text
```

入力例：

```json
{
  "variant": "B",
  "guardian_id": "kurebayashi",
  "facility": {
    "facility_id": "kanagawa_017",
    "facility_name": "横須賀温泉 湯楽の里",
    "area_label": "湘南・三浦",
    "spring_quality": "ナトリウム-塩化物強塩温泉",
    "review_summary_gemini": "海風と露天の開放感に触れる口コミ傾向が強い"
  },
  "user_input": {
    "q1_type": "A",
    "q2_type": "A",
    "free_text": "今日は海風を浴びてぼーっとしたい"
  }
}
```

出力例：

```json
{
  "guardian_id": "kurebayashi",
  "benefit_text": "塩化物泉の温まり感と、海風の余韻が残る一湯です。",
  "intro_text": "横須賀温泉 湯楽の里。湯上がりの風まで含めて、今夜の余白になります。",
  "closing_line": "……帰り道、少しだけ静かになるはず。"
}
```

## 計測ログ

モックではブラウザの `localStorage` に簡易保存し、`ログCSV` ボタンからダウンロードできる。

本番ではCloud Run側で保存する。

ログ列：

- timestamp
- type
- variant
- q1
- q2
- area
- free_text_present
- facility_id
- guardian_id
- score

## 業者引継ぎ時の重要事項

1. フロントエンドにAPIキーを置かない
2. フロントエンドからGoogle Sheetsを直接読ませず、Cloud Run APIを介す
3. 入力UIはA/B結果を反映できるよう差し替え可能にする
4. 施設選定とキャラ口調生成を分離する
5. Geminiは口コミ下処理、OpenAIは最後のキャラ文生成に使う
