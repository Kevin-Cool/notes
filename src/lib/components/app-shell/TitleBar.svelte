<script lang="ts">
    import minimizeIcon from "$lib/assets/icons/minimize.svg";
    import closeIcon from "$lib/assets/icons/close.svg";
    import {
        hideWindow,
        minimizeWindow,
        startWindowDrag,
    } from "$lib/tauri/window-actions";
</script>

<div
    class="titlebar"
    onmousedown={startWindowDrag}
    role="toolbar"
    aria-label="Window controls"
    tabindex="0"
>
    <div class="title"></div>

    <div class="window-actions">
        <button
            type="button"
            onmousedown={(event: MouseEvent): void => event.stopPropagation()}
            onclick={minimizeWindow}
            aria-label="Minimize"
        >
            <span
                class="icon-image titlebar-icon"
                style={`--icon-url: url("${minimizeIcon}")`}
                aria-hidden="true"
            ></span>
        </button>

        <button
            type="button"
            onmousedown={(event: MouseEvent): void => event.stopPropagation()}
            onclick={hideWindow}
            aria-label="Close"
        >
            <span
                class="icon-image titlebar-icon"
                style={`--icon-url: url("${closeIcon}")`}
                aria-hidden="true"
            ></span>
        </button>
    </div>
</div>

<style>
    .titlebar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9999999;
        height: var(--titlebar-height);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px 0 14px;

        background: var(--color-titlebar-bg);
        border-bottom: 1px solid var(--color-border);
        box-shadow: var(--shadow-bar);

        user-select: none;
        -webkit-user-select: none;
        backdrop-filter: blur(var(--blur-bar));
    }

    .title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: var(--color-title);
        pointer-events: none;
    }

    .window-actions {
        display: flex;
        gap: 6px;
    }

    .window-actions button {
        width: 30px;
        height: 30px;
        border: 1px solid transparent;
        background: var(--color-button-bg);
        color: var(--color-title);
        cursor: pointer;
        border-radius: var(--radius-button);

        display: flex;
        align-items: center;
        justify-content: center;

        box-shadow: var(--shadow-soft);
        transition:
            background 140ms ease,
            transform 140ms ease,
            box-shadow 140ms ease,
            border-color 140ms ease;
    }

    .window-actions button:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-border-hover);
        transform: translateY(-1px);
        box-shadow: var(--shadow-soft-hover);
    }

    .window-actions button:active {
        transform: scale(0.96);
    }
    .titlebar-icon {
        width: 18px;
        height: 18px;
        background-color: var(--color-title);
    }

    .window-actions button:hover .titlebar-icon {
        background-color: var(--color-heading);
    }
</style>
