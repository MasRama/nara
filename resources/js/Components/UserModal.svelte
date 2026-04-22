<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
  } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { Loader2 } from '@lucide/svelte';
  import type { UserForm } from '../types';

  let {
    show = false,
    mode = 'create',
    form,
    isSubmitting = false
  }: {
    show?: boolean;
    mode?: 'create' | 'edit';
    form: UserForm;
    isSubmitting?: boolean
  } = $props();

  const dispatch = createEventDispatcher<{
    close: void;
    submit: UserForm;
  }>();

  function handleClose(): void {
    dispatch('close');
  }

  function handleSubmit(): void {
    dispatch('submit', form);
  }
</script>

<Dialog open={show} onOpenChange={(v) => { if (!v) handleClose(); }}>
  <DialogContent class="sm:max-w-md bg-background border-border font-body p-0 gap-0 overflow-hidden">

    <DialogHeader class="px-6 pt-6 pb-5 border-b border-border">
      <span class="text-[10px] font-mono-accent uppercase tracking-widest text-primary mb-2 block">
        {mode === 'create' ? 'New User' : 'Edit User'}
      </span>
      <DialogTitle class="font-heading font-semibold text-xl tracking-tight" style="font-feature-settings: 'ss01'">
        {mode === 'create' ? 'Create User' : 'Update User'}
      </DialogTitle>
      <DialogDescription class="text-sm text-muted-foreground font-body mt-1">
        {mode === 'create'
          ? 'Add a new user to the system.'
          : 'Make changes to the user profile here.'}
      </DialogDescription>
    </DialogHeader>

    <form id="user-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="px-6 py-5 space-y-5">

        <div class="space-y-2">
          <Label for="name" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Full Name</Label>
          <Input
            id="name"
            type="text"
            bind:value={form.name}
            placeholder="Enter full name"
            class="rounded-xl h-11 bg-background border-border font-body text-sm"
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="email" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Email Address</Label>
          <Input
            id="email"
            type="email"
            bind:value={form.email}
            placeholder="user@example.com"
            class="rounded-xl h-11 bg-background border-border font-body text-sm"
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="phone" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">
            Phone <span class="normal-case tracking-normal font-body text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="phone"
            type="text"
            bind:value={form.phone}
            placeholder="+62 xxx xxxx xxxx"
            class="rounded-xl h-11 bg-background border-border font-body text-sm"
          />
        </div>

        <div class="space-y-2">
          <Label for="password" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">
            {mode === 'create' ? 'Password' : 'New Password'}
            <span class="normal-case tracking-normal font-body text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="password"
            type="password"
            bind:value={form.password}
            placeholder={mode === 'create' ? 'Leave empty to use email' : 'Leave empty to keep current'}
            class="rounded-xl h-11 bg-background border-border font-body text-sm"
          />
        </div>

        <div class="grid grid-cols-2 gap-3 pt-1">
          <div class="flex items-center gap-3 bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors duration-200">
            <Switch
              id="admin-role"
              checked={form.roles?.includes('admin') ?? false}
              onCheckedChange={(checked) => {
                if (checked) {
                  form.roles = [...(form.roles || []), 'admin'];
                } else {
                  form.roles = (form.roles || []).filter(r => r !== 'admin');
                }
              }}
            />
            <div>
              <Label for="admin-role" class="text-sm font-heading font-semibold cursor-pointer">Admin</Label>
              <p class="text-xs font-mono-accent text-muted-foreground mt-0.5">Full access</p>
            </div>
          </div>

          <div class="flex items-center gap-3 bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors duration-200">
            <Switch
              id="verified-status"
              bind:checked={form.is_verified}
            />
            <div>
              <Label for="verified-status" class="text-sm font-heading font-semibold cursor-pointer">Verified</Label>
              <p class="text-xs font-mono-accent text-muted-foreground mt-0.5">Email confirmed</p>
            </div>
          </div>
        </div>

      </div>
    </form>

    <DialogFooter class="px-6 py-4 border-t border-border flex gap-2">
      <Button
        variant="outline"
        onclick={handleClose}
        disabled={isSubmitting}
        class="rounded-full font-mono-accent text-xs uppercase tracking-widest border-border hover:border-primary/40 hover:text-primary transition-colors duration-200"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="user-form"
        disabled={isSubmitting}
        class="rounded-full font-mono-accent text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform duration-200"
      >
        {#if isSubmitting}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        {mode === 'create' ? 'Create User' : 'Save Changes'}
      </Button>
    </DialogFooter>

  </DialogContent>
</Dialog>
