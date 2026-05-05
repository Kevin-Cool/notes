<script lang="ts">
    import { getSavedTheme, saveTheme } from "$lib/services/settings-service";

    type ThemeName = "pink" | "yellow" | "berry" | "cloud" | "rose-dark";
    type ThemeMode = "light" | "dark";

    type ThemeOption = {
        name: ThemeName;
        label: string;
        description: string;
        mode: ThemeMode;
        swatch: string;
        swatchText: string;
    };

    const themes: ThemeOption[] = [
        {
            name: "pink",
            label: "Strawberry Milk",
            description: "Soft pink and cozy.",
            mode: "light",
            swatch: "#fff5f7",
            swatchText: "#9d526c",
        },
        {
            name: "yellow",
            label: "Honey Scoop",
            description: "Warm vanilla yellow.",
            mode: "light",
            swatch: "#fff7dc",
            swatchText: "#a68445",
        },
        {
            name: "berry",
            label: "Berry Sorbet",
            description: "Rose-red berry tones.",
            mode: "light",
            swatch: "#f9e6ee",
            swatchText: "#a7375f",
        },
        {
            name: "cloud",
            label: "Cloudberry Float",
            description: "Blue with lavender tones.",
            mode: "light",
            swatch: "#d8e9ff",
            swatchText: "#6f70b8",
        },
        {
            name: "rose-dark",
            label: "Black Cherry",
            description: "Dark red and rose.",
            mode: "dark",
            swatch: "#2a1018",
            swatchText: "#ff9db6",
        },
    ];

    let selectedTheme: ThemeName = $state("pink");

    const lightThemes: ThemeOption[] = themes.filter(
        (theme: ThemeOption): boolean => theme.mode === "light",
    );
    const darkThemes: ThemeOption[] = themes.filter(
        (theme: ThemeOption): boolean => theme.mode === "dark",
    );

    function isThemeName(value: string | undefined): value is ThemeName {
        return (
            value === "pink" ||
            value === "yellow" ||
            value === "berry" ||
            value === "cloud" ||
            value === "rose-dark"
        );
    }

    async function applyTheme(theme: ThemeName): Promise<void> {
        selectedTheme = theme;
        document.documentElement.dataset.theme = theme;

        await saveTheme(theme);
    }

    function getSelectedThemeLabel(themeName: ThemeName): string {
        const theme: ThemeOption | undefined = themes.find(
            (themeOption: ThemeOption): boolean =>
                themeOption.name === themeName,
        );
        return theme?.label ?? themeName;
    }

    async function loadSavedTheme(): Promise<void> {
        const savedTheme: ThemeName | null = await getSavedTheme();

        if (savedTheme !== null) {
            selectedTheme = savedTheme;
            document.documentElement.dataset.theme = savedTheme;
            return;
        }

        const currentTheme: string | undefined =
            document.documentElement.dataset.theme;

        if (isThemeName(currentTheme)) {
            selectedTheme = currentTheme;
        }
    }
    $effect((): void => {
        void loadSavedTheme();
    });
    
    $effect((): void => {
        const currentTheme: string | undefined =
            document.documentElement.dataset.theme;

        if (isThemeName(currentTheme)) {
            selectedTheme = currentTheme;
        }
    });
</script>

<div class="settings-card theme-card">
    <div class="settings-card-header">
        <h2>Theme</h2>
        <p>Choose the current app theme.</p>
    </div>

    <div class="theme-content">
        <div class="settings-card-info">
            <strong
                >Current theme: {getSelectedThemeLabel(selectedTheme)}</strong
            >
            <span>This only changes the theme for the current session.</span>
        </div>

        <div class="theme-groups">
            <section class="theme-group" aria-labelledby="light-themes-heading">
                <h3 id="light-themes-heading">Light themes</h3>

                <div class="theme-options">
                    {#each lightThemes as theme}
                        <button
                            type="button"
                            class:active-theme={selectedTheme === theme.name}
                            style:background={theme.swatch}
                            style:border-color={theme.swatchText}
                            style:color={theme.swatchText}
                            onclick={() => applyTheme(theme.name)}
                            aria-pressed={selectedTheme === theme.name}
                        >
                            <span>{theme.label}</span>
                            <small>{theme.description}</small>
                        </button>
                    {/each}
                </div>
            </section>

            <section class="theme-group" aria-labelledby="dark-themes-heading">
                <h3 id="dark-themes-heading">Dark themes</h3>

                <div class="theme-options">
                    {#each darkThemes as theme}
                        <button
                            type="button"
                            class:active-theme={selectedTheme === theme.name}
                            style:background={theme.swatch}
                            style:border-color={theme.swatchText}
                            style:color={theme.swatchText}
                            onclick={() => applyTheme(theme.name)}
                            aria-pressed={selectedTheme === theme.name}
                        >
                            <span>{theme.label}</span>
                            <small>{theme.description}</small>
                        </button>
                    {/each}
                </div>
            </section>
        </div>
    </div>
</div>

<style>
    .theme-content {
        padding: 1rem 1.1rem;
        display: grid;
        gap: 1rem;
    }

    .settings-card-info {
        display: grid;
        gap: 0.25rem;
    }

    .settings-card-info strong {
        color: var(--color-title);
    }

    .settings-card-info span {
        color: var(--color-text-muted);
        font-size: 0.9rem;
    }

    .theme-groups {
        display: grid;
        gap: 1rem;
    }

    .theme-group {
        display: grid;
        gap: 0.5rem;
    }

    .theme-group h3 {
        margin: 0;
        color: var(--color-heading);
        font-size: 0.9rem;
    }

    .theme-options {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.6rem;
    }

    .theme-options button {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-button);
        cursor: pointer;
        padding: 0.7rem 0.8rem;
        font-family: inherit;
        font-weight: 800;
        text-align: left;
        box-shadow: var(--shadow-soft);
        transition:
            transform 140ms ease,
            box-shadow 140ms ease,
            filter 140ms ease;
    }

    .theme-options button span,
    .theme-options button small {
        display: block;
    }

    .theme-options button small {
        margin-top: 0.2rem;
        font-size: 0.75rem;
        font-weight: 700;
        opacity: 0.75;
    }

    .theme-options button:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-soft-hover);
        filter: saturate(1.05);
    }

    .theme-options button.active-theme {
        outline: 3px solid var(--color-accent);
        outline-offset: 2px;
        box-shadow: var(--shadow-float);
    }

    @media (max-width: 42rem) {
        .theme-options {
            grid-template-columns: 1fr;
        }
    }
</style>
