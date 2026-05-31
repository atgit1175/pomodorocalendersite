import { useState, useEffect, useRef, useCallback } from "react";

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
const SLOT_H = 64;
const CAL_START = 7;

const POMO_COLORS = [
  "#8b63e8","#f7864f","#6dbf7a","#c96de3","#e06b6b",
  "#5cc8c8","#e3c56d","#a07af5","#f7c14f","#b48af5"
];
const POMO_COLORS_DARK = [
  "#6a48c4","#c4682d","#4a9a56","#a050ba","#b84f4f",
  "#3da0a0","#b09840","#7d55cc","#c49830","#8c68cc"
];

function fmt(s) {
  return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
}
function fmtHour(h) {
  if (h===12) return "12 PM"; if (h>12) return `${h-12} PM`; return `${h} AM`;
}
function timeToY(date) {
  return (date.getHours() + date.getMinutes()/60 - CAL_START) * SLOT_H;
}
function blockH(b) {
  const end = b.endTime || new Date();
  return Math.max((end - b.startTime)/60000 * (SLOT_H/60), 22);
}

function PieTimer({ progress, isWork, size, dark }) {
  const remaining = 1 - progress;
  const cx = size/2, cy = size/2, r = size/2 - 6;
  const angle = remaining * 2 * Math.PI;
  const sa = -Math.PI/2, ea = sa + angle;
  const lx = cx + r*Math.cos(sa), ly = cy + r*Math.sin(sa);
  const ex = cx + r*Math.cos(ea), ey = cy + r*Math.sin(ea);
  const large = angle > Math.PI ? 1 : 0;
  const fill = isWork ? (dark?"#2e8a48":"#3cb95e") : (dark?"#b84f4f":"#e06b6b");
  const bg   = isWork ? (dark?"#1a2e1f":"#d4f0dd") : (dark?"#2e1a1a":"#fde0e0");
  const hx = cx + (r+3)*Math.cos(ea), hy = cy + (r+3)*Math.sin(ea);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r+6} fill={bg}/>
      {remaining > 0.005 && <path d={`M ${cx} ${cy} L ${lx} ${ly} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`} fill={fill}/>}
      <circle cx={cx} cy={cy} r={3.5} fill="#555"/>
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#555" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  );
}

function downloadDayCanvas(blocks, dark) {
  const SCALE=2, W=520, LW=56, BW=W-LW-20, H=HOURS.length*SLOT_H+40;
  const canvas=document.createElement("canvas");
  canvas.width=W*SCALE; canvas.height=H*SCALE;
  const ctx=canvas.getContext("2d");
  ctx.scale(SCALE,SCALE);
  const bg=dark?"#131313":"#fafaf8", hl=dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)";
  const lc=dark?"#666":"#aaa", tc=dark?"#eee":"#1a1a1a";
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=tc; ctx.font="500 13px 'DM Mono',monospace";
  ctx.fillText("🍅 "+new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}),LW,22);
  const oy=36;
  HOURS.forEach((h,i)=>{
    const y=oy+i*SLOT_H;
    ctx.strokeStyle=hl; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    ctx.fillStyle=lc; ctx.font="10px 'DM Mono',monospace"; ctx.textAlign="right";
    ctx.fillText(fmtHour(h),LW-8,y+12); ctx.textAlign="left";
  });
  blocks.forEach(b=>{
    const top=oy+timeToY(b.startTime), bh=blockH(b), x=LW+4, w=BW, rad=5;
    ctx.fillStyle=b.color; ctx.globalAlpha=b.endTime?0.82:1;
    ctx.beginPath();
    ctx.moveTo(x+rad,top); ctx.lineTo(x+w-rad,top); ctx.arcTo(x+w,top,x+w,top+rad,rad);
    ctx.lineTo(x+w,top+bh-rad); ctx.arcTo(x+w,top+bh,x+w-rad,top+bh,rad);
    ctx.lineTo(x+rad,top+bh); ctx.arcTo(x,top+bh,x,top+bh-rad,rad);
    ctx.lineTo(x,top+rad); ctx.arcTo(x,top,x+rad,top,rad); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1; ctx.fillStyle="white"; ctx.font="400 11px 'DM Mono',monospace";
    ctx.fillText(b.label,x+7,top+14);
    if(bh>28){
      ctx.globalAlpha=0.65; ctx.font="9px 'DM Mono',monospace";
      ctx.fillText(b.startTime.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+(b.endTime?` → ${b.endTime.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}` :""),x+7,top+26);
      ctx.globalAlpha=1;
    }
  });
  const now=new Date(), nh=now.getHours();
  if(nh>=CAL_START&&nh<CAL_START+HOURS.length){
    const ny=oy+timeToY(now);
    ctx.strokeStyle="#e06b6b"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(LW,ny); ctx.lineTo(W-14,ny); ctx.stroke();
    ctx.fillStyle="#e06b6b"; ctx.beginPath(); ctx.arc(LW-3,ny,3.5,0,Math.PI*2); ctx.fill();
  }
  const link=document.createElement("a");
  link.download=`pomodoro-${new Date().toISOString().slice(0,10)}.png`;
  link.href=canvas.toDataURL("image/png"); link.click();
}

// ── Todo panel ──────────────────────────────────────────────────────────────
function TodoPanel({ T, dark }) {
  const [todos, setTodos] = useState([
    { id:1, text:"Plan the day", done:false },
    { id:2, text:"Deep work block", done:false },
  ]);
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | done
  const inputRef = useRef(null);
  const editRef = useRef(null);

  const add = () => {
    const t = input.trim();
    if (!t) return;
    setTodos(prev => [...prev, { id: Date.now(), text: t, done: false }]);
    setInput("");
  };

  const toggle = id => setTodos(prev => prev.map(t => t.id===id ? {...t, done:!t.done} : t));
  const remove = id => setTodos(prev => prev.filter(t => t.id!==id));
  const startEdit = (id, text) => { setEditId(id); setEditText(text); setTimeout(()=>editRef.current?.focus(),40); };
  const saveEdit = () => {
    if (editId) {
      setTodos(prev => prev.map(t => t.id===editId ? {...t, text:editText.trim()||t.text} : t));
      setEditId(null);
    }
  };

  const visible = todos.filter(t => filter==="all" ? true : filter==="active" ? !t.done : t.done);
  const doneCount = todos.filter(t=>t.done).length;

  const accentColor = dark ? "#7d55cc" : "#8b63e8";
  const filterBtn = (f, label) => (
    <button onClick={()=>setFilter(f)} style={{
      cursor:"pointer", border:"none", background:"none", fontFamily:"inherit",
      fontSize:10, padding:"2px 6px", borderRadius:4,
      color: filter===f ? accentColor : T.muted,
      fontWeight: filter===f ? 500 : 400,
      borderBottom: filter===f ? `1.5px solid ${accentColor}` : "1.5px solid transparent",
    }}>{label}</button>
  );

  return (
    <div style={{display:"flex", flexDirection:"column", height:"100%"}}>
      {/* Header */}
      <div style={{padding:"14px 14px 10px", borderBottom:`0.5px solid ${T.border}`}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
          <div style={{fontSize:12, fontWeight:500, color:T.text, letterSpacing:"0.5px"}}>to-do</div>
          <div style={{fontSize:10, color:T.muted}}>{doneCount}/{todos.length}</div>
        </div>
        {/* Filter tabs */}
        <div style={{display:"flex", gap:2}}>
          {filterBtn("all","all")}
          {filterBtn("active","active")}
          {filterBtn("done","done")}
        </div>
      </div>

      {/* List */}
      <div style={{flex:1, overflowY:"auto", padding:"8px 10px"}}>
        {visible.length===0 && (
          <div style={{fontSize:10, color:T.muted, fontStyle:"italic", textAlign:"center", marginTop:20}}>
            {filter==="done" ? "nothing done yet" : "all clear ✓"}
          </div>
        )}
        {visible.map(todo => (
          <div key={todo.id} style={{
            display:"flex", alignItems:"flex-start", gap:8, marginBottom:6,
            padding:"6px 8px", borderRadius:6,
            background: todo.done ? (dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)") : T.surface,
            border:`0.5px solid ${T.border}`,
            transition:"background .15s",
          }}>
            {/* Checkbox */}
            <div onClick={()=>toggle(todo.id)} style={{
              width:14, height:14, borderRadius:3, flexShrink:0, marginTop:1, cursor:"pointer",
              border:`1.5px solid ${todo.done ? accentColor : T.muted}`,
              background: todo.done ? accentColor : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all .15s",
            }}>
              {todo.done && <span style={{color:"white", fontSize:9, lineHeight:1}}>✓</span>}
            </div>

            {/* Text / edit */}
            {editId===todo.id ? (
              <input ref={editRef} value={editText}
                onChange={e=>setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={e=>{if(e.key==="Enter")saveEdit(); if(e.key==="Escape")setEditId(null);}}
                style={{
                  flex:1, background:"transparent", border:"none",
                  borderBottom:`1px solid ${accentColor}`, outline:"none",
                  fontFamily:"inherit", fontSize:11, color:T.text, padding:"0 1px",
                }}
              />
            ) : (
              <div onDoubleClick={()=>startEdit(todo.id, todo.text)} style={{
                flex:1, fontSize:11, color: todo.done ? T.muted : T.text,
                textDecoration: todo.done ? "line-through" : "none",
                lineHeight:1.4, wordBreak:"break-word", cursor:"text",
                transition:"color .15s",
              }}>{todo.text}</div>
            )}

            {/* Delete */}
            <button onClick={()=>remove(todo.id)} style={{
              background:"none", border:"none", cursor:"pointer",
              color:T.muted, fontSize:13, lineHeight:1, padding:"0 1px", flexShrink:0, marginTop:0,
              opacity:0.5,
            }}>×</button>
          </div>
        ))}
      </div>

      {/* Add input */}
      <div style={{padding:"10px 10px 14px", borderTop:`0.5px solid ${T.border}`}}>
        <div style={{display:"flex", gap:6, alignItems:"center"}}>
          <input
            ref={inputRef}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")add();}}
            placeholder="add a task…"
            style={{
              flex:1, background:T.listBg, border:`0.5px solid ${T.border}`,
              borderRadius:6, padding:"6px 9px", fontSize:11,
              fontFamily:"inherit", color:T.text, outline:"none",
            }}
          />
          <button onClick={add} style={{
            cursor:"pointer", background:accentColor, border:"none",
            borderRadius:6, width:28, height:28, color:"white", fontSize:16,
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0,
          }}>+</button>
        </div>
        <div style={{fontSize:9, color:T.muted, marginTop:5, paddingLeft:2}}>
          double-click a task to edit
        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);
  const [mode, setMode] = useState("work");
  const [timeLeft, setTimeLeft] = useState(WORK_DURATION);
  const [running, setRunning] = useState(false);
  const [timerSize, setTimerSize] = useState("normal");
  const [blocks, setBlocks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [colorIdx, setColorIdx] = useState(0);
  const [todoOpen, setTodoOpen] = useState(true);
  const intervalRef = useRef(null);
  const inputRef = useRef(null);

  const isWork = mode === "work";
  const totalDur = isWork ? WORK_DURATION : BREAK_DURATION;
  const progress = 1 - timeLeft / totalDur;

  const T = dark ? {
    bg:"#111", surface:"#1a1a1a", border:"rgba(255,255,255,0.08)",
    text:"#eee", muted:"#777", subtle:"#444",
    headerBg:"#161616", calBg:"#131313", sidebarBg:"#1a1a1a",
    hourBorder:"rgba(255,255,255,0.06)", listBg:"#222"
  } : {
    bg:"#f5f4ef", surface:"white", border:"rgba(0,0,0,0.09)",
    text:"#1a1a1a", muted:"#888", subtle:"#ddd",
    headerBg:"white", calBg:"#fafaf8", sidebarBg:"white",
    hourBorder:"rgba(0,0,0,0.07)", listBg:"#f5f4ef"
  };

  const stopTimer = useCallback(() => { clearInterval(intervalRef.current); setRunning(false); }, []);

  const completeSession = useCallback(() => {
    stopTimer();
    if (isWork && currentBlockId) {
      setBlocks(prev => prev.map(b => b.id===currentBlockId ? {...b,endTime:new Date()} : b));
      setCurrentBlockId(null);
    }
    setMode(isWork ? "break" : "work");
    setTimeLeft(isWork ? BREAK_DURATION : WORK_DURATION);
  }, [isWork, currentBlockId, stopTimer]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => { if(prev<=1){completeSession();return 0;} return prev-1; });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, completeSession]);

  const handleStart = () => {
    if (!running) {
      setRunning(true);
      const id=Date.now(), now=new Date();
      setCurrentBlockId(id);
      if (isWork) {
        const pal = dark ? POMO_COLORS_DARK : POMO_COLORS;
        setBlocks(prev=>[...prev,{id,label:`Pomodoro ${prev.filter(b=>!b.isBreak).length+1}`,startTime:now,endTime:null,isBreak:false,color:pal[colorIdx%pal.length]}]);
        setColorIdx(c=>c+1);
      } else {
        setBlocks(prev=>[...prev,{id,label:"Break",startTime:now,endTime:null,isBreak:true,color:"#e06b6b"}]);
      }
    } else { stopTimer(); }
  };

  const handleReset = () => {
    stopTimer();
    if (currentBlockId) { setBlocks(prev=>prev.filter(b=>b.id!==currentBlockId)); setCurrentBlockId(null); }
    setTimeLeft(isWork ? WORK_DURATION : BREAK_DURATION);
  };

  const skipBreak = () => {
    stopTimer();
    if (currentBlockId) { setBlocks(prev=>prev.map(b=>b.id===currentBlockId?{...b,endTime:new Date()}:b)); setCurrentBlockId(null); }
    setMode("break"); setTimeLeft(BREAK_DURATION);
  };

  const handleBlockClick = id => {
    const b=blocks.find(x=>x.id===id); if(!b) return;
    setEditingId(id); setEditLabel(b.label);
    setTimeout(()=>inputRef.current?.focus(),50);
  };
  const saveLabel = () => {
    if (editingId) { setBlocks(prev=>prev.map(b=>b.id===editingId?{...b,label:editLabel}:b)); setEditingId(null); }
  };

  const totalPomos = blocks.filter(b=>!b.isBreak&&b.endTime).length;
  const totalFocusMins = Math.round(blocks.filter(b=>!b.isBreak&&b.endTime).reduce((a,b)=>a+(b.endTime-b.startTime)/60000,0));
  const timerPx = timerSize==="full"?240:timerSize==="mini"?60:150;

  const SizeBtns = () => (
    <div style={{display:"flex",gap:3}}>
      {["mini","normal","full"].map(s=>(
        <button key={s} onClick={()=>setTimerSize(s)} style={{
          cursor:"pointer",border:`0.5px solid ${T.border}`,
          background:timerSize===s?T.text:T.surface,borderRadius:4,
          fontSize:9,fontFamily:"inherit",padding:"2px 6px",
          color:timerSize===s?T.bg:T.muted,
        }}>{s}</button>
      ))}
    </div>
  );

  const TimerControls = ({big}) => (
    <div style={{display:"flex",gap:big?14:8,alignItems:"center"}}>
      <button onClick={handleStart} style={{
        width:big?64:40,height:big?64:40,borderRadius:"50%",cursor:"pointer",
        background:running?(dark?"#2a1212":"#fff0f0"):(dark?"#121a12":"#e8fee8"),
        border:`${big?2:1.5}px solid ${running?(dark?"#b84f4f":"#e06b6b"):(dark?"#2e8a48":"#3cb95e")}`,
        color:running?(dark?"#b84f4f":"#e06b6b"):(dark?"#2e8a48":"#3cb95e"),fontSize:big?26:16,
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>{running?"⏸":"▶"}</button>
      <button onClick={handleReset} style={{fontSize:big?20:15,color:T.muted,background:"none",border:"none",cursor:"pointer",padding:4}}>↺</button>
      {isWork&&running&&<button onClick={skipBreak} style={{fontSize:big?12:10,color:T.muted,background:"none",border:"none",cursor:"pointer",padding:4}}>skip→</button>}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:T.bg,fontFamily:"'DM Mono','Fira Mono',monospace",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .blk{cursor:pointer;border-radius:5px;transition:filter .15s,outline .15s}
        .blk:hover{filter:brightness(0.87)}
        .blk.editing{outline:2.5px solid #a07af5;outline-offset:1px}
        .elinput{background:transparent;border:none;border-bottom:1.5px solid rgba(255,255,255,0.8);outline:none;font-family:inherit;font-size:11px;width:100%;color:white;padding:1px 2px}
        .todo-input::placeholder{color:#999}
        .todo-row:hover .todo-del{opacity:1!important}
      `}</style>

      {/* Header */}
      <div style={{padding:"13px 22px 10px",borderBottom:`0.5px solid ${T.border}`,background:T.headerBg,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div>
            <div style={{fontSize:16,fontWeight:500,color:T.text,letterSpacing:"-0.5px"}}>🍅 pomodoro</div>
            <div style={{fontSize:10,color:T.muted,marginTop:2}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
          </div>
          {/* Todo toggle */}
          <button onClick={()=>setTodoOpen(o=>!o)} title="Toggle to-do list" style={{
            cursor:"pointer",background:todoOpen?(dark?"#2a2240":"#f0ecff"):T.surface,
            border:`0.5px solid ${todoOpen?(dark?"#6a48c4":"#c9b8f5"):T.border}`,
            borderRadius:6,padding:"4px 10px",fontSize:10,color:todoOpen?(dark?"#a07af5":"#8b63e8"):T.muted,
            fontFamily:"inherit",transition:"all .15s",
          }}>☑ tasks{todoOpen?" ▾":" ▸"}</button>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:17,fontWeight:500,color:dark?"#2e8a48":"#3cb95e"}}>{totalPomos}</div>
            <div style={{fontSize:9,color:T.muted}}>done</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:17,fontWeight:500,color:dark?"#7d55cc":"#8b63e8"}}>{totalFocusMins}</div>
            <div style={{fontSize:9,color:T.muted}}>focus min</div>
          </div>
          <button onClick={()=>downloadDayCanvas(blocks,dark)} style={{cursor:"pointer",background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:6,padding:"5px 10px",fontSize:10,color:T.muted,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>⬇ save day</button>
          <div onClick={()=>setDark(d=>!d)} style={{cursor:"pointer",background:dark?"#3a3a3a":"#e0e0d8",borderRadius:20,width:42,height:22,position:"relative",flexShrink:0,transition:"background .2s"}}>
            <div style={{width:16,height:16,borderRadius:"50%",background:dark?"#f5c842":"white",position:"absolute",top:3,left:dark?22:4,transition:"left .2s,background .2s"}}/>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* To-do panel */}
        <div style={{
          width: todoOpen ? 220 : 0,
          overflow:"hidden",
          borderRight:`0.5px solid ${T.border}`,
          background:T.sidebarBg,
          transition:"width .25s ease",
          flexShrink:0,
          display:"flex",flexDirection:"column",
        }}>
          {todoOpen && <TodoPanel T={T} dark={dark}/>}
        </div>

        {/* Calendar */}
        <div style={{flex:1,overflowY:"auto",background:T.calBg,padding:"0 0 32px"}}>
          <div style={{position:"relative",marginLeft:52}}>
            {HOURS.map(h=>(
              <div key={h} style={{height:SLOT_H,borderTop:`0.5px solid ${T.hourBorder}`,position:"relative"}}>
                <div style={{position:"absolute",left:-48,top:-9,fontSize:10,color:T.muted,width:40,textAlign:"right"}}>{fmtHour(h)}</div>
              </div>
            ))}

            {blocks.map(b=>{
              const top=timeToY(b.startTime),h=blockH(b);
              const isEd=editingId===b.id,isActive=b.id===currentBlockId;
              const bcolor=isEd?"rgba(160,122,245,0.9)":b.color;
              return (
                <div key={b.id} className={`blk${isEd?" editing":""}`} onClick={()=>handleBlockClick(b.id)}
                  style={{position:"absolute",top,left:4,right:14,height:h,background:bcolor,borderRadius:5,padding:"3px 7px",overflow:"hidden",
                    boxShadow:isActive?`0 0 0 2px ${bcolor},0 0 0 4px ${T.bg}`:"none",
                    transition:"height .5s ease,box-shadow .2s,background .2s",zIndex:isActive||isEd?3:1,opacity:b.endTime&&!isEd?0.82:1}}>
                  {isEd ? (
                    <input ref={inputRef} className="elinput" value={editLabel}
                      onChange={e=>setEditLabel(e.target.value)} onBlur={saveLabel}
                      onKeyDown={e=>{if(e.key==="Enter")saveLabel();if(e.key==="Escape")setEditingId(null);}}
                      onClick={e=>e.stopPropagation()}/>
                  ) : (
                    <div style={{fontSize:11,color:"white",fontWeight:400,lineHeight:1.3,userSelect:"none"}}>
                      {b.label}{isActive&&<span style={{opacity:.55}}> ●</span>}
                    </div>
                  )}
                  {h>28&&(
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginTop:2}}>
                      {b.startTime.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                      {b.endTime&&` → ${b.endTime.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`}
                    </div>
                  )}
                  {isEd&&h>36&&<div style={{fontSize:9,color:"rgba(255,255,255,0.45)",marginTop:3}}>enter to save · esc to cancel</div>}
                </div>
              );
            })}

            {(()=>{
              const now=new Date(),nh=now.getHours();
              if(nh<CAL_START||nh>=CAL_START+HOURS.length) return null;
              const top=timeToY(now);
              return <div style={{position:"absolute",top,left:0,right:14,height:1.5,background:"#e06b6b",zIndex:4,pointerEvents:"none"}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:"#e06b6b",position:"absolute",left:-3,top:-3}}/>
              </div>;
            })()}
          </div>
        </div>

        {/* Timer sidebar */}
        {timerSize==="normal"&&(
          <div style={{width:210,background:T.sidebarBg,borderLeft:`0.5px solid ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 14px",gap:14,flexShrink:0}}>
            <div style={{alignSelf:"flex-end"}}><SizeBtns/></div>
            <PieTimer progress={progress} isWork={isWork} size={timerPx} dark={dark}/>
            <div style={{textAlign:"center",marginTop:-6}}>
              <div style={{fontSize:26,fontWeight:300,color:T.text,letterSpacing:1}}>{fmt(timeLeft)}</div>
              <div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:2,marginTop:2}}>{isWork?"focus":"break"}</div>
            </div>
            <TimerControls/>
            <div style={{width:"100%",background:T.listBg,borderRadius:8,padding:"9px 11px",marginTop:2}}>
              <div style={{fontSize:9,color:T.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>sessions</div>
              {blocks.length===0&&<div style={{fontSize:10,color:T.subtle,fontStyle:"italic"}}>no sessions yet</div>}
              {blocks.map(b=>(
                <div key={b.id} onClick={()=>handleBlockClick(b.id)} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,cursor:"pointer"}}>
                  <div style={{width:7,height:7,borderRadius:2,flexShrink:0,background:editingId===b.id?"#a07af5":b.color,opacity:b.endTime?.7:1}}/>
                  <div style={{fontSize:10,color:editingId===b.id?"#a07af5":T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{b.label}</div>
                  {!b.endTime&&<div style={{fontSize:8,color:"#e06b6b"}}>live</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fullscreen */}
        {timerSize==="full"&&(
          <div style={{position:"fixed",inset:0,zIndex:100,background:dark?(isWork?"#0d1a10":"#1a0d0d"):(isWork?"#edfcf1":"#fff0f0"),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
            <div style={{position:"absolute",top:20,right:20}}><SizeBtns/></div>
            <div style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:3}}>{isWork?"focus":"break"}</div>
            <PieTimer progress={progress} isWork={isWork} size={timerPx} dark={dark}/>
            <div style={{fontSize:52,fontWeight:300,color:T.text,letterSpacing:3}}>{fmt(timeLeft)}</div>
            <TimerControls big/>
            <div style={{position:"absolute",bottom:24,fontSize:10,color:T.muted}}>{totalPomos} done · {totalFocusMins} focus mins</div>
          </div>
        )}
      </div>

      {/* Mini floating */}
      {timerSize==="mini"&&(
        <div style={{position:"fixed",bottom:20,right:20,background:T.surface,borderRadius:40,border:`0.5px solid ${T.border}`,boxShadow:"0 2px 14px rgba(0,0,0,0.14)",padding:"6px 12px 6px 6px",display:"flex",alignItems:"center",gap:8,zIndex:50}}>
          <PieTimer progress={progress} isWork={isWork} size={timerPx} dark={dark}/>
          <div>
            <div style={{fontSize:14,color:T.text,letterSpacing:.5}}>{fmt(timeLeft)}</div>
            <div style={{fontSize:8,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>{isWork?"focus":"break"}</div>
          </div>
          <button onClick={handleStart} style={{width:26,height:26,borderRadius:"50%",cursor:"pointer",
            background:running?(dark?"#2a1212":"#fff0f0"):(dark?"#121a12":"#e8fee8"),
            border:`1px solid ${running?(dark?"#b84f4f":"#e06b6b"):(dark?"#2e8a48":"#3cb95e")}`,
            color:running?(dark?"#b84f4f":"#e06b6b"):(dark?"#2e8a48":"#3cb95e"),
            fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>{running?"⏸":"▶"}</button>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            <button onClick={()=>setTimerSize("normal")} style={{cursor:"pointer",border:`0.5px solid ${T.border}`,background:T.surface,borderRadius:3,fontSize:8,color:T.muted,padding:"1px 5px",fontFamily:"inherit"}}>▲</button>
            <button onClick={()=>setTimerSize("full")} style={{cursor:"pointer",border:`0.5px solid ${T.border}`,background:T.surface,borderRadius:3,fontSize:8,color:T.muted,padding:"1px 5px",fontFamily:"inherit"}}>⛶</button>
          </div>
        </div>
      )}
    </div>
  );
}
