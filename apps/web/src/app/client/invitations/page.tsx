import { redirect } from 'next/navigation';

/** The per-person links are gone (TASK-AF, ADR 0052): the space holds the one team address. */
export default function ClientInvitationsGone(): never {
  redirect('/client');
}
