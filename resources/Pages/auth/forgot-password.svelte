<script lang="ts">
    import { inertia } from "@inertiajs/svelte";
    import NaraIcon from "../../Components/NaraIcon.svelte";
    import DarkModeToggle from "../../Components/DarkModeToggle.svelte";
    import axios from "axios";
    import { api } from "$lib/api";
    import { Toast } from "$lib/toast";
    import Button from '../../Components/Button.svelte';
    import Input from '../../Components/Input.svelte';
    import Label from '../../Components/Label.svelte';

    interface ForgotPasswordForm {
        email: string;
        phone: string;
    }

    let form: ForgotPasswordForm = {
        email: "",
        phone: "",
    };

    let success: boolean = $state(false);
    let { error }: { error?: string } = $props();

    $effect(() => {
        if (error) Toast(error, 'error');
    });

    async function submitForm(): Promise<void> {
        const result = await api(() => axios.post("/forgot-password", form));
        
        if (result.success) {
            success = true;
            form.email = "";
            form.phone = "";
        }
    }
</script>

<section class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
    <!-- Header with dark mode toggle -->
    <header class="fixed inset-x-0 top-0 z-40 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <div class="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
            <a href="/" use:inertia class="flex items-center gap-2">
                <img src="/public/nara.png" alt="Nara logo" class="h-7 w-7 rounded-lg object-cover" />
                <div class="flex flex-col leading-tight">
                    <span class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Nara</span>
                    <span class="text-[10px] uppercase tracking-[0.22em] text-slate-500">TypeScript starter kit</span>
                </div>
            </a>
            <div class="flex items-center gap-3">
                <DarkModeToggle />
            </div>
        </div>
    </header>

    <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto min-h-screen lg:py-0">
        <div class="flex items-center mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            <NaraIcon />
        </div>
        
        <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 class="text-xl font-semibold tracking-tight mb-6">Reset Password</h2>
            {#if success}
                <div role="alert" class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50">
                    Link reset password telah dikirim ke email atau nomor telepon Anda.
                </div>
            {/if}

            <form class="space-y-4 md:space-y-6" onsubmit={(e) => { e.preventDefault(); submitForm(); }}>
                <div class="space-y-2">
                    <Label for="email">Email atau Nomor Telepon</Label>
                    <Input
                        bind:value={form.email}
                        type="text"
                        name="email"
                        id="email"
                        placeholder="email@example.com atau 08xxxxxxxxxx"
                        required
                    />
                </div>

                <Button type="submit" class="w-full">
                    Kirim Link Reset Password
                </Button>

                <p class="text-sm font-light text-slate-500 dark:text-slate-400">
                    Ingat password Anda? <a href="/login" use:inertia class="font-medium text-primary-600 dark:text-primary-400 hover:underline">Login disini</a>
                </p>
            </form>
        </div>
    </div>
</section>
