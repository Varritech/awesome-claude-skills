import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { COLORS, FONT, FONT_BODY } from "./theme";

export const PunchText: React.FC<{children:React.ReactNode;delay?:number;size:number;color?:string;weight?:number;letter?:number}> =
({children,delay=0,size,color=COLORS.white,weight=800,letter=0})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  const s=spring({frame:frame-delay,fps,config:{damping:12,mass:0.6}});
  const scale=interpolate(s,[0,1],[0.7,1]);
  const op=interpolate(frame-delay,[0,6],[0,1],{extrapolateRight:"clamp"});
  return <div style={{fontFamily:FONT,fontSize:size,fontWeight:weight,color,letterSpacing:letter,lineHeight:1.02,textAlign:"center",transform:`scale(${scale})`,opacity:op,textShadow:"0 6px 30px rgba(0,0,0,0.55)",textTransform:"uppercase"}}>{children}</div>;
};

export const BarReveal: React.FC<{text:string;sub?:string;delay?:number;size?:number;barColor?:string}> =
({text,sub,delay=0,size=120,barColor="rgba(255,255,255,0.92)"})=>{
  const frame=useCurrentFrame();const f=frame-delay;
  const w=interpolate(f,[0,8],[0,100],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.out(Easing.cubic)});
  const jitter=f<14?Math.sin(f*3)*(1-f/14)*4:0;
  const textOp=interpolate(f,[4,10],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:60}}>
    <div style={{position:"relative",transform:`translateX(${jitter}px)`}}>
      <div style={{position:"absolute",top:"8%",left:"50%",transform:"translateX(-50%)",width:`${w}%`,height:"84%",minWidth:w>0?40:0,background:barColor,filter:"blur(2px)",borderRadius:4}}/>
      <div style={{position:"relative",fontFamily:FONT,fontSize:size,fontWeight:800,color:COLORS.white,letterSpacing:2,padding:"10px 40px",opacity:textOp,mixBlendMode:"difference",textTransform:"uppercase",whiteSpace:"pre-line",textAlign:"center"}}>{text}</div>
    </div>
    {sub&&<div style={{fontFamily:FONT_BODY,fontSize:44,color:"rgba(255,255,255,0.9)",opacity:interpolate(f,[12,20],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>{sub}</div>}
  </div>;
};

export const Caption: React.FC<{children:React.ReactNode;delay?:number}> = ({children,delay=0})=>{
  const frame=useCurrentFrame();
  const op=interpolate(frame-delay,[0,6],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <div style={{position:"absolute",bottom:360,width:"100%",textAlign:"center",fontFamily:FONT_BODY,fontSize:46,fontWeight:600,color:COLORS.white,textShadow:"0 3px 18px rgba(0,0,0,0.8)",opacity:op,padding:"0 60px"}}>{children}</div>;
};

export const Center: React.FC<{children:React.ReactNode;y?:number}> = ({children,y=0})=>(
  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transform:`translateY(${y}px)`,gap:18}}>{children}</div>
);
