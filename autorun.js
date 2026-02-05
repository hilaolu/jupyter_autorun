// Wait for DOM to attach
setTimeout(() => {
    // 1. Resolve Scope
    const outputArea = (element.get && typeof element.get === 'function') ? element.get(0) : element;
    const currentTrackerCell = outputArea.closest('.jp-Cell');

    // 2. UI Status
    const status = document.createElement('div');
    status.innerHTML = '⚡ <b>Auto-Run Active</b> (Clean State Mode)';
    status.style.cssText = 'font-size: 11px; color: #009688; font-family: monospace; padding: 2px; border-left: 3px solid #009688; background: #f0f4c3;';
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

    // 5. Helper: Simulate Interaction
    const triggerClick = (target) => {
        if (!target) return;
        const opts = { bubbles: true, cancelable: true, view: window };
        target.dispatchEvent(new MouseEvent('mousedown', opts));
        target.dispatchEvent(new MouseEvent('mouseup', opts));
        target.dispatchEvent(new MouseEvent('click', opts));
    };

    // 6. Helper: Robust Toolbar Search & Click
    const triggerToolbarRun = () => {
        // Strategy 1: Direct button selector
        let btn = document.querySelector('jp-button[data-command="notebook:run-cell-and-select-next"]');
        
        // Strategy 2: Wrapper div selector
        if (!btn) {
            const wrapper = document.querySelector('div[data-jp-item-name="run"]');
            if (wrapper) btn = wrapper.querySelector('jp-button') || wrapper.querySelector('button');
        }

        // Strategy 3: Title fallback
        if (!btn) btn = document.querySelector('button[title*="Run"]');

        if (btn) {
            triggerClick(btn);
            return true;
        }
        return false;
    };

    // 7. Main Logic
    const notebookContainer = outputArea.closest('.jp-WindowedPanel-viewport');
    if (!notebookContainer) {
        status.innerHTML = '❌ Error: Viewport not found.';
        return;
    }

    // Initialize State
    let knownHashes = new Set();
    const refreshHashes = () => {
        const freshSet = new Set();
        notebookContainer.querySelectorAll('.jp-Cell').forEach(cell => {
            freshSet.add(getHash(getCellContent(cell)));
        });
        knownHashes = freshSet;
    };
    
    // Initial scan
    refreshHashes();

    // 8. Observer
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            const currentCells = notebookContainer.querySelectorAll('.jp-Cell');
            let runTriggered = false;

            currentCells.forEach(cell => {
                if (cell === currentTrackerCell) return;

                const content = getCellContent(cell);
                const hash = getHash(content);

                // If this is a NEW or MODIFIED cell (not in our last known state)
                if (!knownHashes.has(hash)) {
                    
                    // Prevent double-firing: add to temp set immediately
                    knownHashes.add(hash); 
                    runTriggered = true;

                    // A) Activate Cell
                    triggerClick(cell);

                    // B) Click Run Toolbar
                    setTimeout(() => {
                        const success = triggerToolbarRun();
                        
                        // Visual Feedback
                        const color = success ? '#4caf50' : '#f44336';
                        const flash = document.createElement('div');
                        flash.style.cssText = `position:absolute; top:0; right:0; background:${color}; color:white; font-size:10px; padding:2px; z-index:9999;`;
                        flash.innerText = success ? "AUTO-RUN" : "BTN ERROR";
                        cell.appendChild(flash);
                        setTimeout(() => flash.remove(), 1000);
                        
                        // C) CRITICAL: Refresh State
                        // Once the run command is sent, we re-scan the DOM to establish the "New Normal"
                        setTimeout(refreshHashes, 500); 

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

}, 200);
