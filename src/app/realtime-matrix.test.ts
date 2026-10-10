import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, resetSecurityState } from './server';
import { closeEventStreams, EVENTS_PATH, liveTopics, publish, STREAM_READY_EVENT, type Topic } from '../shared/realtime';
import { readEvents, type EventReader } from '../shared/realtime/tests/helpers';
import { grantAdmin, grantPermissions, signUp, type Persona } from './tests/personas';

/**
 * Who receives which live topic, derived from the topics the composed
 * application declares, so a Feature's new topic is covered without editing
 * this file.
 *
 * Each topic is published once to a room of open streams: an account with no
 * grants, one holding the topic's permission, an administrator, and an
 * account the publication names. Each must receive it exactly when the
 * topic's audience says so; anyone else receiving it is a leak.
 */
const topics = liveTopics();

/** Topic names Feature contracts export as `<NAME>_EVENT`, where the browser subscribes from. */
async function contractTopicNames(): Promise<string[]> {
  const features = readdirSync(resolve(__dirname, '../features'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const names: string[] = [];
  for (const feature of features) {
    const contract = (await import(`../features/${feature.name}/contract.ts`)) as Record<string, unknown>;
    for (const [key, value] of Object.entries(contract)) {
      if (key.endsWith('_EVENT') && typeof value === 'string') names.push(value);
    }
  }
  return names;
}

function describeAudience(topic: Topic): string {
  const { rule, affected } = topic.audience;
  const holders = rule === undefined ? [] : ['permission' in rule ? `${rule.permission} holders` : 'administrators'];
  return [...holders, ...(affected ? ['the accounts it names'] : [])].join(' and ');
}

async function listen(persona: Persona): Promise<EventReader> {
  const response = await app.request(EVENTS_PATH, { headers: { Cookie: persona.cookie } });
  expect(response.status).toBe(200);
  const events = readEvents(response);
  expect(await events.next()).toBe(STREAM_READY_EVENT);
  return events;
}

describe('live topic matrix', () => {
  let outsider: Persona;
  let admin: Persona;

  beforeAll(async () => {
    outsider = await signUp('Topic Outsider');
    admin = await signUp('Topic Admin');
    grantAdmin(admin.id);
  });

  // Registration shares the strict per-client limit; each case starts afresh.
  beforeEach(() => resetSecurityState());
  afterEach(() => closeEventStreams());

  it('covers every topic a Feature contract names', async () => {
    expect(topics.length).toBeGreaterThan(0);
    const declared = new Set(topics.map((topic) => topic.name));
    expect((await contractTopicNames()).filter((name) => !declared.has(name))).toEqual([]);
  });

  for (const topic of topics) {
    const { rule, affected } = topic.audience;

    it(`${topic.name} reaches ${describeAudience(topic)}, and nobody else`, async () => {
      // Every grant is made before a stream opens: grants publish topics of their own.
      const named = await signUp('Topic Named');
      const holder = rule !== undefined && 'permission' in rule ? await signUp(`Topic ${rule.permission}`) : undefined;
      if (holder && rule && 'permission' in rule) grantPermissions(holder.id, [rule.permission]);

      const room: Array<{ who: string; persona: Persona; receives: boolean }> = [
        { who: 'an account with no grants', persona: outsider, receives: false },
        { who: 'an administrator', persona: admin, receives: rule !== undefined },
        { who: 'the account the publication names', persona: named, receives: affected === true },
        ...(holder ? [{ who: 'a holder of the permission', persona: holder, receives: true }] : []),
      ];
      const streams = await Promise.all(room.map((seat) => listen(seat.persona)));

      publish(topic, affected ? [named.id] : []);

      const received = await Promise.all(streams.map((stream, index) => stream.next(room[index].receives ? 2_000 : 150)));
      expect(Object.fromEntries(room.map((seat, index) => [seat.who, received[index]]))).toEqual(
        Object.fromEntries(room.map((seat) => [seat.who, seat.receives ? topic.name : 'timeout'])),
      );
    });
  }
});
