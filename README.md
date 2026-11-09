# ハーネス配線図エディタ

学生フォーミュラEV向けの車両ハーネス配線図をブラウザで作成するツールです。サーバー不要で、GitHub Pages にそのまま置いて使えます。

## 使い方（ローカル）
ES Modules を使っているため、`index.html` をダブルクリックではなく簡易サーバー経由で開いてください。

```bash
python -m http.server 8000
# → http://localhost:8000/ をブラウザで開く
```

## GitHub Pages で公開
1. このフォルダを GitHub リポジトリに push
2. リポジトリの Settings → Pages → Source: `Deploy from a branch`、Branch: `main` / `/ (root)`
3. 表示された URL を開く（ビルド作業は不要）

## 保存と PDF
- **自動保存**: 編集内容はブラウザ（localStorage）に自動保存され、次に開いた時に復元されます。ブラウザ・PC が変わると引き継がれないため、残す場合は「保存」でファイルにしてください。
- **保存 / 開く**: プロジェクトは `○○.harness.json` として保存します。画面にドロップしても開けます。
- **PDF 出力**: 「PDF出力」→「印刷ダイアログを開く」→ 送信先で「PDF に保存」。全ページが 1 つの PDF になり、用紙サイズ・向きはページごとの設定が使われます（Chrome / Edge 推奨）。

## 構成
```
index.html
css/app.css
js/
  main.js                  起動処理
  core/    model.js        図面データ（JSON）のスキーマ・生成・互換変換
           store.js        状態管理・Undo/Redo
           geometry.js     座標変換・形状計算
           wires.js        配線の経路・ネット計算
           tubes.js        チューブの位置計算（基準配線上の範囲 t0〜t1）
           io.js           JSON 保存・読み込み・自動保存
  catalog/connectors/      コネクタ部品データ（断面図形状・ピン配置）
  catalog/wireSpecs.js     配線の種類・太さ・色
  catalog/tubeSpecs.js     コルゲートチューブのサイズ・色
  render/                  SVG 描画（画面と PDF で共通）
  editor/                  キャンバス操作・編集コマンド・PDF 出力(print.js)
  ui/                      ツールバー・各パネル
docs/datasheet-notes.md    断面図・ピン配置の根拠
```
- **部品データ**（`catalog/`）と**図面データ**（プロジェクト JSON）は分離しています。プロジェクトには部品の `partId` と配置情報のみを保存します。
- `Datasheet/` はメーカーの著作物のため `.gitignore` で除外しています。

## 開発状況
- [x] Phase 1: 基本 UI・コネクタ配置
- [x] Phase 2: 配線設定
- [x] Phase 3: コルゲートチューブ
- [x] Phase 4: ページ管理・保存・PDF 出力
- [ ] Phase 5: 動作確認・改善・デプロイ
