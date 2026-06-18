import { useState, useEffect } from "react";
import { type CSSProperties } from "react";

const BASE_RATE: number = 0.35;
const BASE_GAS_PRICE: number = 2.50;
const IRS_RATE: number = 0.72;
 
interface LockedRate {
  rate: number;
  gasPrice: number;
  lockedOn: string;
  lockedFor: string;}
 
interface FetchedPrice {
  price: number;
  source: string;
  date: string;
}
 
function getRateColor(rate: number): string {
  if (rate < 0.35) return "#ef4444";
  if (rate < 0.50) return "#f59e0b";
  return "#22c55e";
}
 
function getMonthName(date: Date): string {
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}
 
function daysUntilReset(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
 
export default function MileageCalculator() {
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const [fetchedPrice, setFetchedPrice] = useState<FetchedPrice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [miles, setMiles] = useState<string>("");
  const [manualOverride, setManualOverride] = useState<boolean>(false);
  const [manualPrice, setManualPrice] = useState<string>("");
  const [aiSummary, setAiSummary] = useState<string>("");
  const [lockedRate, setLockedRate] = useState<LockedRate | null>(null);
  const [tab, setTab] = useState<string>("calculator");
  const [lockConfirm, setLockConfirm] = useState<boolean>(false);
 
  async function fetchGasPrice(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{
            role: "user",
            content: `Search for the current average regular unleaded gasoline price per gallon in Iowa or the Midwest US as of today ${new Date().toLocaleDateString()}. Use sources like GasBuddy, AAA, or EIA for Iowa or Midwest regional average.
Return ONLY a JSON object, no markdown, no backticks:
{"price": <number>, "source": "<source name>", "date": "<date>", "summary": "<one sentence about current Iowa/Midwest fuel price trends>"}`
          }]
        })
      });
      const data = await response.json();
      const rawText = (data.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const price = parseFloat(parsed.price);
        if (!isNaN(price) && price > 0) {
          setFetchedPrice({ price, source: parsed.source, date: parsed.date });
          setGasPrice(price);
          setAiSummary(parsed.summary || "");
        }
      }
    } catch {
      setGasPrice(3.20);
    } finally {
      setLoading(false);
    }
  }
 
  useEffect(() => {
    try {
      const stored = (window as Window & { _lockedRate?: LockedRate })._lockedRate;
      if (stored) setLockedRate(stored);
    } catch {}
    fetchGasPrice();
  }, []);
 
  const activeGasPrice: number | null = manualOverride && manualPrice
    ? parseFloat(manualPrice)
    : gasPrice;
 
  const liveRate: number = activeGasPrice
    ? Math.min(+(BASE_RATE * (activeGasPrice / BASE_GAS_PRICE)).toFixed(4), IRS_RATE)
    : BASE_RATE;
 
  const effectiveRate: number = lockedRate ? lockedRate.rate : liveRate;
  const rateColor: string = getRateColor(effectiveRate);
  const changePercent: string = (((effectiveRate - BASE_RATE) / BASE_RATE) * 100).toFixed(1);
 
  const reimbursement: string | null = miles && !isNaN(parseFloat(miles))
    ? (parseFloat(miles) * effectiveRate).toFixed(2)
    : null;
 
  function lockCurrentRate(): void {
    const newLock: LockedRate = {
      rate: liveRate,
      gasPrice: activeGasPrice ?? 0,
      lockedOn: new Date().toLocaleDateString(),
      lockedFor: getMonthName(new Date()),
    };
    setLockedRate(newLock);
    (window as Window & { _lockedRate?: LockedRate })._lockedRate = newLock;
    setLockConfirm(false);
  }
 
  function clearLock(): void {
    setLockedRate(null);
    (window as Window & { _lockedRate?: LockedRate })._lockedRate = undefined;
  }
 
  const cardStyle: CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    padding: "1.5rem",
    marginBottom: "1rem",
  };
 
  const labelStyle: CSSProperties = {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: "10px",
  };
 
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "2rem 1rem",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>
 
        {/* Header */}
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <h1 style={{ color: "#f8fafc", fontSize: "1.75rem", fontWeight: 800, margin: "0 0 0.3rem", letterSpacing: "-0.02em" }}>
            Mileage Reimbursement
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
            Iowa / Midwest regional fuel price · Locked monthly
          </p>
        </div>
 
        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem" }}>
          {["calculator", "admin"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "9px", borderRadius: "10px", border: "none",
              fontWeight: 700, fontSize: "13px", cursor: "pointer",
              background: tab === t ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.05)",
              color: tab === t ? "#60a5fa" : "#64748b",
              transition: "all 0.15s",
            }}>
              {t === "calculator" ? "🧮 Calculator" : "🔐 Admin / Lock Rate"}
            </button>
          ))}
        </div>
 
        {/* CALCULATOR TAB */}
        {tab === "calculator" && (<>
 
          <div style={{ ...cardStyle, border: `1px solid ${rateColor}50`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: rateColor }} />
 
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: lockedRate ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.12)",
              border: `1px solid ${lockedRate ? "rgba(34,197,94,0.25)" : "rgba(251,191,36,0.25)"}`,
              borderRadius: "999px", padding: "3px 10px", fontSize: "11px",
              color: lockedRate ? "#4ade80" : "#fbbf24", fontWeight: 700, marginBottom: "10px",
            }}>
              {lockedRate ? `🔒 Locked for ${lockedRate.lockedFor}` : "⚡ Live Rate (not yet locked)"}
            </div>
 
            <div style={labelStyle}>This Month's Rate</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", marginBottom: "12px" }}>
              <div style={{ color: rateColor, fontSize: "3.5rem", fontWeight: 900, lineHeight: 1 }}>
                {(effectiveRate * 100).toFixed(1)}¢
              </div>
              <div style={{ color: "#94a3b8", marginBottom: "8px" }}>per mile</div>
            </div>
 
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <div style={{
                background: parseFloat(changePercent) >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${parseFloat(changePercent) >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                borderRadius: "6px", padding: "4px 10px",
                color: parseFloat(changePercent) >= 0 ? "#4ade80" : "#f87171",
                fontSize: "12px", fontWeight: 700,
              }}>
                {parseFloat(changePercent) >= 0 ? "▲" : "▼"} {Math.abs(parseFloat(changePercent))}% vs 35¢ baseline
              </div>
              {lockedRate && (
                <div style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px", padding: "4px 10px", color: "#64748b", fontSize: "12px",
                }}>
                  Gas locked @ ${lockedRate.gasPrice.toFixed(2)}/gal
                </div>
              )}
            </div>
 
            {lockedRate && (
              <div style={{ color: "#475569", fontSize: "11px", marginTop: "10px" }}>
                Resets in {daysUntilReset()} days · Locked on {lockedRate.lockedOn}
              </div>
            )}
          </div>
 
          {/* Trip Calculator */}
          <div style={cardStyle}>
            <div style={labelStyle}>Trip Calculator</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
              <input
                type="number" min="0" placeholder="Miles driven"
                value={miles} onChange={e => setMiles(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "10px", color: "#f8fafc", fontSize: "16px",
                  padding: "12px 16px", flex: 1, outline: "none",
                }}
              />
              <span style={{ color: "#475569" }}>mi</span>
            </div>
            {reimbursement !== null && (
              <div style={{
                background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))",
                border: "1px solid rgba(59,130,246,0.25)", borderRadius: "12px",
                padding: "1.25rem", textAlign: "center",
              }}>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>You are owed</div>
                <div style={{ color: "#f8fafc", fontSize: "2.5rem", fontWeight: 900 }}>${reimbursement}</div>
                <div style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>
                  {miles} mi × {(effectiveRate * 100).toFixed(1)}¢/mi
                  {lockedRate ? ` · ${lockedRate.lockedFor} rate` : " · live rate"}
                </div>
              </div>
            )}
          </div>
 
          {/* How it works */}
          <div style={{ ...cardStyle, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ ...labelStyle, marginBottom: "8px" }}>How it works</div>
            <div style={{ color: "#64748b", fontSize: "12px", lineHeight: 1.8 }}>
              <code style={{ color: "#93c5fd", background: "rgba(59,130,246,0.1)", padding: "1px 6px", borderRadius: "4px" }}>
                rate = 35¢ × (gas_price ÷ $2.50)
              </code>
              <br />
              Rate scales with Iowa/Midwest fuel costs from the 35¢ baseline set at $2.50/gal.
              Capped at the IRS rate ({(IRS_RATE * 100).toFixed(0)}¢/mi). Admin locks the rate on the 1st of each month.
            </div>
          </div>
        </>)}
 
        {/* ADMIN TAB */}
        {tab === "admin" && (<>
 
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <div style={labelStyle}>Iowa / Midwest Avg. Gas Price</div>
                {loading
                  ? <div style={{ color: "#60a5fa", fontSize: "1.5rem", fontWeight: 700 }}>Fetching…</div>
                  : <div style={{ color: "#f8fafc", fontSize: "2rem", fontWeight: 800 }}>
                      ${activeGasPrice?.toFixed(2)}<span style={{ color: "#94a3b8", fontSize: "1rem" }}>/gal</span>
                    </div>
                }
                {fetchedPrice && !manualOverride && (
                  <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                    {fetchedPrice.source} · {fetchedPrice.date}
                  </div>
                )}
              </div>
              <button onClick={fetchGasPrice} disabled={loading} style={{
                background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)",
                borderRadius: "8px", color: "#60a5fa", fontSize: "12px", fontWeight: 600,
                padding: "6px 12px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
              }}>
                {loading ? "…" : "↻ Refresh"}
              </button>
            </div>
 
            {aiSummary && (
              <div style={{
                background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)",
                borderRadius: "8px", padding: "10px 12px", color: "#93c5fd",
                fontSize: "12px", lineHeight: 1.5, marginBottom: "1rem",
              }}>
                💡 {aiSummary}
              </div>
            )}
 
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: manualOverride ? "0.75rem" : 0 }}>
              <button onClick={() => { setManualOverride(!manualOverride); setManualPrice(""); }} style={{
                background: manualOverride ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${manualOverride ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "6px", color: manualOverride ? "#fbbf24" : "#94a3b8",
                fontSize: "12px", fontWeight: 600, padding: "5px 10px", cursor: "pointer",
              }}>
                {manualOverride ? "✎ Manual ON" : "✎ Enter Price Manually"}
              </button>
            </div>
            {manualOverride && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#94a3b8" }}>$</span>
                <input type="number" step="0.01" min="0" placeholder="e.g. 3.20"
                  value={manualPrice} onChange={e => setManualPrice(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px", color: "#f8fafc", fontSize: "14px",
                    padding: "8px 12px", width: "120px", outline: "none",
                  }}
                />
                <span style={{ color: "#64748b", fontSize: "12px" }}>per gallon</span>
              </div>
            )}
          </div>
 
          {/* Rate preview */}
          <div style={{ ...cardStyle, border: "1px solid rgba(139,92,246,0.3)" }}>
            <div style={labelStyle}>Rate if Locked Right Now</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", marginBottom: "8px" }}>
              <div style={{ color: getRateColor(liveRate), fontSize: "2.5rem", fontWeight: 900, lineHeight: 1 }}>
                {(liveRate * 100).toFixed(1)}¢
              </div>
              <div style={{ color: "#94a3b8", marginBottom: "6px" }}>per mile for {getMonthName(new Date())}</div>
            </div>
            <div style={{ color: "#64748b", fontSize: "12px" }}>
              Based on ${activeGasPrice?.toFixed(2)}/gal → 35¢ × ({activeGasPrice?.toFixed(2)} ÷ 2.50)
            </div>
          </div>
 
          {/* Lock controls */}
          {!lockedRate ? (
            <div style={cardStyle}>
              <div style={labelStyle}>Lock Monthly Rate</div>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 1rem", lineHeight: 1.6 }}>
                Locking sets <strong style={{ color: "#f8fafc" }}>{(liveRate * 100).toFixed(1)}¢/mi</strong> as the official rate for all of {getMonthName(new Date())}. Employees see this fixed rate until you lock again next month.
              </p>
              {!lockConfirm ? (
                <button onClick={() => setLockConfirm(true)} style={{
                  width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                  color: "#fff", fontSize: "15px", fontWeight: 800, cursor: "pointer",
                }}>
                  🔒 Lock Rate for {getMonthName(new Date())}
                </button>
              ) : (
                <div>
                  <p style={{ color: "#fbbf24", fontSize: "13px", marginBottom: "12px" }}>
                    Confirm: lock at <strong>{(liveRate * 100).toFixed(1)}¢/mi</strong> for all of {getMonthName(new Date())}?
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={lockCurrentRate} style={{
                      flex: 1, padding: "11px", borderRadius: "10px", border: "none",
                      background: "#22c55e", color: "#fff", fontWeight: 700, cursor: "pointer",
                    }}>✓ Confirm Lock</button>
                    <button onClick={() => setLockConfirm(false)} style={{
                      flex: 1, padding: "11px", borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                      color: "#94a3b8", fontWeight: 600, cursor: "pointer",
                    }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, border: "1px solid rgba(34,197,94,0.3)" }}>
              <div style={labelStyle}>Currently Locked</div>
              <div style={{ color: "#4ade80", fontSize: "1.5rem", fontWeight: 800, marginBottom: "4px" }}>
                {(lockedRate.rate * 100).toFixed(1)}¢/mi · {lockedRate.lockedFor}
              </div>
              <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "1rem" }}>
                Locked on {lockedRate.lockedOn} · gas was ${lockedRate.gasPrice.toFixed(2)}/gal
                <br />Resets in {daysUntilReset()} days
              </div>
              <button onClick={clearLock} style={{
                padding: "9px 18px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)",
                background: "rgba(239,68,68,0.1)", color: "#f87171",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
              }}>
                🔓 Clear Lock (revert to live rate)
              </button>
            </div>
          )}
 
          <div style={{ color: "#334155", fontSize: "11px", textAlign: "center", marginTop: "0.5rem" }}>
            Best practice: lock on the 1st of each month using the prior month's avg price
          </div>
        </>)}
 
      </div>
    </div>
  );
}