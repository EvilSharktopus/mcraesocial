const fs = require('fs');
let src = fs.readFileSync('src/WouldYouRatherBracket.jsx', 'utf8');

// Add expandedReflection state alongside expandedBracket
src = src.replace(
  `  const [expandedBracket, setExpandedBracket] = useState(null);`,
  `  const [expandedBracket, setExpandedBracket] = useState(null);
  const [expandedReflection, setExpandedReflection] = useState(null);`
);

// Replace the reflections tab content with a collapsible list
const OLD = `            {reflections.length === 0 ? (
              <div style={{ ...S.card, color: "var(--color-text-secondary)", fontSize: 14 }}>
                No reflections submitted yet.
              </div>
            ) : reflections.map(r => (
              <div key={r.studentName} style={{ ...S.card, marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "1rem" }}>{r.studentName}</div>
                {[
                  { q: "Hardest choice", a: r.hardest },
                  { q: "Best outcome", a: r.best },
                  { q: "Worst outcome", a: r.worst },
                ].map(({ q, a }) => (
                  <div key={q} style={{ marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{q}</div>
                    <div style={{ fontSize: 14, padding: "8px 12px", background: "var(--color-background-secondary)", borderRadius: 6, lineHeight: 1.5 }}>{a}</div>
                  </div>
                ))}
              </div>
            ))}`;

const NEW = `            {reflections.length === 0 ? (
              <div style={{ ...S.card, color: "var(--color-text-secondary)", fontSize: 14 }}>
                No reflections submitted yet.
              </div>
            ) : reflections.map(r => {
              const isExpanded = expandedReflection === r.studentName;
              return (
                <div key={r.studentName} style={{ ...S.card, marginBottom: "0.75rem", padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.studentName}</div>
                    <button style={{ ...S.btn, fontSize: 12 }} onClick={() => setExpandedReflection(isExpanded ? null : r.studentName)}>
                      {isExpanded ? "Hide" : "View answers"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: "1rem", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "1rem" }}>
                      {[
                        { q: "Hardest choice", a: r.hardest },
                        { q: "Best outcome", a: r.best },
                        { q: "Worst outcome", a: r.worst },
                      ].map(({ q, a }) => (
                        <div key={q} style={{ marginBottom: "0.75rem" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{q}</div>
                          <div style={{ fontSize: 14, padding: "8px 12px", background: "var(--color-background-secondary)", borderRadius: 6, lineHeight: 1.5 }}>{a}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}`;

if (!src.includes('No reflections submitted yet.')) { console.error('Reflections section not found'); process.exit(1); }
src = src.replace(OLD, NEW);
fs.writeFileSync('src/WouldYouRatherBracket.jsx', src, 'utf8');
console.log('Done.');
