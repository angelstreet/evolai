import { redirect } from 'next/navigation';

/** One set of lessons (TASK-AI L2): the old /learn pages open the front page's Learn, lesson 2 of 5. */
export const dynamic = 'force-dynamic';

export default function LearnHowPage(): never {
  redirect('/?learn=2');
}
