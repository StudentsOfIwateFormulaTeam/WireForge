// プロジェクトファイル(JSON)の保存・読み込みと、ブラウザ内への自動保存
import { migrate } from './model.js';

const AUTOSAVE_KEY = 'sift-harness:autosave';
const AUTOSAVE_DELAY = 600; // ms

/** 保存用 JSON 文字列 */
export function serialize(project) {
  return JSON.stringify(project, null, 2);
}

/** JSON 文字列 → 現行スキーマのプロジェクト（不正なら例外） */
export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON として読み込めませんでした（ファイルが壊れている可能性があります）');
  }
  return migrate(data);
}

const safeName = (name) => (name || 'project').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'project';

/** プロジェクトを .json ファイルとしてダウンロード */
export function downloadProject(project) {
  const blob = new Blob([serialize(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(project.name)}.harness.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File → プロジェクト */
export async function readProjectFile(file) {
  return deserialize(await file.text());
}

/** ファイル選択ダイアログを開いて読み込む。キャンセル時は null */
export function pickProjectFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try { resolve(await readProjectFile(file)); } catch (e) { reject(e); }
    };
    input.click();
  });
}

// ---------- 自動保存（localStorage） ----------

export function loadAutosave() {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    return text ? deserialize(text) : null;
  } catch (e) {
    console.warn('自動保存データを読み込めませんでした', e);
    return null;
  }
}

/**
 * store の変更を監視して自動保存する。
 * onStatus(state, time): state = 'saved' | 'error'
 */
export function startAutosave(store, onStatus) {
  let timer = null;
  let last = null;
  const save = () => {
    timer = null;
    const text = JSON.stringify(store.project);
    if (text === last) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, text);
      last = text;
      onStatus?.('saved', new Date());
    } catch (e) {
      console.warn('自動保存に失敗しました', e);
      onStatus?.('error', new Date());
    }
  };
  store.subscribe((reason) => {
    if (reason !== 'project' && reason !== 'page') return;
    clearTimeout(timer);
    timer = setTimeout(save, AUTOSAVE_DELAY);
  });
  // タブを閉じる・隠す直前に保留中の保存を確定
  const flush = () => { if (timer) { clearTimeout(timer); save(); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  return { flush, saveNow: save };
}
