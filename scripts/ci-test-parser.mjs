export function parseTestOutput(output) {
  const tests = [...output.matchAll(/(?:^|\n)\s*(?:#|ℹ)\s+tests\s+(\d+)\b/gm)].map((match) => Number(match[1]))
  const skipped = [...output.matchAll(/(?:^|\n)\s*(?:#|ℹ)\s+skipped\s+(\d+)\b/gm)].map((match) => Number(match[1]))
  return {
    testCounts: tests,
    skippedCounts: skipped,
    totalTests: tests.reduce((total, count) => total + count, 0),
    totalSkipped: skipped.reduce((total, count) => total + count, 0),
  }
}
