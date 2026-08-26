export interface LongPressEvent {
    clientX: number;
    clientY: number;
    pointerType: string;
}

export interface LongPressOptions {
    duration?: number;
    movementTolerance?: number;
    onLongPress: (event: LongPressEvent) => void;
}

interface PointerPosition {
    x: number;
    y: number;
}

export function longPress(
    node: HTMLElement,
    options: LongPressOptions,
): {
    update: (newOptions: LongPressOptions) => void;
    destroy: () => void;
} {
    let duration: number = options.duration ?? 500;
    let movementTolerance: number = options.movementTolerance ?? 10;
    let onLongPress: (event: LongPressEvent) => void = options.onLongPress;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let startPosition: PointerPosition | null = null;
    let activePointerId: number | null = null;

    const clearTimer = (): void => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }

        startPosition = null;
        activePointerId = null;
    };

    const handlePointerDown = (event: PointerEvent): void => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        activePointerId = event.pointerId;

        startPosition = {
            x: event.clientX,
            y: event.clientY,
        };

        timer = setTimeout((): void => {
            timer = null;

            onLongPress({
                clientX: event.clientX,
                clientY: event.clientY,
                pointerType: event.pointerType,
            });
        }, duration);
    };

    const handlePointerMove = (event: PointerEvent): void => {
        if (
            startPosition === null ||
            activePointerId !== event.pointerId
        ) {
            return;
        }

        const distanceX: number =
            Math.abs(event.clientX - startPosition.x);

        const distanceY: number =
            Math.abs(event.clientY - startPosition.y);

        if (
            distanceX > movementTolerance ||
            distanceY > movementTolerance
        ) {
            clearTimer();
        }
    };

    const handlePointerEnd = (): void => {
        clearTimer();
    };

    node.addEventListener("pointerdown", handlePointerDown);
    node.addEventListener("pointermove", handlePointerMove);
    node.addEventListener("pointerup", handlePointerEnd);
    node.addEventListener("pointercancel", handlePointerEnd);

    return {
        update(newOptions: LongPressOptions): void {
            duration = newOptions.duration ?? 500;
            movementTolerance =
                newOptions.movementTolerance ?? 10;

            onLongPress = newOptions.onLongPress;
        },

        destroy(): void {
            clearTimer();

            node.removeEventListener(
                "pointerdown",
                handlePointerDown,
            );

            node.removeEventListener(
                "pointermove",
                handlePointerMove,
            );

            node.removeEventListener(
                "pointerup",
                handlePointerEnd,
            );

            node.removeEventListener(
                "pointercancel",
                handlePointerEnd,
            );
        },
    };
}