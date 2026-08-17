<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = Omit<HTMLInputAttributes, "type"> & {
		type?: InputType;
		label: string;
		ref?: HTMLInputElement | null;
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		label,
		class: className,
		"data-slot": dataSlot = "floating-input",
		...restProps
	}: Props = $props();
</script>

<div class="relative">
	<input
		bind:this={ref}
		data-slot={dataSlot}
		type={type}
		bind:value
		placeholder=" "
		class={cn(
			"border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground font-body flex h-11 w-full min-w-0 rounded-xl border px-3 text-sm transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
			"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
			"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
			"peer",
			className
		)}
		{...restProps}
	/>
	<label
		class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-200 ease-out
			peer-focus:-top-px peer-focus:-translate-y-1/2 peer-focus:px-1 peer-focus:bg-card peer-focus:text-[11px] peer-focus:font-heading peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-primary peer-focus:rounded
			peer-[:not(:placeholder-shown)]:-top-px peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:px-1 peer-[:not(:placeholder-shown)]:bg-card peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-heading peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-widest peer-[:not(:placeholder-shown)]:text-muted-foreground peer-[:not(:placeholder-shown)]:rounded"
	>
		{label}
	</label>
</div>
