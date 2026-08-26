/**
 * A library of the conditions a physiotherapy clinic sees most, each carrying the protocol
 * that usually follows it.
 *
 * Typing the same diagnosis and the same treatment plan for the twentieth "lower back pain"
 * is where the time goes, so picking a condition fills the plan, the body region and the
 * shape of the package. Everything it fills stays editable — it is a starting point for the
 * clinician, never a decision made for them.
 */

export const BODY_REGIONS = [
  'Neck',
  'Shoulder',
  'Elbow',
  'Wrist & hand',
  'Upper back',
  'Lower back',
  'Hip',
  'Knee',
  'Ankle & foot',
  'Neurological',
  'General',
] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

export const SIDES = ['Left', 'Right', 'Both', 'Not applicable'] as const;
export type Side = (typeof SIDES)[number];

export interface ConditionTemplate {
  name: string;
  region: BodyRegion;
  /** Sessions a course of this condition usually runs to. */
  sessions: number;
  /** Days between sessions — three a week is `2`, twice a week is `3`. */
  frequencyDays: number;
  /** Pre-filled treatment plan, written the way a therapist would record it. */
  plan: string;
  /** Words a receptionist might type instead of the formal name. */
  aliases?: string[];
}

export const CONDITION_LIBRARY: ConditionTemplate[] = [
  {
    name: 'Mechanical lower back pain',
    region: 'Lower back',
    sessions: 10,
    frequencyDays: 2,
    plan: 'Hot pack and TENS for pain relief. Lumbar mobilisation, soft tissue release to paraspinals and quadratus lumborum. Core stabilisation starting with transversus abdominis activation, progressing to bridging and bird-dog. Posture and lifting education.',
    aliases: ['back pain', 'low back', 'lumbago'],
  },
  {
    name: 'Lumbar disc prolapse (L4-L5 / L5-S1)',
    region: 'Lower back',
    sessions: 12,
    frequencyDays: 2,
    plan: 'IFT and hot pack. McKenzie extension protocol as tolerated. Neural mobilisation for the affected root. Core strengthening once symptoms centralise. Avoid forward flexion and lifting during the acute phase.',
    aliases: ['disc bulge', 'slip disc', 'herniated disc', 'prolapse'],
  },
  {
    name: 'Sciatica',
    region: 'Lower back',
    sessions: 12,
    frequencyDays: 2,
    plan: 'TENS along the affected dermatome. Sciatic nerve glides and slump mobilisation. Piriformis and hamstring stretching. Lumbar core stabilisation. Advise against prolonged sitting.',
    aliases: ['leg pain', 'nerve pain'],
  },
  {
    name: 'Cervical spondylosis',
    region: 'Neck',
    sessions: 10,
    frequencyDays: 2,
    plan: 'Moist heat and cervical traction. Gentle cervical mobilisation and sub-occipital release. Deep neck flexor training, scapular retraction. Workstation and pillow advice.',
    aliases: ['neck pain', 'cervical', 'spondylosis'],
  },
  {
    name: 'Postural neck pain',
    region: 'Neck',
    sessions: 8,
    frequencyDays: 3,
    plan: 'Soft tissue release to upper trapezius and levator scapulae. Chin tuck and scapular setting exercises. Thoracic extension mobility. Desk ergonomics and screen height correction.',
    aliases: ['text neck', 'office neck', 'stiff neck'],
  },
  {
    name: 'Frozen shoulder (adhesive capsulitis)',
    region: 'Shoulder',
    sessions: 15,
    frequencyDays: 2,
    plan: 'Moist heat, ultrasound to the capsule. Grade III-IV glenohumeral mobilisation in all directions. Capsular stretching, pulley and wand exercises. Progressive strengthening once range improves. Warn the patient that recovery runs over months.',
    aliases: ['frozen shoulder', 'stiff shoulder', 'capsulitis'],
  },
  {
    name: 'Rotator cuff tendinopathy',
    region: 'Shoulder',
    sessions: 12,
    frequencyDays: 2,
    plan: 'Ultrasound and cryotherapy in the irritable phase. Scapular stabilisation, then progressive isometric to eccentric cuff loading. Correct scapulohumeral rhythm. Avoid overhead work early on.',
    aliases: ['shoulder pain', 'cuff tear', 'supraspinatus'],
  },
  {
    name: 'Shoulder impingement',
    region: 'Shoulder',
    sessions: 10,
    frequencyDays: 2,
    plan: 'Activity modification and pain relief modalities. Posterior capsule stretching, scapular retraction and lower trapezius strengthening. Graded return to overhead range.',
    aliases: ['impingement', 'painful arc'],
  },
  {
    name: 'Tennis elbow (lateral epicondylitis)',
    region: 'Elbow',
    sessions: 10,
    frequencyDays: 2,
    plan: 'Ultrasound and deep transverse friction to the common extensor origin. Eccentric wrist extensor loading. Counterforce bracing. Grip and forearm strengthening; review work technique.',
    aliases: ['tennis elbow', 'elbow pain', 'epicondylitis'],
  },
  {
    name: "Golfer's elbow (medial epicondylitis)",
    region: 'Elbow',
    sessions: 10,
    frequencyDays: 2,
    plan: 'Ultrasound and friction massage to the common flexor origin. Eccentric wrist flexor loading. Forearm stretching and grip strengthening.',
    aliases: ['golfers elbow', 'medial elbow'],
  },
  {
    name: 'Carpal tunnel syndrome',
    region: 'Wrist & hand',
    sessions: 10,
    frequencyDays: 3,
    plan: 'Median nerve glides and carpal bone mobilisation. Wrist splinting at night. Tendon gliding exercises, thenar strengthening. Ergonomic advice for repetitive tasks.',
    aliases: ['carpal tunnel', 'hand numbness', 'median nerve'],
  },
  {
    name: "De Quervain's tenosynovitis",
    region: 'Wrist & hand',
    sessions: 8,
    frequencyDays: 3,
    plan: 'Thumb spica splinting and relative rest. Ultrasound to the first dorsal compartment. Gentle tendon gliding, progressing to eccentric thumb loading.',
    aliases: ['thumb pain', 'de quervain', 'mothers wrist'],
  },
  {
    name: 'Knee osteoarthritis',
    region: 'Knee',
    sessions: 12,
    frequencyDays: 2,
    plan: 'Short wave diathermy or hot pack. Quadriceps and VMO strengthening, straight leg raises progressing to closed chain work. Patellar mobilisation, hamstring and calf flexibility. Weight and stair-climbing advice.',
    aliases: ['knee pain', 'oa knee', 'arthritis knee'],
  },
  {
    name: 'Patellofemoral pain syndrome',
    region: 'Knee',
    sessions: 10,
    frequencyDays: 2,
    plan: 'VMO retraining and hip abductor strengthening. ITB and lateral retinaculum release, patellar taping trial. Correct squat and stair mechanics.',
    aliases: ['runners knee', 'front knee pain', 'pfps'],
  },
  {
    name: 'ACL reconstruction rehabilitation',
    region: 'Knee',
    sessions: 24,
    frequencyDays: 2,
    plan: 'Phase-based post-operative protocol. Early: swelling control, full extension, quadriceps activation, gait re-education. Mid: closed chain strengthening, proprioception. Late: agility, plyometrics and sport-specific return criteria.',
    aliases: ['acl', 'ligament surgery', 'knee reconstruction'],
  },
  {
    name: 'Meniscus injury',
    region: 'Knee',
    sessions: 12,
    frequencyDays: 2,
    plan: 'Swelling control and range of motion restoration. Quadriceps and hamstring strengthening, proprioceptive retraining. Avoid deep squatting and twisting early on.',
    aliases: ['meniscus', 'cartilage tear'],
  },
  {
    name: 'Total knee replacement rehabilitation',
    region: 'Knee',
    sessions: 20,
    frequencyDays: 2,
    plan: 'Post-operative protocol: oedema management, knee flexion and extension range, quadriceps re-activation, gait training with aid progressing to independent walking, stair training and endurance work.',
    aliases: ['tkr', 'knee replacement'],
  },
  {
    name: 'Hip osteoarthritis',
    region: 'Hip',
    sessions: 12,
    frequencyDays: 2,
    plan: 'Hip mobilisation and soft tissue work to glutes and hip flexors. Abductor and extensor strengthening. Gait re-education, walking aid assessment if needed.',
    aliases: ['hip pain', 'oa hip'],
  },
  {
    name: 'Ankle sprain (lateral ligament)',
    region: 'Ankle & foot',
    sessions: 8,
    frequencyDays: 2,
    plan: 'Early: PRICE, gentle range of motion. Progress to peroneal strengthening, proprioceptive and balance retraining on wobble board, then hopping and change of direction before return to sport.',
    aliases: ['ankle twist', 'sprain', 'ligament ankle'],
  },
  {
    name: 'Plantar fasciitis',
    region: 'Ankle & foot',
    sessions: 10,
    frequencyDays: 3,
    plan: 'Ultrasound to the plantar fascia, deep friction at the calcaneal insertion. Calf and plantar fascia stretching, intrinsic foot strengthening. Footwear review and heel cushioning; morning stretch routine.',
    aliases: ['heel pain', 'plantar'],
  },
  {
    name: 'Achilles tendinopathy',
    region: 'Ankle & foot',
    sessions: 12,
    frequencyDays: 2,
    plan: 'Load management and eccentric heel-drop programme (Alfredson protocol). Calf flexibility, soleus strengthening. Gradual return to running with heel raise if required.',
    aliases: ['achilles', 'tendon ankle'],
  },
  {
    name: 'Post-fracture rehabilitation',
    region: 'General',
    sessions: 12,
    frequencyDays: 2,
    plan: 'Post-immobilisation: joint mobilisation for stiffness, scar management, progressive strengthening of the immobilised segment, proprioception and return to functional loading as per surgical clearance.',
    aliases: ['fracture', 'after cast', 'post cast'],
  },
  {
    name: 'Post-stroke rehabilitation (hemiplegia)',
    region: 'Neurological',
    sessions: 24,
    frequencyDays: 1,
    plan: 'Neurodevelopmental approach: positioning and tone management, weight bearing through the affected side, sit-to-stand and gait re-education, upper limb task-specific practice, balance training. Family education for the home programme.',
    aliases: ['stroke', 'paralysis', 'cva', 'hemiplegia'],
  },
  {
    name: "Bell's palsy",
    region: 'Neurological',
    sessions: 15,
    frequencyDays: 2,
    plan: 'Facial muscle re-education with mirror feedback, gentle massage, electrical stimulation if indicated. Eye protection advice. Progressive expression exercises.',
    aliases: ['facial palsy', 'face paralysis', 'bells'],
  },
  {
    name: 'Diabetic peripheral neuropathy',
    region: 'Neurological',
    sessions: 12,
    frequencyDays: 3,
    plan: 'Balance and proprioceptive training, foot care education and daily inspection routine, graded aerobic conditioning, footwear assessment to prevent ulceration.',
    aliases: ['neuropathy', 'diabetic feet', 'numbness feet'],
  },
  {
    name: 'Hamstring strain',
    region: 'General',
    sessions: 10,
    frequencyDays: 2,
    plan: 'Acute: relative rest, pain-free range. Progress to Nordic and eccentric loading, lumbopelvic control, then running progression and sport-specific drills before clearance.',
    aliases: ['hamstring', 'muscle pull', 'thigh strain'],
  },
];

/**
 * Ranks the library against what has been typed so far. Matches on the condition name and
 * on the everyday words a receptionist is more likely to reach for ("slip disc", "back pain"),
 * with a name match ranked above an alias match and a prefix above a mid-word hit.
 */
export function searchConditions(query: string, limit = 6): ConditionTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return CONDITION_LIBRARY.slice(0, limit);

  const scored = CONDITION_LIBRARY.map((c) => {
    const name = c.name.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score = 100;
    else if (name.includes(q)) score = 70;
    else if (c.aliases?.some((a) => a.startsWith(q))) score = 50;
    else if (c.aliases?.some((a) => a.includes(q))) score = 30;
    else if (c.region.toLowerCase().includes(q)) score = 10;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));

  return scored.slice(0, limit).map((x) => x.c);
}

export function findCondition(name: string): ConditionTemplate | undefined {
  return CONDITION_LIBRARY.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
}
