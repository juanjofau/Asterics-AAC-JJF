<template>
    <div class="grid-opening-metrics" role="status" aria-live="polite">
        <div class="grid-opening-metrics-line">
            <span class="metric-label">Global:</span>
            <span class="metric-global-name">{{ globalInfo ? globalInfo.name : (globalInfo === false ? 'no se muestra' : '—') }}</span>
            <span class="metric-size"><span class="metric-label">Tamaño:</span> {{ globalInfo ? globalInfo.columns + '×' + globalInfo.rows : '—' }}</span>
            <span class="metric-images"><span class="metric-label">Img incrustadas:</span> {{ globalInfo ? globalInfo.embedded : '—' }} · <span class="metric-label">Img URL:</span> {{ globalInfo ? globalInfo.urls : '—' }}</span>
        </div>
        <div class="grid-opening-metrics-line">
            <span class="metric-label">Tablero:</span>
            <span class="metric-grid-name">{{ gridName || '—' }}</span>
            <span class="metric-size"><span class="metric-label">Tamaño:</span> {{ boardInfo ? boardInfo.columns + '×' + boardInfo.rows : '—' }}</span>
            <span class="metric-images"><span class="metric-label">Img incrustadas:</span> {{ boardInfo ? boardInfo.embedded : '—' }} · <span class="metric-label">Img URL:</span> {{ boardInfo ? boardInfo.urls : '—' }}</span>
            <!-- the bar is the same in every mode: a field a mode does not use shows a dash -->
            <span class="metric-cache"><span class="metric-label">Desde caché:</span> {{ usesCache ? (wasCached ? 'Sí' : 'No') : '—' }}</span>
            <span class="metric-cache"><span class="metric-label">Tableros en caché:</span> <template v-if="memoryBoards">{{ memoryBoards.boards }}/{{ memoryBoards.max }}</template><template v-else>—</template></span>
        </div>
        <div class="grid-opening-metrics-line">
            <span><span class="metric-label">Total:</span> {{ formatTime(openTimeMs) }}</span>
            <span v-if="phases">(<span v-for="(phase, index) in phases" :key="phase[0]"><template v-if="index > 0"> · </template><span class="metric-label">{{ phase[0] }}</span> {{ formatTime(phase[1]) }}</span>)</span>
        </div>
    </div>
</template>

<script>
import { gridOpeningMetrics } from '../../js/util/gridOpeningMetrics';

export default {
    props: {
        gridName: String,
        openTimeMs: Number,
        wasCached: Boolean,
        // the shown board itself and the global board, each { name, columns, rows, embedded, urls }
        // (calculated when the browser is idle). globalInfo is false when the board shows no global board.
        boardInfo: Object,
        globalInfo: [Object, Boolean],
        // true when the selected mode keeps boards in a cache (only then "Caché: Sí/No" is shown)
        usesCache: Boolean,
        // boards kept in memory by the modes of group 4: { boards, max }
        memoryBoards: Object,
        // optional phase breakdown [[name, ms], ...] (Test 8)
        phases: Array
    },
    methods: {
        formatTime(value) {
            return gridOpeningMetrics.formatTime(value);
        },
        formatBytes(value) {
            return gridOpeningMetrics.formatBytes(value);
        }
    }
}
</script>

<style scoped>
.grid-opening-metrics {
    flex: 0 0 auto;
    box-sizing: border-box;
    /* fixed height for 3 lines, so the bar never grows or shrinks between boards */
    height: 5.1em;
    min-height: 5.1em;
    max-height: 5.1em;
    overflow: hidden;
    display: grid;
    grid-template-rows: repeat(3, 1.25em);
    gap: 0.15em;
    padding: 0.35em 0.55em;
    color: #79e6a5;
    background: #090f14;
    border-top: 1px solid #24516b;
    font: 0.85em/1.25 monospace;
}

.grid-opening-metrics-line {
    display: flex;
    align-items: center;
    gap: 0.25em 0.65em;
    white-space: nowrap;
    min-width: 0;
}

.metric-grid-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}

.metric-cache,
.metric-size,
.metric-images {
    flex: 0 0 auto;
    margin-left: 0.75em;
}

.metric-label {
    color: #63c7ff;
}

@media (max-width: 480px) {
    .grid-opening-metrics {
        font-size: 0.72em;
    }
}
</style>
