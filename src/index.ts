/**
 * jupyter_autorun - JupyterLab Extension
 *
 * Automatically executes notebook cells when modified by collaborators
 * in real-time or via out-of-band file changes.
 *
 * @packageDocumentation
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
  NotebookActions,
  NotebookPanel,
  Notebook
} from '@jupyterlab/notebook';

import { Cell, ICellModel } from '@jupyterlab/cells';
import * as Y from 'yjs';

// ============================================================================
// Types
// ============================================================================

class Disposable {
  private _disposed = false;
  constructor(private readonly _dispose: () => void) { }
  get isDisposed() { return this._disposed; }
  dispose() {
    if (!this._disposed) {
      this._disposed = true;
      this._dispose();
    }
  }
}

interface YSharedModel {
  ymodel?: Y.Map<unknown>;
  changed?: {
    connect: (h: (s: unknown, c: CellChange) => void) => void;
    disconnect: (h: (s: unknown, c: CellChange) => void) => void;
  };
}

interface CellChange { sourceChange?: unknown[]; }
interface CellSnapshot { id: string; source: string; type: string; }

// ============================================================================
// State
// ============================================================================

const notebookDisposables = new WeakMap<NotebookPanel, Disposable[]>();
const notebookSnapshots = new WeakMap<NotebookPanel, CellSnapshot[]>();
const pendingExecutions = new Map<string, number>();

const EXECUTION_COOLDOWN_MS = 2000;
const OOB_DEBOUNCE_MS = 1000;
const OOB_SETTLE_MS = 300;

let isAutoRunEnabled = true;

// ============================================================================
// Utilities
// ============================================================================

const isRemote = (tx: Y.Transaction | null | undefined) => tx != null && !tx.local;

function snapshotCells(notebook: Notebook): CellSnapshot[] {
  return notebook.widgets.map(cell => ({
    id: cell.model.id,
    source: cell.model.sharedModel.getSource(),
    type: cell.model.type
  }));
}

function findChangedCells(oldSnap: CellSnapshot[], newSnap: CellSnapshot[]): number[] {
  const oldById = new Map(oldSnap.map(s => [s.id, s]));
  const oldBySource = new Map(oldSnap.map(s => [s.source, s]));
  const changed: number[] = [];

  for (let i = 0; i < newSnap.length; i++) {
    const cell = newSnap[i];
    if (cell.type !== 'code') continue;

    const byId = oldById.get(cell.id);
    if (byId) {
      if (byId.source !== cell.source) changed.push(i);
      continue;
    }
    if (!oldBySource.has(cell.source)) changed.push(i);
  }
  return changed;
}

async function runCell(notebook: Notebook, panel: NotebookPanel, idx: number): Promise<void> {
  if (!panel.sessionContext.session?.kernel) return;

  const cell = notebook.widgets[idx];
  if (!cell || cell.model.type !== 'code') return;

  // Deduplication
  const now = Date.now();
  const last = pendingExecutions.get(cell.model.id);
  if (last && now - last < EXECUTION_COOLDOWN_MS) return;
  pendingExecutions.set(cell.model.id, now);

  // Scroll to cell
  notebook.node.scrollTo({ top: cell.node.offsetTop, behavior: 'smooth' });

  const prev = notebook.activeCellIndex;
  notebook.activeCellIndex = idx;

  try {
    await NotebookActions.run(notebook, panel.sessionContext);
  } catch (err) {
    console.error(`[autorun] Cell ${idx} failed:`, err);
  } finally {
    notebook.activeCellIndex = prev;
  }
}

// ============================================================================
// Cell Observers (Real-time Collaboration)
// ============================================================================

function observeCell(
  cell: Cell<ICellModel>,
  notebook: Notebook,
  panel: NotebookPanel,
  disposables: Disposable[]
): void {
  const shared = cell.model.sharedModel as YSharedModel | undefined;
  if (!shared) return;

  const ySource = shared.ymodel?.get('source') as Y.Text | undefined;
  if (ySource) {
    const handler = (_: Y.YTextEvent, tx: Y.Transaction) => {
      if (!isAutoRunEnabled || !isRemote(tx)) return;
      const idx = notebook.widgets.indexOf(cell);
      if (idx >= 0) runCell(notebook, panel, idx);
    };
    ySource.observe(handler);
    disposables.push(new Disposable(() => ySource.unobserve(handler)));
  } else if (shared.changed) {
    const handler = (_: unknown, change: CellChange) => {
      if (!isAutoRunEnabled || !change.sourceChange?.length) return;
      const idx = notebook.widgets.indexOf(cell);
      if (idx >= 0 && notebook.activeCellIndex !== idx && cell.model.type === 'code') {
        runCell(notebook, panel, idx);
      }
    };
    shared.changed.connect(handler);
    disposables.push(new Disposable(() => shared.changed!.disconnect(handler)));
  }
}

// ============================================================================
// Notebook Observer
// ============================================================================

function observeNotebook(panel: NotebookPanel): void {
  const notebook = panel.content;
  const model = notebook.model;
  if (!model) return;

  const shared = model.sharedModel as YSharedModel | undefined;
  if (!shared) return;

  const disposables: Disposable[] = [];
  notebookSnapshots.set(panel, snapshotCells(notebook));

  // OOB Change Detection
  let processing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let oldSnap: CellSnapshot[] | null = null;

  const onModelChanged = () => {
    if (!isAutoRunEnabled || processing) return;

    // Capture snapshot on first signal only
    if (oldSnap === null) {
      oldSnap = notebookSnapshots.get(panel) || [];
    }

    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (processing) return;
      processing = true;

      try {
        await new Promise(r => setTimeout(r, OOB_SETTLE_MS));

        const newSnap = snapshotCells(notebook);
        const changed = findChangedCells(oldSnap || [], newSnap);

        for (const idx of changed) {
          if (notebook.widgets[idx]) await runCell(notebook, panel, idx);
        }

        notebookSnapshots.set(panel, snapshotCells(notebook));
        oldSnap = null;

        for (const cell of notebook.widgets) {
          observeCell(cell, notebook, panel, disposables);
        }
      } catch (err) {
        console.error('[autorun] Error:', err);
        oldSnap = null;
      } finally {
        processing = false;
      }
    }, OOB_DEBOUNCE_MS);
  };

  // Connect signals
  if ((model.sharedModel as any)?.changed) {
    (model.sharedModel as any).changed.connect(onModelChanged);
    disposables.push(new Disposable(() => {
      (model.sharedModel as any).changed?.disconnect(onModelChanged);
      if (timer) clearTimeout(timer);
    }));
  }
  model.contentChanged.connect(onModelChanged);
  disposables.push(new Disposable(() => model.contentChanged.disconnect(onModelChanged)));

  // Y.Array cell insertions
  const yCells = shared.ymodel?.get('cells') as Y.Array<unknown> | undefined;
  if (yCells) {
    const handler = (event: Y.YArrayEvent<unknown>, tx: Y.Transaction) => {
      if (!isAutoRunEnabled || !isRemote(tx)) return;

      let idx = 0;
      for (const delta of event.changes.delta) {
        if ('retain' in delta) idx += delta.retain as number;
        if ('insert' in delta && Array.isArray(delta.insert)) {
          for (let i = 0; i < delta.insert.length; i++) {
            const cellIdx = idx + i;
            setTimeout(() => {
              const cell = notebook.widgets[cellIdx];
              if (cell?.model.type === 'code') {
                runCell(notebook, panel, cellIdx);
                observeCell(cell, notebook, panel, disposables);
              }
            }, 100);
          }
          idx += delta.insert.length;
        }
      }
      notebookSnapshots.set(panel, snapshotCells(notebook));
    };
    yCells.observe(handler);
    disposables.push(new Disposable(() => yCells.unobserve(handler)));
  }

  // Observe existing cells
  notebook.widgets.forEach(cell => observeCell(cell, notebook, panel, disposables));

  // Future cell additions
  model.cells.changed.connect((_, change: { type: string; newIndex: number; newValues?: ICellModel[] }) => {
    if (change.type !== 'add' || !change.newValues) return;
    for (let i = 0; i < change.newValues.length; i++) {
      const idx = change.newIndex + i;
      setTimeout(() => {
        const cell = notebook.widgets[idx];
        if (cell) observeCell(cell, notebook, panel, disposables);
      }, 50);
    }
    notebookSnapshots.set(panel, snapshotCells(notebook));
  });

  // Cleanup
  notebookDisposables.set(panel, disposables);
  panel.disposed.connect(() => {
    disposables.forEach(d => d.dispose());
    notebookDisposables.delete(panel);
    notebookSnapshots.delete(panel);
  });
}

// ============================================================================
// Plugin
// ============================================================================

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter_autorun:plugin',
  description: 'Auto-run cells on collaborator edits or out-of-band changes',
  autoStart: true,
  requires: [INotebookTracker],

  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    app.commands.addCommand('jupyter_autorun:toggle', {
      label: () => `Auto-Run: ${isAutoRunEnabled ? 'ON' : 'OFF'}`,
      caption: 'Toggle auto-execution of remotely modified cells',
      isToggled: () => isAutoRunEnabled,
      execute: () => { isAutoRunEnabled = !isAutoRunEnabled; }
    });

    tracker.forEach(p => p.revealed.then(() => observeNotebook(p)));
    tracker.widgetAdded.connect((_, p) => p.revealed.then(() => observeNotebook(p)));
  }
};

export default plugin;
