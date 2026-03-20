import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FiDatabase, FiZap, FiSearch, FiCheck, FiChevronUp, FiChevronDown, FiRefreshCw, FiTrash2, FiPlus, FiCheckCircle } from 'react-icons/fi';

// ─── Mock Data ─────────────────────────────────────────────────────────────
const MOCK_EXISTING_INDEXES = [
    { name: '_id_', keys: [{ field: '_id', dir: 1 }], collection: 'paymentcards', usage: 'high' },
    { name: 'userId_1_createdAt_-1', keys: [{ field: 'userId', dir: 1 }, { field: 'createdAt', dir: -1 }], collection: 'paymentcards', usage: 'high' },
    { name: 'userId_1_category_1', keys: [{ field: 'userId', dir: 1 }, { field: 'category', dir: 1 }], collection: 'paymentcards', usage: 'medium' },
    { name: 'userId_1_status_1', keys: [{ field: 'userId', dir: 1 }, { field: 'status', dir: 1 }], collection: 'paymentcards', usage: 'medium' },
    { name: 'userId_1_amount_-1', keys: [{ field: 'userId', dir: 1 }, { field: 'amount', dir: -1 }], collection: 'paymentcards', usage: 'low' },
    { name: 'title_text_provider_text', keys: [{ field: 'title', dir: 'text' }, { field: 'provider', dir: 'text' }], collection: 'paymentcards', usage: 'medium' },
    { name: 'email_1', keys: [{ field: 'email', dir: 1 }], collection: 'users', usage: 'high' },
];

const AI_RECOMMENDATIONS = [
    {
        action: 'keep',
        index: '_id_',
        reason: 'Системный индекс MongoDB — обязателен. Обеспечивает O(log n) доступ по первичному ключу. Удаление приведёт к краху базы.',
        impact: 'critical',
    },
    {
        action: 'keep',
        index: 'userId_1_createdAt_-1',
        reason: 'Ключевой составной индекс. Используется в основном запросе (получение карточек пользователя, сортировка по дате). Покрывает 80% запросов. Без него каждый запрос вызовет COLLSCAN.',
        impact: 'high',
    },
    {
        action: 'add',
        index: 'userId_1_category_1_status_1',
        keys: [{ field: 'userId', dir: 1 }, { field: 'category', dir: 1 }, { field: 'status', dir: 1 }],
        reason: 'Текущие индексы по категории и статусу хранятся отдельно. При одновременной фильтрации (userId + category + status) MongoDB делает пересечение двух индексов. Один составной индекс ускорит такие запросы на 60-70%, не создавая лишних записей в OPLOG.',
        impact: 'high',
    },
    {
        action: 'delete',
        index: 'userId_1_category_1',
        reason: 'Будет заменён новым составным индексом userId_1_category_1_status_1. Дублирование индексов замедляет INSERT/UPDATE, так как MongoDB обновляет оба при записи. Удаление сократит overhead при CRUD-операциях на ~15%.',
        impact: 'medium',
    },
    {
        action: 'delete',
        index: 'userId_1_status_1',
        reason: 'Аналогично — будет перекрыт новым составным индексом. Раздельный индекс по статусу имеет низкую селективность (только 4 значения). Составной индекс эффективнее.',
        impact: 'medium',
    },
    {
        action: 'keep',
        index: 'userId_1_amount_-1',
        reason: 'Индекс по сумме. Нагрузка средняя — используется при сортировке. Влияние на запись минимально (~2% overhead). Рекомендуется оставить для поиска по диапазону сумм.',
        impact: 'low',
    },
    {
        action: 'keep',
        index: 'title_text_provider_text',
        reason: 'Полнотекстовый индекс для поиска. Покрывает текстовый поиск по title и provider. Без него поиск потребует COLLSCAN. Atlas Search заменит его только при переходе на Enterprise план.',
        impact: 'medium',
    },
    {
        action: 'keep',
        index: 'email_1',
        reason: 'Уникальный индекс по email пользователей. Используется при каждом логине (findOne by email). Без него аутентификация будет O(n). Обязателен к сохранению.',
        impact: 'high',
    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomBetween(a, b) { return (Math.random() * (b - a) + a).toFixed(1); }

function IndexKey({ keys }) {
    return (
        <div className='idx-keys'>
            {keys.map((k, i) => (
                <span key={i} className='idx-key'>
                    {k.field} <span className='idx-dir'>{k.dir === 1 ? '↑' : k.dir === -1 ? '↓' : k.dir}</span>
                </span>
            ))}
        </div>
    );
}

const STEP_LABELS = ['Нагрузка', 'Индексы', 'AI Анализ', 'Тестирование'];

// ─── Main Widget Component ─────────────────────────────────────────────────
export default function IndexOptimizerWidget() {
    const [collapsed, setCollapsed] = useState(false);
    const [step, setStep] = useState(null); // null | 0 | 1 | 2 | 3
    const [running, setRunning] = useState(false);
    const [crudMetrics, setCrudMetrics] = useState(null);
    const [indexes, setIndexes] = useState([]);
    const [recs, setRecs] = useState([]);
    const [applied, setApplied] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
    const widgetRef = useRef(null);

    const onMouseDown = useCallback((e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        dragging.current = true;
        dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
        document.body.style.userSelect = 'none';
    }, [pos]);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragging.current) return;
            const dx = e.clientX - dragStart.current.mx;
            const dy = e.clientY - dragStart.current.my;
            setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
        };
        const onUp = () => { dragging.current = false; document.body.style.userSelect = ''; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, []);

    const startProcess = async () => {
        setRunning(true);
        setApplied(false);

        // Step 0 – Load metrics
        setStep(0);
        setCrudMetrics(null);
        await sleep(600);
        const metrics = {
            create: +randomBetween(18, 45),
            read: +randomBetween(4, 12),
            update: +randomBetween(14, 38),
            delete: +randomBetween(9, 25),
            totalQueries: Math.floor(Math.random() * 500) + 100,
            load: +randomBetween(15, 80),
        };
        await sleep(1200);
        setCrudMetrics(metrics);

        // Step 1 – Indexes
        await sleep(800);
        setStep(1);
        setIndexes([]);
        for (let i = 0; i < MOCK_EXISTING_INDEXES.length; i++) {
            await sleep(150);
            setIndexes(prev => [...prev, MOCK_EXISTING_INDEXES[i]]);
        }

        // Step 2 – AI recommendations
        await sleep(600);
        setStep(2);
        setRecs([]);
        for (let i = 0; i < AI_RECOMMENDATIONS.length; i++) {
            await sleep(300);
            setRecs(prev => [...prev, AI_RECOMMENDATIONS[i]]);
        }

        // Step 3 – Testing
        await sleep(500);
        setStep(3);
        setRunning(false);
    };

    const handleApprove = () => {
        setApplied(true);
    };

    const handleRevert = () => {
        setApplied(false);
    };

    const actionColor = { keep: '#2ECC71', add: '#0A66C2', delete: '#E74C3C' };
    const actionLabel = { keep: 'Оставить', add: 'Добавить', delete: 'Удалить' };
    const actionIcon = { keep: <FiCheck />, add: <FiPlus />, delete: <FiTrash2 /> };

    return (
        <div
            ref={widgetRef}
            className='idx-widget'
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
            {/* Header bar */}
            <div className='idx-header' onMouseDown={onMouseDown}>
                <div className='idx-header-left'>
                    <div className='idx-logo'><FiDatabase size={16} /></div>
                    <span className='idx-title'>Index Optimizer</span>
                    {step !== null && (
                        <div className='idx-steps-mini'>
                            {STEP_LABELS.map((l, i) => (
                                <div key={i} className={`idx-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} title={l} />
                            ))}
                        </div>
                    )}
                </div>
                <div className='idx-header-right'>
                    {step === null && (
                        <button className='idx-start-btn' onClick={startProcess} disabled={running}>
                            <FiZap size={14} /> Начать
                        </button>
                    )}
                    {step !== null && !running && (
                        <button className='idx-reset-btn' onClick={() => { setStep(null); setCrudMetrics(null); setIndexes([]); setRecs([]); setApplied(false); }} title='Сбросить'>
                            <FiRefreshCw size={14} />
                        </button>
                    )}
                    <button className='idx-collapse-btn' onClick={() => setCollapsed(p => !p)}>
                        {collapsed ? <FiChevronDown size={16} /> : <FiChevronUp size={16} />}
                    </button>
                </div>
            </div>

            {/* Body */}
            {!collapsed && (
                <div className='idx-body'>
                    {step === null && (
                        <div className='idx-idle'>
                            <FiDatabase size={36} className='idx-idle-icon' />
                            <p>Нажмите <strong>Начать</strong>, чтобы запустить анализ индексов MongoDB. Процесс независим от данных сайта.</p>
                        </div>
                    )}

                    {/* Step tabs */}
                    {step !== null && (
                        <div className='idx-tabs'>
                            {STEP_LABELS.map((l, i) => (
                                <div key={i} className={`idx-tab ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                                    {i < step ? <FiCheck size={12} /> : <span>{i + 1}</span>}
                                    {l}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 0 – Load */}
                    {step === 0 && (
                        <div className='idx-section'>
                            <h4 className='idx-section-title'><FiZap /> Нагрузочный тест (CRUD)</h4>
                            {!crudMetrics ? (
                                <div className='idx-loading-bars'>
                                    {['CREATE', 'READ', 'UPDATE', 'DELETE'].map(op => (
                                        <div key={op} className='idx-bar-row'>
                                            <span className='idx-op-label'>{op}</span>
                                            <div className='idx-bar-track'><div className='idx-bar-fill animating' /></div>
                                            <span className='idx-ms-val'>…</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className='idx-metrics'>
                                    <div className='idx-metric-row'>
                                        <span>Загрузка сервера</span>
                                        <div className='idx-load-bar'>
                                            <div className='idx-load-fill' style={{ width: `${crudMetrics.load}%`, background: crudMetrics.load > 70 ? '#E74C3C' : crudMetrics.load > 40 ? '#F5A623' : '#2ECC71' }} />
                                        </div>
                                        <span className='idx-load-pct'>{crudMetrics.load}%</span>
                                    </div>
                                    {[['CREATE', crudMetrics.create], ['READ', crudMetrics.read], ['UPDATE', crudMetrics.update], ['DELETE', crudMetrics.delete]].map(([op, ms]) => (
                                        <div className='idx-bar-row' key={op}>
                                            <span className='idx-op-label'>{op}</span>
                                            <div className='idx-bar-track'>
                                                <div className='idx-bar-fill' style={{ width: `${Math.min(ms * 2, 100)}%`, background: ms > 30 ? '#E74C3C' : ms > 15 ? '#F5A623' : '#2ECC71' }} />
                                            </div>
                                            <span className='idx-ms-val'>{ms} мс</span>
                                        </div>
                                    ))}
                                    <div className='idx-stat-note'>Всего запросов за тест: <strong>{crudMetrics.totalQueries}</strong></div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 1 – Indexes */}
                    {step === 1 && (
                        <div className='idx-section'>
                            <h4 className='idx-section-title'><FiSearch /> Текущие индексы</h4>
                            <div className='idx-list'>
                                {indexes.map((idx, i) => (
                                    <div key={i} className='idx-row fade-in'>
                                        <div className='idx-row-left'>
                                            <span className='idx-name'>{idx.name}</span>
                                            <span className='idx-collection'>{idx.collection}</span>
                                        </div>
                                        <IndexKey keys={idx.keys} />
                                        <span className={`idx-usage ${idx.usage}`}>{idx.usage === 'high' ? 'Высокая' : idx.usage === 'medium' ? 'Средняя' : 'Низкая'}</span>
                                    </div>
                                ))}
                                {running && <div className='idx-loading-dot'>Загрузка индексов…</div>}
                            </div>
                        </div>
                    )}

                    {/* Step 2 – AI */}
                    {step === 2 && (
                        <div className='idx-section'>
                            <h4 className='idx-section-title'><span style={{ fontSize: 16 }}>🤖</span> AI Рекомендации</h4>
                            <div className='idx-list'>
                                {recs.map((r, i) => (
                                    <div key={i} className={`idx-rec fade-in action-${r.action}`}>
                                        <div className='idx-rec-header'>
                                            <span className='idx-rec-action' style={{ color: actionColor[r.action] }}>
                                                {actionIcon[r.action]} {actionLabel[r.action]}
                                            </span>
                                            <code className='idx-rec-name'>{r.index}</code>
                                            <span className={`idx-impact ${r.impact}`}>{r.impact}</span>
                                        </div>
                                        {r.keys && <IndexKey keys={r.keys} />}
                                        <p className='idx-rec-reason'>{r.reason}</p>
                                    </div>
                                ))}
                                {running && <div className='idx-loading-dot'>AI анализирует индексы…</div>}
                            </div>
                        </div>
                    )}

                    {/* Step 3 – Testing / Approve */}
                    {step === 3 && (
                        <div className='idx-section'>
                            <h4 className='idx-section-title'><FiCheck /> Тестирование и применение</h4>
                            <div className='idx-apply-summary'>
                                <div className='idx-apply-stat add'><FiPlus /><span>{recs.filter(r => r.action === 'add').length} добавить</span></div>
                                <div className='idx-apply-stat delete'><FiTrash2 /><span>{recs.filter(r => r.action === 'delete').length} удалить</span></div>
                                <div className='idx-apply-stat keep'><FiCheck /><span>{recs.filter(r => r.action === 'keep').length} оставить</span></div>
                            </div>

                            {applied && (
                                <div className='idx-apply-notice success'>
                                    <FiCheckCircle /> Изменения применены! Индексы оптимизированы.
                                </div>
                            )}

                            {!applied && (
                                <p className='idx-test-hint'>Нажмите <strong>Одобрить</strong>, чтобы применить изменения индексов. Кнопка <strong>Откатить</strong> всегда доступна для возврата к исходному состоянию.</p>
                            )}

                            <div className='idx-actions-row'>
                                <button className={`idx-btn-approve ${applied ? 'applied' : ''}`} onClick={handleApprove}>
                                    <FiCheckCircle size={16} /> {applied ? 'Применено' : 'Одобрить'}
                                </button>
                                <button className='idx-btn-revert' onClick={handleRevert}>
                                    <FiRefreshCw size={16} /> Откатить
                                </button>
                            </div>

                            {applied && (
                                <div className='idx-applied-list'>
                                    <p className='idx-applied-label'>Применённые изменения:</p>
                                    {recs.filter(r => r.action !== 'keep').map((r, i) => (
                                        <div key={i} className={`idx-applied-item ${r.action}`}>
                                            <span style={{ color: actionColor[r.action] }}>{actionIcon[r.action]}</span>
                                            <code>{r.index}</code>
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
