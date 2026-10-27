import type { ReactNode } from 'react';
import SurveyFrame from '@/components/chrome/SurveyFrame';

/** Team survey pages in the Workbench frame (TASK-AI L3). */
export default function SurveyLayout({ children }: { children: ReactNode }) {
  return <SurveyFrame>{children}</SurveyFrame>;
}
