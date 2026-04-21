# Systematic Debugging

## Core Rule
**No fixes without root cause first.** Attempting solutions before understanding causes wastes time and masks deeper issues.

## Four Phases

### Phase 1: Root Cause Investigation
- Read the full error message — don't stop at the first line
- Reproduce the issue consistently
- Identify which recent change introduced it
- Trace data flow backward from symptom to origin
- Gather diagnostic evidence at component boundaries

### Phase 2: Pattern Analysis
- Find a working example of the same pattern in the codebase
- Study the difference between working and broken code
- Identify all dependencies involved

### Phase 3: Hypothesis + Test
- Form ONE clear hypothesis about the root cause
- Test with the minimal change that proves/disproves it
- If wrong, form new hypothesis — don't stack changes

### Phase 4: Implement
- Write a failing test first (if applicable)
- Apply the single fix targeting the root cause
- Verify it works
- **If 3+ fixes attempted and still broken → question the architecture, not the code**

## Stop Signs

Stop and return to Phase 1 if you notice yourself:
- Proposing a fix without evidence
- Adding multiple changes simultaneously
- Attempting a fourth fix after three failures

## For this project (Matec Radar B2B)

Common root cause patterns:
- **TypeScript errors**: Check `npm run build` — tsc is stricter than the editor
- **React state bugs**: Check if state is URL-driven (wizard-state) vs. component-local
- **SQL NULL errors**: Check if columns can be NULL in old rows (aggregate with COALESCE)
- **API 401s**: Check `getCurrentSession()` returns non-null
- **SSE not streaming**: Check if `response.body` is being consumed before headers are sent
- **shadcn prop errors**: Check the actual Radix primitive types, not assumed props
