/**
 * Section icons for the Patient and Prescription forms.
 *
 * Kept separate from NavIcon (the sidebar's set) because these needs are different: softer,
 * smaller motifs that sit inside a tinted chip beside a section heading rather than standing
 * alone in a dark sidebar row. Same drawing rules as NavIcon — 24 viewBox, one stroke weight,
 * rounded joins — so the two sets read as one family.
 */

export type FormIconName =
  | 'person'
  | 'phone'
  | 'calendar'
  | 'heart'
  | 'note'
  | 'stethoscope'
  | 'target'
  | 'activity'
  | 'clipboard'
  | 'message'
  | 'paperclip'
  | 'flask'
  | 'search';

const paths: Record<FormIconName, JSX.Element> = {
  // A single person: who this record is about.
  person: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  // A classic handset: how to reach them.
  phone: (
    <path d="M6.6 3.5h3l1.4 4.4-2.3 1.9a12.5 12.5 0 0 0 5.5 5.5l1.9-2.3 4.4 1.4v3a1.5 1.5 0 0 1-1.6 1.5C11.6 18.4 5.6 12.4 5.1 5.1A1.5 1.5 0 0 1 6.6 3.5z" />
  ),
  // A calendar page: dates and scheduling.
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
    </>
  ),
  // Who is close to the patient: attendant, emergency contact.
  heart: (
    <path d="M12 20s-7.5-4.6-9.6-9.3C1 7.5 2.7 4.5 6 4.1c2-.2 3.6 1 4.6 2.5.9-1.5 2.6-2.7 4.6-2.5 3.3.4 5 3.4 3.6 6.6C19.5 15.4 12 20 12 20z" />
  ),
  // A page of lines: freeform notes.
  note: (
    <>
      <path d="M6.5 3.5h9l3 3v13a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M9 10.5h6M9 14.5h6M9 6.5h3" />
    </>
  ),
  // Reused from the Doctors nav icon, so an exam section and the clinician section match.
  stethoscope: (
    <>
      <path d="M5 3.5v4.5a4.5 4.5 0 0 0 9 0V3.5" />
      <path d="M3.2 3.5h3.4M12.4 3.5h3.4" />
      <path d="M9.5 12.5v2a5 5 0 0 0 5 5h1" />
      <circle cx="18" cy="17" r="2.6" />
    </>
  ),
  // A target: pinpointing the diagnosis.
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // A heartbeat trace: the treatment protocol in motion.
  activity: <path d="M2.5 12h4l2-6.5 4 13L15 12h6.5" />,
  // A clipboard: the treatment plan as a document to follow.
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <path d="M9 4.5V3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V4.5" />
      <path d="M8.5 11.5l2 2 4.5-4.5M8.5 16.5h7" />
    </>
  ),
  // A speech bubble: instructions to hand to the patient.
  message: (
    <path d="M4 5.5h16v11h-8.5L8 20v-3.5H4z" />
  ),
  // A paperclip: attached reports.
  paperclip: (
    <path d="M16.5 6.5l-8 8a3 3 0 0 0 4.2 4.2l8.5-8.5a5 5 0 0 0-7-7l-8.5 8.5a7 7 0 0 0 9.9 9.9" />
  ),
  // A flask: lab work and investigations.
  flask: (
    <>
      <path d="M9.5 3.5h5M10 3.5v5.8L5.3 18a1.8 1.8 0 0 0 1.6 2.6h10.2a1.8 1.8 0 0 0 1.6-2.6L14 9.3V3.5" />
      <path d="M7.5 15h9" />
    </>
  ),
  // A magnifying glass: the condition search box.
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5l-4.3-4.3" />
    </>
  ),
};

export default function FormIcon({
  name,
  className = 'h-[18px] w-[18px]',
}: {
  name: FormIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
