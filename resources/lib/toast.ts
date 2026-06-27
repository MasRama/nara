import { toast } from 'svelte-sonner';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export function Toast(text: string, type: ToastType = "success"): void {
  switch (type) {
    case 'success':
      toast.success(text);
      break;
    case 'error':
      toast.error(text);
      break;
    case 'warning':
      toast.warning(text);
      break;
    case 'info':
      toast.info(text);
      break;
    default:
      toast(text);
  }
}
