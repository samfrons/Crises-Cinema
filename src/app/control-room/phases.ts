/* The URL for each state of the desk. Phase slugs name where the desk opens:
   a shared link can open a day at its briefing, at the first decision (in
   the log, picture or diorama view), or at the debrief's day. A debrief
   needs a finished run, which a link cannot carry, so /debrief opens the
   day at its briefing rather than fabricate choices. */
export const PHASES = ['briefing', 'play', 'picture', 'diorama', 'debrief'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  briefing: 'Briefing',
  play: 'The log',
  picture: 'Picture mode',
  diorama: 'Diorama mode',
  debrief: 'Debrief',
};

export const isPhase = (s: string): s is Phase => (PHASES as readonly string[]).includes(s);
