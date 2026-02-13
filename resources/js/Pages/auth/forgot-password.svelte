<script lang="ts">
    import { inertia, router } from "@inertiajs/svelte";
    import NaraIcon from "../../Components/NaraIcon.svelte";
    import DarkModeToggle from "../../Components/DarkModeToggle.svelte";
    import axios from "axios";
    import { api, Toast } from "../../Components/helper";

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

<section class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
    <!-- Header with dark mode toggle -->
    <header class="fixed inset-x-0 top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div class="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
            <a href="/" use:inertia class="flex items-center gap-2">
                <img src="/public/nara.png" alt="Nara logo" class="h-7 w-7 rounded-lg object-cover" />
                <div class="flex flex-col leading-tight">
                    <span class="text-sm font-semibold tracking-tight text-slate-50">Nara</span>
                    <span class="text-[10px] uppercase tracking-[0.22em] text-slate-500">TypeScript framework</span>
                </div>
            </a>
            <div class="flex items-center gap-3">
                <DarkModeToggle />
            </div>
        </div>
    </header>

    <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto min-h-screen lg:py-0">
        <div class="flex items-center mb-6 text-2xl font-semibold text-slate-50">
            <NaraIcon></NaraIcon>
        </div>
        <div class="w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.8)] md:mt-0 sm:max-w-md xl:p-0">
            <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
                <h1 class="text-xl font-bold leading-tight tracking-tight text-slate-50 md:text-2xl">
                    Reset Password
                </h1>

                {#if success}
                    <div class="p-4 mb-4 text-sm text-green-400 rounded-lg bg-green-900/50" role="alert">
                        Link reset password telah dikirim ke email atau nomor telepon Anda.
                    </div>
                {/if}

                <form
                    class="space-y-4 md:space-y-6"
                    onsubmit={(e) => { e.preventDefault(); submitForm(); }}
                >
                    <div>
                        <label for="email" class="block mb-2 text-sm font-medium text-slate-200">Email atau Nomor Telepon</label>
                        <input
                            bind:value={form.email}
                            type="text"
                            name="email"
                            id="email"
                            class="bg-slate-900/70 border border-slate-700 text-slate-50 sm:text-sm rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 focus:outline-none block w-full py-2.5 px-3 placeholder-slate-500"
                            placeholder="email@example.com atau 08xxxxxxxxxx"
                            required
                        />
                    </div>

                    <button type="submit" class="w-full text-sm font-medium rounded-full px-5 py-2.5 text-slate-950 bg-primary-400 hover:bg-primary-300 focus:ring-4 focus:outline-none focus:ring-primary-300">
                        Kirim Link Reset Password
                    </button>

                    <p class="text-sm font-light text-slate-400">
                        Ingat password Anda? <a href="/login" use:inertia class="font-medium text-primary-400 hover:underline">Login disini</a>
                    </p>
                </form>
            </div>
        </div>
    </div>
</section>
