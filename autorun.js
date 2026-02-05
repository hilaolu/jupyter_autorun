setTimeout(() => {
    // 1. Resolve Scope & Identify Self
    const outputArea = (element.get && typeof element.get === 'function') ? element.get(0) : element;

    // Find the cell that is running THIS code
    const currentTrackerCell = outputArea.closest('.jp-Cell');

    // 2. Setup UI Indicator
    const status = document.createElement('div');
    status.innerHTML = '⚡ <b>Auto-Run Active</b> (Self-Ignored)';
    status.style.cssText = 'font-size: 11px; color: #d32f2f; font-family: monospace; padding: 2px;';
    outputArea.appendChild(status);

    // 3. Helper: Generate Hash
    const getHash = (str) => {
        let hash = 0;
        if (!str) return hash;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    };

    // 4. Helper: Extract Code Content
    const getCellContent = (cell) => {
        const editor = cell.querySelector('.cm-content') || cell.querySelector('.CodeMirror-code') || cell.querySelector('.jp-InputArea');
        return editor ? editor.innerText.trim() : "";
    };

    // 5. Helper: Simulate Ctrl+Enter
    const triggerRun = (targetElement) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            ctrlKey: !isMac,
            metaKey: isMac
        });
        targetElement.dispatchEvent(event);
    };

    // 6. Main Logic
    const notebookContainer = outputArea.closest('.jp-WindowedPanel-viewport');

    if (!notebookContainer) {
        status.innerHTML = '❌ Error: Notebook viewport not found.';
        return;
    }

    // Initialize known hashes (Including self, to be safe, but we will ignore self in loop anyway)
    const knownHashes = new Set();
    notebookContainer.querySelectorAll('.jp-Cell').forEach(cell => {
        knownHashes.add(getHash(getCellContent(cell)));
    });

    // 7. Observer
    const observer = new MutationObserver((mutations) => {
        const nodesAdded = mutations.some(m => m.addedNodes.length > 0);

        if (nodesAdded || true) {
            setTimeout(() => {
                const currentCells = notebookContainer.querySelectorAll('.jp-Cell');

                currentCells.forEach(cell => {
                    // --- SAFETY CHECK: IGNORE SELF ---
                    if (cell === currentTrackerCell) return;

                    const content = getCellContent(cell);
                    const hash = getHash(content);

                    // If New Unique Code Found
                    if (!knownHashes.has(hash)) {
                        knownHashes.add(hash);

                        // A) Focus
                        cell.click();

                        const input = cell.querySelector('.cm-content') || cell.querySelector('textarea');
                        const target = input || cell;

                        if (input) input.focus();
                        else cell.focus();

                        cell.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // B) Run
                        setTimeout(() => {
                            triggerRun(target);

                            // Visual feedback
                            const flash = document.createElement('div');
                            flash.style.cssText = 'position:absolute; top:0; right:0; background:green; color:white; font-size:10px; padding:2px; z-index:1000;';
                            flash.innerText = "AUTO-RUN";
                            cell.appendChild(flash);
                            setTimeout(() => flash.remove(), 1000);
                        }, 100);
                    }
                });
            }, 50);
        }
    });

    observer.observe(notebookContainer, { childList: true });

}, 200);
