let pendingMetadata = null;
let saveInProgress = false;

// Waits until the browser has painted the board (two animation frames), then until it is idle.
function waitUntilPaintedAndIdle() {
    return new Promise(resolve => {
        let whenIdle = () => {
            if (window.requestIdleCallback) {
                window.requestIdleCallback(() => resolve(), { timeout: 1000 });
            } else {
                setTimeout(resolve, 50);
            }
        };
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(() => window.requestAnimationFrame(whenIdle));
        } else {
            setTimeout(whenIdle, 0);
        }
    });
}

// Like Test 3, but the write only starts after the board is visible, so its CPU work
// (JSON, encryption, database write) no longer competes with showing the board.
// Only the newest pending state is saved.
export function scheduleTest8MetadataSave(metadata, saveMetadata) {
    pendingMetadata = JSON.parse(JSON.stringify(metadata));
    if (saveInProgress) {
        return;
    }

    saveInProgress = true;
    waitUntilPaintedAndIdle().then(async () => {
        while (pendingMetadata) {
            let metadataToSave = pendingMetadata;
            pendingMetadata = null;
            try {
                await saveMetadata(metadataToSave);
            } catch (error) {
                log.error(error);
            }
        }
    }).then(() => {
        saveInProgress = false;
        if (pendingMetadata) {
            scheduleTest8MetadataSave(pendingMetadata, saveMetadata);
        }
    });
}
