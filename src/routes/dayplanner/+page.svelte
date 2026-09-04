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
                <h2 class="dayplanner-card-title">My Day</h2>
            </div>

            <DayPlannerDayView />
        </section>

        <aside class="dayplanner-side">
            <div class="dayplanner-side-card">
                <DayPlannerTodos />
            </div>

            <div class="dayplanner-side-card">
                <DayPlannerDailies />
            </div>
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

    .dayplanner-card-title{
        user-select: none;
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

    .dayplanner-side-card {
        min-height: 0;
        overflow: hidden;
        border: 1px solid var(--color-border);
        border-radius: 1.1rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft);
    }

    /* Mobile portrait */
    @media (max-width: 48rem) and (orientation: portrait) {
        .dayplanner-main {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto auto;
            overflow-x: hidden;
            overflow-y: auto;
        }

        .dayplanner-day-card {
            min-height: 65dvh;
        }

        .dayplanner-side {
            grid-template-rows: auto auto;
            overflow: visible;
        }

        .dayplanner-side-card {
            min-height: 15rem;
        }
    }

    /* Mobile landscape */
    @media (max-height: 48rem) and (orientation: landscape) {
        .dayplanner-main {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            grid-template-rows: minmax(0, 1fr);
            overflow: hidden;
        }

        .dayplanner-day-card {
            min-height: 0;
            height: 100%;
        }

        .dayplanner-side {
            grid-template-rows: minmax(15rem, 1fr) minmax(15rem, 1fr);
            overflow-y: auto;
        }

        .dayplanner-side > :global(*) {
            min-height: 15rem;
        }
    }
</style>
