<script>
  import axios from "axios";
  import Header from "../Components/Header.svelte";
  import { Toast } from "../Components/helper";
  export let user;

  let current_password;
  let new_password;
  let confirm_password;
  let isLoading = false;
  let avatarFile;
  let previewUrl = user.avatar || null;
 

 

  function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      isLoading = true;
      axios
        .post("/assets/avatar", formData)
        .then((response) => {
          setTimeout(() => {
            isLoading = false;
            previewUrl = response.data + "?v=" + Date.now();
          }, 500);
          user.avatar = response.data + "?v=" + Date.now();
        })
        .catch((error) => {
          isLoading = false;
        });
    }
  }
 
  async function changeProfile() {
    isLoading = true;
    try {
      const response = await axios.post("/change-profile", user);
      Toast("Profile updated", "success");
    } catch (error) {
      if (error.response.data.code == "SQLITE_CONSTRAINT_UNIQUE") {
        Toast("username atau email sudah digunakan", "error");
      } else {
        Toast(error.response.data.code, "error");
      }
    }
    isLoading = false;
  }

  async function changePassword() {
    if (new_password != confirm_password) {
      Toast("Password not match", "error");
      return;
    }

    if (!current_password || !new_password || !confirm_password) {
      Toast("Please fill all fields", "error");
      return;
    }

    isLoading = true;
    try {
      const response = await axios.post("/change-password", {
        current_password,
        new_password,
        confirm_password,
      });
      Toast(response.data.message);
      current_password = "";
      new_password = "";
      confirm_password = "";
    } catch (error) {
      Toast(error.response.data.message, "error");
    }
    isLoading = false;
  }
</script>

<Header group="profile" />

<section class="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 space-y-10">
    <div class="space-y-2">
      <p class="text-xs tracking-[0.35em] uppercase text-slate-500">Account</p>
      <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-50">
        Profil kamu
      </h1>
      <p class="text-sm text-slate-400 max-w-xl">
        Kelola informasi akun dan keamanan password kamu dengan tampilan yang
        konsisten dengan dashboard.
      </p>
    </div>

    <div class="grid gap-8 lg:grid-cols-[2fr,3fr] items-start">
      <div class="space-y-6">
        <div class="rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.8)]">
          <div class="flex items-center gap-4">
            <div class="relative group">
              <div class="w-20 h-20 rounded-full bg-primary-500/10 border border-primary-500/40 overflow-hidden flex items-center justify-center">
                {#if previewUrl}
                  <img
                    src={previewUrl}
                    alt="Profile"
                    class="w-full h-full object-cover"
                  />
                {:else}
                  <span class="text-2xl font-bold text-primary-300">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                {/if}
              </div>
              <label
                class="absolute -bottom-1 -right-1 bg-primary-500 text-white p-1.5 rounded-full cursor-pointer hover:bg-primary-400 transition-colors"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  on:change={handleAvatarChange}
                  class="hidden"
                />
              </label>
            </div>

            <div class="space-y-1">
              <h2 class="text-xl font-semibold text-slate-50">
                {user.name}
              </h2>
              <p class="text-sm text-slate-400">{user.email}</p>
              {#if user.phone}
                <p class="text-xs text-slate-500">{user.phone}</p>
              {/if}
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
          <p class="flex items-center gap-2">
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Data profil kamu tersimpan aman di backend Nara. Pastikan email dan
            nomor HP selalu up to date.
          </p>
        </div>
      </div>

      <div class="space-y-6">
        <div class="rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7">
          <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-slate-400 mb-4">
            Informasi pribadi
          </h2>
          <form on:submit|preventDefault={changeProfile} class="space-y-5">
            <div class="space-y-1">
              <label
                for="name"
                class="block text-xs font-medium text-slate-400"
                >Nama</label
              >
              <input
                bind:value={user.name}
                type="text"
                id="name"
                class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
                placeholder="Nama lengkap kamu"
              />
            </div>

            <div class="space-y-1">
              <label
                for="email"
                class="block text-xs font-medium text-slate-400"
                >Email</label
              >
              <input
                bind:value={user.email}
                type="email"
                id="email"
                class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div class="space-y-1">
              <label
                for="phone"
                class="block text-xs font-medium text-slate-400"
                >No. HP</label
              >
              <input
                bind:value={user.phone}
                type="text"
                id="phone"
                class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
                placeholder="Nomor HP yang aktif"
              />
            </div>

            <div class="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                class="inline-flex items-center px-4 py-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-sm font-medium shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if isLoading}
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Menyimpan...
                {:else}
                  Simpan perubahan
                {/if}
              </button>
            </div>
          </form>
        </div>

        <div class="rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7">
          <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-slate-400 mb-4">
            Ganti password
          </h2>
          <form on:submit|preventDefault={changePassword} class="space-y-5">
            <div class="space-y-1">
              <label
                for="current_password"
                class="block text-xs font-medium text-slate-400"
                >Password sekarang</label
              >
              <input
                bind:value={current_password}
                type="password"
                id="current_password"
                class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
              />
            </div>

            <div class="space-y-1">
              <label
                for="new_password"
                class="block text-xs font-medium text-slate-400"
                >Password baru</label
              >
              <input
                bind:value={new_password}
                type="password"
                id="new_password"
                class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
              />
            </div>

            <div class="space-y-1">
              <label
                for="confirm_password"
                class="block text-xs font-medium text-slate-400"
                >Konfirmasi password baru</label
              >
              <input
                bind:value={confirm_password}
                type="password"
                id="confirm_password"
                class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
              />
            </div>

            <div class="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                class="inline-flex items-center px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if isLoading}
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-100"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Mengupdate...
                {:else}
                  Update password
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</section>
