import React, { useState } from 'react';
import {
  TrendingUp,
  BarChart2,
  PieChart as PieChartIcon,
  Table as TableIcon,
  GitCommit,
  Compass,
  Layers,
  Maximize2,
  X,
  FileImage,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { ChartType } from '../WritingImportModal';

interface WritingTask1VisualRendererProps {
  prompt: string;
  imageUrl?: string;
  chartType?: ChartType | string;
  minWords?: number;
  className?: string;
}

// Distinctive harmonious colors for charts
const CHART_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0284c7', // Sky
  '#7c3aed', // Purple
  '#ea580c', // Orange
  '#0d9488', // Teal
];

import {
  extractMarkdownTable,
  stripMarkdownTableFromPrompt,
  detectChartType,
  type ParsedTable,
} from '../../lib/writingVisualHelper';

export {
  extractMarkdownTable,
  stripMarkdownTableFromPrompt,
  detectChartType,
  type ParsedTable,
};

export const WritingTask1VisualRenderer: React.FC<WritingTask1VisualRendererProps> = ({
  prompt,
  imageUrl,
  chartType: rawChartType,
  minWords = 150,
  className = '',
}) => {
  const [showLightbox, setShowLightbox] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ series: string; label: string; value: number | string; x: number; y: number } | null>(null);

  const parsedTable = React.useMemo(() => extractMarkdownTable(prompt), [prompt]);
  const effectiveChartType = React.useMemo(
    () => detectChartType(rawChartType, prompt, Boolean(parsedTable)),
    [rawChartType, prompt, parsedTable]
  );

  // Tab state when both uploaded image and structured chart are available
  const [activeVisualTab, setActiveVisualTab] = useState<'chart' | 'image'>(
    imageUrl && !parsedTable ? 'image' : 'chart'
  );

  // Extract structured numeric data from table if available
  const structuredData = React.useMemo(() => {
    if (!parsedTable || parsedTable.rows.length === 0) return null;

    const { headers, rows } = parsedTable;
    if (headers.length < 2) return null;

    // Check if columns 1..N are numeric series or if rows are series
    const categories: string[] = [];
    const seriesList: { name: string; values: number[] }[] = [];

    // Approach A: First column contains category names (e.g. Years or Countries)
    // Subsequent columns are series (e.g. Males, Females)
    const colSeries: { name: string; values: number[] }[] = headers.slice(1).map((h) => ({
      name: h,
      values: [],
    }));

    let canParseNumericCols = true;
    for (const row of rows) {
      categories.push(row[0]);
      for (let c = 1; c < headers.length; c++) {
        const rawVal = row[c] || '0';
        const num = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
        if (isNaN(num)) {
          canParseNumericCols = false;
          break;
        }
        colSeries[c - 1].values.push(num);
      }
    }

    if (canParseNumericCols && colSeries.length > 0 && colSeries[0].values.length > 0) {
      return {
        categories,
        series: colSeries,
        headers,
        rows,
      };
    }

    return null;
  }, [parsedTable]);

  // Fallback sample data if no markdown table was in text but a chart type was requested
  const displayData = React.useMemo(() => {
    if (structuredData) return structuredData;

    // Generate balanced IELTS demonstration dataset matching the chart type
    if (effectiveChartType === 'Line Graph') {
      return {
        categories: ['2000', '2005', '2010', '2015', '2020'],
        series: [
          { name: 'Category A', values: [25, 42, 58, 65, 80] },
          { name: 'Category B', values: [40, 38, 35, 30, 22] },
          { name: 'Category C', values: [15, 20, 28, 45, 52] },
        ],
        headers: ['Year', 'Category A', 'Category B', 'Category C'],
        rows: [
          ['2000', '25%', '40%', '15%'],
          ['2005', '42%', '38%', '20%'],
          ['2010', '58%', '35%', '28%'],
          ['2015', '65%', '30%', '45%'],
          ['2020', '80%', '22%', '52%'],
        ],
      };
    }

    if (effectiveChartType === 'Pie Chart') {
      return {
        categories: ['Residential', 'Commercial', 'Industrial', 'Transport', 'Other'],
        series: [
          { name: 'Share (%)', values: [35, 25, 20, 15, 5] },
        ],
        headers: ['Sector', 'Percentage (%)'],
        rows: [
          ['Residential', '35%'],
          ['Commercial', '25%'],
          ['Industrial', '20%'],
          ['Transport', '15%'],
          ['Other', '5%'],
        ],
      };
    }

    // Default Bar Chart / Table dataset
    return {
      categories: ['UK', 'USA', 'Australia', 'Canada', 'Germany'],
      series: [
        { name: 'Group 1', values: [45, 60, 35, 50, 40] },
        { name: 'Group 2', values: [30, 45, 55, 38, 48] },
      ],
      headers: ['Country', 'Group 1', 'Group 2'],
      rows: [
        ['UK', '45', '30'],
        ['USA', '60', '45'],
        ['Australia', '35', '55'],
        ['Canada', '50', '38'],
        ['Germany', '40', '48'],
      ],
    };
  }, [structuredData, effectiveChartType]);

  // Clean prompt without duplicated markdown table
  const cleanPrompt = React.useMemo(() => stripMarkdownTableFromPrompt(prompt), [prompt]);

  // --- RENDERERS FOR INDIVIDUAL VISUAL TYPES ---

  // 1. Structured Table Renderer
  const renderTable = (headers: string[], rows: string[][]) => (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs md:text-sm border-collapse">
          <thead>
            <tr className="bg-indigo-50/70 border-b border-indigo-100 text-indigo-950 font-bold uppercase text-[11px] tracking-wider">
              {headers.map((h, idx) => (
                <th key={idx} className="py-2.5 px-3.5 border-r border-indigo-100 last:border-r-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={rIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/50 hover:bg-slate-100/60'}
              >
                {row.map((cell, cIdx) => {
                  const isNumber = /^[0-9.,%$ -]+$/.test(cell.trim());
                  return (
                    <td
                      key={cIdx}
                      className={`py-2 px-3.5 text-slate-800 border-r border-slate-100 last:border-r-0 ${
                        cIdx === 0 ? 'font-medium' : isNumber ? 'font-mono text-right' : ''
                      }`}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 2. Line Graph SVG Renderer
  const renderLineGraph = () => {
    const { categories, series } = displayData;
    const width = 560;
    const height = 280;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find min and max value across series
    const allVals = series.flatMap((s) => s.values);
    const maxVal = Math.max(...allVals, 10);
    const minVal = Math.min(0, ...allVals);
    const valRange = maxVal - minVal || 1;

    const getY = (val: number) => padding.top + chartH - ((val - minVal) / valRange) * chartH;
    const getX = (idx: number) =>
      padding.left + (categories.length > 1 ? (idx / (categories.length - 1)) * chartW : chartW / 2);

    return (
      <div className="space-y-3">
        <div className="relative bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none font-sans">
            {/* Grid Lines & Y-Axis Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const yVal = minVal + pct * valRange;
              const yPos = getY(yVal);
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={width - padding.right}
                    y2={yPos}
                    stroke="#e2e8f0"
                    strokeDasharray={i === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={yPos + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                    className="font-mono"
                  >
                    {Math.round(yVal)}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Category Labels */}
            {categories.map((cat, i) => {
              const xPos = getX(i);
              return (
                <text
                  key={i}
                  x={xPos}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#475569"
                >
                  {cat}
                </text>
              );
            })}

            {/* Series Lines & Circles */}
            {series.map((s, sIdx) => {
              const strokeColor = CHART_COLORS[sIdx % CHART_COLORS.length];
              const points = s.values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

              return (
                <g key={sIdx}>
                  <polyline
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                  {s.values.map((v, i) => {
                    const cx = getX(i);
                    const cy = getY(v);
                    const isHovered =
                      hoveredPoint &&
                      hoveredPoint.series === s.name &&
                      hoveredPoint.label === categories[i];

                    return (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 6 : 4}
                        fill={strokeColor}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() =>
                          setHoveredPoint({
                            series: s.name,
                            label: categories[i],
                            value: v,
                            x: cx,
                            y: cy,
                          })
                        }
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* Tooltip on Hover */}
          {hoveredPoint && (
            <div
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs shadow-lg z-10 space-y-0.5"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(hoveredPoint.y / height) * 100}%`,
              }}
            >
              <div className="font-bold">{hoveredPoint.series}</div>
              <div className="text-[11px] text-slate-300">
                {hoveredPoint.label}: <span className="font-bold text-white">{hoveredPoint.value}</span>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 py-1">
          {series.map((s, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 3. Bar Chart SVG Renderer
  const renderBarChart = () => {
    const { categories, series } = displayData;
    const width = 560;
    const height = 280;
    const padding = { top: 25, right: 25, bottom: 45, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const allVals = series.flatMap((s) => s.values);
    const maxVal = Math.max(...allVals, 10);
    const minVal = 0;
    const valRange = maxVal - minVal || 1;

    const numCategories = categories.length;
    const numSeries = series.length;
    const catBandWidth = chartW / numCategories;
    const barWidth = Math.min(32, (catBandWidth * 0.75) / numSeries);
    const groupWidth = barWidth * numSeries;

    return (
      <div className="space-y-3">
        <div className="relative bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none font-sans">
            {/* Grid Lines & Y-Axis */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const yVal = minVal + pct * valRange;
              const yPos = padding.top + chartH - pct * chartH;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={width - padding.right}
                    y2={yPos}
                    stroke="#e2e8f0"
                    strokeDasharray={i === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={yPos + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                    className="font-mono"
                  >
                    {Math.round(yVal)}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {categories.map((cat, cIdx) => {
              const catCenter = padding.left + cIdx * catBandWidth + catBandWidth / 2;
              const groupStart = catCenter - groupWidth / 2;

              return (
                <g key={cIdx}>
                  {/* Category Label */}
                  <text
                    x={catCenter}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="#475569"
                  >
                    {cat}
                  </text>

                  {/* Series Bars */}
                  {series.map((s, sIdx) => {
                    const val = s.values[cIdx] || 0;
                    const barH = (val / valRange) * chartH;
                    const barX = groupStart + sIdx * barWidth;
                    const barY = padding.top + chartH - barH;
                    const barColor = CHART_COLORS[sIdx % CHART_COLORS.length];

                    return (
                      <g key={sIdx}>
                        <rect
                          x={barX}
                          y={barY}
                          width={barWidth - 2}
                          height={Math.max(2, barH)}
                          fill={barColor}
                          rx="3"
                          ry="3"
                          className="hover:opacity-85 transition-opacity cursor-pointer"
                        />
                        {/* Value label on top of bar */}
                        <text
                          x={barX + (barWidth - 2) / 2}
                          y={barY - 4}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="#475569"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        {series.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-4 py-1">
            {series.map((s, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 4. Pie Chart SVG Renderer
  const renderPieChart = () => {
    const { categories, series } = displayData;
    const values = series[0]?.values || [];
    const total = values.reduce((sum, v) => sum + v, 0) || 1;

    const width = 480;
    const height = 260;
    const cx = 150;
    const cy = 130;
    const radius = 95;

    let accumulatedAngle = 0;
    const slices = values.map((val, idx) => {
      const percentage = (val / total) * 100;
      const angle = (val / total) * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle += angle;

      // Convert angles to polar coords
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;
      const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      return {
        label: categories[idx] || `Item ${idx + 1}`,
        value: val,
        percentage: percentage.toFixed(1),
        pathData,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      };
    });

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="w-full md:w-1/2 flex justify-center">
            <svg viewBox={`0 0 300 260`} className="w-56 h-56 overflow-visible select-none font-sans">
              {slices.map((slice, idx) => (
                <path
                  key={idx}
                  d={slice.pathData}
                  fill={slice.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="hover:opacity-85 transition-opacity cursor-pointer"
                />
              ))}
              <circle cx={cx} cy={cy} r="35" fill="#ffffff" />
            </svg>
          </div>

          <div className="w-full md:w-1/2 space-y-2">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Phân bố Tỷ lệ (Breakdown)
            </h5>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {slices.map((slice, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="font-semibold text-slate-800 truncate">{slice.label}</span>
                  </div>
                  <span className="font-bold text-indigo-700 shrink-0 font-mono">
                    {slice.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 5. Process / Flow Diagram Renderer
  const renderProcessDiagram = () => {
    // Parse steps from prompt text (e.g. "Step 1: ...", "Stage 1: ...", numbered items)
    const lines = prompt.split('\n').filter((l) => l.trim().length > 0);
    const detectedSteps: { stepNum: number; title: string; desc: string }[] = [];

    let currentStep = 1;
    for (const line of lines) {
      const match = line.match(/^(?:Stage|Step|Phase|Bước)?\s*([0-9]+)[:.-]\s*(.+)/i);
      if (match) {
        detectedSteps.push({
          stepNum: parseInt(match[1], 10),
          title: match[2].trim(),
          desc: '',
        });
        currentStep++;
      } else if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        detectedSteps.push({
          stepNum: currentStep++,
          title: line.replace(/^[-*]\s*/, '').trim(),
          desc: '',
        });
      }
    }

    const steps = detectedSteps.length > 1
      ? detectedSteps
      : [
          { stepNum: 1, title: 'Thu thập nguyên liệu thô (Collection of raw materials)', desc: 'Initial raw stage' },
          { stepNum: 2, title: 'Xử lý và tinh chế nhiệt (Thermal processing & sorting)', desc: 'Purification' },
          { stepNum: 3, title: 'Đúc khuôn và định hình (Molding & shaping products)', desc: 'Manufacturing' },
          { stepNum: 4, title: 'Kiểm định chất lượng (Quality inspection & packaging)', desc: 'Quality control' },
          { stepNum: 5, title: 'Phân phối ra thị trường (Distribution to retail markets)', desc: 'Final distribution' },
        ];

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
          <GitCommit className="w-4 h-4 text-indigo-600" />
          <span>Sơ đồ quy trình / Chu trình các bước (Process Flow)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map((st, idx) => (
            <div
              key={idx}
              className="relative p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/80 transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {st.stepNum}
                </span>
                {idx < steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-indigo-400 hidden lg:block shrink-0" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                {st.title}
              </div>
              {st.desc && (
                <div className="text-[11px] text-slate-500">{st.desc}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 6. Map / Spatial Comparison Renderer
  const renderMapLayout = () => {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Compass className="w-4 h-4 text-indigo-600" />
            <span>Sơ đồ bản đồ so sánh (Map Comparison Layout)</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            <span>North ↑</span>
            <span>East →</span>
            <span>South ↓</span>
            <span>West ←</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Before / Phase 1 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase">Giai đoạn 1 / Quá khứ (Past Layout)</span>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                Baseline
              </span>
            </div>
            <div className="h-44 rounded-lg border-2 border-dashed border-slate-300 bg-white p-3 flex flex-col justify-between text-xs text-slate-600">
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-semibold text-[11px]">
                🌳 North: Khu vực cây xanh / Rừng tự nhiên (Woodland area)
              </div>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 font-semibold text-[11px] text-center">
                🏠 Central: Cụm nhà ở dân cư truyền thống (Residential homes)
              </div>
              <div className="p-2 bg-sky-50 border border-sky-200 rounded text-sky-800 font-semibold text-[11px] text-right">
                🌊 South: Đường bờ sông / Cảng cá (Riverbank & Pier)
              </div>
            </div>
          </div>

          {/* Card 2: After / Phase 2 */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase">Giai đoạn 2 / Hiện tại (Modernized Layout)</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Redeveloped
              </span>
            </div>
            <div className="h-44 rounded-lg border-2 border-dashed border-indigo-300 bg-white p-3 flex flex-col justify-between text-xs text-slate-600">
              <div className="p-2 bg-purple-50 border border-purple-200 rounded text-purple-800 font-semibold text-[11px]">
                🏢 North: Khu liên hợp văn phòng cao ốc (Commercial complex)
              </div>
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-indigo-800 font-semibold text-[11px] text-center">
                🛍️ Central: Trung tâm thương mại & Bãi đỗ xe ngầm (Shopping Mall)
              </div>
              <div className="p-2 bg-teal-50 border border-teal-200 rounded text-teal-800 font-semibold text-[11px] text-right">
                ⛵ South: Khu du lịch sinh thái bến du thuyền (Marina promenade)
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 7. Mixed Charts Renderer
  const renderMixedCharts = () => {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 flex items-center gap-2 text-xs font-bold text-indigo-950">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Biểu đồ kết hợp (Mixed Charts): Đồ thị trực quan kèm Bảng đối soát số liệu chi tiết</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>{renderBarChart()}</div>
          <div>{renderTable(displayData.headers, displayData.rows)}</div>
        </div>
      </div>
    );
  };

  // Determine main component based on effective chart type
  const renderMainVisual = () => {
    switch (effectiveChartType) {
      case 'Line Graph':
        return renderLineGraph();
      case 'Bar Chart':
        return renderBarChart();
      case 'Pie Chart':
        return renderPieChart();
      case 'Process / Diagram':
        return renderProcessDiagram();
      case 'Map':
        return renderMapLayout();
      case 'Mixed Charts':
        return renderMixedCharts();
      case 'Table':
      default:
        return renderTable(displayData.headers, displayData.rows);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header Bar showing Type Badge and Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            {effectiveChartType === 'Line Graph' && <TrendingUp className="w-4 h-4 text-indigo-600" />}
            {effectiveChartType === 'Bar Chart' && <BarChart2 className="w-4 h-4 text-emerald-600" />}
            {effectiveChartType === 'Pie Chart' && <PieChartIcon className="w-4 h-4 text-amber-600" />}
            {effectiveChartType === 'Table' && <TableIcon className="w-4 h-4 text-indigo-600" />}
            {effectiveChartType === 'Process / Diagram' && <GitCommit className="w-4 h-4 text-purple-600" />}
            {effectiveChartType === 'Map' && <Compass className="w-4 h-4 text-sky-600" />}
            {effectiveChartType === 'Mixed Charts' && <Layers className="w-4 h-4 text-indigo-600" />}
            {effectiveChartType}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            IELTS Academic Task 1
          </span>
        </div>

        {/* Toggle tabs if both diagram image and structured data exist */}
        {imageUrl && (
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveVisualTab('chart')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                activeVisualTab === 'chart'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Biểu đồ trực quan
            </button>
            <button
              type="button"
              onClick={() => setActiveVisualTab('image')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                activeVisualTab === 'image'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hình ảnh gốc
            </button>
          </div>
        )}
      </div>

      {/* Main Visual Display */}
      {activeVisualTab === 'image' && imageUrl ? (
        <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group">
          <img
            src={imageUrl}
            alt="Task 1 Visual Diagram"
            className="w-full object-contain max-h-80 mx-auto bg-white cursor-pointer"
            onClick={() => setShowLightbox(true)}
          />
          <button
            type="button"
            onClick={() => setShowLightbox(true)}
            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Phóng to</span>
          </button>
        </div>
      ) : (
        renderMainVisual()
      )}

      {/* Lightbox Modal for Full Image Zoom */}
      {showLightbox && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-2 overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              className="absolute top-3 right-3 p-1.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={imageUrl}
              alt="Zoomed diagram"
              className="max-h-[85vh] w-auto object-contain mx-auto rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
