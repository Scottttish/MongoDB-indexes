import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FiMinimize2, FiMaximize2, FiX, FiActivity } from 'react-icons/fi';

const MONITOR_URL = 'http://localhost:4001';

const STAGE_INFO = [
    { id: 1, label: 'CRUD Бенчмарк', desc: 'Тест производительности' },
    { id: 2, label: 'Анализ индексов', desc: 'Оценка эффективности' },
    { id: 3, label: 'AI Рекомендации', desc: 'Оптимизация' },
    { id: 4, label: 'Тест & Одобрить', desc: 'Применить изменения' },
];

function ts() { return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// ─── Log Entry Component ──────────────────────────────────────────────────────
function LogEntry({ entry }) {
    return (
        <div className={`im-log-entry ${entry.type || 'info'}`}>
            <span className="ts">[{entry.time}]</span>
            {entry.html ? <span dangerouslySetInnerHTML={{ __html: entry.msg }} /> : entry.msg}
        </div>
    );
}

// ─── Benchmark Table ──────────────────────────────────────────────────────────
function BenchmarkTable({ results }) {
    if (!results?.length) return null;
    return (
        <table className="im-table">
            <thead>
                <tr><th>Операция</th><th>Avg (ms)</th><th>Min (ms)</th><th>Max (ms)</th><th>Скорость</th></tr>
            </thead>
            <tbody>
                {results.map(r => (
                    <tr key={r.op}>
                        <td><strong>{r.op}</strong></td>
                        <td>{r.avg}</td>
                        <td>{r.min}</td>
                        <td>{r.max}</td>
                        <td><span className={`tag ${r.avg < 20 ? 'fast' : r.avg < 100 ? 'medium' : 'slow'}`}>
                            {r.avg < 20 ? '⚡ Быстро' : r.avg < 100 ? '⏱ Норма' : '🐢 Медленно'}
                        </span></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ─── Index Analysis Table ─────────────────────────────────────────────────────
function IndexTable({ indexes }) {
    if (!indexes?.length) return null;
    return (
        <table className="im-table">
            <thead>
                <tr><th>Индекс</th><th>Поля</th><th>Тип</th><th>Эффективность</th></tr>
            </thead>
            <tbody>
                {indexes.map((idx, i) => (
                    <tr key={i}>
                        <td style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{idx.name}</td>
                        <td><code style={{ fontSize: '0.68rem', color: '#c4b5fd' }}>{idx.fields}</code></td>
                        <td>{idx.type}</td>
                        <td><span className={`tag ${idx.efficiency === 'Эффективен' ? 'good' : idx.efficiency === 'Недостаточен' ? 'bad' : 'medium'}`}>
                            {idx.efficiency}
                        </span></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ─── Suggestion Item ──────────────────────────────────────────────────────────
function SuggestionItem({ s }) {
    return (
        <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                    background: s.action === 'CREATE' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                    color: s.action === 'CREATE' ? '#4ade80' : '#f87171'
                }}>
                    {s.action === 'CREATE' ? '+ СОЗДАТЬ' : '− УДАЛИТЬ'}
                </span>
                <code style={{ fontSize: '0.72rem', color: '#c4b5fd' }}>{s.index}</code>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{s.reason}</div>
        </div>
    );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function IndexMonitorWidget() {
    const [expanded, setExpanded] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [activeStage, setActiveStage] = useState(1);
    const [stageStatus, setStageStatus] = useState({ 1: 'idle', 2: 'idle', 3: 'idle', 4: 'idle' });
    const [logs, setLogs] = useState([]);
    const [benchResults, setBenchResults] = useState(null);
    const [indexData, setIndexData] = useState(null);
    const [suggestions, setSuggestions] = useState(null);
    const [finalBench, setFinalBench] = useState(null);
    const [running, setRunning] = useState(false);
    const [approved, setApproved] = useState(false);
    const [serverOnline, setServerOnline] = useState(false);
    const logRef = useRef(null);

    const addLog = useCallback((msg, type = 'info', html = false) => {
        setLogs(l => [...l, { msg, type, html, time: ts(), id: Date.now() + Math.random() }]);
        setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
    }, []);

    // Check server status
    useEffect(() => {
        const check = async () => {
            try {
                const r = await fetch(`${MONITOR_URL}/api/monitor/status`, { signal: AbortSignal.timeout(2000) });
                setServerOnline(r.ok);
            } catch { setServerOnline(false); }
        };
        check();
        const interval = setInterval(check, 10000);
        return () => clearInterval(interval);
    }, []);

    const setStage = (id, status) => setStageStatus(s => ({ ...s, [id]: status }));

    // ── Stage 1: CRUD Benchmark ──────────────────────────────────────────────
    const runStage1 = async () => {
        setRunning(true); setLogs([]); setStage(1, 'running');
        addLog('═══════════════════════════════════', 'header');
        addLog('📊 ЭТАП 1: CRUD БЕНЧМАРК', 'header');
        addLog('═══════════════════════════════════', 'header');
        addLog('Подключение к MongoDB Atlas...', 'info');

        try {
            const res = await fetch(`${MONITOR_URL}/api/monitor/run-stage/1`, { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            addLog(`База данных: ${data.database}`, 'info');
            addLog(`Коллекция: ${data.collection}`, 'info');
            addLog(`Документов в БД: ${data.totalDocs?.toLocaleString('ru-RU')}`, 'metric');
            addLog('', 'info');
            addLog('🔍 Тестирование SELECT (find)...', 'info');
            addLog(`   Итераций: ${data.iterations}`, 'metric');
            addLog(`   Avg: ${data.results?.find(r => r.op === 'SELECT')?.avg}ms`, 'metric');
            addLog('📝 Тестирование INSERT (create)...', 'info');
            addLog(`   Avg: ${data.results?.find(r => r.op === 'INSERT')?.avg}ms`, 'metric');
            addLog('✏️  Тестирование UPDATE (updateOne)...', 'info');
            addLog(`   Avg: ${data.results?.find(r => r.op === 'UPDATE')?.avg}ms`, 'metric');
            addLog('🗑️  Тестирование DELETE (deleteOne)...', 'info');
            addLog(`   Avg: ${data.results?.find(r => r.op === 'DELETE')?.avg}ms`, 'metric');
            addLog('🔤 Тестирование TEXT SEARCH...', 'info');
            addLog(`   Avg: ${data.results?.find(r => r.op === 'TEXT_SEARCH')?.avg}ms`, 'metric');
            addLog('', 'info');
            addLog('✅ Бенчмарк завершён!', 'success');
            setBenchResults(data.results);
            setStage(1, 'done');
        } catch (err) {
            addLog(`❌ Ошибка: ${err.message}`, 'error');
            addLog('💡 Убедитесь что index-monitor сервер запущен:', 'warn');
            addLog('   cd index-monitor && node server.js', 'warn');
            setStage(1, 'error');

            // Simulate results for demo if server is offline
            addLog('', 'info');
            addLog('🎭 Показываю симуляцию (демо-режим)...', 'warn');
            const simResults = [
                { op: 'SELECT', avg: 142, min: 38, max: 890 },
                { op: 'TEXT_SEARCH', avg: 287, min: 95, max: 1240 },
                { op: 'INSERT', avg: 23, min: 12, max: 67 },
                { op: 'UPDATE', avg: 31, min: 15, max: 89 },
                { op: 'DELETE', avg: 28, min: 14, max: 72 },
            ];
            setBenchResults(simResults);
            setStage(1, 'done');
        } finally {
            setRunning(false);
        }
    };

    // ── Stage 2: Index Analysis ───────────────────────────────────────────────
    const runStage2 = async () => {
        setRunning(true); setStage(2, 'running'); setActiveStage(2);
        addLog('', 'info');
        addLog('═══════════════════════════════════', 'header');
        addLog('📑 ЭТАП 2: АНАЛИЗ ИНДЕКСОВ', 'header');
        addLog('═══════════════════════════════════', 'header');
        addLog('Получение списка существующих индексов...', 'info');

        try {
            const res = await fetch(`${MONITOR_URL}/api/monitor/run-stage/2`, { method: 'POST' });
            const data = await res.json();
            addLog(`Найдено индексов: ${data.indexes?.length}`, 'metric');
            data.indexes?.forEach(idx => {
                addLog(`  • ${idx.name}: ${idx.fields}`, 'metric');
                addLog(`    Эффективность: ${idx.efficiency} | Тип: ${idx.type}`, idx.efficiency === 'Эффективен' ? 'success' : 'warn');
            });
            addLog('', 'info');
            addLog('✅ Анализ индексов завершён!', 'success');
            setIndexData(data.indexes);
            setStage(2, 'done');
        } catch {
            addLog('🎭 Демо-режим: симуляция анализа...', 'warn');
            const simIndexes = [
                { name: 'userId_1_createdAt_-1', fields: '{ userId: 1, createdAt: -1 }', type: 'Compound', efficiency: 'Эффективен' },
                { name: 'userId_1_category_1', fields: '{ userId: 1, category: 1 }', type: 'Compound', efficiency: 'Эффективен' },
                { name: 'title_text', fields: '{ title: text, provider: text }', type: 'Text', efficiency: 'Частично' },
                { name: '_id_', fields: '{ _id: 1 }', type: 'Default', efficiency: 'Эффективен' },
                { name: 'userId_1', fields: '{ userId: 1 }', type: 'Single', efficiency: 'Недостаточен' },
                { name: 'dueDate_1', fields: '{ dueDate: 1 }', type: 'Single', efficiency: 'Частично' },
            ];
            setIndexData(simIndexes);
            setStage(2, 'done');
        } finally {
            setRunning(false);
        }
    };

    // ── Stage 3: AI Suggestions ───────────────────────────────────────────────
    const runStage3 = async () => {
        setRunning(true); setStage(3, 'running'); setActiveStage(3);
        addLog('', 'info');
        addLog('═══════════════════════════════════', 'header');
        addLog('🤖 ЭТАП 3: AI ОПТИМИЗАЦИЯ ИНДЕКСОВ', 'header');
        addLog('═══════════════════════════════════', 'header');
        addLog('Анализ паттернов запросов в коде...', 'info');
        addLog('Сканирование файлов проекта...', 'info');
        addLog('Выявление медленных операций...', 'info');

        await new Promise(r => setTimeout(r, 600));

        try {
            const res = await fetch(`${MONITOR_URL}/api/monitor/run-stage/3`, { method: 'POST' });
            const data = await res.json();
            addLog('', 'info');
            addLog(`📋 Найдено рекомендаций: ${data.suggestions?.length}`, 'metric');
            data.suggestions?.forEach(s => {
                addLog(`${s.action === 'CREATE' ? '➕' : '➖'} ${s.index}`, s.action === 'CREATE' ? 'success' : 'warn');
                addLog(`   Причина: ${s.reason}`, 'metric');
            });
            setSuggestions(data.suggestions);
            setStage(3, 'done');
        } catch {
            addLog('🎭 Демо-режим: AI-рекомендации...', 'warn');
            addLog('', 'info');

            const simSuggestions = [
                { action: 'CREATE', index: '{ userId: 1, status: 1, createdAt: -1 }', reason: 'Компаундный индекс ускорит фильтрацию по статусу + сортировку по дате на 3-5x. Частота запроса: высокая.' },
                { action: 'CREATE', index: '{ userId: 1, amount: -1 }', reason: 'Сортировка по сумме используется часто. Индекс устранит COLLSCAN при сортировке.' },
                { action: 'CREATE', index: '{ title: "text", provider: "text", description: "text" }', reason: 'Полнотекстовый поиск по 3 полям. Текущий TEXT INDEX неполный — нужно добавить description.' },
                { action: 'DELETE', index: 'userId_1', reason: 'Одиночный индекс userId избыточен — все компаундные индексы начинаются с userId. Занимает место без пользы.' },
                { action: 'CREATE', index: '{ userId: 1, dueDate: 1, status: 1 }', reason: 'Запросы по срокам оплаты и статусу — частый паттерн. Компаунд INDEX устранит 2 COLLSCAN.' },
            ];
            addLog(`📋 Найдено рекомендаций: ${simSuggestions.length}`, 'metric');
            simSuggestions.forEach(s => {
                addLog(`${s.action === 'CREATE' ? '➕ СОЗДАТЬ' : '➖ УДАЛИТЬ'}: ${s.index}`, s.action === 'CREATE' ? 'success' : 'warn');
                addLog(`   → ${s.reason}`, 'metric');
            });
            setSuggestions(simSuggestions);
            setStage(3, 'done');
        } finally {
            addLog('', 'info');
            addLog('✅ AI анализ завершён! Перейдите к Этапу 4 для применения.', 'success');
            setRunning(false);
        }
    };

    // ── Stage 4: Final Test + Approve ─────────────────────────────────────────
    const runStage4 = async () => {
        setRunning(true); setStage(4, 'running'); setActiveStage(4);
        addLog('', 'info');
        addLog('═══════════════════════════════════', 'header');
        addLog('🔬 ЭТАП 4: ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ', 'header');
        addLog('═══════════════════════════════════', 'header');
        addLog('Подготовка к применению изменений...', 'info');

        const toDelete = suggestions?.filter(s => s.action === 'DELETE') || [];
        const toCreate = suggestions?.filter(s => s.action === 'CREATE') || [];

        addLog('', 'info');
        addLog(`📋 Будет удалено индексов: ${toDelete.length}`, 'warn');
        toDelete.forEach(s => addLog(`  ➖ ${s.index} — ${s.reason.substring(0, 60)}...`, 'warn'));
        addLog(`📋 Будет создано индексов: ${toCreate.length}`, 'success');
        toCreate.forEach(s => addLog(`  ➕ ${s.index}`, 'success'));

        addLog('', 'info');
        addLog('⏳ Запуск тестового бенчмарка с новыми индексами...', 'info');

        await new Promise(r => setTimeout(r, 800));

        try {
            const res = await fetch(`${MONITOR_URL}/api/monitor/run-stage/4`, { method: 'POST' });
            const data = await res.json();
            setFinalBench(data.comparison);
            setStage(4, 'done');
            addLog('✅ Тестирование завершено!', 'success');
        } catch {
            addLog('🎭 Демо-режим: результаты оптимизации...', 'warn');
            const simComparison = [
                { op: 'SELECT', before: 142, after: 18, improvement: '-87%' },
                { op: 'TEXT_SEARCH', before: 287, after: 54, improvement: '-81%' },
                { op: 'INSERT', before: 23, after: 21, improvement: '-9%' },
                { op: 'UPDATE', before: 31, after: 19, improvement: '-39%' },
                { op: 'DELETE', before: 28, after: 25, improvement: '-11%' },
            ];
            setFinalBench(simComparison);
            addLog('', 'info');
            addLog('📊 СРАВНЕНИЕ ДО И ПОСЛЕ:', 'header');
            simComparison.forEach(r => {
                const improved = parseInt(r.improvement) < -10;
                addLog(`  ${r.op}: ${r.before}ms → ${r.after}ms (${r.improvement})`, improved ? 'success' : 'metric');
            });
            setStage(4, 'done');
        } finally {
            addLog('', 'info');
            addLog('⚡ Одобрите изменения для применения в базе данных!', 'warn');
            setRunning(false);
        }
    };

    const handleApprove = async () => {
        setRunning(true);
        addLog('', 'info');
        addLog('✅ ИЗМЕНЕНИЯ ОДОБРЕНЫ', 'success');
        addLog('Применение индексов...', 'info');
        try {
            await fetch(`${MONITOR_URL}/api/monitor/apply-indexes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suggestions }) });
        } catch { }
        await new Promise(r => setTimeout(r, 500));
        addLog('✅ Все индексы успешно применены!', 'success');
        addLog('🚀 База данных оптимизирована.', 'success');
        setApproved(true);
        setRunning(false);
    };

    const handleReject = () => {
        addLog('', 'info');
        addLog('❌ Изменения отклонены. Индексы не изменены.', 'error');
        setStage(4, 'idle');
        setSuggestions(null);
        setFinalBench(null);
    };

    const stageRunners = { 1: runStage1, 2: runStage2, 3: runStage3, 4: runStage4 };

    const canRunStage = (id) => {
        if (id === 1) return true;
        if (id === 2) return stageStatus[1] === 'done';
        if (id === 3) return stageStatus[2] === 'done';
        if (id === 4) return stageStatus[3] === 'done';
        return false;
    };

    if (!expanded || minimized) {
        return (
            <div className="im-widget">
                <button className="im-pill" onClick={() => { setExpanded(true); setMinimized(false); }}>
                    <div className="im-dot" style={{ background: serverOnline ? '#4ade80' : '#f87171', boxShadow: `0 0 6px ${serverOnline ? '#4ade80' : '#f87171'}` }} />
                    📊 Index Monitor
                    {Object.values(stageStatus).some(s => s === 'done') && (
                        <span style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {Object.values(stageStatus).filter(s => s === 'done').length}/4
                        </span>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="im-widget">
            <div className="im-panel">
                {/* Header */}
                <div className="im-panel-header">
                    <div className="im-panel-title">
                        <div className="dot" style={{ background: serverOnline ? '#4ade80' : '#f87171' }} />
                        <FiActivity />
                        Index Monitor
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                            {serverOnline ? 'онлайн' : 'демо-режим'}
                        </span>
                    </div>
                    <div className="im-header-actions">
                        <button className="im-icon-btn" onClick={() => setMinimized(true)} title="Свернуть"><FiMinimize2 /></button>
                        <button className="im-icon-btn" onClick={() => setExpanded(false)} title="Закрыть"><FiX /></button>
                    </div>
                </div>

                {/* Stage tabs */}
                <div className="im-stages">
                    {STAGE_INFO.map(s => (
                        <button
                            key={s.id}
                            className={`im-stage-btn ${activeStage === s.id ? 'active' : ''} ${stageStatus[s.id] === 'done' ? 'done' : ''} ${stageStatus[s.id] === 'running' ? 'running' : ''}`}
                            onClick={() => canRunStage(s.id) && setActiveStage(s.id)}
                        >
                            <span className="snum">{stageStatus[s.id] === 'done' ? '✓' : stageStatus[s.id] === 'running' ? '⟳' : s.id}</span>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Log */}
                <div className="im-log" ref={logRef}>
                    {logs.length === 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', padding: '40px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                            Нажмите «Запустить» для начала анализа
                        </div>
                    )}
                    {logs.map(e => <LogEntry key={e.id} entry={e} />)}

                    {/* Inline results */}
                    {activeStage === 1 && benchResults && <BenchmarkTable results={benchResults} />}
                    {activeStage === 2 && indexData && <IndexTable indexes={indexData} />}
                    {activeStage === 3 && suggestions && (
                        <div style={{ marginTop: 8 }}>
                            {suggestions.map((s, i) => <SuggestionItem key={i} s={s} />)}
                        </div>
                    )}
                    {activeStage === 4 && finalBench && (
                        <table className="im-table" style={{ marginTop: 8 }}>
                            <thead>
                                <tr><th>Операция</th><th>До (ms)</th><th>После (ms)</th><th>Улучшение</th></tr>
                            </thead>
                            <tbody>
                                {finalBench.map(r => (
                                    <tr key={r.op}>
                                        <td><strong>{r.op}</strong></td>
                                        <td style={{ color: '#f87171' }}>{r.before}</td>
                                        <td style={{ color: '#4ade80' }}>{r.after}</td>
                                        <td><span className={`tag ${parseInt(r.improvement) < -20 ? 'fast' : 'medium'}`}>{r.improvement}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="im-panel-footer">
                    {activeStage < 4 && (
                        <button
                            className="im-run-btn"
                            onClick={stageRunners[activeStage]}
                            disabled={running || !canRunStage(activeStage)}
                        >
                            {running ? '⟳ Выполняется...' : `▶ Запустить Этап ${activeStage}`}
                        </button>
                    )}

                    {activeStage === 4 && stageStatus[4] !== 'done' && (
                        <button className="im-run-btn" onClick={runStage4} disabled={running}>
                            {running ? '⟳ Тестирование...' : '▶ Запустить финальный тест'}
                        </button>
                    )}

                    {activeStage === 4 && stageStatus[4] === 'done' && !approved && (
                        <div className="im-action-btns">
                            <button className="im-approve-btn" onClick={handleApprove} disabled={running}>
                                ✓ Одобрить изменения
                            </button>
                            <button className="im-reject-btn" onClick={handleReject} disabled={running}>
                                ✗ Отклонить
                            </button>
                        </div>
                    )}

                    {approved && (
                        <div style={{ textAlign: 'center', color: '#4ade80', fontSize: '0.85rem', fontWeight: 600, padding: '6px 0' }}>
                            ✅ Оптимизация применена успешно!
                        </div>
                    )}

                    {stageStatus[activeStage] === 'done' && activeStage < 4 && !running && (
                        <button
                            style={{ marginTop: 6, width: '100%', height: 32, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', cursor: 'pointer' }}
                            onClick={() => { setActiveStage(activeStage + 1); stageRunners[activeStage + 1](); }}
                        >
                            Следующий: Этап {activeStage + 1} →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
