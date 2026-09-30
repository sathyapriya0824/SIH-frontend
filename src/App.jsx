import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";
const Badge = ({ v }) => <span className={`badge ${v}`}>{v}</span>;

export default function App() {
  const [parsers, setParsers] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [ledgerCheck, setLedgerCheck] = useState(null);
  const [file, setFile] = useState(null);
  const [drift, setDrift] = useState(0);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState(null);

  const j = async (url, opt) => {
    const r = await fetch(API + url, opt);
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  };

  const load = async () => {
    try {
      setParsers(await j("/api/parsers"));
      const ev = await j("/api/evidence");
      setEvidence(ev);
      setSelected((s) => (s && ev.find((e) => e.id === s.id)) || ev[0] || null);
      setLedger(await j("/api/ledger"));
    } catch (e) { setMsg("Backend connect aagala pa: " + e.message); }
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) return setMsg("First oru file choose pannunga pa.");
    const fd = new FormData(); fd.append("file", file);
    try {
      const rec = await j(`/api/evidence/upload?drift_seconds=${drift}`, { method: "POST", body: fd });
      setMsg(`Uploaded: ${rec.filename} (${rec.support_level})`);
      setSelected(rec); await load();
    } catch (e) { setMsg("Upload error: " + e.message); }
  };
  const verify = async (id) => {
    const r = await j(`/api/evidence/${id}/verify`, { method: "POST" });
    setMsg(r.match ? "Integrity OK: hash match" : "WARNING: hash mismatch!");
    await load();
  };
  const checkLedger = async () => setLedgerCheck(await j("/api/ledger/verify"));

  return (
    <>
      <header>
        <h1>DVR/NVR Forensic Platform — Student Prototype</h1>
        <div className="muted">SIH PS 26150 · NTRO · Only SIMULATED format is supported; real vendor formats are PLANNED.</div>
      </header>
      <main>
        <section className="card">
          <h2>Parsers</h2>
          {parsers.map((p) => <div key={p.name}>{p.name} <Badge v={p.support_level} /></div>)}
          <div className="muted" style={{ marginTop: 8 }}>
            Dahua, CP Plus, Honeywell, TP-Link, Godrej, Uniview, Hikvision, Matrix: <Badge v="PLANNED" />
          </div>
        </section>

        <section className="card">
          <h2>Evidence Upload</h2>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />{" "}
          Clock drift (s): <input type="number" value={drift} onChange={(e) => setDrift(e.target.value)} />{" "}
          <button onClick={upload}>Upload & Analyze</button>
          <div className="muted" style={{ marginTop: 8 }}>{msg}</div>
        </section>

        {selected && (
          <section className="card">
            <h2>Device & Integrity — {selected.filename} <Badge v={selected.support_level} /></h2>
            {selected.device ? (
              <table><tbody>
                {Object.entries(selected.device).map(([k, v]) => <tr key={k}><th>{k}</th><td>{String(v)}</td></tr>)}
              </tbody></table>
            ) : <div className="bad">No parser recognised this file (UNKNOWN).</div>}
            <p>MD5: <code>{selected.md5}</code><br />SHA-256: <code>{selected.sha256}</code><br />
              Size: {selected.size_bytes} bytes · Read-only lock: {String(selected.readonly)}</p>
            <button onClick={() => verify(selected.id)}>Re-verify integrity</button>
          </section>
        )}

        {selected && selected.recordings?.length > 0 && (
          <section className="card">
            <h2>Recordings & Timeline (normalised to UTC)</h2>
            <table>
              <thead><tr><th>Ch</th><th>File</th><th>Original start</th><th>UTC start</th><th>UTC end</th><th>Status</th></tr></thead>
              <tbody>{[...selected.recordings].sort((a, b) => (a.start_norm.utc || "").localeCompare(b.start_norm.utc || "")).map((r, i) => (
                <tr key={i}><td>{r.channel}</td><td>{r.file_ref}</td>
                  <td>{r.orig_start} ({r.orig_tz})</td><td>{r.start_norm.utc}</td><td>{r.end_norm.utc}</td>
                  <td className={r.is_deleted ? "bad" : "ok"}>{r.is_deleted ? "DELETED (flagged)" : "Active"}</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}

        <section className="card">
          <h2>Evidence History</h2>
          <table><tbody>{evidence.map((e) => (
            <tr key={e.id}><td>{e.id}</td><td>{e.filename}</td><td>{e.uploaded_at}</td>
              <td><button onClick={() => setSelected(e)}>View</button></td></tr>
          ))}</tbody></table>
        </section>

        <section className="card">
          <h2>Chain of Custody (hash-chained ledger)</h2>
          <button onClick={checkLedger}>Verify ledger chain</button>{" "}
          {ledgerCheck && <span className={ledgerCheck.valid ? "ok" : "bad"}>
            {ledgerCheck.valid ? "VALID" : `BROKEN at block ${ledgerCheck.broken_at}`} · {ledgerCheck.blocks} blocks · head <code>{ledgerCheck.head_hash.slice(0, 16)}…</code></span>}
          <table><thead><tr><th>#</th><th>Time</th><th>Action</th><th>Hash</th></tr></thead>
            <tbody>{ledger.map((b) => (
              <tr key={b.index}><td>{b.index}</td><td>{b.timestamp}</td><td>{b.action}</td><td><code>{b.hash.slice(0, 20)}…</code></td></tr>
            ))}</tbody></table>
          <div className="muted">Blockchain-inspired hash chain, not a distributed blockchain.</div>
        </section>
      </main>
    </>
  );
}
