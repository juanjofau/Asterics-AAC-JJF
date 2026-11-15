export const gridOpeningMetrics = {
    start(startedAt) {
        return Number.isFinite(startedAt) ? startedAt : performance.now();
    },
    elapsed(startedAt) {
        return Math.max(0, performance.now() - startedAt);
    },
    // Counts the images of a list of grid elements, as the board displays them (data wins over url):
    //   embedded  images stored inside the board (data), their size is known
    //   urls      images loaded from a URL, their size is not known here
    //   bytes     approximate size of the embedded images
    // globalIds (optional): ids of the global board's elements. Those images are counted apart
    // (globalEmbedded / globalUrls), because the shown board has the global board merged into it.
    countImages(gridElements, globalIds) {
        let counts = { embedded: 0, urls: 0, bytes: 0, globalEmbedded: 0, globalUrls: 0 };
        for (let element of gridElements || []) {
            let image = element && element.image;
            if (!image) {
                continue;
            }
            let isGlobal = !!globalIds && globalIds.has(element.id);
            if (image.data) {
                counts[isGlobal ? 'globalEmbedded' : 'embedded']++;
                let marker = image.data.indexOf('base64,');
                counts.bytes += marker === -1
                    ? image.data.length
                    : Math.floor((image.data.length - marker - 7) * 3 / 4);
            } else if (image.url) {
                counts[isGlobal ? 'globalUrls' : 'urls']++;
            }
        }
        return counts;
    },
    // Estimated memory of the decoded images shown in a DOM element: width x height x 4 bytes
    // for each loaded <img>. An image source already in `seenSources` is not counted again (the browser
    // shares the same image between boards). It is an upper bound, the browser may drop decoded images it does not draw.
    decodedImageBytes(domElement, seenSources = new Set()) {
        let bytes = 0;
        if (domElement && domElement.querySelectorAll) {
            for (let img of domElement.querySelectorAll('img')) {
                if (img.complete && img.naturalWidth > 0 && !seenSources.has(img.currentSrc)) {
                    seenSources.add(img.currentSrc);
                    bytes += img.naturalWidth * img.naturalHeight * 4;
                }
            }
        }
        return bytes;
    },
    // runs fn when the browser is idle (after painting), never in the opening path
    whenIdle(fn) {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(fn, { timeout: 1000 });
        } else {
            setTimeout(fn, 50);
        }
    },
    formatBytes(bytes) {
        if (!Number.isFinite(bytes)) {
            return '—';
        }
        return bytes < 1024 * 1024
            ? `${Math.round(bytes / 1024)} KB`
            : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    formatTime(value) {
        return Number.isFinite(value) ? `${Math.round(value)} ms` : '—';
    }
};
