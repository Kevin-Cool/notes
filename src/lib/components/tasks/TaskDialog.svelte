<script lang="ts">
    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import type { CalendarTaskDraft } from "$lib/types/tasks/calendar-task-draft";
    import { TaskColor } from "$lib/types/tasks/task-color";

    import trash_icon from "$lib/assets/icons/trash_icon.svg";

    type TimeMode = "end" | "duration";

    let {
        isOpen,
        mode,
        initialTask = null,
        initialStartDate = null,
        onClose,
        onSubmit,
        onDelete,
    }: {
        isOpen: boolean;
        mode: "create" | "update";
        initialTask?: CalendarTask | null;
        initialStartDate?: Date | null;
        onClose?: () => void;
        onSubmit?: (draft: CalendarTaskDraft) => void | Promise<void>;
        onDelete?: () => void | Promise<void>;
    } = $props();

    const availableColors: TaskColor[] = [
        TaskColor.Primary,
        TaskColor.Red,
        TaskColor.Rose,
        TaskColor.Blue,
        TaskColor.BlueLight,
        TaskColor.Green,
        TaskColor.GreenLight,
        TaskColor.Yellow,
        TaskColor.Orange,
        TaskColor.Purple,
        TaskColor.Lavender,
        TaskColor.Gray,
        TaskColor.Brown,
    ];

    let title: string = $state("");
    let description: string = $state("");
    let startDate: string = $state("");
    let startTime: string = $state("");
    let endDate: string = $state("");
    let endTime: string = $state("");
    let color: number = $state(TaskColor.Primary);
    let isSubmitting: boolean = $state(false);
    let titleError: string = $state("");
    let dateError: string = $state("");

    let timeMode: TimeMode = $state("duration");
    let durationMinutes: number = $state(60);
    let durationInput: string = $state("1:00");
    let isEditingDuration: boolean = $state(false);

    function handleDurationFocus(): void {
        isEditingDuration = true;
    }

    function handleDurationChange(value: string): void {
        durationInput = sanitizeDurationInput(value);
    }

    function handleDurationBlur(): void {
        isEditingDuration = false;

        const parsed: number | null =
            parseCommittedDurationInput(durationInput);

        if (parsed === null || parsed <= 0) {
            durationInput = formatDurationInputValue(durationMinutes);
            return;
        }

        durationMinutes = parsed;
        durationInput = formatDurationInputValue(parsed);

        if (timeMode === "duration") {
            applyEndFromDuration();
        }
    }

    function getDurationMinutes(start: Date, end: Date): number {
        const differenceMs: number = end.getTime() - start.getTime();
        return Math.max(15, Math.round(differenceMs / 60000));
    }

    function formatDurationInputValue(totalMinutes: number): string {
        const safeMinutes: number = Math.max(0, totalMinutes);
        const hours: number = Math.floor(safeMinutes / 60);
        const minutes: number = safeMinutes % 60;

        return `${hours}:${pad(minutes)}`;
    }

    function sanitizeDurationInput(value: string): string {
        const digitsAndColonOnly: string = value.replace(/[^\d:]/g, "");
        const colonIndex: number = digitsAndColonOnly.indexOf(":");

        if (colonIndex === -1) {
            return digitsAndColonOnly.slice(0, 5);
        }

        const beforeColon: string = digitsAndColonOnly
            .slice(0, colonIndex)
            .slice(0, 2);
        const afterColonRaw: string = digitsAndColonOnly.slice(colonIndex + 1);
        const afterColon: string = afterColonRaw.replace(/:/g, "").slice(0, 2);

        return `${beforeColon}:${afterColon}`;
    }

    function parseCommittedDurationInput(value: string): number | null {
        const trimmedValue: string = value.trim();

        if (trimmedValue.length === 0) {
            return null;
        }

        if (trimmedValue.includes(":")) {
            const match: RegExpMatchArray | null =
                trimmedValue.match(/^(\d+):(\d{1,2})$/);

            if (!match) {
                return null;
            }

            const hours: number = Number(match[1]);
            const minutes: number = Number(match[2]);

            if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                return null;
            }

            if (minutes >= 60) {
                return null;
            }

            return hours * 60 + minutes;
        }

        const digitsOnly: string = trimmedValue.replace(/\D/g, "");

        if (digitsOnly.length === 0) {
            return null;
        }

        const truncatedDigits: string = digitsOnly.slice(0, 4);
        const normalizedDigits: string = truncatedDigits.padStart(3, "0");

        const hoursPart: string = normalizedDigits.slice(0, -2);
        const minutesPart: string = normalizedDigits.slice(-2);

        const hours: number = Number(hoursPart);
        const minutes: number = Number(minutesPart);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return null;
        }

        if (minutes >= 60) {
            return null;
        }

        return hours * 60 + minutes;
    }

    function applyDurationFromDates(): void {
        if (
            startDate.trim().length === 0 ||
            startTime.trim().length === 0 ||
            endDate.trim().length === 0 ||
            endTime.trim().length === 0
        ) {
            return;
        }

        const start: Date = combineDateAndTime(startDate, startTime);
        const end: Date = combineDateAndTime(endDate, endTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return;
        }

        if (end.getTime() > start.getTime()) {
            durationMinutes = getDurationMinutes(start, end);

            if (!isEditingDuration) {
                durationInput = formatDurationInputValue(durationMinutes);
            }
        }
    }

    function applyEndFromDuration(): void {
        if (
            startDate.trim().length === 0 ||
            startTime.trim().length === 0 ||
            Number.isNaN(durationMinutes) ||
            durationMinutes <= 0
        ) {
            return;
        }

        const start: Date = combineDateAndTime(startDate, startTime);

        if (Number.isNaN(start.getTime())) {
            return;
        }

        const end: Date = new Date(start);
        end.setMinutes(end.getMinutes() + durationMinutes);

        endDate = formatDateInputValue(end);
        endTime = formatTimeInputValue(end);
    }
    function switchToDurationMode(): void {
        isEditingDuration = false;
        applyDurationFromDates();
        durationInput = formatDurationInputValue(durationMinutes);
        timeMode = "duration";
    }

    function switchToEndMode(): void {
        isEditingDuration = false;
        applyEndFromDuration();
        timeMode = "end";
    }

    function pad(value: number): string {
        return value.toString().padStart(2, "0");
    }

    function roundUpToNearest15Minutes(value: Date): Date {
        const rounded: Date = new Date(value);
        rounded.setSeconds(0, 0);

        const minutes: number = rounded.getMinutes();
        const remainder: number = minutes % 15;

        if (remainder !== 0) {
            rounded.setMinutes(minutes + (15 - remainder));
        }

        return rounded;
    }

    function formatDateInputValue(value: Date): string {
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }

    function formatTimeInputValue(value: Date): string {
        return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    }

    function combineDateAndTime(dateValue: string, timeValue: string): Date {
        const [year, month, day]: number[] = dateValue
            .split("-")
            .map((part: string): number => Number(part));

        const [hours, minutes]: number[] = timeValue
            .split(":")
            .map((part: string): number => Number(part));

        const result: Date = new Date(
            year,
            month - 1,
            day,
            hours,
            minutes,
            0,
            0,
        );

        return result;
    }

    function applyInitialValues(): void {
        if (mode === "update" && initialTask) {
            const start: Date =
                initialTask.start instanceof Date
                    ? initialTask.start
                    : new Date(initialTask.start);

            const end: Date =
                initialTask.end instanceof Date
                    ? initialTask.end
                    : new Date(initialTask.end);

            title = initialTask.title;
            description = initialTask.description ?? "";
            startDate = formatDateInputValue(start);
            startTime = formatTimeInputValue(start);
            endDate = formatDateInputValue(end);
            endTime = formatTimeInputValue(end);
            color = initialTask.color;

            durationMinutes = getDurationMinutes(start, end);
            durationInput = formatDurationInputValue(durationMinutes);
            timeMode = "end";

            return;
        }

        const baseStart: Date =
            mode === "create" && initialStartDate
                ? new Date(initialStartDate)
                : roundUpToNearest15Minutes(new Date());

        const roundedStart: Date = roundUpToNearest15Minutes(baseStart);
        const roundedEnd: Date = new Date(roundedStart);
        roundedEnd.setHours(roundedEnd.getHours() + 1);

        title = "";
        description = "";
        startDate = formatDateInputValue(roundedStart);
        startTime = formatTimeInputValue(roundedStart);
        endDate = formatDateInputValue(roundedEnd);
        endTime = formatTimeInputValue(roundedEnd);
        color = TaskColor.Primary;

        durationMinutes = 60;
        durationInput = formatDurationInputValue(durationMinutes);
        timeMode = "duration";
    }

    function validate(): boolean {
        titleError = "";
        dateError = "";

        if (title.trim().length === 0) {
            titleError = "Title is required.";
        }

        if (
            startDate.trim().length === 0 ||
            startTime.trim().length === 0 ||
            (timeMode === "end" &&
                (endDate.trim().length === 0 || endTime.trim().length === 0))
        ) {
            dateError = "Start and end are required.";
            return titleError.length === 0;
        }

        if (timeMode === "duration") {
            const parsedDuration: number | null =
                parseCommittedDurationInput(durationInput);

            if (parsedDuration === null || parsedDuration <= 0) {
                dateError = "Length must be valid.";
                return titleError.length === 0;
            }

            durationMinutes = parsedDuration;
            durationInput = formatDurationInputValue(parsedDuration);
            applyEndFromDuration();
        }

        const start: Date = combineDateAndTime(startDate, startTime);
        const end: Date = combineDateAndTime(endDate, endTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            dateError = "Start and end must be valid.";
        } else if (end.getTime() <= start.getTime()) {
            dateError = "End must be after start.";
        }

        return titleError.length === 0 && dateError.length === 0;
    }

    async function handleSubmit(): Promise<void> {
        if (!validate()) {
            return;
        }

        const start: Date = combineDateAndTime(startDate, startTime);
        const end: Date = combineDateAndTime(endDate, endTime);

        const draft: CalendarTaskDraft = {
            title: title.trim(),
            description:
                description.trim().length > 0 ? description.trim() : null,
            start,
            end,
            color,
        };

        isSubmitting = true;

        try {
            await onSubmit?.(draft);
        } finally {
            isSubmitting = false;
        }
    }

    function handleBackdropClick(event: MouseEvent): void {
        if (event.target !== event.currentTarget) {
            return;
        }

        onClose?.();
    }

    function handleGlobalKeydown(event: KeyboardEvent): void {
        if (!isOpen) return;

        if (event.key === "Escape") {
            event.preventDefault();
            onClose?.();
        }
    }

    function handleStartDateChange(value: string): void {
        startDate = value;

        if (timeMode === "duration") {
            applyEndFromDuration();
        } else {
            applyDurationFromDates();
        }
    }

    function handleStartTimeChange(value: string): void {
        startTime = value;

        if (timeMode === "duration") {
            applyEndFromDuration();
        } else {
            applyDurationFromDates();
        }
    }

    function handleEndDateChange(value: string): void {
        endDate = value;

        if (timeMode === "end") {
            applyDurationFromDates();
        }
    }

    function handleEndTimeChange(value: string): void {
        endTime = value;

        if (timeMode === "end") {
            applyDurationFromDates();
        }
    }

    async function handleDelete(): Promise<void> {
        if (mode !== "update" || isSubmitting) {
            return;
        }

        isSubmitting = true;

        try {
            await onDelete?.();
        } finally {
            isSubmitting = false;
        }
    }

    $effect(() => {
        window.addEventListener("keydown", handleGlobalKeydown);

        return () => {
            window.removeEventListener("keydown", handleGlobalKeydown);
        };
    });

    let wasOpen: boolean = false;

    $effect((): void => {
        if (isOpen && !wasOpen) {
            applyInitialValues();
            titleError = "";
            dateError = "";
        }

        wasOpen = isOpen;
    });
</script>

{#if isOpen}
    <div
        class="dialog-backdrop"
        role="presentation"
        onclick={handleBackdropClick}
    >
        <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-dialog-title"
        >
            <h2 id="task-dialog-title" class="dialog-title">
                {mode === "create" ? "Create task" : "Update task"}
            </h2>

            <div class="form-grid">
                <label class="field">
                    <span class="field-label">Title</span>
                    <input
                        class="text-input"
                        type="text"
                        bind:value={title}
                        maxlength="200"
                        placeholder="Task title"
                    />
                    {#if titleError}
                        <span class="field-error">{titleError}</span>
                    {/if}
                </label>

                <label class="field">
                    <span class="field-label">Description</span>
                    <textarea
                        class="text-area"
                        bind:value={description}
                        rows="4"
                        placeholder="Description"
                    ></textarea>
                </label>

                <div class="date-time-section">
                    <div class="date-time-row">
                        <label class="field">
                            <span class="field-label">Start date</span>
                            <input
                                class="text-input"
                                type="date"
                                value={startDate}
                                oninput={(event: Event): void => {
                                    const target: HTMLInputElement =
                                        event.currentTarget as HTMLInputElement;
                                    handleStartDateChange(target.value);
                                }}
                            />
                        </label>

                        <label class="field">
                            <span class="field-label">End date</span>
                            <input
                                class="text-input"
                                type="date"
                                value={endDate}
                                oninput={(event: Event): void => {
                                    const target: HTMLInputElement =
                                        event.currentTarget as HTMLInputElement;
                                    handleEndDateChange(target.value);
                                }}
                                disabled={timeMode === "duration"}
                            />
                        </label>
                    </div>

                    <div class="date-time-row">
                        <label class="field">
                            <span class="field-label">Start time</span>
                            <input
                                class="text-input"
                                type="time"
                                step="900"
                                value={startTime}
                                oninput={(event: Event): void => {
                                    const target: HTMLInputElement =
                                        event.currentTarget as HTMLInputElement;
                                    handleStartTimeChange(target.value);
                                }}
                            />
                        </label>

                        <div class="field">
                            <span class="field-label">
                                {timeMode === "duration"
                                    ? "Length"
                                    : "End time"}
                            </span>

                            <div class="time-mode-input">
                                <button
                                    type="button"
                                    class="mode-toggle-button"
                                    onclick={() => {
                                        if (timeMode === "duration") {
                                            switchToEndMode();
                                        } else {
                                            switchToDurationMode();
                                        }
                                    }}
                                    aria-label={timeMode === "duration"
                                        ? "Switch to end time"
                                        : "Switch to duration"}
                                    title={timeMode === "duration"
                                        ? "Switch to end time"
                                        : "Switch to duration"}
                                >
                                    ⟳
                                </button>

                                {#if timeMode === "duration"}
                                    <input
                                        class="text-input"
                                        type="text"
                                        value={durationInput}
                                        onfocus={handleDurationFocus}
                                        oninput={(event: Event): void => {
                                            const target: HTMLInputElement =
                                                event.currentTarget as HTMLInputElement;
                                            handleDurationChange(target.value);
                                        }}
                                        onblur={handleDurationBlur}
                                        placeholder="1:00"
                                        aria-label="Length in hours and minutes"
                                    />
                                {:else}
                                    <input
                                        class="text-input"
                                        type="time"
                                        step="900"
                                        value={endTime}
                                        oninput={(event: Event): void => {
                                            const target: HTMLInputElement =
                                                event.currentTarget as HTMLInputElement;
                                            handleEndTimeChange(target.value);
                                        }}
                                    />
                                {/if}
                            </div>
                        </div>
                    </div>

                    {#if dateError}
                        <span class="field-error">{dateError}</span>
                    {/if}
                </div>

                <div class="field">
                    <span class="field-label">Color</span>

                    <div
                        class="color-picker"
                        role="radiogroup"
                        aria-label="Task color"
                    >
                        {#each availableColors as taskColor (taskColor)}
                            <button
                                type="button"
                                class={`color-button task-color-${taskColor} ${color === taskColor ? "is-selected" : ""}`}
                                aria-pressed={color === taskColor}
                                onclick={() => {
                                    color = taskColor;
                                }}
                                aria-label="color nr: {taskColor}"
                            >
                                <span class="color-dot"></span>
                            </button>
                        {/each}
                    </div>
                </div>
            </div>

            <div class="dialog-actions">
                {#if mode === "update"}
                    <button
                        type="button"
                        class="delete-icon-button"
                        onclick={() => void handleDelete()}
                        disabled={isSubmitting}
                        aria-label="Delete task"
                        title="Delete task"
                    >
                        <span
                            class="icon-image delete-icon"
                            style={`--icon-url: url("${trash_icon}")`}
                            aria-hidden="true"
                        ></span>
                    </button>
                {/if}

                <button
                    type="button"
                    class="submit-button"
                    onclick={() => void handleSubmit()}
                    disabled={isSubmitting}
                >
                    {#if isSubmitting}
                        Saving...
                    {:else}
                        {mode === "create" ? "Create" : "Update"}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .dialog {
        width: min(100%, 34rem);
        max-width: 100%;
        max-height: min(75vh, 48rem);
        overflow: auto;
        border: 1px solid var(--color-border);
        border-radius: 1rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft-hover);
        padding: 1rem;
        box-sizing: border-box;
    }

    .dialog-title {
        margin: 0 0 1rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-title);
    }

    .form-grid {
        display: grid;
        gap: 0.9rem;
    }

    .field {
        display: grid;
        gap: 0.35rem;
        min-width: 0;
    }

    .field-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--color-text-muted);
    }

    .text-input,
    .text-area {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        background: var(--color-surface);
        color: var(--color-text);
        padding: 0.7rem 0.85rem;
        font: inherit;
    }

    .text-area {
        resize: vertical;
        min-height: 6rem;
    }

    .date-time-section {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
    }

    .date-time-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        min-width: 0;
    }

    .time-mode-input {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.5rem;
        align-items: center;
        min-width: 0;
    }

    .mode-toggle-button {
        width: 2.75rem;
        height: 2.75rem;
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
        flex: 0 0 auto;
    }

    .mode-toggle-button:hover {
        border-color: var(--color-accent);
    }

    .color-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
    }

    .color-button {
        width: 2.4rem;
        height: 2.4rem;
        padding: 0;
        border: 2px solid transparent;
        border-radius: 999px;
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex: 0 0 auto;
    }

    .color-button.is-selected {
        border-color: var(--color-title);
    }

    .color-dot {
        width: 1.65rem;
        height: 1.65rem;
        border-radius: 999px;
        display: inline-block;
        background: var(--task-accent);
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.35);
    }

    .task-color-1 {
        --task-accent: var(--color-task-primary);
    }

    .task-color-2 {
        --task-accent: var(--color-task-red);
    }

    .task-color-3 {
        --task-accent: var(--color-task-rose);
    }

    .task-color-4 {
        --task-accent: var(--color-task-blue);
    }

    .task-color-5 {
        --task-accent: var(--color-task-blue-light);
    }

    .task-color-6 {
        --task-accent: var(--color-task-green);
    }

    .task-color-7 {
        --task-accent: var(--color-task-green-light);
    }

    .task-color-8 {
        --task-accent: var(--color-task-yellow);
    }

    .task-color-9 {
        --task-accent: var(--color-task-orange);
    }

    .task-color-10 {
        --task-accent: var(--color-task-purple);
    }

    .task-color-11 {
        --task-accent: var(--color-task-lavender);
    }

    .task-color-12 {
        --task-accent: var(--color-task-gray);
    }

    .task-color-13 {
        --task-accent: var(--color-task-brown);
    }

    .field-error {
        font-size: 0.78rem;
        color: var(--color-danger, #c62828);
    }

    .submit-button {
        border: 0;
        border-radius: 0.75rem;
        padding: 0.7rem 1rem;
        font: inherit;
        font-weight: 700;
        background: var(--color-accent);
        color: white;
        cursor: pointer;
    }

    .submit-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    .dialog-actions {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.75rem;
    }

    .delete-icon-button {
        width: 2.75rem;
        height: 2.75rem;
        border: 1px solid var(--color-warning-border);
        border-radius: 0.75rem;
        background: transparent;
        color: var(--color-warning);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .delete-icon {
        width: 21px;
        height: 21px;
        background-color: currentColor;
        pointer-events: none;
    }

    .delete-icon-button:hover {
        background: var(--color-warning-bg);
        border-color: var(--color-warning-hover);
        color: var(--color-warning-hover);
    }

    .delete-icon-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }
</style>
