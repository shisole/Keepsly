<script lang="ts">
	import '../app.css';
	import { navigating } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { PUBLIC_GA_ID } from '$env/static/public';

	let { children } = $props();

	$effect(() => {
		if (!PUBLIC_GA_ID) return;

		// Initialize dataLayer and gtag function
		window.dataLayer = window.dataLayer || [];
		window.gtag = function (...args: unknown[]) {
			window.dataLayer.push(args);
		};
		window.gtag('js', new Date());
		window.gtag('config', PUBLIC_GA_ID);

		// Load gtag.js script
		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${PUBLIC_GA_ID}`;
		document.head.appendChild(script);
	});

	afterNavigate(() => {
		if (!PUBLIC_GA_ID || !window.gtag) return;
		window.gtag('event', 'page_view', {
			page_location: window.location.href,
			page_path: window.location.pathname
		});
	});
</script>

{#if $navigating}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm">
		<div class="flex flex-col items-center gap-3">
			<svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
			</svg>
			<p class="text-sm font-medium text-gray-400">Loading...</p>
		</div>
	</div>
{/if}

<div class="min-h-screen bg-gray-50">
	{@render children()}
</div>
