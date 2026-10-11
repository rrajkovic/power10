// Turns per-photo readings into workouts.
//
// Photos of the same activity are one workout: their times and distances are
// added up. A different activity, a different intensity or a different day
// makes a separate workout. So four photos
//   erg 20 min, berg 40 min, erg 20 min, erg 20 min
// become one 60-minute erg workout and one 40-minute berg workout.
//
// This is plain code, not AI, so the adding is always exact.

// What the AI read off one photo, after every value has been checked.
export type Piece = {
  // Position of the photo in the request (0 = first).
  photo: number;
  activity_type_id: string | null;
  intensity_id: string | null;
  seconds: number;
  distance_meters: number | null;
  date: string | null;
  // 1 to 10: how sure the AI is that it read the screen correctly.
  confidence: number;
};

// One workout for the logging form.
export type ReadSession = {
  activity_type_id: string | null;
  intensity_id: string | null;
  seconds: number;
  distance_meters: number | null;
  date: string | null;
  // The lowest confidence of its photos: one doubtful photo makes the whole
  // workout doubtful.
  confidence: number;
  low_confidence: boolean;
  // Which photos belong to this workout (positions in the request).
  photos: number[];
};

export function groupPieces(pieces: Piece[], minConfidence: number): ReadSession[] {
  const sessions: ReadSession[] = [];
  // A value the AI couldn't read (null) doesn't split a workout: an erg photo
  // with no visible date still belongs with the other erg photos.
  const fits = <T>(a: T | null, b: T | null) => a === null || b === null || a === b;

  // Workouts come out in the order their first photo was sent.
  for (const piece of [...pieces].sort((a, b) => a.photo - b.photo)) {
    const session = sessions.find(
      (s) =>
        s.activity_type_id === piece.activity_type_id &&
        fits(s.intensity_id, piece.intensity_id) &&
        fits(s.date, piece.date),
    );
    if (!session) {
      sessions.push({
        activity_type_id: piece.activity_type_id,
        intensity_id: piece.intensity_id,
        seconds: piece.seconds,
        distance_meters: piece.distance_meters,
        date: piece.date,
        confidence: piece.confidence,
        low_confidence: false,
        photos: [piece.photo],
      });
      continue;
    }
    // A day is the longest session the database accepts.
    session.seconds = Math.min(session.seconds + piece.seconds, 86_400);
    // A total distance only makes sense if every piece showed one.
    session.distance_meters =
      session.distance_meters !== null && piece.distance_meters !== null
        ? session.distance_meters + piece.distance_meters
        : null;
    session.intensity_id ??= piece.intensity_id;
    session.date ??= piece.date;
    session.confidence = Math.min(session.confidence, piece.confidence);
    session.photos.push(piece.photo);
  }

  for (const session of sessions) session.low_confidence = session.confidence < minConfidence;
  return sessions;
}
