import React from 'react';

export default function SkeletonCard() {
    return (
        <div className="skeleton-card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div className="skeleton skeleton-circle" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton skeleton-row" style={{ width: '70%' }} />
                    <div className="skeleton skeleton-row" style={{ width: '45%', height: 11 }} />
                </div>
            </div>
            <div className="skeleton skeleton-row" style={{ height: 32, width: '55%', borderRadius: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton skeleton-row" style={{ width: '30%', height: 22, borderRadius: 999 }} />
                <div className="skeleton skeleton-row" style={{ width: '25%', height: 11 }} />
            </div>
            <div className="skeleton" style={{ height: 36, borderRadius: 999 }} />
        </div>
    );
}
