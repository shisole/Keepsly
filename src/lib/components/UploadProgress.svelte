<script lang="ts">
	let {
		current,
		total,
		status
	}: { current: number; total: number; status: string } = $props();

	let percentage = $derived(total > 0 ? Math.round((current / total) * 100) : 0);
</script>

{#if total > 0}
	<div class="space-y-2">
		<div class="flex justify-between text-sm">
			<span class="text-gray-600">{status}</span>
			<span class="font-medium text-gray-900">{current}/{total}</span>
		</div>
		<div class="h-2 overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full rounded-full bg-primary transition-all duration-300"
				style="width: {percentage}%"
			></div>
		</div>
	</div>
{/if}
