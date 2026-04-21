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

<Dialog 
  open={show} 
  onOpenChange={(v) => { 
    if(!v) handleClose(); 
  }}
>
  <DialogContent class="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>
        {mode === 'create' ? 'Create User' : 'Update User'}
      </DialogTitle>
      <DialogDescription>
        {mode === 'create' 
          ? 'Add a new user to the system.' 
          : 'Make changes to the user profile here.'}
      </DialogDescription>
    </DialogHeader>

    <form 
      id="user-form" 
      onsubmit={(e) => { 
        e.preventDefault(); 
        handleSubmit(); 
      }}
    >
      <div class="grid gap-4 py-4">
        
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="name" class="text-right">
            Full Name
          </Label>
          <Input 
            id="name" 
            type="text" 
            bind:value={form.name} 
            placeholder="Enter full name" 
            class="col-span-3" 
            required 
          />
        </div>

        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="email" class="text-right">
            Email Address
          </Label>
          <Input 
            id="email" 
            type="email" 
            bind:value={form.email} 
            placeholder="user@example.com" 
            class="col-span-3" 
            required 
          />
        </div>

        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="phone" class="text-right">
            Phone 
            <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input 
            id="phone" 
            type="text" 
            bind:value={form.phone} 
            placeholder="+62 xxx xxxx xxxx" 
            class="col-span-3" 
          />
        </div>

        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="password" class="text-right">
            {mode === 'create' ? 'Password' : 'New Password'}
            <br/>
            <span class="text-muted-foreground font-normal text-xs">
              (optional)
            </span>
          </Label>
          <Input 
            id="password" 
            type="password" 
            bind:value={form.password} 
            placeholder={
              mode === 'create' 
                ? 'Leave empty to use email' 
                : 'Leave empty to keep current'
            } 
            class="col-span-3" 
          />
        </div>

        <div class="grid grid-cols-4 items-center gap-4 pt-2">
          <div class="col-start-2 col-span-3 flex gap-6">
            
            <div class="flex items-center space-x-2 border rounded-md p-3 flex-1">
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
              <div class="grid gap-1.5 leading-none">
                <Label for="admin-role" class="cursor-pointer">
                  Admin
                </Label>
                <p class="text-sm text-muted-foreground">
                  Full access
                </p>
              </div>
            </div>

            <div class="flex items-center space-x-2 border rounded-md p-3 flex-1">
              <Switch 
                id="verified-status"
                bind:checked={form.is_verified}
              />
              <div class="grid gap-1.5 leading-none">
                <Label for="verified-status" class="cursor-pointer">
                  Verified
                </Label>
                <p class="text-sm text-muted-foreground">
                  Email confirmed
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </form>

    <DialogFooter>
      <Button 
        variant="outline" 
        onclick={handleClose} 
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button 
        type="submit" 
        form="user-form" 
        disabled={isSubmitting}
      >
        {#if isSubmitting}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        {mode === 'create' ? 'Create User' : 'Save Changes'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>