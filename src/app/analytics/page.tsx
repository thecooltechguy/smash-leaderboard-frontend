export default function Analytics() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <iframe
        src="/analytics/index.html"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Analytics Dashboard"
      />
    </div>
  );
}
