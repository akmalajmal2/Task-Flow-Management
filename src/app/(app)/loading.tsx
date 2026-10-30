/** Shown by Next while a project or page streams in. Pure CSS shimmer, no JS. */
export default function Loading() {
  return (
    <div className="skel-board" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <div className="skeleton" style={{ height: 28 }} />
          <div className="skeleton" style={{ height: 84 }} />
          <div className="skeleton" style={{ height: 84, opacity: 0.7 }} />
          {i < 2 && <div className="skeleton" style={{ height: 84, opacity: 0.45 }} />}
        </div>
      ))}
    </div>
  );
}
