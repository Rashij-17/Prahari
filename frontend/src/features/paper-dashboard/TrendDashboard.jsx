// deps: react, recharts
import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';
import { t } from '../../shared/bilingual.js';

// Custom tooltip renderer
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const statusColor = data.status === 'high' ? 'var(--color-critical)' :
                        data.status === 'low' ? 'var(--color-warning)' :
                        'var(--color-safe)';
    return (
      <div style={{
        background: 'var(--color-white)',
        border: '1.5px solid var(--color-border)',
        padding: '8px 12px',
        borderRadius: '8px',
        textAlign: 'left',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-ink)' }}>
          Value: <span style={{ color: statusColor }}>{data.value} {data.unit}</span>
        </div>
        <div style={{ fontSize: '9px', color: 'var(--color-muted)', marginTop: '2px' }}>
          Range: {data.refMin || 0} - {data.refMax || '—'}
        </div>
      </div>
    );
  }
  return null;
}

export default function TrendDashboard({ reports, lang }) {
  const [activeCategory, setActiveCategory] = useState('CBC');
  const [selectedTest, setSelectedTest] = useState(null);

  const categories = ['CBC', 'Liver', 'Kidney', 'Lipid', 'Thyroid', 'Other'];

  const getTestsInCategory = () => {
    const list = new Set();
    reports.forEach(r => {
      r.tests.forEach(t => {
        if (t.category === activeCategory) {
          list.add(t.name);
        }
      });
    });
    return Array.from(list);
  };

  const categoryTests = getTestsInCategory();

  React.useEffect(() => {
    if (categoryTests.length > 0) {
      setSelectedTest(categoryTests[0]);
    } else {
      setSelectedTest(null);
    }
  }, [activeCategory, reports]);

  const getChartData = () => {
    if (!selectedTest) return [];
    
    return reports
      .filter(r => r.tests.some(t => t.name === selectedTest))
      .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
      .map(r => {
        const test = r.tests.find(t => t.name === selectedTest);
        return {
          date: new Date(r.reportDate).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short' }),
          value: test.value,
          unit: test.unit,
          status: test.status,
          refMin: test.referenceRange.min,
          refMax: test.referenceRange.max
        };
      });
  };

  const chartData = getChartData();
  const activeTestUnit = chartData[0]?.unit || '';
  const refMin = chartData[0]?.refMin;
  const refMax = chartData[0]?.refMax;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
      
      {/* Category Tabs Row — unified pill-switcher */}
      <div style={{
        display: 'flex',
        gap: '0.375rem',
        overflowX: 'auto',
        paddingBottom: '0.25rem',
        background: 'var(--color-cream)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
      }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              background: activeCategory === cat ? 'var(--color-forest)' : 'transparent',
              border: 'none',
              color: activeCategory === cat ? '#fff' : 'var(--color-muted)',
              padding: '6px 14px',
              borderRadius: '7px',
              cursor: 'pointer',
              fontWeight: activeCategory === cat ? 700 : 500,
              fontSize: '12px',
              whiteSpace: 'nowrap',
              transition: 'all 140ms ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Biomarker chip selector */}
      {categoryTests.length > 0 ? (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          margin: '0.5rem 0'
        }}>
          {categoryTests.map(testName => (
            <button
              key={testName}
              onClick={() => setSelectedTest(testName)}
              className={selectedTest === testName ? 'chip chip-safe' : 'pill-btn'}
              style={{ cursor: 'pointer', borderRadius: '20px' }}
            >
              {testName}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--color-muted)', padding: '1rem', textAlign: 'center', fontSize: '12px' }}>
          No data available in this category.
        </div>
      )}

      {/* Line Chart Panel */}
      {selectedTest && chartData.length > 0 && (
        <div className="card" style={{ position: 'relative' }}>
          
          {/* Legend and stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-ink)', margin: 0 }}>
                {selectedTest} {lang === 'hi' ? 'रुझान' : 'Trend'}
              </h3>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--color-muted)' }}>
                {lang === 'hi' ? 'सामान्य सीमा:' : 'Normal bounds:'} {refMin ?? 0} - {refMax ?? '—'} {activeTestUnit}
              </p>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-forest)', fontFamily: 'var(--font-mono)' }}>
                {chartData[chartData.length - 1].value}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-muted)', marginLeft: '4px' }}>
                {activeTestUnit} (Latest)
              </span>
            </div>
          </div>

          {/* Recharts Container */}
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 15, right: 10, bottom: 5, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} unit={` ${activeTestUnit}`} />
                <Tooltip content={<CustomTooltip />} />
                
                {refMax !== null && refMax !== undefined && (
                  <ReferenceLine y={refMax} stroke="var(--color-critical)" strokeDasharray="6 3" label={{ value: 'Max', fill: 'var(--color-critical)', position: 'right', fontSize: 9 }} />
                )}
                {refMin !== null && refMin !== undefined && (
                  <ReferenceLine y={refMin} stroke="var(--color-warning)" strokeDasharray="6 3" label={{ value: 'Min', fill: 'var(--color-warning)', position: 'right', fontSize: 9 }} />
                )}

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-forest)"
                  strokeWidth={2.5}
                  dot={{ fill: 'var(--color-forest)', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: 'white', stroke: 'var(--color-forest)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
