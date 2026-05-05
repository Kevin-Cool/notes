<script lang="ts">
    import {
        startWindowDrag,
        toggleCustomChrome,
    } from "$lib/tauri/window-actions";
</script>

<div class="top-edge-zone" onmousedown={startWindowDrag} aria-hidden="true">
    <div class="top-edge-handle">
        <span class="top-edge-grip"></span>
    </div>
</div>

<button
    type="button"
    class="floating-grab"
    onmousedown={startWindowDrag}
    onclick={toggleCustomChrome}
    aria-label="Show window bar"
    title="Show window bar"
>
    <span class="floating-grab-icon" aria-hidden="true">⠿</span>
</button>

<style>
    .top-edge-zone {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1900;
        height: 16px;

        display: flex;
        align-items: flex-start;
        justify-content: center;

        pointer-events: auto;
    }

    .top-edge-handle {
        margin-top: 0;
        width: 88px;
        height: 14px;

        border: 1px solid var(--color-border);
        border-top: none;
        border-radius: 0 0 12px 12px;

        background: color-mix(
            in srgb,
            var(--color-titlebar-bg-strong) 82%,
            transparent
        );
        color: var(--color-accent);

        box-shadow: 0 6px 16px rgba(191, 112, 138, 0.14);
        backdrop-filter: blur(14px);

        display: flex;
        align-items: center;
        justify-content: center;

        cursor: grab;

        opacity: 0;
        transform: translateY(-6px) scale(0.96);
        transition:
            opacity 140ms ease,
            transform 140ms ease,
            background 140ms ease,
            box-shadow 140ms ease;

        pointer-events: none;
    }

    .top-edge-zone:hover .top-edge-handle,
    .top-edge-zone:active .top-edge-handle,
    .top-edge-handle:focus-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
    }

    .top-edge-handle:hover {
        background: var(--color-button-bg-hover);
        box-shadow: 0 8px 18px rgba(191, 112, 138, 0.18);
    }

    .top-edge-handle:active {
        cursor: grabbing;
        transform: translateY(0) scale(0.97);
    }

    .top-edge-grip {
        width: 28px;
        height: 4px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--color-accent) 70%, white 30%);
        opacity: 0.8;
    }

    .floating-grab {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 2000;

        width: 38px;
        height: 38px;

        border: 1px solid var(--color-border);
        border-radius: 0 0 0 16px;

        background: var(--color-titlebar-bg-strong);
        color: var(--color-accent);

        cursor: grab;

        display: flex;
        align-items: center;
        justify-content: center;

        box-shadow: var(--shadow-float);
        backdrop-filter: blur(var(--blur-bar));
        transition:
            background 140ms ease,
            transform 140ms ease,
            box-shadow 140ms ease;
    }

    .floating-grab:hover {
        background: var(--color-button-bg-hover);
        box-shadow: var(--shadow-float-hover);
    }

    .floating-grab:active {
        cursor: grabbing;
        transform: scale(0.96);
    }

    .floating-grab-icon {
        font-size: 22px;
        line-height: 1;
        transform: translateY(-1px);
    }
</style>
