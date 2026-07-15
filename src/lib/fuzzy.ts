// Tiny subsequence scorer for the command palette's static commands.
// Higher is better; -1 means no match. Bonuses for word-start and
// consecutive-character matches keep "gp" ranking "Go to Purchase orders"
// above "Sign out".

export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;

  let score = 0;
  let ti = 0;
  let lastMatch = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        ti++;
        break;
      }
      ti++;
    }
    if (found === -1) return -1;
    score += 1;
    if (found === 0 || t[found - 1] === " " || t[found - 1] === "-") score += 3; // word start
    if (found === lastMatch + 1) score += 2; // consecutive
    lastMatch = found;
  }
  // Slight preference for shorter targets.
  return score + Math.max(0, 10 - Math.floor(t.length / 6));
}
