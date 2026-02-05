// Wait for DOM to attach

setTimeout(() => {
    // 1. Resolve Scope
    const outputArea = (element.get && typeof element.get === 'function') ? element.get(0) : element;
    const currentTrackerCell = outputArea.closest('.jp-Cell');

    // 2. UI Status
    const status = document.createElement('div');
    status.innerHTML = '⚡ <b>Background-Ready</b> (Robust Selector Mode)';
    status.style.cssText = 'font-size: 11px; color: #e65100; font-family: monospace; padding: 2px;';
    outputArea.appendChild(status);

    // 3. Helper: Hash Content
    const getHash = (str) => {
        let hash = 0;
        if (!str) return hash;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    };

    // 4. Helper: Get Content
    const getCellContent = (cell) => {
        const editor = cell.querySelector('.cm-content') || cell.querySelector('.CodeMirror-code') || cell.querySelector('.jp-InputArea');
        return editor ? editor.innerText.trim() : "";
    };

    // 5. Helper: Simulate Interaction (Click)
    const triggerClick = (target) => {
        if (!target) return;
        const opts = { bubbles: true, cancelable: true, view: window };
        target.dispatchEvent(new MouseEvent('mousedown', opts));
        target.dispatchEvent(new MouseEvent('mouseup', opts));
        target.dispatchEvent(new MouseEvent('click', opts));
    };

    // 6. NEW Helper: Robust Toolbar Search
    const triggerToolbarRun = () => {
        // Strategy 1: The precise jp-button (Direct)
        let btn = document.querySelector('jp-button[data-command="notebook:run-cell-and-select-next"]');

        // Strategy 2: The wrapper div "run" -> find the button inside
        if (!btn) {
            const wrapper = document.querySelector('div[data-jp-item-name="run"]');
            if (wrapper) {
                btn = wrapper.querySelector('jp-button') || wrapper.querySelector('button');
            }
        }

        // Strategy 3: Search by Title (Fallback)
        if (!btn) {
            btn = document.querySelector('button[title*="Run"]');
        }

        if (btn) {
            triggerClick(btn); // Use the helper to send full mouse event sequence
            return true;
        }

        console.warn("Auto-Run: All selector strategies failed.");
        return false;
    };

    // 7. Main Logic
    const notebookContainer = outputArea.closest('.jp-WindowedPanel-viewport');
    if (!notebookContainer) {
        status.innerHTML = '❌ Error: Viewport not found.';
        return;
    }

    const knownHashes = new Set();
    notebookContainer.querySelectorAll('.jp-Cell').forEach(cell => {
        knownHashes.add(getHash(getCellContent(cell)));
    });

    // 8. Observer
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            const currentCells = notebookContainer.querySelectorAll('.jp-Cell');

            var triggered = false;
            currentCells.forEach(cell => {
                if (cell === currentTrackerCell) return;
                if (triggered) return;


                const content = getCellContent(cell);
                const hash = getHash(content);

                if (!knownHashes.has(hash)) {
                    knownHashes.clear();
                    notebookContainer.querySelectorAll('.jp-Cell').forEach(cell => {
                        knownHashes.add(getHash(getCellContent(cell)));
                    });
                    triggered = true;

                    // --- STEP A: ACTIVATE CELL ---
                    triggerClick(cell);

                    // --- STEP B: TRIGGER TOOLBAR ---
                    setTimeout(() => {
                        const success = triggerToolbarRun();

                        const color = success ? '#43a047' : '#d32f2f';
                        const msg = success ? "TOOLBAR RUN" : "BTN NOT FOUND";

                        const flash = document.createElement('div');
                        flash.style.cssText = `position:absolute; top:0; right:0; background:${color}; color:white; font-size:10px; padding:2px; z-index:9999;`;
                        flash.innerText = msg;
                        cell.appendChild(flash);
                        setTimeout(() => flash.remove(), 1000);
                    }, 100);
                }
            });
        }, 200);
    });

    observer.observe(notebookContainer, {
        childList: true,
        subtree: true,
        characterData: true
    });

}, 400);
