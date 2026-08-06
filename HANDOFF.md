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

- （作業を始めたらここに追記する）

## 注意

- チャット履歴はツール間で同期されない。引き継ぎ文脈の正本はこのファイルと Git 履歴
- `.env`・APIキー・認証情報は commit しない
- Codex の日付フォルダに新規クローンを作らない。必ずこのパスを開く
