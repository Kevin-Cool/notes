import { availableMonitors, getCurrentWindow, PhysicalPosition, PhysicalSize, type Monitor } from "@tauri-apps/api/window";

export async function snapToRightMostMonitorTopLeft(): Promise<void> {
    const appWindow = getCurrentWindow();

    const isMinimized: boolean = await appWindow.isMinimized();
    if (isMinimized) {
        await appWindow.unminimize();
        await appWindow.show();
    }

    const isMaximized: boolean = await appWindow.isMaximized();
    if (isMaximized) {
        await appWindow.unmaximize();
    }

    const monitors: Monitor[] = await availableMonitors();
    if (monitors.length === 0) {
        console.warn("No monitors found");
        return;
    }

    const rightMostMonitor: Monitor = monitors.reduce(
        (currentRightMonitor: Monitor, nextMonitor: Monitor): Monitor =>
            nextMonitor.position.x > currentRightMonitor.position.x
                ? nextMonitor
                : currentRightMonitor,
    );

    const workAreaX: number = rightMostMonitor.workArea.position.x;
    const workAreaY: number = rightMostMonitor.workArea.position.y;
    const workAreaWidth: number = rightMostMonitor.workArea.size.width;
    const workAreaHeight: number = rightMostMonitor.workArea.size.height;

    // Move first
    await appWindow.setPosition(
        new PhysicalPosition(workAreaX - 7, workAreaY),
    );

    // Let Windows/Tauri settle onto the target monitor
    await waitFor(50);

    const currentOuterSize: PhysicalSize = await appWindow.outerSize();
    const currentInnerSize: PhysicalSize = await appWindow.innerSize();

    const horizontalFrameSize: number =
        currentOuterSize.width - currentInnerSize.width;
    const verticalFrameSize: number =
        currentOuterSize.height - currentInnerSize.height;

    const minimumOuterWidth: number = Math.round(workAreaWidth * 0.4);
    const targetOuterWidth: number = Math.min(
        Math.max(currentOuterSize.width, minimumOuterWidth),
        workAreaWidth,
    );

    const targetOuterHeight: number = workAreaHeight;

    const targetInnerWidth: number = Math.max(
        1,
        targetOuterWidth - horizontalFrameSize,
    );

    const targetInnerHeight: number = Math.max(
        1,
        targetOuterHeight - verticalFrameSize,
    );

    await appWindow.setSize(
        new PhysicalSize(targetInnerWidth, targetInnerHeight + 7),
    );

    await appWindow.setPosition(
        new PhysicalPosition(workAreaX - 7, workAreaY),
    );

    await appWindow.setFocus();
}

function waitFor(ms: number): Promise<void> {
    return new Promise((resolve: () => void): void => {
        window.setTimeout(resolve, ms);
    });
}
