export interface LongPressEvent {
    clientX: number;
    clientY: number;
    pointerType: string;
}

export interface LongPressOptions {
    duration?: number;
    movementTolerance?: number;
    triggerOnRelease?: boolean;
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
    let triggerOnRelease: boolean = options.triggerOnRelease ?? false;

    let onLongPress: (event: LongPressEvent) => void =
        options.onLongPress;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let startPosition: PointerPosition | null = null;
    let activePointerId: number | null = null;

    let longPressReached: boolean = false;
    let pendingEvent: LongPressEvent | null = null;

    const reset = (): void => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }

        startPosition = null;
        activePointerId = null;
        longPressReached = false;
        pendingEvent = null;
    };

    const handlePointerDown = (event: PointerEvent): void => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        reset();

        activePointerId = event.pointerId;

        startPosition = {
            x: event.clientX,
            y: event.clientY,
        };

        pendingEvent = {
            clientX: event.clientX,
            clientY: event.clientY,
            pointerType: event.pointerType,
        };

        timer = setTimeout((): void => {
            timer = null;
            longPressReached = true;

            if (!triggerOnRelease && pendingEvent !== null) {
                const longPressEvent: LongPressEvent = pendingEvent;

                reset();
                onLongPress(longPressEvent);
            }
        }, duration);
    };

    const handlePointerMove = (event: PointerEvent): void => {
        if (
            startPosition === null ||
            activePointerId !== event.pointerId
        ) {
            return;
        }

        const distanceX: number = Math.abs(
            event.clientX - startPosition.x,
        );

        const distanceY: number = Math.abs(
            event.clientY - startPosition.y,
        );

        if (
            distanceX > movementTolerance ||
            distanceY > movementTolerance
        ) {
            reset();
        }
    };

    const handlePointerUp = (event: PointerEvent): void => {
        if (activePointerId !== event.pointerId) {
            return;
        }

        if (
            triggerOnRelease &&
            longPressReached &&
            pendingEvent !== null
        ) {
            const longPressEvent: LongPressEvent = pendingEvent;

            reset();
            onLongPress(longPressEvent);

            return;
        }

        reset();
    };

    const handlePointerCancel = (): void => {
        reset();
    };

    node.addEventListener("pointerdown", handlePointerDown);
    node.addEventListener("pointermove", handlePointerMove);
    node.addEventListener("pointerup", handlePointerUp);
    node.addEventListener("pointercancel", handlePointerCancel);

    return {
        update(newOptions: LongPressOptions): void {
            duration = newOptions.duration ?? 500;
            movementTolerance =
                newOptions.movementTolerance ?? 10;
            triggerOnRelease =
                newOptions.triggerOnRelease ?? false;
            onLongPress = newOptions.onLongPress;
        },

        destroy(): void {
            reset();

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
                handlePointerUp,
            );

            node.removeEventListener(
                "pointercancel",
                handlePointerCancel,
            );
        },
    };
}