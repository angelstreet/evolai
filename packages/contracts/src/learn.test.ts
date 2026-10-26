import { describe, expect, it } from 'vitest';
import { LEARN_VIDEOS, filledVideos, parseLearnVideos } from './learn.js';

const slot = (over: Record<string, unknown> = {}) => ({
  id: 'slot-1',
  page: 'why',
  youtubeId: '',
  minutes: 0,
  title: { en: '', fr: '' },
  ...over,
});

describe('learn videos', () => {
  it('ships ten empty slots, all hidden', () => {
    expect(LEARN_VIDEOS).toHaveLength(10);
    expect(filledVideos()).toEqual([]);
  });

  it('filters filled slots by page', () => {
    const v = parseLearnVideos({
      videos: [
        slot({ youtubeId: 'abcdefghijk', minutes: 2, title: { en: 'A', fr: 'B' } }),
        slot({ id: 'slot-2', page: 'how' }),
      ],
    });
    expect(filledVideos('why', v)).toHaveLength(1);
    expect(filledVideos('how', v)).toHaveLength(0);
  });

  it('rejects a bad id, a filled slot without titles, duplicates and more than ten', () => {
    expect(() => parseLearnVideos({ videos: [slot({ youtubeId: 'short' })] })).toThrow();
    expect(() => parseLearnVideos({ videos: [slot({ youtubeId: 'abcdefghijk' })] })).toThrow();
    expect(() => parseLearnVideos({ videos: [slot(), slot()] })).toThrow();
    const eleven = Array.from({ length: 11 }, (_, i) => slot({ id: `slot-${i + 1}` }));
    expect(() => parseLearnVideos({ videos: eleven })).toThrow();
  });
});
