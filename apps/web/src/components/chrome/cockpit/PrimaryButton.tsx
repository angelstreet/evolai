import type { ComponentProps } from 'react';
import Button from '@mui/material/Button';

/** The one filled button of a cockpit view (docs/UI_RULES.md §3). */
export default function PrimaryButton(props: Omit<ComponentProps<typeof Button>, 'variant'>) {
  return <Button variant="contained" {...props} sx={{ minHeight: 44, ...props.sx }} />;
}
