/**
 * Normalize and deduplicate phone numbers.
 * Rules:
 *   - 11 digits starting with 1 → strip the leading 1, store as 10 digits
 *   - 10 digits                 → keep as-is
 *   - anything else             → discard
 * Output is always 10 digits (no leading country code).
 */
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

function normalizeAndDedupe(lines) {
  const seen = new Set()
  const result = []
  for (const line of lines) {
    // Strip all non-digits from the line, then slide a 10-digit window
    // This handles: delimited numbers, concatenated runs, mixed formats
    const digits = line.replace(/\D/g, '')

    // First try splitting on delimiters (space, comma, etc.)
    const tokens = line.split(/[\s,;|]+/)
    const fromTokens = []
    for (const token of tokens) {
      const t = token.trim().replace(/\D/g, '')
      if (t.length === 10) fromTokens.push(t)
      else if (t.length === 11 && t.startsWith('1')) fromTokens.push(t.slice(1))
    }

    if (fromTokens.length > 0) {
      // Delimited format — use token results
      for (const normalized of fromTokens) {
        if (!seen.has(normalized)) {
          seen.add(normalized)
          result.push(normalized)
        }
      }
    } else if (digits.length >= 10) {
      // Concatenated format — slide a 10-digit window across the digit string
      let i = 0
      while (i <= digits.length - 10) {
        const chunk = digits.slice(i, i + 10)
        // Valid US numbers: area code 200-999, exchange 200-999
        if (/^[2-9]\d{2}[2-9]\d{6}$/.test(chunk)) {
          if (!seen.has(chunk)) {
            seen.add(chunk)
            result.push(chunk)
          }
          i += 10 // consume this number
        } else {
          i++
        }
      }
    }
  }
  return result
}

module.exports = { normalizePhone, normalizeAndDedupe }
