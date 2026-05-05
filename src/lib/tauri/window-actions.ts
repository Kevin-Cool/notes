import { uiState } from "$lib/state/ui.svelte";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor, PhysicalSize, type Monitor } from "@tauri-apps/api/window";

const appWindow = getCurrentWebviewWindow();

export async function minimizeWindow(): Promise<void> {
    await appWindow.minimize();
}

export async function hideWindow(): Promise<void> {
    await appWindow.hide();
}

export function toggleCustomChrome(): void {
    uiState.showCustomBar = !uiState.showCustomBar;
}

export async function toggleOpenOrMinimize(): Promise<void> {
    const isMinimized: boolean = await appWindow.isMinimized();
    const isVisible: boolean = await appWindow.isVisible();

    if (isMinimized || !isVisible) {
        await appWindow.show();
        await appWindow.unminimize();
        await appWindow.setFocus();
        return;
    }

    await appWindow.minimize();
}

export async function startWindowDrag(): Promise<void> {
    const monitor: Monitor | null = await currentMonitor();

    if (monitor !== null) {
        const currentPosition = await appWindow.outerPosition();
        const currentOuterSize = await appWindow.outerSize();
        const currentInnerSize = await appWindow.innerSize();

        const verticalFrameSize: number =
            currentOuterSize.height - currentInnerSize.height;

        const topEdgeY: number = monitor.workArea.position.y;
        const currentWindowY: number = currentPosition.y;
        const distanceToTop: number = Math.abs(currentWindowY - topEdgeY);

        if (distanceToTop <= 5) {
            const targetOuterHeight: number = Math.round(
                monitor.workArea.size.height * 0.5,
            );

            const targetInnerHeight: number = Math.max(
                1,
                targetOuterHeight - verticalFrameSize,
            );

            await appWindow.setSize(
                new PhysicalSize(currentInnerSize.width, targetInnerHeight),
            );
        }
    }

    await appWindow.startDragging();
}
