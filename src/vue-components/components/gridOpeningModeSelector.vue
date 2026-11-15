<template>
    <label class="grid-opening-mode-control">
        <select :value="value" @change="onChange" aria-label="Modo de apertura">
            <option value="original">Modo 0 · original (lógica original)</option>
            <option disabled>──────────</option>
            <option value="test15">Modo 1.1 · texto de las celdas calculado antes de pintar</option>
            <option value="test1">Modo 1.2 · omite celdas vacías (sin relleno)</option>
            <option value="test16">Modo 1.3 · celdas sin reactividad profunda (congeladas)</option>
            <option value="test8">Modo 1.4 · guarda metadata tras pintar el tablero</option>
            <option value="test17">Modo 1.5 · sin miniaturas al abrir tableros</option>
            <option value="test22">Modo 1.99 · todas las mejoras simples juntas (1.1 a 1.5)</option>
            <option disabled>──────────</option>
            <option value="test23">Modo 2.1 · zona dinámica deducida por la esquina libre (global sin zona definida)</option>
            <option value="test24">Modo 2.2 · zona dinámica deducida por el mayor espacio libre (global sin zona definida)</option>
            <option value="test25">Modo 2.3 · como 2.2 + vista previa de la zona al editar el global</option>
            <option value="test26">Modo 2.4 · como 2.3 pero con el mayor hueco libre en cualquier posición</option>
            <option disabled>──────────</option>
            <option value="test27">Modo 3.1 · como 2.4 + capas separadas para el global y el dinámico</option>
            <option value="test28">Modo 3.99 · modo 3.1 + todas las mejoras simples (1.1 a 1.5)</option>
            <option disabled>──────────</option>
            <option value="test29">Modo 4.1 · como 3.1 + datos preparados de los últimos 20 tableros</option>
            <option value="test30">Modo 4.2 · como 3.1 + últimos 20 tableros ya montados (keep-alive)</option>
            <option value="test31">Modo 4.99 · modo 4.2 + todas las mejoras simples (1.1 a 1.5)</option>
        </select>
    </label>
</template>

<script>
export default {
    props: {
        value: {
            type: String,
            default: 'original'
        }
    },
    methods: {
        onChange(event) {
            let mode = event.target.value;
            this.$emit('input', mode);
            this.$emit('mode-change', mode);
        }
    }
}
</script>

<style>
/* barra de arriba de las pruebas: con el selector no caben todos los botones, así que solo se ve el icono
   (cada botón conserva su aria-label) */
.opening-test-compact-header .hide-mobile {
    display: none;
}
</style>

<style scoped>
.grid-opening-mode-control {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    margin: 0 0.5em;
}

.grid-opening-mode-control select {
    max-width: 21em;
}
</style>
