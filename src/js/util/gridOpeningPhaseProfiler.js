// Measurement only (part of the opening metrics bar, not a test mode): records how long each
// phase of opening a board takes, so optimizations can target the phase that dominates.
//
// Phases (each value is the time spent in that phase, in ms):
//   lectura      from the user's click (Router) until loadGrid() starts: getGrid() from the database
//   datos        synchronous part of recalculateRenderGrid(): fill spaces, merge global grid, filters
//   montaje      the wait after it, in which Vue mounts the board (absent when the board comes from a cache)
//   metadata     saving metadata (lastOpenedGridId)
//   nextTick     Vue mounting the board
//   servicios    prediction / collect / live element services + EVENT_GRID_LOADED
//   pintado      until the browser has painted
// The 4 phases shown in the metrics bar, as groups of the phases recorded above. The groups are the same
// in every mode (a phase that does not happen, e.g. "datos" for a board kept in memory, counts as 0 ms):
//   Leer       lectura
//   Preparar   datos + montaje
//   Activar    metadata + nextTick + servicios
//   Dibujar    pintado
// Their sum is the total opening time (from the start of the opening until the board is painted).
const PHASE_GROUPS = [
    ['Leer', ['lectura']],
    ['Preparar', ['datos', 'montaje']],
    ['Activar', ['metadata', 'nextTick', 'servicios']],
    ['Dibujar', ['pintado']]
];

export function groupPhases(phases) {
    return PHASE_GROUPS.map(([label, names]) => [
        label,
        phases.filter(phase => names.includes(phase[0])).reduce((sum, phase) => sum + phase[1], 0)
    ]);
}

export function createPhaseProfiler(startedAt) {
    let last = startedAt;
    let phases = [];

    function mark(name) {
        let now = performance.now();
        phases.push([name, now - last]);
        last = now;
    }

    // marks the final phase "pintado" now; onDone receives [[name, ms], ...]
    function finish(onDone) {
        mark('pintado');
        if (onDone) {
            onDone(phases.slice());
        }
    }

    // like finish(), but waits two animation frames so the browser has actually painted
    function finishAfterPaint(onDone) {
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => finish(onDone)));
        } else {
            setTimeout(() => finish(onDone), 0);
        }
    }

    return { mark, finish, finishAfterPaint };
}
