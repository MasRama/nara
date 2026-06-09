<script lang="ts">
	import * as zagSwitch from "@zag-js/switch";
	import { useMachine, normalizeProps } from "@zag-js/svelte";
	import { cn } from "$lib/utils.js";

	let {
		class: className,
		checked = $bindable(false),
		disabled = false,
		onCheckedChange,
		...restProps
	}: {
		class?: string;
		checked?: boolean;
		disabled?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		[key: string]: any;
	} = $props();

	const service = useMachine(zagSwitch.machine, {
		id: crypto.randomUUID(),
		get checked() { return checked; },
		get disabled() { return disabled; },
		onCheckedChange(details) {
			checked = details.checked;
			onCheckedChange?.(details.checked);
		},
	});

	const api = $derived(zagSwitch.connect(service, normalizeProps));
</script>

<label
	{...api.getRootProps()}
	data-slot="switch"
	data-state={api.checked ? "checked" : "unchecked"}
	class={cn(
		"data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{...restProps}
>
	<span {...api.getThumbProps()}
		data-slot="switch-thumb"
		data-state={api.checked ? "checked" : "unchecked"}
		class={cn(
			"bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:translate-x-[calc(-100%)]"
		)}
	></span>
	<input {...api.getHiddenInputProps()} />
</label>
