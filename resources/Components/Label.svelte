<script lang="ts">
	import type { HTMLLabelAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	let {
		class: className,
		...restProps
	}: HTMLLabelAttributes = $props();
</script>

<label
	data-slot="label"
	class={cn(
		"flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
		className
	)}
	{...restProps}
></label>
