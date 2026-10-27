import { redirect } from 'next/navigation';

/** One set of lessons (TASK-AI L2): the old /learn pages open the front page's Learn, lesson 3 of 5. */
export const dynamic = 'force-dynamic';

export default function LearnQuestionsPage(): never {
  redirect('/?learn=3');
}
