<script lang="ts">
    import { onMount, tick } from "svelte";

    import TodoContextMenu from "$lib/components/dayplanner/TodoContextMenu.svelte";

    import {
        createDayplannerTodo,
        deleteDayplannerTodo,
        getAllDayplannerTodos,
        upsertDayplannerTodo,
    } from "$lib/services/dayplanner-todo-service";

    import type { DayplannerTodo } from "$lib/types/dayplanner/dayplanner-todo";
    import type { TodoContextMenuState } from "$lib/types/dayplanner/todo-context-menu";
    import { TodoColor } from "$lib/types/dayplanner/todo-color";

    let todos: DayplannerTodo[] = $state([]);
    let contextMenu: TodoContextMenuState | null = $state(null);

    let editingTodoId: string | null = $state(null);
    let editingTitle: string = $state("");
    let inputElement: HTMLInputElement | null = $state(null);

    onMount((): void => {
        void loadTodos();
    });

    async function loadTodos(): Promise<void> {
        todos = await getAllDayplannerTodos();
    }

    async function focusInputAfterRender(): Promise<void> {
        await tick();

        inputElement?.focus();
        inputElement?.select();
    }

    function closeContextMenu(): void {
        contextMenu = null;
    }

    function handleEmptyContextMenu(event: MouseEvent): void {
        event.preventDefault();

        contextMenu = {
            mode: "empty",
            x: event.clientX,
            y: event.clientY,
        };
    }

    function handleTodoContextMenu(
        event: MouseEvent,
        todo: DayplannerTodo,
    ): void {
        event.preventDefault();
        event.stopPropagation();

        contextMenu = {
            mode: "todo",
            x: event.clientX,
            y: event.clientY,
            todo,
        };
    }

    async function handleDeleteTodo(todo: DayplannerTodo): Promise<void> {
        await deleteDayplannerTodo(todo.id);

        todos = todos.filter(
            (currentTodo: DayplannerTodo): boolean =>
                currentTodo.id !== todo.id,
        );

        closeContextMenu();

        if (editingTodoId === todo.id) {
            cancelEditingTodo();
        }
    }
    async function handleCreateTodo(): Promise<void> {
        const createdTodo: DayplannerTodo = await createDayplannerTodo({
            title: "",
            color: TodoColor.Primary,
            completed: false,
            completionDate: null,
        });

        todos = [...todos, createdTodo];
        closeContextMenu();

        editingTodoId = createdTodo.id;
        editingTitle = "";
        await focusInputAfterRender();
    }

    async function handleToggleTodo(todo: DayplannerTodo): Promise<void> {
        const nextCompleted: boolean = !todo.completed;

        const updatedTodo: DayplannerTodo = await upsertDayplannerTodo({
            ...todo,
            completed: nextCompleted,
            completionDate: nextCompleted ? new Date().toISOString() : null,
        });

        replaceTodo(updatedTodo);
    }

    async function handleChangeTodoColor(
        todo: DayplannerTodo,
        color: TodoColor,
    ): Promise<void> {
        const updatedTodo: DayplannerTodo = await upsertDayplannerTodo({
            ...todo,
            color,
        });

        replaceTodo(updatedTodo);
        closeContextMenu();
    }

    function handleEditTodo(todo: DayplannerTodo): void {
        editingTodoId = todo.id;
        editingTitle = todo.title ?? "";
        closeContextMenu();

        void focusInputAfterRender();
    }

    async function saveEditingTodo(): Promise<void> {
        if (editingTodoId === null) {
            return;
        }

        const todo: DayplannerTodo | undefined = todos.find(
            (currentTodo: DayplannerTodo): boolean =>
                currentTodo.id === editingTodoId,
        );

        if (!todo) {
            cancelEditingTodo();
            return;
        }

        const normalizedTitle: string = editingTitle.trim();

        const updatedTodo: DayplannerTodo = await upsertDayplannerTodo({
            ...todo,
            title: normalizedTitle,
        });

        replaceTodo(updatedTodo);
        cancelEditingTodo();
    }

    function cancelEditingTodo(): void {
        editingTodoId = null;
        editingTitle = "";
    }

    function handleEditingKeydown(event: KeyboardEvent): void {
        if (event.key === "Enter") {
            event.preventDefault();
            void saveEditingTodo();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            cancelEditingTodo();
        }
    }

    function replaceTodo(updatedTodo: DayplannerTodo): void {
        todos = todos.map(
            (todo: DayplannerTodo): DayplannerTodo =>
                todo.id === updatedTodo.id ? updatedTodo : todo,
        );
    }
</script>

<section class="dayplanner-list-card" aria-labelledby="todos-heading" oncontextmenu={handleEmptyContextMenu} >
    <header class="list-header">
        <h2>Todos</h2>
    </header>

    <div class="list-content">
        {#each todos as todo (todo.id)}
            <div
                role="listitem"
                class={`todo-row todo-color-${todo.color}`}
                class:is-completed={todo.completed}
                oncontextmenu={(event: MouseEvent): void =>
                    handleTodoContextMenu(event, todo)}
            >
                <div class="todo-accent"></div>

                {#if editingTodoId === todo.id}
                    <input
                        bind:this={inputElement}
                        bind:value={editingTitle}
                        class="todo-title-input"
                        maxlength="1024"
                        aria-label="Todo title"
                        onkeydown={handleEditingKeydown}
                        onblur={() => {
                            void saveEditingTodo();
                        }}
                    />
                {:else}
                    <div class="todo-title">
                        {todo.title || "Untitled todo"}
                    </div>
                {/if}

                <button
                    type="button"
                    class="check-button"
                    class:is-checked={todo.completed}
                    aria-label={todo.completed
                        ? "Mark todo as incomplete"
                        : "Mark todo as complete"}
                    onclick={() => {
                        void handleToggleTodo(todo);
                    }}
                >
                    ✓
                </button>
            </div>
        {/each}

        {#if todos.length === 0}
            <div class="empty-todos">Right-click to create a todo.</div>
        {/if}
    </div>
</section>

<TodoContextMenu
    menu={contextMenu}
    onClose={closeContextMenu}
    onCreate={() => {
        void handleCreateTodo();
    }}
    onEdit={handleEditTodo}
    onDelete={(todo: DayplannerTodo): void => {
        void handleDeleteTodo(todo);
    }}
    onChangeColor={(todo: DayplannerTodo, color: TodoColor): void => {
        void handleChangeTodoColor(todo, color);
    }}
/>

<style>
    .dayplanner-list-card {
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: var(--color-surface);
    }

    .list-header {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface-strong);
        text-align: center;
    }

    .list-header h2 {
        margin: 0;
        color: var(--color-title);
        font-size: 1.1rem;
    }

    .list-content {
        min-height: 0;
        overflow-y: auto;
        padding: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    .todo-row {
        --todo-bg: var(--color-todo-primary-bg);
        --todo-border: var(--color-todo-primary-border);
        --todo-text: var(--color-todo-primary-text);
        --todo-accent: var(--color-task-primary);

        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.7rem;
        padding: 0.65rem 0.7rem;
        border: 1px solid var(--todo-border);
        border-radius: 0.85rem;
        background: var(--todo-bg);
    }

    .todo-row.is-completed {
        --todo-accent: var(
            --color-dayplanner-completed,
            var(--color-task-green)
        );

        --todo-bg: color-mix(
            in srgb,
            var(--todo-accent) 10%,
            var(--color-surface) 90%
        );

        --todo-border: color-mix(
            in srgb,
            var(--todo-accent) 30%,
            var(--color-border) 70%
        );

        --todo-text: var(--color-text-muted);

        opacity: 0.9;
    }

    .todo-accent {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: var(--todo-accent);
    }

    .todo-title {
        min-width: 0;
        color: var(--todo-text);
        font-size: 0.9rem;
        font-weight: 650;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .todo-title-input {
        min-width: 0;
        width: 90%;
        border: 1px solid
            color-mix(in srgb, var(--todo-accent) 35%, var(--color-border) 65%);
        border-radius: 0.55rem;
        background: var(--color-surface);
        color: var(--color-title);
        padding: 0.35rem 0.45rem;
        font-size: 0.9rem;
        font-weight: 650;
        outline: none;
        box-sizing: border-box;
        justify-self: start;
    }

    .todo-title-input:focus {
        border-color: var(--todo-accent);
        box-shadow: 0 0 0 2px
            color-mix(in srgb, var(--todo-accent) 20%, transparent 80%);
    }

    .is-completed .todo-title {
        color: var(--color-text-muted);
    }

    .check-button {
        width: 1.65rem;
        height: 1.65rem;
        border: 1px solid
            color-mix(in srgb, var(--todo-accent) 45%, var(--color-border) 55%);
        border-radius: 999px;
        background: var(--color-surface);
        color: transparent;
        cursor: pointer;
        font-weight: 800;
    }

    .check-button.is-checked {
        background: var(--todo-accent);
        color: var(--color-surface);
    }

    .empty-todos {
        min-height: 8rem;
        display: grid;
        place-items: center;
        color: var(--color-text-muted);
        font-size: 0.9rem;
        text-align: center;
    }

    .todo-color-1 {
        --todo-bg: var(--color-todo-primary-bg);
        --todo-border: var(--color-todo-primary-border);
        --todo-text: var(--color-todo-primary-text);
        --todo-accent: var(--color-task-primary);
    }

    .todo-color-2 {
        --todo-bg: var(--color-todo-red-bg);
        --todo-border: var(--color-todo-red-border);
        --todo-text: var(--color-todo-red-text);
        --todo-accent: var(--color-warning);
    }

    .todo-color-3 {
        --todo-bg: var(--color-todo-blue-bg);
        --todo-border: var(--color-todo-blue-border);
        --todo-text: var(--color-todo-blue-text);
        --todo-accent: var(--color-task-blue);
    }
</style>
