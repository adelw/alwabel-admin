// src/pages/AiArena.jsx
// ساحة النماذج — مقارنة نماذج AI مباشرة مع حساب التكلفة والسرعة
import { useState, useRef, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════
// النماذج والأسعار (مارس 2026)
// ═══════════════════════════════════════════════════
const MODELS = [
  { id: 'claude-opus',   name: 'Claude Opus 4.6',   company: 'Anthropic', color: '#c9a84c', apiGroup: 'anthropic', model: 'claude-opus-4-6-20250514',   priceIn: 5,    priceOut: 25 },
  { id: 'claude-sonnet', name: 'Claude Sonnet 4.6',  company: 'Anthropic', color: '#e5cb78', apiGroup: 'anthropic', model: 'claude-sonnet-4-6-20250514', priceIn: 3,    priceOut: 15 },
  { id: 'claude-haiku',  name: 'Claude Haiku 4.5',   company: 'Anthropic', color: '#8B7355', apiGroup: 'anthropic', model: 'claude-haiku-4-5-20251001',  priceIn: 1,    priceOut: 5 },
  { id: 'gpt-5',         name: 'GPT-5.2',            company: 'OpenAI',    color: '#10a37f', apiGroup: 'openai',    model: 'gpt-4o',                     priceIn: 1.75, priceOut: 14 },
  { id: 'gpt-4.1',       name: 'GPT-4.1',            company: 'OpenAI',    color: '#1a7f5a', apiGroup: 'openai',    model: 'gpt-4.1',                    priceIn: 2,    priceOut: 8 },
  { id: 'gemini-pro',    name: 'Gemini 2.5 Pro',     company: 'Google',    color: '#4285f4', apiGroup: 'google',    model: 'gemini-2.5-pro',             priceIn: 1.25, priceOut: 10 },
  { id: 'gemini-flash',  name: 'Gemini 2.5 Flash',   company: 'Google',    color: '#7baaf7', apiGroup: 'google',    model: 'gemini-2.5-flash-preview-05-20', priceIn: 0.15, priceOut: 0.60 },
  { id: 'grok-4',        name: 'Grok 4',             company: 'xAI',       color: '#ef4444', apiGroup: 'xai',       model: 'grok-4',                    priceIn: 2,    priceOut: 15 },
];

const API_GROUPS = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  openai:    { label: 'OpenAI',    placeholder: 'sk-...' },
  google:    { label: 'Google AI', placeholder: 'AIza...' },
  xai:       { label: 'xAI (Grok)',placeholder: 'xai-...' },
};

const ENDPOINT = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai:    'https://api.openai.com/v1/chat/completions',
  google:    'https://generativelanguage.googleapis.com/v1beta/models/',
  xai:       'https://api.x.ai/v1/chat/completions',
};

// ═══════════════════════════════════════════════════
// حساب التكلفة
// ═══════════════════════════════════════════════════
function calcCost(model, inputTokens, outputTokens) {
  const m = MODELS.find(x => x.id === model);
  if (!m) return 0;
  return (inputTokens * m.priceIn / 1_000_000) + (outputTokens * m.priceOut / 1_000_000);
}

function formatCost(cost) {
  if (cost < 0.0001) return '< $0.0001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

// ═══════════════════════════════════════════════════
// API Calls
// ═══════════════════════════════════════════════════
async function callModel(m, text, apiKey) {
  if (m.apiGroup === 'anthropic') {
    const res = await fetch(ENDPOINT.anthropic, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: m.model, max_tokens: 1024, messages: [{ role: 'user', content: text }] })
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0,100)}`);
    const data = await res.json();
    return {
      text: data.content?.[0]?.text || 'لا يوجد رد',
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  }

  if (m.apiGroup === 'openai' || m.apiGroup === 'xai') {
    const endpoint = m.apiGroup === 'xai' ? ENDPOINT.xai : ENDPOINT.openai;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: m.model, max_tokens: 1024, messages: [{ role: 'user', content: text }] })
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0,100)}`);
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || 'لا يوجد رد',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }

  if (m.apiGroup === 'google') {
    const url = `${ENDPOINT.google}${m.model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { maxOutputTokens: 1024 } })
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0,100)}`);
    const data = await res.json();
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || 'لا يوجد رد',
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    };
  }

  throw new Error('مزوّد غير مدعوم');
}

// ═══════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════
export default function AiArena() {
  const [activeModels, setActiveModels] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('arena_active2') || '[]')); } catch { return new Set(); }
  });
  const [apiKeys, setApiKeys] = useState(() => {
    try { return JSON.parse(localStorage.getItem('arena_keys2') || '{}'); } catch { return {}; }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [sessionStats, setSessionStats] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('arena_active2', JSON.stringify([...activeModels]));
      localStorage.setItem('arena_keys2', JSON.stringify(apiKeys));
    } catch {}
  }, [activeModels, apiKeys]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleModel = useCallback((id) => {
    setActiveModels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });
  }, []);

  const updateApiKey = useCallback((group, value) => {
    setApiKeys(prev => ({ ...prev, [group]: value.trim() }));
  }, []);

  // ── إرسال رسالة ──
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!activeModels.size) return alert('اختر نموذج واحد على الأقل');

    setSending(true);
    setInput('');

    const models = [...activeModels].map(id => MODELS.find(x => x.id === id)).filter(Boolean);
    const msgId = Date.now();

    // أضف الرسالة مع حالة loading
    const newMsg = {
      id: msgId,
      user: text,
      responses: models.map(m => ({ modelId: m.id, status: 'loading', text: '', time: 0, inputTokens: 0, outputTokens: 0, cost: 0 })),
    };
    setMessages(prev => [...prev, newMsg]);

    // أرسل لكل النماذج بالتوازي
    const promises = models.map(async (m, idx) => {
      const start = performance.now();
      try {
        const key = apiKeys[m.apiGroup];
        if (!key) throw new Error('مفتاح API مفقود');
        const result = await callModel(m, text, key);
        const elapsed = (performance.now() - start) / 1000;
        const cost = calcCost(m.id, result.inputTokens, result.outputTokens);

        setMessages(prev => prev.map(msg => {
          if (msg.id !== msgId) return msg;
          const responses = [...msg.responses];
          responses[idx] = { modelId: m.id, status: 'done', text: result.text, time: elapsed, inputTokens: result.inputTokens, outputTokens: result.outputTokens, cost };
          return { ...msg, responses };
        }));

        // تحديث إحصائيات الجلسة
        setSessionStats(prev => {
          const s = prev[m.id] || { totalCost: 0, totalIn: 0, totalOut: 0, count: 0 };
          return { ...prev, [m.id]: { totalCost: s.totalCost + cost, totalIn: s.totalIn + result.inputTokens, totalOut: s.totalOut + result.outputTokens, count: s.count + 1 } };
        });
      } catch (err) {
        const elapsed = (performance.now() - start) / 1000;
        setMessages(prev => prev.map(msg => {
          if (msg.id !== msgId) return msg;
          const responses = [...msg.responses];
          responses[idx] = { modelId: m.id, status: 'error', text: err.message, time: elapsed, inputTokens: 0, outputTokens: 0, cost: 0 };
          return { ...msg, responses };
        }));
      }
    });

    await Promise.allSettled(promises);
    setSending(false);
  }, [input, sending, activeModels, apiKeys]);

  // ═══════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════
  const totalSessionCost = Object.values(sessionStats).reduce((sum, s) => sum + s.totalCost, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0f', color: '#e8e6e3', fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #c9a84c, #e5cb78)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚔</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}><span style={{ color: '#c9a84c' }}>ساحة</span> النماذج</span>
        </div>
        <div style={{ flex: 1 }} />

        {/* إحصائيات الجلسة */}
        {totalSessionCost > 0 && (
          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'monospace', direction: 'ltr' }}>
            <span style={{ color: '#c9a84c' }}>الجلسة: {formatCost(totalSessionCost)}</span>
            <span style={{ color: '#5a5550' }}>|</span>
            <span style={{ color: '#9a9590' }}>لو 1000 رسالة: {formatCost(totalSessionCost / Object.values(sessionStats).reduce((s, x) => Math.max(s, x.count), 1) * 1000)}</span>
          </div>
        )}

        <button onClick={() => setShowKeys(!showKeys)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: showKeys ? '#c9a84c' : '#1a1a25', color: showKeys ? '#0a0a0f' : '#e8e6e3', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showKeys ? 'إخفاء المفاتيح' : 'مفاتيح API'}
        </button>
        <button onClick={() => { setMessages([]); setSessionStats({}); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: '#1a1a25', color: '#e8e6e3', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          مسح
        </button>
      </div>

      {/* API Keys Panel */}
      {showKeys && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#12121a', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(API_GROUPS).map(([group, info]) => (
            <div key={group} style={{ flex: '1 1 200px', minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: apiKeys[group] ? '#22c55e' : '#ef4444' }} />
                <span style={{ fontSize: 11, color: '#9a9590' }}>{info.label}</span>
              </div>
              <input type="password" placeholder={info.placeholder} value={apiKeys[group] || ''}
                onChange={e => updateApiKey(group, e.target.value)}
                onFocus={e => e.target.type = 'text'} onBlur={e => e.target.type = 'password'}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: '#0a0a0f', color: '#e8e6e3', fontFamily: 'monospace', fontSize: 11, direction: 'ltr' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Models Strip */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#5a5550', marginLeft: 8 }}>النماذج:</span>
        {MODELS.map(m => {
          const active = activeModels.has(m.id);
          const hasKey = !!apiKeys[m.apiGroup];
          return (
            <button key={m.id} onClick={() => hasKey && toggleModel(m.id)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: hasKey ? 'pointer' : 'not-allowed',
                border: `1px solid ${active ? m.color + '60' : 'rgba(255,255,255,0.08)'}`,
                background: active ? m.color + '15' : 'transparent',
                color: active ? m.color : hasKey ? '#9a9590' : '#3a3530',
                fontFamily: 'inherit', opacity: hasKey ? 1 : 0.35, transition: 'all 0.15s',
              }}>
              {m.name}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {!messages.length && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5a5550', fontSize: 14 }}>
                اختر النماذج وأدخل مفاتيح API ثم ابدأ المحادثة
              </div>
            )}

            {messages.map(msg => {
              const doneResponses = msg.responses.filter(r => r.status === 'done');
              const fastest = doneResponses.length > 1 ? doneResponses.reduce((a, b) => a.time < b.time ? a : b) : null;

              return (
                <div key={msg.id} style={{ marginBottom: 28 }}>
                  {/* رسالة المستخدم */}
                  <div style={{ background: '#1a1a25', padding: '10px 16px', borderRadius: 12, maxWidth: '65%', marginRight: 'auto', marginBottom: 14, fontSize: 14, lineHeight: 1.7 }}>
                    {msg.user}
                  </div>

                  {/* ردود النماذج */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${msg.responses.length <= 2 ? '380px' : '280px'}, 1fr))`, gap: 10 }}>
                    {msg.responses.map(r => {
                      const m = MODELS.find(x => x.id === r.modelId);
                      const isFastest = fastest && fastest.modelId === r.modelId;
                      return (
                        <div key={r.modelId} style={{
                          background: '#15151f', border: `1px solid ${r.status === 'error' ? 'rgba(239,68,68,0.3)' : isFastest ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: 12, padding: '12px 14px', minHeight: 80,
                        }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 7, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{m.name}</span>
                            {isFastest && <span style={{ fontSize: 9, color: '#22c55e', marginRight: 'auto', fontWeight: 600 }}>الأسرع</span>}
                            <span style={{ marginRight: isFastest ? 0 : 'auto' }} />
                            {r.status === 'done' && (
                              <span style={{ fontSize: 10, color: isFastest ? '#22c55e' : '#5a5550', fontFamily: 'monospace', direction: 'ltr' }}>
                                {r.time.toFixed(2)}s
                              </span>
                            )}
                          </div>

                          {/* Body */}
                          {r.status === 'loading' && (
                            <div style={{ color: '#5a5550', fontSize: 18 }}>
                              <span style={{ animation: 'blink 1.4s infinite' }}>.</span>
                              <span style={{ animation: 'blink 1.4s infinite 0.2s' }}>.</span>
                              <span style={{ animation: 'blink 1.4s infinite 0.4s' }}>.</span>
                            </div>
                          )}
                          {r.status === 'done' && (
                            <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e8e6e3' }}>
                              {r.text}
                            </div>
                          )}
                          {r.status === 'error' && (
                            <div style={{ fontSize: 12, color: '#ef4444' }}>خطأ: {r.text}</div>
                          )}

                          {/* Stats */}
                          {r.status === 'done' && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                              <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', background: '#1a1a25', color: '#9a9590', direction: 'ltr' }}>
                                {r.inputTokens}↓ {r.outputTokens}↑
                              </span>
                              <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', background: '#1a1a25', color: '#c9a84c', direction: 'ltr' }}>
                                {formatCost(r.cost)}
                              </span>
                              <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', background: '#1a1a25', color: '#5a5550', direction: 'ltr' }}>
                                1K msg ≈ {formatCost(r.cost * 1000)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="اكتب رسالتك هنا..."
                rows={1}
                style={{ flex: 1, resize: 'none', padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: '#12121a', color: '#e8e6e3', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, minHeight: 46, maxHeight: 120, direction: 'rtl' }}
              />
              <button onClick={sendMessage} disabled={sending || !input.trim()}
                style={{ width: 46, height: 46, borderRadius: 12, background: sending ? '#3a3530' : '#c9a84c', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#0a0a0f" style={{ transform: 'rotate(180deg)' }}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Session Stats Sidebar */}
        {Object.keys(sessionStats).length > 0 && (
          <div style={{ width: 240, borderRight: '1px solid rgba(255,255,255,0.06)', padding: 16, overflow: 'auto', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#5a5550', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>إحصائيات الجلسة</div>

            {/* الإجمالي */}
            <div style={{ background: '#15151f', borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: '1px solid rgba(201,168,76,0.2)' }}>
              <div style={{ fontSize: 10, color: '#9a9590', marginBottom: 4 }}>إجمالي التكلفة</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#c9a84c', fontFamily: 'monospace', direction: 'ltr' }}>{formatCost(totalSessionCost)}</div>
              <div style={{ fontSize: 10, color: '#5a5550', marginTop: 4 }}>
                {Object.values(sessionStats).reduce((s, x) => s + x.count, 0)} رسالة
              </div>
            </div>

            {/* لكل نموذج */}
            {[...activeModels].map(id => {
              const m = MODELS.find(x => x.id === id);
              const s = sessionStats[id];
              if (!m || !s) return null;
              return (
                <div key={id} style={{ background: '#15151f', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: m.color }}>{m.name}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 10, fontFamily: 'monospace', direction: 'ltr' }}>
                    <span style={{ color: '#5a5550' }}>تكلفة</span>
                    <span style={{ color: '#c9a84c' }}>{formatCost(s.totalCost)}</span>
                    <span style={{ color: '#5a5550' }}>إدخال</span>
                    <span style={{ color: '#9a9590' }}>{s.totalIn.toLocaleString()}</span>
                    <span style={{ color: '#5a5550' }}>إخراج</span>
                    <span style={{ color: '#9a9590' }}>{s.totalOut.toLocaleString()}</span>
                    <span style={{ color: '#5a5550' }}>رسائل</span>
                    <span style={{ color: '#9a9590' }}>{s.count}</span>
                    <span style={{ color: '#5a5550' }}>1K msg</span>
                    <span style={{ color: '#e5cb78' }}>{formatCost(s.totalCost / s.count * 1000)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </div>
  );
}
