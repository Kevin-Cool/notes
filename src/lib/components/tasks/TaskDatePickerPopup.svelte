<script lang="ts">
    import { tick } from "svelte";

    let {
        isOpen,
        anchorElement,
        value,
        onClose,
        onSelectDate,
    }: {
        isOpen: boolean;
        anchorElement: HTMLElement | null;
        value: Date;
        onClose: () => void;
        onSelectDate: (date: Date) => void;
    } = $props();

    const viewportPaddingPx: number = 8;
    const weekDayLabels: string[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

    let popupElement: HTMLDivElement | null = $state(null);
    let popupLeftPx: number = $state(0);
    let popupTopPx: number = $state(0);
    // svelte-ignore state_referenced_locally
    let inputValue: string = $state(formatDateDdMmYyyy(value));
    // svelte-ignore state_referenced_locally
    let visibleMonth: Date = $state(getStartOfMonth(value));

    function getStartOfMonth(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function normalizeDate(date: Date): Date {
        const result: Date = new Date(date);
        result.setHours(0, 1, 0, 0);
        return result;
    }

    function formatDateDdMmYyyy(date: Date): string {
        const day: string = String(date.getDate()).padStart(2, "0");
        const month: string = String(date.getMonth() + 1).padStart(2, "0");
        const year: string = String(date.getFullYear());

        return `${day}/${month}/${year}`;
    }

    function parseDateDdMmYyyy(rawValue: string): Date | null {
        const match: RegExpMatchArray | null = rawValue.match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/,
        );

        if (!match) return null;

        const day: number = Number(match[1]);
        const monthIndex: number = Number(match[2]) - 1;
        const year: number = Number(match[3]);

        const parsedDate: Date = new Date(year, monthIndex, day);

        if (
            parsedDate.getFullYear() !== year ||
            parsedDate.getMonth() !== monthIndex ||
            parsedDate.getDate() !== day
        ) {
            return null;
        }

        return normalizeDate(parsedDate);
    }

    function getCalendarDays(monthDate: Date): Date[] {
        const monthStart: Date = getStartOfMonth(monthDate);
        const dayOfWeek: number = monthStart.getDay();
        const mondayOffset: number = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const firstVisibleDate: Date = new Date(monthStart);
        firstVisibleDate.setDate(monthStart.getDate() - mondayOffset);

        return Array.from({ length: 42 }, (_: unknown, index: number): Date => {
            const date: Date = new Date(firstVisibleDate);
            date.setDate(firstVisibleDate.getDate() + index);
            return normalizeDate(date);
        });
    }

    function isSameDay(left: Date, right: Date): boolean {
        return (
            left.getFullYear() === right.getFullYear() &&
            left.getMonth() === right.getMonth() &&
            left.getDate() === right.getDate()
        );
    }

    function selectDate(date: Date): void {
        const normalizedDate: Date = normalizeDate(date);
        onSelectDate(normalizedDate);
        onClose();
    }

    function handleManualSubmit(): void {
        const parsedDate: Date | null = parseDateDdMmYyyy(inputValue);

        if (!parsedDate) return;

        selectDate(parsedDate);
    }

    function changeMonth(amount: number): void {
        const nextMonth: Date = new Date(visibleMonth);
        nextMonth.setMonth(nextMonth.getMonth() + amount);
        visibleMonth = getStartOfMonth(nextMonth);
    }

    function goToToday(): void {
        const today: Date = normalizeDate(new Date());
        selectDate(today);
    }

    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    async function updatePopupPosition(): Promise<void> {
        if (!isOpen || !anchorElement) return;

        await tick();

        if (!popupElement) return;

        const anchorRect: DOMRect = anchorElement.getBoundingClientRect();
        const popupRect: DOMRect = popupElement.getBoundingClientRect();

        popupLeftPx = clamp(
            anchorRect.left,
            viewportPaddingPx,
            window.innerWidth - popupRect.width - viewportPaddingPx,
        );

        popupTopPx = clamp(
            anchorRect.bottom + 8,
            viewportPaddingPx,
            window.innerHeight - popupRect.height - viewportPaddingPx,
        );
    }

    $effect((): void => {
        if (!isOpen) return;

        inputValue = formatDateDdMmYyyy(value);
        visibleMonth = getStartOfMonth(value);
        void updatePopupPosition();
    });
</script>

<svelte:window onresize={() => void updatePopupPosition()} />

{#if isOpen}
    <div
        bind:this={popupElement}
        class="date-picker-popup"
        style={`left: ${popupLeftPx}px; top: ${popupTopPx}px;`}
        onclick={(event: MouseEvent): void => event.stopPropagation()}
        role="dialog"
        aria-label="Pick date"
        tabindex="-1"
        onkeydown={(event: KeyboardEvent): void => {
            if (event.key === "esc") {
                event.preventDefault();
                onClose();
            }
        }}
    >
        <label class="date-picker-label" for="date-picker-input">
            Go to date
        </label>

        <form
            onsubmit={(event: SubmitEvent): void => {
                event.preventDefault();
                handleManualSubmit();
            }}
        >
            <input
                id="date-picker-input"
                class="date-picker-input"
                bind:value={inputValue}
                placeholder="dd/mm/yyyy"
            />
        </form>

        <div class="calendar-header">
            <button type="button" onclick={() => changeMonth(-1)}>←</button>

            <div class="calendar-month">
                {visibleMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                })}
            </div>

            <button type="button" onclick={() => changeMonth(1)}>→</button>
        </div>

        <div class="calendar-grid">
            {#each weekDayLabels as label}
                <div class="calendar-weekday">{label}</div>
            {/each}

            {#each getCalendarDays(visibleMonth) as date}
                <button
                    type="button"
                    class="calendar-day"
                    class:muted={date.getMonth() !== visibleMonth.getMonth()}
                    class:selected={isSameDay(date, value)}
                    onclick={() => selectDate(date)}
                >
                    {date.getDate()}
                </button>
            {/each}
        </div>

        <button type="button" class="today-action" onclick={goToToday}>
            Today
        </button>
    </div>
{/if}

<style>
    .date-picker-popup {
        position: fixed;
        z-index: 2001;
        width: 19rem;
        padding: 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-float);
        background: var(--color-surface);
        box-shadow: var(--shadow-float);
        user-select: none;
    }

    .date-picker-label {
        display: block;
        padding: 0.4rem 0.5rem 0.5rem;
        font-size: 0.8rem;
        color: var(--color-text-muted);
    }

    .date-picker-input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--color-border);
        background: var(--color-button-bg);
        color: var(--color-text);
        border-radius: var(--radius-button);
        font: inherit;
    }

    .calendar-header {
        display: grid;
        grid-template-columns: 2rem 1fr 2rem;
        align-items: center;
        gap: 0.25rem;
        margin-top: 0.6rem;
    }

    .calendar-header button,
    .calendar-day,
    .today-action {
        border: none;
        background: transparent;
        color: var(--color-text);
        border-radius: var(--radius-button);
        cursor: pointer;
    }

    .calendar-header button {
        height: 2rem;
    }

    .calendar-header button:hover,
    .calendar-day:hover,
    .today-action:hover {
        background: var(--color-button-bg-hover);
    }

    .calendar-month {
        text-align: center;
        font-weight: 600;
        color: var(--color-text);
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.2rem;
        margin-top: 0.5rem;
    }

    .calendar-weekday {
        text-align: center;
        font-size: 0.78rem;
        color: var(--color-text-muted);
        padding: 0.35rem 0;
    }

    .calendar-day {
        height: 2rem;
        font-size: 0.85rem;
    }

    .calendar-day.muted {
        color: var(--color-text-muted);
        opacity: 0.65;
    }

    .calendar-day.selected {
        background: var(--color-accent);
        color: var(--color-surface);
    }

    .today-action {
        width: 100%;
        margin-top: 0.4rem;
        padding: 0.55rem 0.75rem;
        text-align: center;
        color: var(--color-accent);
    }
</style>
