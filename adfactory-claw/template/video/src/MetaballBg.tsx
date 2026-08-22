import React from "react";
import { useCurrentFrame } from "remotion";
type Blob={x:number;y:number;r:number;speed:number;phase:number};
const make=(n:number,seed:number):Blob[]=>{const o:Blob[]=[];let s=seed;const r=()=>{s=(s*9301+49297)%233280;return s/233280;};for(let i=0;i<n;i++)o.push({x:r()*1080,y:r()*1920,r:140+r()*320,speed:0.3+r()*0.9,phase:r()*Math.PI*2});return o;};
export const MetaballBg: React.FC<{base:string;blob:string;blob2?:string;seed?:number;count?:number}> =
({base,blob,blob2,seed=7,count=8})=>{
  const frame=useCurrentFrame();const blobs=make(count,seed);const t=frame/30;
  return <div style={{position:"absolute",inset:0,background:base}}>
    <svg width="1080" height="1920" style={{position:"absolute",inset:0}}>
      <defs>
        <filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="40" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter>
        <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0%" stopColor={blob2??blob} stopOpacity="0.55"/><stop offset="100%" stopColor={base} stopOpacity="0"/></radialGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#bg)"/>
      <g filter="url(#goo)">{blobs.map((b,i)=>{const dx=Math.sin(t*b.speed+b.phase)*90;const dy=Math.cos(t*b.speed*0.8+b.phase)*110;const pr=b.r*(0.9+0.12*Math.sin(t*b.speed*1.3+b.phase));return <circle key={i} cx={b.x+dx} cy={b.y+dy} r={pr} fill={i%3===0&&blob2?blob2:blob}/>;})}</g>
    </svg>
  </div>;
};
