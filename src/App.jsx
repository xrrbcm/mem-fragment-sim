import { useState, useMemo, useCallback } from "react";

/* ================================================================
   MEM FRAGMENT BOARD SYSTEM — V1 SIMULATION
   • 16 outer-edge entry/exit
   • Hamiltonian path guide on boards
   • Editable archetype inventories
   • Progressive boards (fragments consumed)
   • Perfect Clear tracking + board stoppage
   ================================================================ */

// ── Constants ──
const DIRS  = { N:[-1,0], S:[1,0], E:[0,1], W:[0,-1] };
const OPP   = { N:"S", S:"N", E:"W", W:"E" };
const DARR  = { N:"↑", S:"↓", E:"→", W:"←" };
const SCORE = { FULL_BOARD:50, HAMILTONIAN:100, COMBO_PER:15 };

const FTYPES = {
  CD_STRAIGHT:{ tier:"C/D", shape:"Straight", conn:10, disc:5,  c:"#64748B" },
  AB_CORNER:  { tier:"A/B", shape:"Corner",   conn:15, disc:7,  c:"#3B82F6" },
  S_TPIECE:   { tier:"S",   shape:"T-piece",  conn:25, disc:12, c:"#F59E0B" },
  SPECIAL:    { tier:"Sp",  shape:"Cross",    conn:40, disc:20, c:"#8B5CF6" },
  UNIQUE:     { tier:"Un",  shape:"Cross",    conn:40, disc:20, c:"#EC4899" },
  HIDDEN:     { tier:"Hd",  shape:"Cross",    conn:40, disc:20, c:"#10B981" },
  COLLECTOR:  { tier:"Co",  shape:"Cross",    conn:40, disc:20, c:"#EF4444" },
};

const FRAG_KEYS = Object.keys(FTYPES);
const FRAG_LABELS = {
  CD_STRAIGHT:"C/D Straight", AB_CORNER:"A/B Corner", S_TPIECE:"S T-piece",
  SPECIAL:"Special (4-notch)", UNIQUE:"Unique (4-notch)",
  HIDDEN:"Hidden (4-notch)", COLLECTOR:"Collector (4-notch)",
};

// ── Default archetype inventories ──
const DEFAULT_INVENTORIES = [
  { name:"Passive Single-Char", combos:0, frags:{ CD_STRAIGHT:2, AB_CORNER:2, S_TPIECE:0, SPECIAL:1, UNIQUE:0, HIDDEN:0, COLLECTOR:0 }},
  { name:"Active Single-Char",  combos:1, frags:{ CD_STRAIGHT:3, AB_CORNER:3, S_TPIECE:0, SPECIAL:4, UNIQUE:2, HIDDEN:0, COLLECTOR:0 }},
  { name:"Mid Collector (3-5)", combos:2, frags:{ CD_STRAIGHT:5, AB_CORNER:4, S_TPIECE:1, SPECIAL:4, UNIQUE:1, HIDDEN:0, COLLECTOR:1 }},
  { name:"Whale (20+)",         combos:4, frags:{ CD_STRAIGHT:9, AB_CORNER:8, S_TPIECE:2, SPECIAL:5, UNIQUE:3, HIDDEN:1, COLLECTOR:0 }},
];

// ── Fragment orientation logic ──
function randOrient(shape) {
  const S=[["N","S"],["E","W"]], C=[["N","E"],["N","W"],["S","E"],["S","W"]];
  const T=[["N","E","W"],["N","S","E"],["N","S","W"],["S","E","W"]];
  if(shape==="Straight") return[...S[Math.random()*2|0]];
  if(shape==="Corner")   return[...C[Math.random()*4|0]];
  if(shape==="T-piece")  return[...T[Math.random()*4|0]];
  return["N","S","E","W"];
}

function allRots(shape, notches) {
  if(shape==="Cross") return[["N","S","E","W"]];
  if(shape==="T-piece") return[notches]; // LOCKED
  if(shape==="Straight") return[["N","S"],["E","W"]];
  if(shape==="Corner") {
    const s=[...notches].sort().join(",");
    return({"E,N":[["N","E"],["S","E"],["N","W"]],"N,W":[["N","W"],["N","E"],["S","W"]],
      "E,S":[["S","E"],["N","E"],["S","W"]],"S,W":[["S","W"],["N","W"],["S","E"]]})[s]||[notches];
  }
  return[notches];
}

function mkFrag(type, id) {
  const d=FTYPES[type];
  return{id,type,tier:d.tier,shape:d.shape,conn:d.conn,disc:d.disc,c:d.c,notches:randOrient(d.shape)};
}

// ── Board definitions ──
function adj(a,b){return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;}
function verify(p){
  if(p.length!==16)return false;
  const s=new Set();
  for(let i=0;i<16;i++){const k=p[i][0]*4+p[i][1];if(s.has(k))return false;s.add(k);if(i>0&&!adj(p[i],p[i-1]))return false;}
  return true;
}

const BOARDS=[
  {name:"Serpent's Trail",difficulty:"Easy",
   entry:{row:0,col:0,dir:"W"},exit:{row:3,col:0,dir:"W"},
   path:[[0,0],[0,1],[0,2],[0,3],[1,3],[1,2],[1,1],[1,0],[2,0],[2,1],[2,2],[2,3],[3,3],[3,2],[3,1],[3,0]],
   desc:"Classic snake. W of R1C1 → W of R4C1."},
  {name:"Cascade Flow",difficulty:"Easy",
   entry:{row:0,col:3,dir:"E"},exit:{row:3,col:3,dir:"E"},
   path:[[0,3],[0,2],[0,1],[0,0],[1,0],[1,1],[1,2],[1,3],[2,3],[2,2],[2,1],[2,0],[3,0],[3,1],[3,2],[3,3]],
   desc:"Reverse snake. E of R1C4 → E of R4C4."},
  {name:"Spiral Descent",difficulty:"Normal",
   entry:{row:0,col:0,dir:"N"},exit:{row:1,col:0,dir:"W"},
   path:[[0,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3],[3,2],[3,1],[3,0],[2,0],[2,1],[2,2],[1,2],[1,1],[1,0]],
   desc:"Clockwise spiral inward. N of R1C1 → W of R2C1."},
  {name:"Mirror Gate",difficulty:"Hard",
   entry:{row:0,col:0,dir:"N"},exit:{row:0,col:3,dir:"N"},
   path:[[0,0],[1,0],[2,0],[3,0],[3,1],[2,1],[1,1],[0,1],[0,2],[1,2],[2,2],[3,2],[3,3],[2,3],[1,3],[0,3]],
   desc:"Column snake. Same-side entry/exit (top). N of R1C1 → N of R1C4."},
  {name:"Labyrinth Core",difficulty:"Hard",
   entry:{row:0,col:1,dir:"N"},exit:{row:3,col:3,dir:"S"},
   path:[[0,1],[0,0],[1,0],[1,1],[1,2],[0,2],[0,3],[1,3],[2,3],[2,2],[2,1],[2,0],[3,0],[3,1],[3,2],[3,3]],
   desc:"Irregular weave. N of R1C2 → S of R4C4."},
  {name:"Fracture Grid",difficulty:"Hard",
   entry:{row:0,col:2,dir:"N"},exit:{row:0,col:1,dir:"N"},
   path:[[0,2],[0,3],[1,3],[1,2],[2,2],[2,3],[3,3],[3,2],[3,1],[3,0],[2,0],[2,1],[1,1],[1,0],[0,0],[0,1]],
   desc:"Max corners, same-side top. N of R1C3 → N of R1C2."},
];

function pathReqs(board){
  const{path,entry,exit}=board;
  return path.map(([r,c],i)=>{
    const n=new Set();
    if(i===0)n.add(entry.dir);
    if(i>0){const[pr,pc]=path[i-1];if(pr<r)n.add("N");else if(pr>r)n.add("S");else if(pc<c)n.add("W");else n.add("E");}
    if(i<15){const[nr,nc]=path[i+1];if(nr<r)n.add("N");else if(nr>r)n.add("S");else if(nc<c)n.add("W");else n.add("E");}
    if(i===15)n.add(exit.dir);
    return{r,c,need:[...n]};
  });
}

function countTurns(path){
  let t=0;
  for(let i=1;i<path.length-1;i++){
    const d1=[path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]];
    const d2=[path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]];
    if(d1[0]!==d2[0]||d1[1]!==d2[1])t++;
  }
  return t;
}

// ── Simulation engine ──
function mkInventory(inv){
  const f=[];let id=0;
  for(const[type,count]of Object.entries(inv.frags)){for(let i=0;i<count;i++)f.push(mkFrag(type,id++));}
  return{frags:f,combos:inv.combos};
}

function canFit(fn,need){for(const n of need)if(!fn.includes(n))return false;return true;}

function solveBoard(board,frags){
  const reqs=pathReqs(board);
  const grid=Array.from({length:4},()=>Array(4).fill(null));
  const used=new Set();
  const order=reqs.map((_,i)=>i).sort((a,b)=>reqs[b].need.length-reqs[a].need.length);
  const onP=new Array(16).fill(false);

  for(const ri of order){
    const{r,c,need}=reqs[ri];
    let bfi=-1,brot=null,bval=-1;
    for(let fi=0;fi<frags.length;fi++){
      if(used.has(fi))continue;
      for(const rot of allRots(frags[fi].shape,frags[fi].notches)){
        if(canFit(rot,need)&&frags[fi].conn>bval){bval=frags[fi].conn;bfi=fi;brot=rot;}
      }
    }
    if(bfi>=0){used.add(bfi);grid[r][c]={...frags[bfi],notches:brot,onPath:true};onP[ri]=true;}
  }

  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    if(grid[r][c])continue;
    let bfi=-1,bd=-1;
    for(let fi=0;fi<frags.length;fi++){if(used.has(fi))continue;if(frags[fi].disc>bd){bd=frags[fi].disc;bfi=fi;}}
    if(bfi>=0){used.add(bfi);grid[r][c]={...frags[bfi],onPath:false};}
  }
  return{grid,usedIds:used,allOnPath:onP.every(Boolean)};
}

function scoreGrid(grid,board,combos){
  let pP=0,dP=0,filled=0,onC=0,dC=0;
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const t=grid[r][c];if(t){filled++;if(t.onPath){pP+=t.conn;onC++;}else{dP+=t.disc;dC++;}}
  }
  const fB=filled===16?SCORE.FULL_BOARD:0;
  const hB=onC===16?SCORE.HAMILTONIAN:0;
  let cP=0;
  if(combos>0){
    const cands=[];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const t=grid[r][c];if(!t)continue;
      let cn=0;
      for(const n of t.notches){const[dr,dc]=DIRS[n];const nr=r+dr,nc=c+dc;
        if(nr>=0&&nr<4&&nc>=0&&nc<4&&grid[nr][nc]&&grid[nr][nc].notches.includes(OPP[n]))cn++;}
      cands.push({cn});
    }
    cands.sort((a,b)=>b.cn-a.cn);
    for(let i=0;i<Math.min(combos,cands.length);i++)cP+=cands[i].cn*SCORE.COMBO_PER;
  }
  return{filled,onC,dC,empty:16-filled,pP,dP,fB,hB,cP,
    perfectClear:filled===16&&onC===16,boardCleared:filled===16,
    total:pP+dP+fB+hB+cP};
}

function runProgressive(invs,iters=120){
  const data={};
  for(let a=0;a<invs.length;a++){
    const perBoard=[];for(let b=0;b<6;b++)perBoard.push({runs:[],stopped:0,usageRuns:[]});
    for(let it=0;it<iters;it++){
      const{frags,combos}=mkInventory(invs[a]);
      let rem=[...frags],cum=0;
      for(let b=0;b<6;b++){
        const emptyUsage={};FRAG_KEYS.forEach(k=>emptyUsage[k]=0);
        if(rem.length===0){
          perBoard[b].runs.push({filled:0,onC:0,dC:0,empty:16,pP:0,dP:0,fB:0,hB:0,cP:0,perfectClear:false,boardCleared:false,total:0,cumTotal:cum,stopped:true,fragsAvail:0});
          perBoard[b].stopped++;
          perBoard[b].usageRuns.push(emptyUsage);
          continue;
        }
        const{grid,usedIds}=solveBoard(BOARDS[b],rem);
        const sc=scoreGrid(grid,BOARDS[b],combos);
        cum+=sc.total;
        // Track which types were used
        const usage={...emptyUsage};
        for(const idx of usedIds){usage[rem[idx].type]=(usage[rem[idx].type]||0)+1;}
        perBoard[b].usageRuns.push(usage);
        perBoard[b].runs.push({...sc,cumTotal:cum,stopped:sc.filled===0,fragsAvail:rem.length});
        if(sc.filled===0)perBoard[b].stopped++;
        rem=rem.filter((_,i)=>!usedIds.has(i));
      }
    }
    data[a]=perBoard.map((br,bi)=>{
      const R=br.runs,N=R.length;
      const av=fn=>R.reduce((s,r)=>s+fn(r),0)/N;
      const vs=R.map(r=>r.total);
      const avgT=av(r=>r.total);
      // Average usage per type per board
      const avgUsage={};
      FRAG_KEYS.forEach(k=>{avgUsage[k]=+(br.usageRuns.reduce((s,u)=>s+(u[k]||0),0)/N).toFixed(1);});
      return{bi,avgScore:+avgT.toFixed(1),minScore:Math.min(...vs),maxScore:Math.max(...vs),
        stdDev:+(Math.sqrt(av(r=>(r.total-avgT)**2)).toFixed(1)),
        avgFilled:+av(r=>r.filled).toFixed(1),avgOnPath:+av(r=>r.onC).toFixed(1),
        pctFull:+((R.filter(r=>r.boardCleared).length/N*100).toFixed(1)),
        pctPC:+((R.filter(r=>r.perfectClear).length/N*100).toFixed(1)),
        avgCombo:+av(r=>r.cP).toFixed(1),avgCum:+av(r=>r.cumTotal).toFixed(1),
        stopPct:+((br.stopped/N*100).toFixed(1)),avgFrags:+av(r=>r.fragsAvail).toFixed(1),
        avgUsage};
    });
  }
  return data;
}

function runComboSens(invs,iters=60){
  const out={};
  for(let a=0;a<invs.length;a++){
    const wC=[],woC=[];
    for(let i=0;i<iters;i++){
      const{frags,combos}=mkInventory(invs[a]);
      let r1=[...frags],r2=[...frags],s1=0,s2=0;
      for(let b=0;b<6;b++){
        if(r1.length>0){const{grid:g,usedIds:u}=solveBoard(BOARDS[b],r1);s1+=scoreGrid(g,BOARDS[b],combos).total;r1=r1.filter((_,j)=>!u.has(j));}
        if(r2.length>0){const{grid:g,usedIds:u}=solveBoard(BOARDS[b],r2);s2+=scoreGrid(g,BOARDS[b],0).total;r2=r2.filter((_,j)=>!u.has(j));}
      }
      wC.push(s1);woC.push(s2);
    }
    out[a]={w:+(wC.reduce((a,b)=>a+b,0)/wC.length).toFixed(1),wo:+(woC.reduce((a,b)=>a+b,0)/woC.length).toFixed(1)};
  }
  return out;
}

// ── SVG Board with Hamiltonian Path Arrows ──
function BoardSVG({board,size=260}){
  const pad=22,gap=4;
  const cellSz=(size-pad*2-gap*3)/4;
  const total=size;
  const pMap={};board.path.forEach(([r,c],i)=>pMap[`${r},${c}`]=i);
  const reqs=pathReqs(board);
  const reqMap={};reqs.forEach(rq=>reqMap[`${rq.r},${rq.c}`]=rq.need);

  // Compute path line coordinates (center to center)
  const cellCenter=(r,c)=>({x:pad+c*(cellSz+gap)+cellSz/2, y:pad+r*(cellSz+gap)+cellSz/2});
  const pathPts=board.path.map(([r,c])=>cellCenter(r,c));

  // Entry/exit arrow points
  const entryCell=cellCenter(board.entry.row,board.entry.col);
  const exitCell=cellCenter(board.exit.row,board.exit.col);
  const offset=cellSz/2+10;
  const dirOff={N:[0,-offset],S:[0,offset],E:[offset,0],W:[-offset,0]};
  const entryStart={x:entryCell.x+dirOff[board.entry.dir][0],y:entryCell.y+dirOff[board.entry.dir][1]};
  const exitEnd={x:exitCell.x+dirOff[board.exit.dir][0],y:exitCell.y+dirOff[board.exit.dir][1]};

  return(
    <svg width={total} height={total} viewBox={`0 0 ${total} ${total}`} style={{flexShrink:0}}>
      <defs>
        <marker id="arrowH" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 6 2.5, 0 5" fill="#FBBF24" opacity="0.9"/>
        </marker>
        <marker id="arrowEntry" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 7 3, 0 6" fill="#22D3EE"/>
        </marker>
        <marker id="arrowExit" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 7 3, 0 6" fill="#F472B6"/>
        </marker>
      </defs>

      {/* Grid cells */}
      {Array.from({length:16},(_,idx)=>{
        const r=idx>>2,c=idx&3;
        const x=pad+c*(cellSz+gap),y=pad+r*(cellSz+gap);
        const pi=pMap[`${r},${c}`];
        const isE=r===board.entry.row&&c===board.entry.col;
        const isX=r===board.exit.row&&c===board.exit.col;
        const needs=reqMap[`${r},${c}`]||[];
        return(
          <g key={idx}>
            <rect x={x} y={y} width={cellSz} height={cellSz} rx={4}
              fill={pi!==undefined?"#1E293B":"#0F172A"}
              stroke={isE?"#22D3EE":isX?"#F472B6":"#1E293B"} strokeWidth={isE||isX?2:1}/>
            {/* Notch indicators */}
            {needs.map(d=>{
              const nw=8,nh=3;
              let nx,ny,nW,nH;
              if(d==="N"){nx=x+cellSz/2-nw/2;ny=y;nW=nw;nH=nh;}
              else if(d==="S"){nx=x+cellSz/2-nw/2;ny=y+cellSz-nh;nW=nw;nH=nh;}
              else if(d==="W"){nx=x;ny=y+cellSz/2-nw/2;nW=nh;nH=nw;}
              else{nx=x+cellSz-nh;ny=y+cellSz/2-nw/2;nW=nh;nH=nw;}
              return <rect key={d} x={nx} y={ny} width={nW} height={nH} rx={1} fill="#FBBF24" opacity={0.7}/>;
            })}
            {/* Path number */}
            {pi!==undefined&&<text x={x+cellSz/2} y={y+cellSz/2+1} textAnchor="middle" dominantBaseline="middle"
              fill="#F8FAFC" fontSize={cellSz>48?12:10} fontWeight="700" fontFamily="monospace">{pi+1}</text>}
            {isE&&<text x={x+4} y={y+10} fill="#22D3EE" fontSize={7} fontWeight="800" fontFamily="monospace">IN</text>}
            {isX&&<text x={x+cellSz-16} y={y+10} fill="#F472B6" fontSize={7} fontWeight="800" fontFamily="monospace">OUT</text>}
          </g>
        );
      })}

      {/* 16 outer edge dots */}
      {(()=>{
        const dots=[];
        for(let c=0;c<4;c++){dots.push({r:0,c,d:"N"});dots.push({r:3,c,d:"S"});}
        for(let r=0;r<4;r++){dots.push({r,c:0,d:"W"});dots.push({r,c:3,d:"E"});}
        return dots.map((m,i)=>{
          const cx=pad+m.c*(cellSz+gap)+cellSz/2;
          const cy=pad+m.r*(cellSz+gap)+cellSz/2;
          const o=cellSz/2+6;
          let dx=cx,dy=cy;
          if(m.d==="N")dy=cy-o;else if(m.d==="S")dy=cy+o;
          else if(m.d==="W")dx=cx-o;else dx=cx+o;
          const isE=board.entry.row===m.r&&board.entry.col===m.c&&board.entry.dir===m.d;
          const isX=board.exit.row===m.r&&board.exit.col===m.c&&board.exit.dir===m.d;
          return<circle key={i} cx={dx} cy={dy} r={isE||isX?4:3}
            fill={isE?"#22D3EE":isX?"#F472B6":"#FBBF24"} opacity={isE||isX?1:0.25}/>;
        });
      })()}

      {/* Hamiltonian path line */}
      <polyline points={pathPts.map(p=>`${p.x},${p.y}`).join(" ")}
        fill="none" stroke="#FBBF24" strokeWidth={2} strokeOpacity={0.5}
        strokeLinejoin="round" strokeLinecap="round" markerEnd="url(#arrowH)"/>

      {/* Entry arrow */}
      <line x1={entryStart.x} y1={entryStart.y} x2={entryCell.x} y2={entryCell.y}
        stroke="#22D3EE" strokeWidth={2.5} markerEnd="url(#arrowEntry)" strokeDasharray="4 2"/>

      {/* Exit arrow */}
      <line x1={exitCell.x} y1={exitCell.y} x2={exitEnd.x} y2={exitEnd.y}
        stroke="#F472B6" strokeWidth={2.5} markerEnd="url(#arrowExit)" strokeDasharray="4 2"/>
    </svg>
  );
}

// ── Editable Inventory Panel ──
function InventoryEditor({inventories,setInventories}){
  const update=(ai,key,val)=>{
    const nv=[...inventories];
    nv[ai]={...nv[ai],frags:{...nv[ai].frags,[key]:Math.max(0,parseInt(val)||0)}};
    setInventories(nv);
  };
  const updateCombo=(ai,val)=>{
    const nv=[...inventories];
    nv[ai]={...nv[ai],combos:Math.max(0,parseInt(val)||0)};
    setInventories(nv);
  };
  const updateName=(ai,val)=>{
    const nv=[...inventories];
    nv[ai]={...nv[ai],name:val};
    setInventories(nv);
  };
  const totalFrags=(inv)=>Object.values(inv.frags).reduce((a,b)=>a+b,0);
  const reset=()=>setInventories(JSON.parse(JSON.stringify(DEFAULT_INVENTORIES)));

  return(
    <div style={{background:"#111827",border:"1px solid #334155",borderRadius:10,padding:16,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h3 style={{fontSize:13,fontWeight:700,color:"#A78BFA",margin:0,letterSpacing:1,textTransform:"uppercase"}}>
          ✏️ Archetype Inventories <span style={{fontSize:9,color:"#64748B",textTransform:"none",letterSpacing:0,fontWeight:400}}>(editable — change values and re-run)</span>
        </h3>
        <button onClick={reset} style={{padding:"4px 12px",background:"#1E293B",border:"1px solid #334155",borderRadius:4,color:"#94A3B8",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>
          Reset to Defaults
        </button>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
          <thead>
            <tr style={{color:"#64748B"}}>
              <th style={{padding:"5px 6px",textAlign:"left",borderBottom:"1px solid #1E293B",fontSize:9}}>Archetype Name</th>
              {FRAG_KEYS.map(k=>(
                <th key={k} style={{padding:"5px 4px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:8,whiteSpace:"nowrap"}}>
                  <span style={{color:FTYPES[k].c}}>{FRAG_LABELS[k]}</span>
                </th>
              ))}
              <th style={{padding:"5px 6px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:9,color:"#EC4899"}}>Combos</th>
              <th style={{padding:"5px 6px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:9,color:"#FBBF24"}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {inventories.map((inv,ai)=>(
              <tr key={ai}>
                <td style={{padding:"4px 6px",borderBottom:"1px solid #1E293B20"}}>
                  <input value={inv.name} onChange={e=>updateName(ai,e.target.value)}
                    style={{background:"#0F172A",border:"1px solid #1E293B",borderRadius:3,padding:"3px 6px",
                      color:"#E2E8F0",fontSize:10,fontFamily:"inherit",width:140}}/>
                </td>
                {FRAG_KEYS.map(k=>(
                  <td key={k} style={{padding:"4px 3px",textAlign:"center",borderBottom:"1px solid #1E293B20"}}>
                    <input type="number" min={0} max={50} value={inv.frags[k]}
                      onChange={e=>update(ai,k,e.target.value)}
                      style={{background:"#0F172A",border:"1px solid #1E293B",borderRadius:3,padding:"3px 2px",
                        color:"#F8FAFC",fontSize:10,fontFamily:"inherit",width:36,textAlign:"center"}}/>
                  </td>
                ))}
                <td style={{padding:"4px 3px",textAlign:"center",borderBottom:"1px solid #1E293B20"}}>
                  <input type="number" min={0} max={20} value={inv.combos}
                    onChange={e=>updateCombo(ai,e.target.value)}
                    style={{background:"#0F172A",border:"1px solid #EC489930",borderRadius:3,padding:"3px 2px",
                      color:"#EC4899",fontSize:10,fontFamily:"inherit",width:36,textAlign:"center"}}/>
                </td>
                <td style={{padding:"4px 6px",textAlign:"center",borderBottom:"1px solid #1E293B20",color:"#FBBF24",fontWeight:700}}>
                  {totalFrags(inv)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main App ──
export default function App(){
  const[phase,setPhase]=useState(1);
  const[simData,setSimData]=useState(null);
  const[sensData,setSensData]=useState(null);
  const[running,setRunning]=useState(false);
  const[progress,setProgress]=useState(0);
  const[inventories,setInventories]=useState(()=>JSON.parse(JSON.stringify(DEFAULT_INVENTORIES)));

  const bAnal=useMemo(()=>BOARDS.map(b=>{
    const t=countTurns(b.path);const reqs=pathReqs(b);
    const rc={};reqs.forEach(r=>{const n=r.need.length;rc[n]=(rc[n]||0)+1;});
    return{turns:t,straights:b.path.length-1-t,rc};
  }),[]);

  const runSim=useCallback(()=>{
    setRunning(true);setProgress(0);
    setTimeout(()=>{
      const data=runProgressive(inventories,120);
      setProgress(80);
      const sens=runComboSens(inventories,60);
      setProgress(100);
      setSimData(data);setSensData(sens);setRunning(false);setPhase(2);
    },50);
  },[inventories]);

  const totalF=inv=>Object.values(inv.frags).reduce((a,b)=>a+b,0);

  const btn=(p,label)=>(
    <button onClick={()=>{if(p===1)setPhase(1);else if(simData)setPhase(p);else runSim();}}
      style={{padding:"7px 14px",background:phase===p?"#6366F1":"transparent",
        border:`1px solid ${phase===p?"#6366F1":"#334155"}`,borderRadius:6,
        color:phase===p?"#FFF":"#94A3B8",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
      {label}
    </button>
  );

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0F1C; }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { opacity: 1; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0F172A; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  `;

  return(
    <div style={{minHeight:"100vh",background:"#0A0F1C",color:"#E2E8F0",fontFamily:"'SF Mono','Cascadia Code','JetBrains Mono',monospace"}}>
      <style>{css}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0F172A 0%,#1a1340 50%,#0F172A 100%)",borderBottom:"1px solid #1E293B",padding:"16px 24px",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:1440,margin:"0 auto",flexWrap:"wrap",gap:8}}>
          <div>
            <h1 style={{fontSize:17,fontWeight:800,background:"linear-gradient(90deg,#22D3EE,#A78BFA,#F472B6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              MEM Fragment Board System
            </h1>
            <p style={{fontSize:9,color:"#64748B",marginTop:2,letterSpacing:2,textTransform:"uppercase"}}>
              V1 Simulation • Progressive • 16 Entry/Exit Points
            </p>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{btn(1,"Boards")}{btn(2,"Results")}{btn(3,"Analysis")}{btn(4,"Balance")}</div>
        </div>
      </div>

      <div style={{maxWidth:1440,margin:"0 auto",padding:"16px 24px"}}>

        {/* ═══ PHASE 1: BOARDS ═══ */}
        {phase===1&&(<div>
          <h2 style={{fontSize:15,fontWeight:700,color:"#F8FAFC",margin:"0 0 4px"}}>Phase 1: Board Designs & Hamiltonian Guide</h2>
          <p style={{fontSize:10,color:"#64748B",margin:"0 0 14px",maxWidth:700,lineHeight:1.6}}>
            6 premade boards. Yellow line = Hamiltonian perfect clear path. Yellow dots = 16 valid entry/exit points.
            <span style={{color:"#22D3EE"}}> Cyan ▸</span> = Entry. <span style={{color:"#F472B6"}}>Pink ▸</span> = Exit.
            Orange bars = notches needed. Numbers = path step order.
          </p>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(460px,1fr))",gap:12}}>
            {BOARDS.map((board,bi)=>{
              const a=bAnal[bi];
              return(
                <div key={bi} style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <h3 style={{fontSize:13,fontWeight:700,color:"#F8FAFC",margin:0}}>Board {bi+1}: {board.name}</h3>
                      <span style={{display:"inline-block",marginTop:3,padding:"1px 8px",borderRadius:20,fontSize:9,fontWeight:700,
                        letterSpacing:1,textTransform:"uppercase",
                        color:board.difficulty==="Easy"?"#34D399":board.difficulty==="Normal"?"#FBBF24":"#F87171",
                        background:board.difficulty==="Easy"?"#065F4620":board.difficulty==="Normal"?"#78350F20":"#7F1D1D20",
                        border:`1px solid ${board.difficulty==="Easy"?"#34D39940":board.difficulty==="Normal"?"#FBBF2440":"#F8717140"}`}}>
                        {board.difficulty}
                      </span>
                    </div>
                    <div style={{textAlign:"right",fontSize:10,color:"#64748B"}}>
                      <div>Turns: <b style={{color:"#F59E0B"}}>{a.turns}</b></div>
                      <div>Straights: <b style={{color:"#22D3EE"}}>{a.straights}</b></div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                    <BoardSVG board={board} size={240}/>
                    <div style={{flex:1,fontSize:10,color:"#94A3B8",lineHeight:1.7}}>
                      <div><span style={{color:"#22D3EE"}}>Entry:</span> {board.entry.dir} of R{board.entry.row+1}C{board.entry.col+1}</div>
                      <div><span style={{color:"#F472B6"}}>Exit:</span> {board.exit.dir} of R{board.exit.row+1}C{board.exit.col+1}</div>
                      <div style={{marginTop:6,color:"#A78BFA",fontSize:9}}>Tile notch requirements:</div>
                      {Object.entries(a.rc).sort().map(([n,ct])=>(<div key={n} style={{fontSize:9}}>{ct}× need {n} notch{n!=="1"?"es":""}</div>))}
                      <div style={{marginTop:6,fontSize:9,color:"#FBBF24"}}>
                        Path: {board.path.map(([r,c])=>`R${r+1}C${c+1}`).join(" → ")}
                      </div>
                      <div style={{fontSize:8,color:"#475569",marginTop:4}}>{board.desc}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Editable inventory */}
          <div style={{marginTop:20}}>
            <InventoryEditor inventories={inventories} setInventories={setInventories}/>
          </div>

          <div style={{marginTop:12,textAlign:"center"}}>
            <button onClick={runSim} disabled={running} style={{
              padding:"12px 40px",background:running?"#334155":"linear-gradient(135deg,#6366F1,#A78BFA)",
              border:"none",borderRadius:8,color:"#FFF",fontSize:13,fontWeight:700,cursor:running?"wait":"pointer",fontFamily:"inherit"}}>
              {running?`Simulating... ${progress}%`:"▶ Run Progressive Simulation"}
            </button>
            <p style={{fontSize:9,color:"#475569",marginTop:5}}>
              120 iterations × {inventories.length} archetypes × 6 boards. Fragments consumed across boards 1→6.
            </p>
          </div>
        </div>)}

        {/* ═══ PHASE 2: RESULTS ═══ */}
        {phase===2&&simData&&(<div>
          <h2 style={{fontSize:15,fontWeight:700,color:"#F8FAFC",margin:"0 0 4px"}}>Phase 2: Progressive Simulation Results</h2>
          <p style={{fontSize:10,color:"#64748B",margin:"0 0 14px",lineHeight:1.6}}>
            Fragments consumed board-to-board. <b style={{color:"#FBBF24"}}>Perfect Clear</b> = 16/16 filled + Hamiltonian.
            <b style={{color:"#34D399"}}> Full Board</b> = 16/16 filled (no Hamiltonian required).
          </p>

          {/* Heatmap */}
          <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginBottom:14,overflowX:"auto"}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#A78BFA",margin:"0 0 10px",letterSpacing:1,textTransform:"uppercase"}}>Avg Score Heatmap</h3>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
              <thead><tr>
                <th style={{padding:"5px 8px",textAlign:"left",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:9}}>Archetype</th>
                {BOARDS.map((b,i)=>(<th key={i} style={{padding:"5px 6px",textAlign:"center",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:9}}>B{i+1} ({b.difficulty[0]})</th>))}
                <th style={{padding:"5px 8px",textAlign:"center",color:"#FBBF24",borderBottom:"1px solid #1E293B",fontSize:9}}>Cumulative</th>
              </tr></thead>
              <tbody>{inventories.map((inv,a)=>{
                if(!simData[a])return null;
                const bds=simData[a];
                const mx=Math.max(...Object.values(simData).flatMap(d=>d.map(b=>b.avgScore)),1);
                return(<tr key={a}>
                  <td style={{padding:"7px 8px",color:"#E2E8F0",fontWeight:600,borderBottom:"1px solid #1E293B20",fontSize:10,whiteSpace:"nowrap"}}>{inv.name}</td>
                  {bds.map((bd,b)=>(<td key={b} style={{padding:"7px 6px",textAlign:"center",fontWeight:700,
                    color:bd.avgScore>0?"#F8FAFC":"#334155",
                    background:`rgba(99,102,241,${bd.avgScore/mx*0.5})`,borderBottom:"1px solid #1E293B20",fontSize:10}}>
                    {bd.avgScore}{bd.stopPct>=99&&<div style={{fontSize:7,color:"#F87171"}}>⛔</div>}
                  </td>))}
                  <td style={{padding:"7px 8px",textAlign:"center",fontWeight:700,color:"#FBBF24",borderBottom:"1px solid #1E293B20"}}>{bds[5].avgCum}</td>
                </tr>);
              })}</tbody>
            </table>
          </div>

          {/* Per-archetype detail */}
          {inventories.map((inv,a)=>{
            if(!simData[a])return null;
            const bds=simData[a];
            const firstStop=bds.findIndex(b=>b.stopPct>=99);
            return(
              <div key={a} style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginBottom:10}}>
                <h3 style={{fontSize:12,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>
                  {inv.name} <span style={{fontSize:10,color:"#64748B",fontWeight:400}}>— {totalF(inv)} frags, {inv.combos} combos</span>
                </h3>
                {firstStop>=0&&<p style={{fontSize:9,color:"#FCA5A5",margin:"4px 0 8px",padding:"4px 8px",background:"#7F1D1D15",border:"1px solid #F8717125",borderRadius:4}}>
                  ⚠ Fragments fully depleted after Board {firstStop}. Boards {firstStop+1}–6 have no fragments. Incomplete boards still earn points for tiles placed.
                </p>}

                {/* Badge Breakdown: Owned vs Used per board */}
                <div style={{marginBottom:10,overflowX:"auto"}}>
                  <div style={{fontSize:9,color:"#64748B",marginBottom:6,fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>
                    🧩 Badge Breakdown — Owned vs Avg Used per Board
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
                    <thead>
                      <tr>
                        <th style={{padding:"4px 6px",textAlign:"left",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:8}}>Fragment Type</th>
                        <th style={{padding:"4px 6px",textAlign:"center",color:"#FBBF24",borderBottom:"1px solid #1E293B",fontSize:8}}>Owned</th>
                        {BOARDS.map((_,b)=>(
                          <th key={b} style={{padding:"4px 5px",textAlign:"center",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:8}}>B{b+1} Used</th>
                        ))}
                        <th style={{padding:"4px 6px",textAlign:"center",color:"#F472B6",borderBottom:"1px solid #1E293B",fontSize:8}}>Total Used</th>
                        <th style={{padding:"4px 6px",textAlign:"center",color:"#34D399",borderBottom:"1px solid #1E293B",fontSize:8}}>Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FRAG_KEYS.map(k=>{
                        const owned=inv.frags[k]||0;
                        if(owned===0 && bds.every(bd=>(bd.avgUsage?.[k]||0)===0)) return null;
                        const usedPerBoard=bds.map(bd=>bd.avgUsage?.[k]||0);
                        const totalUsed=+usedPerBoard.reduce((s,v)=>s+v,0).toFixed(1);
                        const remaining=+(owned-totalUsed).toFixed(1);
                        return(
                          <tr key={k}>
                            <td style={{padding:"4px 6px",color:FTYPES[k].c,fontWeight:600,borderBottom:"1px solid #1E293B15",whiteSpace:"nowrap"}}>
                              <span style={{display:"inline-block",width:6,height:6,borderRadius:2,background:FTYPES[k].c,marginRight:4,verticalAlign:"middle"}}/>
                              {FRAG_LABELS[k]}
                            </td>
                            <td style={{padding:"4px 6px",textAlign:"center",color:"#FBBF24",fontWeight:700,borderBottom:"1px solid #1E293B15"}}>{owned}</td>
                            {usedPerBoard.map((u,b)=>(
                              <td key={b} style={{padding:"4px 5px",textAlign:"center",borderBottom:"1px solid #1E293B15",
                                color:u>0?"#E2E8F0":"#334155",fontWeight:u>0?600:400,
                                background:u>0?`${FTYPES[k].c}15`:"transparent"}}>
                                {u>0?u.toFixed(1):"—"}
                              </td>
                            ))}
                            <td style={{padding:"4px 6px",textAlign:"center",color:"#F472B6",fontWeight:700,borderBottom:"1px solid #1E293B15"}}>{totalUsed}</td>
                            <td style={{padding:"4px 6px",textAlign:"center",fontWeight:700,borderBottom:"1px solid #1E293B15",
                              color:remaining>0.5?"#34D399":remaining<-0.5?"#F87171":"#475569"}}>
                              {remaining.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr style={{borderTop:"1px solid #334155"}}>
                        <td style={{padding:"5px 6px",color:"#F8FAFC",fontWeight:700,fontSize:9}}>TOTAL</td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:"#FBBF24",fontWeight:700}}>{totalF(inv)}</td>
                        {bds.map((bd,b)=>{
                          const boardTotal=+FRAG_KEYS.reduce((s,k)=>s+(bd.avgUsage?.[k]||0),0).toFixed(1);
                          return(<td key={b} style={{padding:"5px 5px",textAlign:"center",color:boardTotal>0?"#F8FAFC":"#334155",fontWeight:700}}>{boardTotal>0?boardTotal.toFixed(1):"—"}</td>);
                        })}
                        <td style={{padding:"5px 6px",textAlign:"center",color:"#F472B6",fontWeight:700}}>
                          {+FRAG_KEYS.reduce((s,k)=>s+bds.reduce((ss,bd)=>ss+(bd.avgUsage?.[k]||0),0),0).toFixed(1)}
                        </td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:"#34D399",fontWeight:700}}>
                          {+(totalF(inv)-FRAG_KEYS.reduce((s,k)=>s+bds.reduce((ss,bd)=>ss+(bd.avgUsage?.[k]||0),0),0)).toFixed(1)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
                    <thead><tr style={{color:"#64748B"}}>
                      {["Board","Frags\nAvail","Avg\nScore","Min","Max","σ","Slots\nFilled","On\nPath","Full Board\n(16/16)","Perfect\nClear ✦","Combo\nPts","Cum.\nScore","Status"].map(h=>(
                        <th key={h} style={{padding:"4px 5px",textAlign:"center",borderBottom:"1px solid #1E293B",whiteSpace:"pre-line",fontSize:8,lineHeight:1.3}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{bds.map((bd,b)=>{
                      const dead=bd.stopPct>=99;
                      return(<tr key={b} style={{opacity:dead?0.35:1}}>
                        <td style={{padding:"5px",color:"#A78BFA",fontWeight:600,textAlign:"center"}}>{BOARDS[b].name}</td>
                        <td style={{padding:"5px",textAlign:"center",color:bd.avgFrags<3?"#F87171":"#94A3B8"}}>{bd.avgFrags.toFixed(0)}</td>
                        <td style={{padding:"5px",textAlign:"center",color:"#22D3EE",fontWeight:700}}>{bd.avgScore}</td>
                        <td style={{padding:"5px",textAlign:"center",color:"#475569"}}>{bd.minScore}</td>
                        <td style={{padding:"5px",textAlign:"center",color:"#475569"}}>{bd.maxScore}</td>
                        <td style={{padding:"5px",textAlign:"center",color:"#F59E0B"}}>{bd.stdDev}</td>
                        <td style={{padding:"5px",textAlign:"center"}}>{bd.avgFilled}/16</td>
                        <td style={{padding:"5px",textAlign:"center"}}>{bd.avgOnPath}</td>
                        <td style={{padding:"5px",textAlign:"center",color:bd.pctFull>0?"#34D399":"#334155",fontWeight:bd.pctFull>0?700:400}}>{bd.pctFull}%</td>
                        <td style={{padding:"5px",textAlign:"center",fontWeight:700,
                          color:bd.pctPC>0?"#FBBF24":"#334155",
                          background:bd.pctPC>0?"#FBBF2410":"transparent",borderRadius:3}}>
                          {bd.pctPC>0?`${bd.pctPC}%`:"—"}
                        </td>
                        <td style={{padding:"5px",textAlign:"center",color:"#EC4899"}}>{bd.avgCombo}</td>
                        <td style={{padding:"5px",textAlign:"center",color:"#FBBF24",fontWeight:600}}>{bd.avgCum}</td>
                        <td style={{padding:"5px",textAlign:"center"}}>{dead?<span style={{color:"#F87171",fontWeight:700}}>⛔ NO FRAGS</span>:bd.stopPct>0?<span style={{color:"#F59E0B"}}>⚠ {bd.stopPct}%</span>:<span style={{color:"#34D399"}}>✓</span>}</td>
                      </tr>);
                    })}</tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>)}

        {/* ═══ PHASE 3: ANALYSIS ═══ */}
        {phase===3&&simData&&(<div>
          <h2 style={{fontSize:15,fontWeight:700,color:"#F8FAFC",margin:"0 0 14px"}}>Phase 3: Analysis Report</h2>
          {[
            {q:"1. Can a passive holder have a meaningful experience?",a:()=>{const d=simData[0];if(!d)return"N/A";const s=d.findIndex(b=>b.stopPct>=99);return`With ${totalF(inventories[0])} fragments: Board 1 fills ~${d[0].avgFilled}/16 slots (avg ${d[0].avgScore} pts). ${s>=0?`Depletes after Board ${s}.`:"Plays all 6."} Empty squares are a visual call-to-action for earning more badges.`;}},
            {q:"2. Can an active single-holder complete an easy board?",a:()=>{const d=simData[1];if(!d)return"N/A";return`With ${totalF(inventories[1])} fragments: Board 1 avg ${d[0].avgFilled}/16 filled, ${d[0].pctFull}% full board, ${d[0].pctPC}% perfect clear. The cross-pieces are critical universal connectors.`;}},
            {q:"3. Scoring gap: smallest vs largest holder?",a:()=>{if(!simData[0]||!simData[inventories.length-1])return"N/A";const c0=simData[0][5].avgCum,cN=simData[inventories.length-1][5].avgCum;return`Cumulative across 6 boards: ${inventories[0].name} ~${c0} pts vs ${inventories[inventories.length-1].name} ~${cN} pts (${(cN/Math.max(c0,1)).toFixed(1)}× multiplier). Progressive consumption amplifies this gap.`;}},
            {q:"4. Do rotation constraints create meaningful decisions?",a:()=>"Yes. Corner ±90° restriction prevents reaching the opposite orientation. T-piece lock (no rotation) makes it the highest-stakes placement decision. On hard boards with many turns, a misoriented T-piece is devastating."},
            {q:"5. How impactful are combo badges?",a:()=>{if(!sensData)return"N/A";return inventories.map((inv,a)=>{if(!sensData[a])return"";const d=sensData[a];return`${inv.name}: +${(d.w-d.wo).toFixed(0)} pts (${((d.w-d.wo)/Math.max(d.w,1)*100).toFixed(1)}%)`;}).filter(Boolean).join(" • ")+". Combos add 5-15% — meaningful but not dominant.";}},
            {q:"6. Do hard boards require better fragments?",a:()=>{const mid=simData[Math.min(2,inventories.length-1)];if(!mid)return"N/A";return`On easy Board 1: avg ${mid[0].avgOnPath} on path. On hard Board 4: avg ${mid[3].avgOnPath} on path. Hard boards demand more corners/T-pieces, and by then progressive depletion has consumed best pieces.`;}},
            {q:"7. Is T-piece lock the right call?",a:()=>"Yes. Creates deepest strategic decision: burn T-piece early for guaranteed points, or save for hard board where it might not even fit? Keep locked for V1."},
            {q:"8. Random orientation variance?",a:()=>{const mid=simData[Math.min(2,inventories.length-1)];if(!mid)return"N/A";const stds=mid.map(b=>b.stdDev);return`σ ranges ${Math.min(...stds)}–${Math.max(...stds)} across boards. Moderate variance — consequential but not punishing. Progressive system compounds it.`;}},
          ].map(({q,a},i)=>(
            <div key={i} style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginBottom:8}}>
              <h4 style={{fontSize:11,fontWeight:700,color:"#A78BFA",margin:"0 0 6px"}}>{q}</h4>
              <p style={{fontSize:11,color:"#CBD5E1",margin:0,lineHeight:1.7}}>{a()}</p>
            </div>
          ))}
          {sensData&&(
            <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginTop:10}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#F59E0B",margin:"0 0 10px",textTransform:"uppercase",letterSpacing:1}}>Sensitivity: Combo Impact (Cumulative)</h3>
              <table style={{borderCollapse:"collapse",fontSize:10,maxWidth:540}}>
                <thead><tr style={{color:"#64748B"}}>{["Archetype","With","Without","Δ","%"].map(h=>(<th key={h} style={{padding:"5px 8px",textAlign:"center",borderBottom:"1px solid #1E293B"}}>{h}</th>))}</tr></thead>
                <tbody>{inventories.map((inv,a)=>{if(!sensData[a])return null;const d=sensData[a];const diff=(d.w-d.wo).toFixed(0);
                  return(<tr key={a}><td style={{padding:"6px 8px",color:"#E2E8F0",fontWeight:600,fontSize:10}}>{inv.name}</td>
                    <td style={{padding:"6px 8px",textAlign:"center",color:"#22D3EE"}}>{d.w}</td>
                    <td style={{padding:"6px 8px",textAlign:"center",color:"#94A3B8"}}>{d.wo}</td>
                    <td style={{padding:"6px 8px",textAlign:"center",color:"#34D399",fontWeight:700}}>+{diff}</td>
                    <td style={{padding:"6px 8px",textAlign:"center",color:"#F59E0B"}}>{(d.w>0?((d.w-d.wo)/d.w*100):0).toFixed(1)}%</td></tr>);
                })}</tbody>
              </table>
            </div>
          )}
        </div>)}

        {/* ═══ PHASE 4: BALANCE ═══ */}
        {phase===4&&simData&&(<div>
          <h2 style={{fontSize:15,fontWeight:700,color:"#F8FAFC",margin:"0 0 14px"}}>Phase 4: Balance Recommendations</h2>
          {[
            {t:"Scoring Balance",i:"⚖️",c:"#22D3EE",x:()=>`${inventories[0].name}→${inventories[inventories.length-1].name} cumulative: ${simData[0]?.[5]?.avgCum||0} → ${simData[inventories.length-1]?.[5]?.avgCum||0} pts. Consider scaling bonuses by difficulty: Full Board +50/+75/+100 for Easy/Normal/Hard.`},
            {t:"Progressive Depletion",i:"🔋",c:"#A78BFA",x:()=>{return inventories.map((inv,a)=>{if(!simData[a])return"";const s=simData[a].findIndex(b=>b.stopPct>=99);return`${inv.name}: ${s>=0?`stops after B${s}`:"all 6 boards"}`;}).filter(Boolean).join(" • ")+". Consider 'Fragment Echo': completing a board returns 1 fragment.";}},
            {t:"Perfect Clear Tuning",i:"✨",c:"#FBBF24",x:()=>{return inventories.map((inv,a)=>{if(!simData[a])return"";const r=simData[a].map(b=>b.pctPC);const any=r.some(v=>v>0);return`${inv.name}: ${any?r.map((v,i)=>v>0?`B${i+1}:${v}%`:"").filter(Boolean).join(" ")||"0%":"0% all boards"}`;}).filter(Boolean).join(" | ")+". Perfect clears should feel legendary.";}},
            {t:"Key Findings",i:"💡",c:"#F59E0B",x:()=>"1) Progressive consumption is the #1 balance lever. 2) 4-notch pieces are too universal — consider making some Special badges 3-notch. 3) Board order strategy matters. 4) Whale advantage is choices, not raw power. 5) T-piece lock + progression creates the deepest strategic layer."},
          ].map(({t,i,c,x},idx)=>(
            <div key={idx} style={{background:"#111827",borderLeft:`3px solid ${c}`,border:`1px solid ${c}30`,borderRadius:10,padding:14,marginBottom:10}}>
              <h4 style={{fontSize:11,fontWeight:700,color:c,margin:"0 0 6px"}}>{i} {t}</h4>
              <p style={{fontSize:11,color:"#CBD5E1",margin:0,lineHeight:1.7}}>{x()}</p>
            </div>
          ))}
          <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginTop:10}}>
            <h3 style={{fontSize:12,fontWeight:700,color:"#F8FAFC",margin:"0 0 10px"}}>Cumulative Score Distribution</h3>
            {inventories.map((inv,a)=>{
              if(!simData[a])return null;
              const cum=simData[a][5].avgCum;
              const gMax=Math.max(...Object.values(simData).map(d=>d?.[5]?.avgCum||0),1);
              const colors=["#64748B","#3B82F6","#F59E0B","#EC4899","#8B5CF6","#10B981"];
              return(
                <div key={a} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
                  <div style={{width:145,fontSize:10,color:"#94A3B8",textAlign:"right",flexShrink:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inv.name}</div>
                  <div style={{flex:1,position:"relative",height:22,background:"#0F172A",borderRadius:4}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${cum/gMax*100}%`,background:`linear-gradient(90deg,${colors[a%colors.length]}60,${colors[a%colors.length]}CC)`,borderRadius:4}}/>
                    <div style={{position:"absolute",left:`${Math.min(cum/gMax*100,90)}%`,top:"50%",transform:"translate(-10%,-50%)",fontSize:10,color:"#F8FAFC",fontWeight:700,textShadow:"0 0 6px #000"}}>{cum}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>)}

        {running&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
            <div style={{background:"#1E293B",padding:24,borderRadius:12,textAlign:"center",border:"1px solid #334155"}}>
              <div style={{width:180,height:4,background:"#0F172A",borderRadius:2,overflow:"hidden",marginBottom:10}}>
                <div style={{width:`${progress}%`,height:"100%",background:"linear-gradient(90deg,#6366F1,#A78BFA)",borderRadius:2,transition:"width .3s"}}/>
              </div>
              <p style={{fontSize:11,color:"#A78BFA",margin:0,fontWeight:600}}>Simulating... {progress}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
