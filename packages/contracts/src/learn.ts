import { z } from 'zod';
import videosJson from './learn/videos.json' with { type: 'json' };

/**
 * Video slots of the public /learn pages (TASK-AE, ADR 0050). One JSON file; the owner fills the
 * YouTube id, length and titles. An empty `youtubeId` hides the slot, so nothing shows "coming soon".
 */
export const LEARN_PAGE_KEYS = ['why', 'how', 'questions', 'results', 'more'] as const;
export const learnPageKeySchema = z.enum(LEARN_PAGE_KEYS);
export type LearnPageKey = z.infer<typeof learnPageKeySchema>;

export const learnVideoSchema = z
  .object({
    id: z.string().regex(/^slot-\d{1,2}$/),
    page: learnPageKeySchema,
    youtubeId: z.union([z.literal(''), z.string().regex(/^[A-Za-z0-9_-]{11}$/)]),
    minutes: z.number().int().min(0).max(120),
    title: z.object({ en: z.string().max(120), fr: z.string().max(120) }),
  })
  .superRefine((v, ctx) => {
    if (v.youtubeId !== '' && (!v.title.en || !v.title.fr || v.minutes < 1)) {
      ctx.addIssue({ code: 'custom', message: 'a filled slot needs both titles and a length' });
    }
  });
export type LearnVideo = z.infer<typeof learnVideoSchema>;

export const learnVideosSchema = z
  .object({ videos: z.array(learnVideoSchema).max(10) })
  .superRefine((d, ctx) => {
    const ids = d.videos.map((v) => v.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'slot ids must be unique' });
    }
  });

export const parseLearnVideos = (raw: unknown): LearnVideo[] => learnVideosSchema.parse(raw).videos;

/** All ten slots, validated once at import time. */
export const LEARN_VIDEOS: LearnVideo[] = parseLearnVideos(videosJson);

/** The slots that are filled, for one page or (without a page) for all. */
export const filledVideos = (
  page?: LearnPageKey,
  videos: LearnVideo[] = LEARN_VIDEOS,
): LearnVideo[] =>
  videos.filter((v) => v.youtubeId !== '' && (page === undefined || v.page === page));
