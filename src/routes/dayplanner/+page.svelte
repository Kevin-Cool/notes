<script lang="ts">
    import DayPlannerTasks from "$lib/components/dayplanner/DayPlannerTasks.svelte";
    import DayPlannerDayView from "$lib/components/dayplanner/DayPlannerDayView.svelte";
    import DayPlannerTodos from "$lib/components/dayplanner/DayPlannerTodos.svelte";
    import DayPlannerDailies from "$lib/components/dayplanner/DayPlannerDailies.svelte";

</script>

<div class="dayplanner-page">
    <DayPlannerTasks />

    <main class="dayplanner-main">
        <section class="dayplanner-card dayplanner-day-card">
            <div class="dayplanner-card-header">
                <h2>My Day</h2>
            </div>

            <DayPlannerDayView />
        </section>

        <aside class="dayplanner-side">
            <DayPlannerTodos />

            <DayPlannerDailies />
        </aside>
    </main>
</div>

<style>
    :global(html),
    :global(body) {
        height: 100%;
        overflow: hidden;
    }

    :global(body > div) {
        height: 100%;
        min-height: 0;
    }

    .dayplanner-page {
        box-sizing: border-box;
        height: 100%;
        min-height: 0;
        overflow: hidden;

        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 0.9rem;

        padding: 1rem;
        background: linear-gradient(
            180deg,
            var(--color-bg-top),
            var(--color-bg-mid),
            var(--color-bg-bottom)
        );
    }

    .dayplanner-main {
        min-height: 0;
        overflow: hidden;

        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem);
        gap: 0.9rem;
    }

    .dayplanner-card {
        min-height: 0;
        overflow: hidden;

        border: 1px solid var(--color-border);
        border-radius: 1.1rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft);
    }

    .dayplanner-day-card {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
    }

    .dayplanner-card-header {
        min-height: 0;
        padding: 1rem 1.1rem 0.65rem;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface-strong);
    }

    .dayplanner-card-header h2 {
        margin: 0;
        color: var(--color-title);
        font-size: 1.2rem;
    }

    .dayplanner-side {
        min-height: 0;
        overflow: hidden;

        display: grid;
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
        gap: 0.9rem;
    }

    .dayplanner-side > :global(*) {
        min-height: 0;
        overflow: hidden;

        border: 1px solid var(--color-border);
        border-radius: 1.1rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft);
    }
</style>