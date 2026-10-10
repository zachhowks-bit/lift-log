interface Props {
  onDone: () => void;
}

/** Placeholder — built in Task 9. Routable so a finished block can open it. */
export default function CheckIn({ onDone }: Props) {
  return (
    <main className="screen">
      <h1 className="app-title">Block check-in</h1>
      <p className="hint">Check-in is coming soon.</p>
      <button type="button" className="btn btn-primary" onClick={onDone}>Back to home</button>
    </main>
  );
}
