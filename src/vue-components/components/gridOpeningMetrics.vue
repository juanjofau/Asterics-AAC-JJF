
<template>
    <div class="grid-opening-metrics">
        <div class="metrics-line">
            <span class="metric">
                <span class="metric-label">Board:</span> {{ gridName || '—' }}
            </span>
            <span class="metric">
                <span class="metric-label">Global:</span> {{ globalName === false ? 'Not shown' : (globalName || '—') }}
            </span>
        </div>
        <div class="metrics-line">
            <span class="metric">
                <span class="metric-label">Opening:</span> {{ formatTime(openTimeMs) }}
            </span>
            <span class="metric">
                <span class="metric-label">Cache:</span> {{ cacheHit === null ? '—' : (cacheHit ? 'Yes' : 'No') }}
            </span>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        gridName: String,
        globalName: [String, Boolean],
        openTimeMs: Number,
        cacheHit: {
            type: Boolean,
            default: null
        }
    },
    methods: {
        formatTime(value) {
            return Number.isFinite(value) ? `${Math.round(value)} ms` : '—';
        }
    }
};
</script>

<style scoped>
.grid-opening-metrics {
    flex: 0 0 auto;
    box-sizing: border-box;
    height: 3.6em;
    min-height: 3.6em;
    max-height: 3.6em;
    overflow: hidden;
    display: grid;
    grid-template-rows: repeat(2, 1.3em);
    gap: 0.2em;
    padding: 0.3em 0.55em;
    color: #79e6a5;
    background: #090f14;
    border-top: 1px solid #24516b;
    font: 0.85em/1.3 monospace;
}

.metrics-line {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75em;
    min-width: 0;
}

.metric {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
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
