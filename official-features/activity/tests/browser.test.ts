// @vitest-environment jsdom
import { createApp, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActivityPage from '../web/pages/ActivityPage.vue';

async function flush(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await nextTick();
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('activity browser surface', () => {
  it('renders the feed and applies an exact action filter', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            activities: [
              {
                id: 'event-1',
                action: 'users.updated',
                resource: 'users',
                actorId: 'actor-1',
                targetId: 'user-1',
                targetLabel: 'Ada Lovelace',
                metadata: { self: false },
                occurredAt: 1_700_000_000_000,
              },
              {
                id: 'event-2',
                action: 'billing.invoice-sent',
                resource: 'billing',
                actorId: 'actor-1',
                targetId: null,
                targetLabel: null,
                metadata: {},
                occurredAt: 1_699_999_000_000,
              },
            ],
            total: 2,
            page: 1,
            limit: 20,
            actions: [
              { action: 'auth.login', label: 'Signed in', kind: 'access' },
              { action: 'users.updated', label: 'Member edited', kind: 'update' },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const container = document.createElement('div');
    document.body.append(container);
    const application = createApp(ActivityPage);
    application.mount(container);
    await flush();

    expect(container.textContent).toContain('Activity');
    // Labels and filter options come from what reporting Features declared.
    expect(container.textContent).toContain('Member edited');
    expect(container.textContent).not.toContain('User updated');
    expect(container.textContent).toContain('Billing invoice sent');
    const options = [...container.querySelectorAll('#activity-action-options option')].map((option) => [
      option.getAttribute('value'),
      option.textContent,
    ]);
    expect(options).toEqual([
      ['auth.login', 'Signed in'],
      ['users.updated', 'Member edited'],
    ]);
    expect(container.textContent).toContain('Ada Lovelace');
    expect(container.textContent).toContain('SelfNo');

    const action = container.querySelector('#activity-action') as HTMLInputElement | null;
    if (!action) throw new Error('Missing action filter');
    action.value = 'auth.login';
    action.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    const form = container.querySelector('form');
    if (!form) throw new Error('Missing activity filter form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('action=auth.login');

    application.unmount();
  });
});
