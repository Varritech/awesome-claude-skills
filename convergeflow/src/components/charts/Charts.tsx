"use client";

import { useEffect, useState } from "react";

/* ─── Ring Progress (single ring with percentage) ─── */
interface RingProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  className?: string;
}

export function RingProgress({
  percentage,
  size = 72,
  strokeWidth = 5,
  color = "#D4E4DD",
  bgColor = "#222228",
  label,
  className = "",
}: RingProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2 + 5}
          textAnchor="middle"
          fill="#fff"
          fontSize={size * 0.19}
          fontWeight={700}
          fontFamily="var(--font-jetbrains), 'JetBrains Mono', monospace"
        >
          {percentage}%
        </text>
      </svg>
      {label && (
        <p className="text-[11px] text-white/20 mt-2">{label}</p>
      )}
    </div>
  );
}

/* ─── Donut Chart (segmented ring) ─── */
interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
  className?: string;
}

export function DonutChart({
  segments,
  size = 100,
  strokeWidth = 10,
  centerLabel,
  centerSublabel,
  className = "",
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let currentOffset = 0;
  const arcs = segments.map((segment) => {
    const segmentLength = (segment.value / total) * circumference;
    const gap = 3;
    const arc = {
      ...segment,
      dashArray: `${segmentLength - gap} ${circumference - segmentLength + gap}`,
      dashOffset: -currentOffset,
    };
    currentOffset += segmentLength;
    return arc;
  });

  return (
    <div className={`relative ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#222228"
          strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
        {centerLabel && (
          <text
            x={size / 2}
            y={size / 2 + 5}
            textAnchor="middle"
            fill="#fff"
            fontSize={size * 0.16}
            fontWeight={700}
            fontFamily="var(--font-jetbrains), 'JetBrains Mono', monospace"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      {centerSublabel && (
        <p className="text-[11px] text-white/20 text-center mt-1">{centerSublabel}</p>
      )}
    </div>
  );
}

/* ─── Gauge (half-arc with needle) ─── */
interface GaugeProps {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
  statusText?: string;
  className?: string;
}

export function Gauge({
  value,
  max = 100,
  size = 130,
  color = "#B8D8CA",
  label,
  statusText,
  className = "",
}: GaugeProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const centerX = size / 2;
  const centerY = size - 10;
  const startAngle = Math.PI;
  const endAngle = 0;

  // Calculate needle angle (0 = left, PI = right)
  const percentage = value / max;
  const needleAngle = startAngle - percentage * (startAngle - endAngle);
  const needleLength = radius * 0.7;
  const needleEndX = centerX + needleLength * Math.cos(needleAngle);
  const needleEndY = centerY - needleLength * Math.sin(needleAngle);

  // Arc path
  const arcPath = (radius: number, startAngle: number, endAngle: number) => {
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY - radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY - radius * Math.sin(endAngle);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  // Calculate dash for filled portion
  const totalArcLength = Math.PI * radius;
  const filledLength = percentage * totalArcLength;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        {/* Background arc */}
        <path
          d={arcPath(radius, startAngle, endAngle)}
          fill="none"
          stroke="#222228"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={arcPath(radius, startAngle, endAngle)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={totalArcLength}
          strokeDashoffset={totalArcLength - filledLength}
        />
        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleEndX}
          y2={needleEndY}
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r={3} fill="#fff" />
        {/* Min/Max labels */}
        <text x="12" y={size * 0.58} fill="rgba(255,255,255,0.15)" fontSize="9" fontFamily="var(--font-jetbrains), 'JetBrains Mono', monospace">
          0
        </text>
        <text x={size - 28} y={size * 0.58} fill="rgba(255,255,255,0.15)" fontSize="9" fontFamily="var(--font-jetbrains), 'JetBrains Mono', monospace">
          {max}
        </text>
      </svg>
      <p className="text-2xl font-bold mt-2 font-mono">{value}%</p>
      {statusText && <p className="text-[11px] text-white/20">{statusText}</p>}
      {label && <p className="text-sm font-bold mt-1 font-heading">{label}</p>}
    </div>
  );
}

/* ─── Bar Chart ─── */
interface BarData {
  label: string;
  value: number;
  isHighlighted?: boolean;
}

interface BarChartProps {
  data: BarData[];
  className?: string;
}

export function BarChart({ data, className = "" }: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const chartHeight = 130;
  const barWidth = 20;

  return (
    <div className={className}>
      <div className="flex items-end justify-between" style={{ height: chartHeight + 24 }}>
        {data.map((bar, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <div className="relative">
              {bar.isHighlighted && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-cf-card text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                  {bar.value}
                </div>
              )}
              <div
                className="rounded-md transition-colors"
                style={{
                  width: barWidth,
                  height: `${(bar.value / maxValue) * chartHeight}px`,
                  background: bar.isHighlighted ? "#F97316" : "#222228",
                }}
              />
            </div>
            <div
              className={`w-[5px] h-[5px] rounded-full ${
                bar.isHighlighted || bar.value > 0 ? "bg-cf-orange" : "bg-white/10"
              }`}
            />
            <span className="text-[10px] text-white/15">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Sparkline ─── */
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 48,
  height = 24,
  color = "#F97316",
  className = "",
}: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  // Smooth curve approximation
  let smoothPath = `M ${points[0]}`;
  for (let i = 1; i < points.length; i++) {
    const [prevX, prevY] = points[i - 1].split(",").map(Number);
    const [currX, currY] = points[i].split(",").map(Number);
    const midX = (prevX + currX) / 2;
    smoothPath += ` C ${midX},${prevY} ${midX},${currY} ${currX},${currY}`;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      <path
        d={smoothPath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Mini ring for metric cards ─── */
interface MiniRingProps {
  percentage: number;
  size?: number;
  color?: string;
  label?: string;
  className?: string;
}

export function MiniRing({
  percentage,
  size = 48,
  color = "#F97316",
  label,
  className = "",
}: MiniRingProps) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#222228"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {label && (
        <text
          x={size / 2}
          y={size / 2 + 4}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.2}
          fontWeight={700}
          fontFamily="var(--font-jetbrains), 'JetBrains Mono', monospace"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

/* ─── Animated counter ─── */
interface AnimatedCounterProps {
  target: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  target,
  duration = 1000,
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return (
    <span className={className}>
      {prefix}{count}{suffix}
    </span>
  );
}