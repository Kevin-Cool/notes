<script lang="ts">
	import { page } from "$app/state";

	const status: number = page.status;
	const error: App.Error | null = page.error;
</script>

<h1>
	{status === 404 ? "Page not found" : "Something went wrong"}
</h1>

<p>
	{status === 404
		? "This page does not exist."
		: error?.message}
</p>

<a href="/notes">Go home</a>