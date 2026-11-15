import Vue from 'vue';

// Group 4 (modes 4.1, 4.2 and 4.99): the dynamic boards opened last are kept in memory, to open them again without
// preparing them again.
//
// This file keeps the prepared dynamic boards (their cells, size, ...) of the last MAX_PERSISTED_BOARDS boards opened.
// Mode 4.1 only keeps these data. Modes 4.2 and 4.99 also keep the mounted regions (see persistentRegionsHost.vue),
// identified by the same keys, so the number of boards in memory is the same in both.
//
// A board is identified by its id, its revision and the settings that change its cells (see persistentRegionsGrid.js),
// so an edited board is never taken from here. A newer version of a board replaces the older one.

export const MAX_PERSISTED_BOARDS = 20;

// shown in the metrics bar: boards in memory (of the maximum) and whether the last opening was taken from memory
export const persistenceState = Vue.observable({
    boards: 0,
    max: MAX_PERSISTED_BOARDS,
    lastHit: false
});

// key -> { boardId, ... }; the first one is the oldest used (a Map keeps the order of insertion)
const prepared = new Map();

export function getPrepared(key) {
    if (!prepared.has(key)) {
        return null;
    }
    let entry = prepared.get(key);
    prepared.delete(key); // the board is now the most recently used one
    prepared.set(key, entry);
    return entry;
}

export function setPrepared(boardId, key, entry) {
    for (let existingKey of [...prepared.keys()]) {
        if (prepared.get(existingKey).boardId === boardId) {
            prepared.delete(existingKey); // an older version of the same board
        }
    }
    prepared.set(key, Object.assign({ boardId: boardId }, entry));
    while (prepared.size > MAX_PERSISTED_BOARDS) {
        prepared.delete(prepared.keys().next().value); // the oldest used one
    }
    persistenceState.boards = prepared.size;
}

export function clearPersistedBoards() {
    prepared.clear();
    persistenceState.boards = 0;
    persistenceState.lastHit = false;
}
