import type { MockInterviewScoreRequest, MockInterviewScoreResult } from "@/lib/ai/types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "at", "by",
  "is", "are", "was", "were", "be", "been", "i", "you", "your", "my", "me", "it", "this", "that",
]);

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Deterministic, real signals — not a fabricated "AI assessment." Scores the response's own
 * word count, sentence structure, and keyword overlap with the question; never claims anything
 * about the candidate beyond what's in the text they typed. The real Claude-backed provider can
 * give genuinely richer qualitative feedback; this is an honest, working default without one.
 */
export function scoreMockInterviewResponseHeuristic(request: MockInterviewScoreRequest): MockInterviewScoreResult {
  const responseWords = words(request.responseText);
  const responseSentences = sentences(request.responseText);
  const wordCount = responseWords.length;

  // Completeness: word count relative to a reasonable spoken-answer length (~60-200 words).
  const scoreCompleteness = Math.round(Math.max(0, Math.min(100, (wordCount / 120) * 100)));

  // Structure: multiple sentences and at least one transition/sequencing word read as
  // "structured" (situation → action → result framing), a single run-on sentence doesn't.
  const transitionWords = ["first", "then", "so", "because", "as a result", "which led", "eventually", "ultimately"];
  const hasTransition = transitionWords.some((t) => request.responseText.toLowerCase().includes(t));
  const scoreStructure = Math.min(100, responseSentences.length * 15 + (hasTransition ? 25 : 0));

  // Clarity: penalize extremely long run-on sentences (a proxy for rambling).
  const avgWordsPerSentence = responseSentences.length > 0 ? wordCount / responseSentences.length : wordCount;
  const scoreClarity = avgWordsPerSentence <= 35 ? 85 : Math.max(30, 85 - (avgWordsPerSentence - 35) * 2);

  // Relevance: overlap between the response's significant words and the question's.
  const questionKeywords = new Set(words(request.question).filter((w) => !STOPWORDS.has(w) && w.length > 3));
  const responseKeywordSet = new Set(responseWords.filter((w) => !STOPWORDS.has(w)));
  const overlap = [...questionKeywords].filter((w) => responseKeywordSet.has(w)).length;
  const scoreRelevance = questionKeywords.size > 0 ? Math.round((overlap / questionKeywords.size) * 100) : 50;

  const feedbackParts: string[] = [];
  if (wordCount < 30) feedbackParts.push("This answer is quite short — consider adding more detail on what you did and the outcome.");
  if (!hasTransition && responseSentences.length > 1) feedbackParts.push("Consider a clearer situation → action → result flow.");
  if (avgWordsPerSentence > 35) feedbackParts.push("A few sentences run long — shorter sentences read as clearer.");
  if (scoreRelevance < 40) feedbackParts.push("Try tying your answer more directly back to the question asked.");
  if (feedbackParts.length === 0) feedbackParts.push("Solid structure and length — this reads as a clear, complete answer.");

  return {
    scoreRelevance: Math.round(scoreRelevance),
    scoreClarity: Math.round(scoreClarity),
    scoreStructure: Math.round(scoreStructure),
    scoreCompleteness: Math.round(scoreCompleteness),
    feedback: feedbackParts.join(" "),
  };
}
