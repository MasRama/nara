import { describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../../shared/database';
import { declaredActivity } from '../../features/activity';
import { createActivityRecorder } from '../bindings/activity.server';

const RECORDER_ACTIVITY = [{ action: 'tested', label: 'Recorder tested', kind: 'update' }] as const;

describe('application activity recorder', () => {
  // Activity runs after a business mutation has committed; its failure must
  // not turn that success into a 500.
  it('reports a failed record instead of throwing', () => {
    const onFailure = vi.fn();
    const record = createActivityRecorder(onFailure).declare('recorder', RECORDER_ACTIVITY);

    expect(() => record({ action: null as unknown as 'recorder.tested', resource: 'recorder', actorId: null })).not.toThrow();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('records the event and stays quiet when it succeeds', () => {
    const onFailure = vi.fn();
    const record = createActivityRecorder(onFailure).declare('recorder', RECORDER_ACTIVITY);

    record({ action: 'recorder.tested', resource: 'recorder', actorId: null, targetLabel: 'recorder-ok' });

    expect(onFailure).not.toHaveBeenCalled();
    expect(
      getDatabase().prepare("SELECT 1 FROM activity_events WHERE action = 'recorder.tested' AND target_label = 'recorder-ok'").get(),
    ).toBeDefined();
  });

  it('declares what a reporter may report before handing out its sink', () => {
    createActivityRecorder(vi.fn()).declare('recorder', RECORDER_ACTIVITY);

    expect(declaredActivity()).toContainEqual({ action: 'recorder.tested', label: 'Recorder tested', kind: 'update' });
  });
});
