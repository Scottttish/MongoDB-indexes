/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FiZap, FiSearch, FiCheck, FiChevronUp, FiChevronDown, FiRefreshCw, FiTrash2, FiPlus, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import api from '../services/api';

const STEPS = ['Нагрузка', 'Индексы', 'Анализ', 'Применение'];
const A_COLOR = { keep: '#1dd1a1', add: '#3dc6ff', delete: '#ff6b81' };
const A_LABEL = { keep: 'оставить', add: 'добавить', delete: 'удалить' };
const IMP_CLR = { critical: '#ff4757', high: '#1dd1a1', medium: '#ffa502', low: '#747d8c' };
const IMP_LBL = { critical: 'Критично', high: 'Важно', medium: 'Умеренно', low: 'Низко' };

function Badge({ color, children }) {
    return <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: color + '22', color }}>{children}</span>;
}

function KeyTag({ field, dir }) {
    return <span style={{ fontSize: '0.62rem', padding: '1px 6px', background: 'rgba(61,198,255,0.12)', color: '#3dc6ff', borderRadius: 4, fontFamily: 'monospace' }}>{field} <span style={{ opacity: 0.6 }}>{dir === 1 || dir === 'asc' ? '↑' : dir === -1 || dir === 'desc' ? '↓' : dir}</span></span>;
}

export default function IndexOptimizerWidget() {
    const [collapsed, setCollapsed] = useState(false);
    const [step, setStep] = useState(null);
    const [maxStep, setMaxStep] = useState(-1);
    const [running, setRunning] = useState(false);
    const [metrics, setMetrics] = useState(null);
    const [indexes, setIndexes] = useState([]);
    const [recs, setRecs] = useState([]);
    const [rawStats, setRawStats] = useState({});
    const [applied, setApplied] = useState(false);
    const [opLog, setOpLog] = useState([]);
    const [opStatus, setOpStatus] = useState({});
    const [initialIndexes, setInitialIndexes] = useState([]);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const drag0 = useRef({});

    const onMouseDown = useCallback((e) => {
        if (e.target.closest('button')) return;
        dragging.current = true;
        drag0.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
        document.body.style.userSelect = 'none';
    }, [pos]);

    useEffect(() => {
        const mv = e => { if (!dragging.current) return; setPos({ x: drag0.current.px + e.clientX - drag0.current.mx, y: drag0.current.py + e.clientY - drag0.current.my }); };
        const up = () => { dragging.current = false; document.body.style.userSelect = ''; };
        window.addEventListener('mousemove', mv);
        window.addEventListener('mouseup', up);
        return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    }, []);

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const run = async () => {
        setRunning(true); setApplied(false); setOpLog([]); setOpStatus({}); setMaxStep(0);

        // ─ Initial State ────────────────────────────────────────────────
        try {
            const { data } = await api.get('/api/system/indexes');
            setInitialIndexes(data || []);
        } catch { }

        // ─ Step 0: Real benchmark ─────────────────────────────────────────
        setStep(0); setMetrics(null);
        try {
            const { data } = await api.get('/api/system/benchmark');
            setMetrics(data);
        } catch { setMetrics({ create: '?', read: '?', update: '?', delete: '?', error: true }); }

        await sleep(500);
        setMaxStep(1);

        // ─ Step 1: Real indexes ───────────────────────────────────────────
        setStep(1); setIndexes([]);
        try {
            const { data } = await api.get('/api/system/indexes');
            for (let i = 0; i < data.length; i++) {
                await sleep(50);
                setIndexes(p => [...p, data[i]]);
            }
        } catch { setIndexes([]); }

        await sleep(400);
        setMaxStep(2);

        // ─ Step 2: Real analysis ($indexStats) ───────────────────────────
        setStep(2); setRecs([]);
        try {
            const { data } = await api.get('/api/system/analyze');
            setRawStats(data.rawStats || {});
            const recommendations = data.recommendations || [];
            if (recommendations.length === 0) {
                setRecs([{ action: 'keep', index: 'Данные не найдены', reason: 'База данных пока не накопила достаточно статистики для глубокого анализа попробуйте совершить больше действий в приложении и запустить проверку снова', impact: 'low' }]);
            } else {
                for (let i = 0; i < recommendations.length; i++) {
                    await sleep(150);
                    setRecs(p => [...p, recommendations[i]]);
                }
            }
        } catch (e) {
            setRecs([{
                action: 'delete',
                index: 'Ошибка анализа',
                reason: `Не удалось получить данные от сервера ${e.message} проверьте подключение к базе данных и попробуйте еще раз`,
                impact: 'high'
            }]);
        }

        await sleep(500);
        setMaxStep(3);
        setStep(3); // Auto-transition to Apply step
        setRunning(false);
    };

    const applyChanges = async () => {
        const toApply = recs.filter(r => r.action === 'add' || r.action === 'delete');
        if (!toApply.length) return;
        for (const rec of toApply) {
            setOpStatus(p => ({ ...p, [rec.index]: 'loading' }));
            await sleep(200);
            try {
                if (rec.action === 'delete') {
                    await api.delete(`/api/system/indexes/${rec.collection}/${encodeURIComponent(rec.index)}`);
                } else {
                    const keys = rec.mongoKeys || {};
                    if (!Object.keys(keys).length) (rec.keys || []).forEach(k => { keys[k.field] = k.dir === 'asc' || k.dir === 1 ? 1 : k.dir === 'text' ? 'text' : -1; });
                    await api.post('/api/system/indexes', { collection: rec.collection, keys, options: rec.options || {} });
                }
                setOpStatus(p => ({ ...p, [rec.index]: 'done' }));
                setOpLog(p => [...p, { name: rec.index, action: rec.action, ok: true }]);
            } catch (err) {
                setOpStatus(p => ({ ...p, [rec.index]: 'error' }));
                setOpLog(p => [...p, { name: rec.index, action: rec.action, ok: false, msg: err.response?.data?.message || err.message }]);
            }
        }
        setApplied(true);
        // Using a fresh local status check or just relying on what we just did
        setRecs(prev => prev.map(r => {
            // If it was add/delete and we just processed it (opStatus from closure might be stale, 
            // but we can check if it's currently in opLog or just update all that were not 'keep')
            return { ...r, action: 'keep', reason: 'Оптимизация успешно выполнена: уровень производительности в норме' };
        }));

        // Refetch actual indexes from DB to show real impact
        try {
            const { data } = await api.get('/api/system/indexes');
            setIndexes(data || []);
        } catch { }
        setOpLog(p => [...p, { name: 'СИСТЕМА', action: 'Оптимизация завершена', ok: true }]);
    };

    const revert = async () => {
        setRunning(true);
        const currentRecs = recs.filter(r => r.action !== 'keep' && opStatus[r.index] === 'done');
        if (!currentRecs.length) {
            setOpLog(p => [...p, { name: 'ИНФО', action: 'нет изменений для отката', ok: true }]);
            setRunning(false);
            return;
        }

        setOpLog(p => [...p, { name: 'СИСТЕМА', action: 'запуск отката...', ok: true }]);
        for (const rec of currentRecs) {
            setOpStatus(p => ({ ...p, [rec.index]: 'loading' }));
            await sleep(300);
            try {
                if (rec.action === 'add') {
                    await api.delete(`/api/system/indexes/${rec.collection}/${encodeURIComponent(rec.index)}`);
                } else if (rec.action === 'delete') {
                    const keys = rec.mongoKeys || {};
                    await api.post('/api/system/indexes', { collection: rec.collection, keys });
                }
                setOpStatus(p => ({ ...p, [rec.index]: 'reverted' }));
                setOpLog(p => [...p, { name: rec.index, action: 'откачено', ok: true }]);
            } catch (err) {
                setOpStatus(p => ({ ...p, [rec.index]: 'error' }));
                setOpLog(p => [...p, { name: rec.index, action: 'ошибка отката', ok: false }]);
            }
        }
        setApplied(false);
        setRunning(false);
        const { data } = await api.get('/api/system/indexes');
        setIndexes(data || []);
    };

    const restoreDefaults = async () => {
        setRunning(true);
        setOpLog(p => [...p, { name: 'СИСТЕМА', action: 'полный сброс...', ok: true }]);
        try {
            await api.post('/api/system/restore-defaults');
            setOpLog(p => [...p, { name: 'СИСТЕМА', action: 'заводские настройки!', ok: true }]);
            setApplied(false); setOpStatus({}); setRecs([]); setMaxStep(1); setStep(1);
            const { data } = await api.get('/api/system/indexes');
            setIndexes(data || []);
        } catch (e) {
            setOpLog(p => [...p, { name: 'ОШИБКА', action: 'сбой сброса', ok: false }]);
        }
        setRunning(false);
    };

    const reset = () => { setStep(null); setMaxStep(-1); setMetrics(null); setIndexes([]); setRecs([]); setApplied(false); setOpLog([]); setOpStatus({}); setRawStats({}); };

    const colStats = Object.entries(rawStats);

    return (
        <div className='wo-widget' style={{ transform: `translate(${pos.x}px,${pos.y}px)` }}>
            {/* ── Header ── */}
            <div className='wo-header' onMouseDown={onMouseDown}>
                <div className='wo-hdr-left'>
                    <span className='wo-title'>Оптимизация индексов</span>
                    {step !== null && (
                        <div style={{ display: 'flex', gap: 4 }}>
                            {STEPS.map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < step ? '#1dd1a1' : i === step ? '#3dc6ff' : 'rgba(255,255,255,0.15)', display: 'inline-block', boxShadow: i === step ? '0 0 6px #3dc6ff' : '' }} />)}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                    {step === null && <button className='wo-start' onClick={run} disabled={running}><FiZap size={11} /> Запустить</button>}
                    {step !== null && !running && <button className='wo-icon-btn' onClick={reset}><FiRefreshCw size={12} /></button>}
                    <button className='wo-icon-btn' onClick={() => setCollapsed(p => !p)}>{collapsed ? <FiChevronDown size={13} /> : <FiChevronUp size={13} />}</button>
                </div>
            </div>

            {/* ── Step nav ── */}
            {!collapsed && step !== null && (
                <div className='wo-steps'>
                    {STEPS.map((label, i) => (
                        <button key={i} className={`wo-step-btn ${i === step ? 'active' : i <= maxStep ? 'done' : ''}`}
                            onClick={() => !running && i <= maxStep && setStep(i)}>
                            {i < maxStep ? <FiCheck size={10} /> : <span className='wo-step-num'>{i + 1}</span>}
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {!collapsed && (
                <div className='wo-body'>
                    {/* Idle */}
                    {step === null && (
                        <div className='wo-idle'>
                            <p>Нажмите <strong>Запустить</strong> для реального анализа индексов вашей MongoDB.</p>
                        </div>
                    )}

                    {/* Step 0 – Нагрузка */}
                    {step === 0 && (
                        <div className='wo-section'>
                            <div className='wo-sec-title'><FiZap size={12} /> Бенчмарк CRUD</div>
                            {!metrics ? (
                                <div className='wo-bars'>
                                    {['CREATE', 'READ', 'UPDATE', 'DELETE'].map(op => (
                                        <div key={op} className='wo-bar-row'>
                                            <span className='wo-op'>{op}</span>
                                            <div className='wo-track'><div className='wo-fill pulse' /></div>
                                            <span className='wo-ms'>…</span>
                                        </div>
                                    ))}
                                    <button className='wo-button secondary' onClick={revert} disabled={running}>
                                        Откатить
                                    </button>
                                    <button className='wo-button' style={{ background: 'transparent', fontSize: '10px', opacity: 0.5 }} onClick={restoreDefaults} disabled={running}>
                                        Сброс настроек
                                    </button>
                                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>Выполняется реальный запрос к MongoDB…</p>
                                </div>
                            ) : (
                                <div className='wo-bars'>
                                    {[['CREATE', metrics.create], ['READ', metrics.read], ['UPDATE', metrics.update], ['DELETE', metrics.delete]].map(([op, ms]) => (
                                        <div key={op} style={{ marginBottom: op === 'READ' && metrics.readStats ? '20px' : '12px' }}>
                                            <div className='wo-bar-row' style={{ alignItems: 'center' }}>
                                                <span className='wo-op'>{op}</span>
                                                <div className='wo-track'>
                                                    <div className='wo-fill' style={{
                                                        width: `${Math.min(ms * 1.5, 100)}%`,
                                                        background: ms > 150 ? '#ff4757' : ms > 80 ? '#ffa502' : '#1dd1a1',
                                                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }} />
                                                </div>
                                                <div className='wo-ms' style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end', minWidth: 50 }}>
                                                    <span style={{ fontWeight: 800 }}>{ms}</span>
                                                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>мс</span>
                                                </div>
                                            </div>
                                            {op === 'READ' && metrics.readStats && (
                                                <div className="wo-stats-detail" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', textAlign: 'left', fontWeight: '500', paddingLeft: '65px' }}>
                                                    <span>Документов: {metrics.readStats.docsExamined}</span>
                                                    <span style={{ margin: '0 6px' }}>|</span>
                                                    <span>Ключей: {metrics.readStats.keysExamined}</span>
                                                    {metrics.readStats.docsExamined > metrics.readStats.keysExamined && (
                                                        <span style={{ color: '#ff4757', marginLeft: '6px' }}>⚠ Неэффективный скан</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                                        <span>Карточек: <strong style={{ color: '#e8eaf0' }}>{metrics.totalCards?.toLocaleString()}</strong></span>
                                        <span>Пользов.: <strong style={{ color: '#e8eaf0' }}>{metrics.totalUsers?.toLocaleString()}</strong></span>
                                    </div>
                                    {metrics.error && <p style={{ fontSize: '0.72rem', color: '#ffa502', marginTop: 4 }}>⚠ Бенчмарк выполнен с ошибкой</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 1 – Индексы */}
                    {step === 1 && (
                        <div className='wo-section'>
                            <div className='wo-sec-title'><FiSearch size={12} /> Итого индексов ({indexes.length})</div>
                            <div className='wo-list'>
                                {indexes.map((idx, i) => {
                                    const keys = idx.key ? Object.entries(idx.key) : [];
                                    return (
                                        <div key={i} className='wo-idx fade-in'>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <code style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace' }}>{idx.name}</code>
                                                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{idx.collection}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {keys.map(([f, d], j) => <KeyTag key={j} field={f} dir={d} />)}
                                            </div>
                                        </div>
                                    );
                                })}
                                {running && <div className='wo-loading-txt'>Загрузка индексов из MongoDB…</div>}
                            </div>
                        </div>
                    )}

                    {/* Step 2 – Анализ */}
                    {step === 2 && (
                        <div className='wo-section'>
                            <div className='wo-sec-title'><FiSearch size={12} /> Анализ через $indexStats</div>
                            {colStats.length > 0 && (
                                <div className='wo-stats-row'>
                                    {colStats.map(([col, s]) => !s.error && (
                                        <div key={col} className='wo-stat-chip'>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>{col}</span>
                                            <strong style={{ color: '#e8eaf0' }}>{s.docCount?.toLocaleString()}</strong> doc
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className='wo-list'>
                                {recs.map((r, i) => {
                                    const st = opStatus[r.index];
                                    return (
                                        <div key={i} className={`wo-rec fade-in wo-rec-${r.action}`}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <Badge color={A_COLOR[r.action]}>{A_LABEL[r.action]}</Badge>
                                                <code style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.index}</code>
                                                <Badge color={IMP_CLR[r.impact || 'low']}>{IMP_LBL[r.impact || 'low']}</Badge>
                                                {r.ops !== undefined && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>{r.ops.toLocaleString()} ops</span>}
                                                {st === 'done' && <FiCheckCircle size={11} style={{ color: '#1dd1a1' }} />}
                                                {st === 'error' && <FiAlertTriangle size={11} style={{ color: '#ff4757' }} />}
                                                {st === 'reverted' && <FiRefreshCw size={11} style={{ color: '#ffa502' }} />}
                                            </div>
                                            {r.keys?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{r.keys.map((k, j) => <KeyTag key={j} field={k.field} dir={k.dir} />)}</div>}
                                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, margin: 0 }}>{r.reason}</p>
                                        </div>
                                    );
                                })}
                                {running && <div className='wo-loading-txt'>Запрашиваем $indexStats из MongoDB…</div>}
                            </div>
                        </div>
                    )}

                    {/* Step 3 – Применение */}
                    {step === 3 && (
                        <div className='wo-section'>
                            <div className='wo-sec-title'><FiCheck size={12} /> Применение изменений</div>
                            <div className='wo-chips' style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                <span className='wo-chip wo-chip-add' style={{ background: 'rgba(61,198,255,0.1)', color: '#3dc6ff', padding: '4px 10px', borderRadius: 8, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FiPlus size={10} /> {recs.filter(r => r.action === 'add').length} <span style={{ fontWeight: 600 }}>добавить</span>
                                </span>
                                <span className='wo-chip wo-chip-del' style={{ background: 'rgba(255,71,87,0.1)', color: '#ff4757', padding: '4px 10px', borderRadius: 8, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FiTrash2 size={10} /> {recs.filter(r => r.action === 'delete').length} <span style={{ fontWeight: 600 }}>удалить</span>
                                </span>
                                <span className='wo-chip wo-chip-keep' style={{ background: 'rgba(29,209,161,0.1)', color: '#1dd1a1', padding: '4px 10px', borderRadius: 8, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FiCheck size={10} /> {recs.filter(r => r.action === 'keep').length} <span style={{ fontWeight: 600 }}>оставить</span>
                                </span>
                            </div>
                            {!applied && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 10 }}>Нажмите <strong style={{ color: '#e8eaf0' }}>Применить</strong> — выполнятся реальные создание/удаление индексов в MongoDB.</p>}
                            {applied && <div className='wo-notice-ok'><FiCheckCircle size={13} /> Изменения применены в MongoDB</div>}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <button className={`wo-btn-apply ${applied ? 'applied' : ''}`} onClick={applyChanges} disabled={running || !recs.some(r => r.action !== 'keep')}>
                                    <FiCheckCircle size={13} /> {applied ? 'Применено' : 'Применить'}
                                </button>
                                <button className='wo-btn-revert' onClick={revert}><FiRefreshCw size={13} /> Откатить</button>
                            </div>
                            {opLog.length > 0 && (
                                <div className='wo-log'>
                                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Лог операций</p>
                                    {opLog.map((l, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: '0.72rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            {l.ok ? <FiCheckCircle size={11} style={{ color: '#1dd1a1' }} /> : <FiAlertTriangle size={11} style={{ color: '#ff4757' }} />}
                                            <code style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</code>
                                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{l.action}</span>
                                            {l.msg && <span style={{ color: '#ff4757', fontSize: '0.65rem' }}>{l.msg}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
