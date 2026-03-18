import { useState, useMemo, useCallback, useEffect } from "react";
import { WALLETS } from "./wallets.js";

/* ================================================================
   MEM FRAGMENT BOARD — PHASE A SIMULATION
   Updated: A/B corner split, T-piece locked, 16 straights,
   badge guide, board reading guide, scoring guide,
   Figma-matched SVG fragments
   ================================================================ */

const DIRS={N:[-1,0],S:[1,0],E:[0,1],W:[0,-1]};
const OPP={N:"S",S:"N",E:"W",W:"E"};
const SC={FULL:50,HAM:100,COMBO:15};

// ── Figma asset URLs (expire in 7 days — replace with hosted versions for production) ──
const FIGMA={
  straightWE:"https://www.figma.com/api/mcp/asset/f6719cf6-40e0-47b1-80e6-ab70e9b4e9fe",
  straightNS:"https://www.figma.com/api/mcp/asset/c948242e-534b-4773-82de-eaa0d1eaf353",
  cornerB:"https://www.figma.com/api/mcp/asset/18bee469-9e12-425b-ab53-870f7fbf1a09",
  cornerA:"https://www.figma.com/api/mcp/asset/15275471-5a24-4e22-b6e5-575ae9915ff1",
  tPiece:"https://www.figma.com/api/mcp/asset/bc815d7a-d338-4913-b145-579971a5fb62",
  cross:"https://www.figma.com/api/mcp/asset/970bf6a1-94da-4157-9460-e4822acf590d",
  combo:"https://www.figma.com/api/mcp/asset/6948e743-c928-4f5e-be5d-78b9c5b167d3",
  comboExample:"https://www.figma.com/api/mcp/asset/c7521c7d-f1ab-4255-9930-804bdd1e54a5",
  boardWithCombo:"https://www.figma.com/api/mcp/asset/068abe9b-378d-41b7-acc0-67449b4c8f90",
  perfectBoard:"https://www.figma.com/api/mcp/asset/cacb7439-f7a2-4d59-9aa6-ada5cd5da8f5",
  hamiltonianLine:"https://www.figma.com/api/mcp/asset/9a5f9dde-02e0-4681-85da-097f1494cb2a",
};

// ── Fragment types ──
const FT={
  CD_STRAIGHT:{tier:"C/D",shape:"Straight",conn:10,disc:5,cl:"#64748B"},
  B_CORNER:   {tier:"B",  shape:"CornerB", conn:15,disc:7,cl:"#3B82F6"},
  A_CORNER:   {tier:"A",  shape:"CornerA", conn:15,disc:7,cl:"#60A5FA"},
  S_TPIECE:   {tier:"S",  shape:"T-piece", conn:25,disc:12,cl:"#F59E0B"},
  SPECIAL:    {tier:"Sp", shape:"Cross",   conn:40,disc:20,cl:"#8B5CF6"},
  UNIQUE:     {tier:"Un", shape:"Cross",   conn:40,disc:20,cl:"#EC4899"},
  HIDDEN:     {tier:"Hd", shape:"Cross",   conn:40,disc:20,cl:"#10B981"},
};
const FK=Object.keys(FT);
const FL={
  CD_STRAIGHT:"C/D Straight",B_CORNER:"B Corner",A_CORNER:"A Corner",
  S_TPIECE:"S T-Piece",SPECIAL:"Special Cross",UNIQUE:"Unique Cross",HIDDEN:"Hidden Cross",
};

// ── Rotation rules ──
// Straight: free → NS ↔ WE
// B Corner: limited → WN ↔ NE
// A Corner: limited → WS ↔ SE
// T-piece: LOCKED → issued as one of WNE/NES/ESW/SWN
// Cross: irrelevant → always NSEW

function randOrient(shape){
  if(shape==="Straight") return Math.random()<0.5?["N","S"]:["E","W"];
  if(shape==="CornerB")  return Math.random()<0.5?["W","N"]:["N","E"];
  if(shape==="CornerA")  return Math.random()<0.5?["W","S"]:["S","E"];
  if(shape==="T-piece"){
    const opts=[["W","N","E"],["N","E","S"],["E","S","W"],["S","W","N"]];
    return[...opts[Math.random()*4|0]];
  }
  return["N","S","E","W"];
}

function allRots(shape,notches){
  if(shape==="Cross") return[["N","S","E","W"]];
  if(shape==="T-piece") return[notches]; // LOCKED
  if(shape==="Straight") return[["N","S"],["E","W"]];
  if(shape==="CornerB") return[["W","N"],["N","E"]];
  if(shape==="CornerA") return[["W","S"],["S","E"]];
  return[notches];
}

function mkFrag(type,id){const d=FT[type];return{id,type,tier:d.tier,shape:d.shape,conn:d.conn,disc:d.disc,cl:d.cl,notches:randOrient(d.shape)};}

// ── 16 outer edges ──
const OUTER=[];
for(let c=0;c<4;c++){OUTER.push({r:0,c,d:"N"});OUTER.push({r:3,c,d:"S"});}
for(let r=0;r<4;r++){OUTER.push({r,c:0,d:"W"});OUTER.push({r,c:3,d:"E"});}

// ── Boards ──
function adj(a,b){return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;}
function verify(p){if(p.length!==16)return false;const s=new Set();for(let i=0;i<16;i++){const k=p[i][0]*4+p[i][1];if(s.has(k))return false;s.add(k);if(i>0&&!adj(p[i],p[i-1]))return false;}return true;}

const BOARDS=[
  {name:"Board 1",difficulty:"Easy",entry:{row:0,col:0,dir:"W"},exit:{row:3,col:0,dir:"W"},
   path:[[0,0],[0,1],[0,2],[0,3],[1,3],[1,2],[1,1],[1,0],[2,0],[2,1],[2,2],[2,3],[3,3],[3,2],[3,1],[3,0]],
   desc:"Classic snake pattern. Enters west R1C1, exits west R4C1."},
  {name:"Board 2",difficulty:"Easy",entry:{row:0,col:3,dir:"E"},exit:{row:3,col:3,dir:"E"},
   path:[[0,3],[0,2],[0,1],[0,0],[1,0],[1,1],[1,2],[1,3],[2,3],[2,2],[2,1],[2,0],[3,0],[3,1],[3,2],[3,3]],
   desc:"Reverse snake. Enters east R1C4, exits east R4C4."},
  {name:"Board 3",difficulty:"Normal",entry:{row:0,col:0,dir:"N"},exit:{row:1,col:0,dir:"W"},
   path:[[0,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3],[3,2],[3,1],[3,0],[2,0],[2,1],[2,2],[1,2],[1,1],[1,0]],
   desc:"Clockwise spiral inward. Enters north R1C1, exits west R2C1."},
  {name:"Board 4",difficulty:"Hard",entry:{row:0,col:0,dir:"N"},exit:{row:0,col:3,dir:"N"},
   path:[[0,0],[1,0],[2,0],[3,0],[3,1],[2,1],[1,1],[0,1],[0,2],[1,2],[2,2],[3,2],[3,3],[2,3],[1,3],[0,3]],
   desc:"Column snake. Same-side entry/exit on top edge."},
  {name:"Board 5",difficulty:"Hard",entry:{row:0,col:1,dir:"N"},exit:{row:3,col:3,dir:"S"},
   path:[[0,1],[0,0],[1,0],[1,1],[1,2],[0,2],[0,3],[1,3],[2,3],[2,2],[2,1],[2,0],[3,0],[3,1],[3,2],[3,3]],
   desc:"Irregular weave with 8 turns. Entry north R1C2, exit south R4C4."},
  {name:"Board 6",difficulty:"Hard",entry:{row:0,col:2,dir:"N"},exit:{row:0,col:1,dir:"N"},
   path:[[0,2],[0,3],[1,3],[1,2],[2,2],[2,3],[3,3],[3,2],[3,1],[3,0],[2,0],[2,1],[1,1],[1,0],[0,0],[0,1]],
   desc:"Maximum corners (12 turns). Same-side entry/exit on top."},
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

function countTurns(path){let t=0;for(let i=1;i<path.length-1;i++){const d1=[path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]];const d2=[path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]];if(d1[0]!==d2[0]||d1[1]!==d2[1])t++;}return t;}

// Analyze what each board position needs (straight/cornerB/cornerA/3notch/any)
function analyzeBoardNeeds(board){
  const reqs=pathReqs(board);
  let str=0,cB=0,cA=0,any=0;
  reqs.forEach(({need})=>{
    if(need.length>=3){any++;return;}
    const s=[...need].sort().join(",");
    if(s==="N,S"||s==="E,W")str++;
    else if(s==="N,W"||s==="E,N")cB++;
    else if(s==="S,W"||s==="E,S")cA++;
    else any++;
  });
  return{straights:str,bCorners:cB,aCorners:cA,flexSlots:any};
}

// ── Inventory ──
const DEFAULT_INV=[
  {name:"Passive Single Holder",combos:0,frags:{CD_STRAIGHT:2,B_CORNER:1,A_CORNER:0,S_TPIECE:0,SPECIAL:2,UNIQUE:0,HIDDEN:0}},
  {name:"Active Single Holder",combos:1,frags:{CD_STRAIGHT:2,B_CORNER:1,A_CORNER:0,S_TPIECE:0,SPECIAL:8,UNIQUE:2,HIDDEN:0}},
  {name:"Mid Collector (6-10)",combos:4,frags:{CD_STRAIGHT:6,B_CORNER:4,A_CORNER:2,S_TPIECE:1,SPECIAL:8,UNIQUE:3,HIDDEN:1}},
  {name:"Large Holder (11-50)",combos:8,frags:{CD_STRAIGHT:8,B_CORNER:5,A_CORNER:3,S_TPIECE:1,SPECIAL:8,UNIQUE:4,HIDDEN:2}},
  {name:"Whale (51+)",combos:12,frags:{CD_STRAIGHT:10,B_CORNER:6,A_CORNER:5,S_TPIECE:2,SPECIAL:8,UNIQUE:5,HIDDEN:3}},
];

function mkInv(inv){const f=[];let id=0;for(const[t,n]of Object.entries(inv.frags))for(let i=0;i<n;i++)f.push(mkFrag(t,id++));return{frags:f,combos:inv.combos};}
const totalF=inv=>Object.values(inv.frags).reduce((a,b)=>a+b,0);

// ── Solver ──
function canFit(fn,need){for(const n of need)if(!fn.includes(n))return false;return true;}

function solveBoard(board,frags){
  const reqs=pathReqs(board);
  const grid=Array.from({length:4},()=>Array(4).fill(null));
  const used=new Set();
  const order=reqs.map((_,i)=>i).sort((a,b)=>reqs[b].need.length-reqs[a].need.length);
  const onP=new Array(16).fill(false);
  for(const ri of order){
    const{r,c,need}=reqs[ri];let bfi=-1,brot=null,bval=-1;
    for(let fi=0;fi<frags.length;fi++){
      if(used.has(fi))continue;
      for(const rot of allRots(frags[fi].shape,frags[fi].notches)){
        if(canFit(rot,need)&&frags[fi].conn>bval){bval=frags[fi].conn;bfi=fi;brot=rot;}
      }
    }
    if(bfi>=0){used.add(bfi);grid[r][c]={...frags[bfi],notches:brot,onPath:true};onP[ri]=true;}
  }
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    if(grid[r][c])continue;let bfi=-1,bd=-1;
    for(let fi=0;fi<frags.length;fi++){if(used.has(fi))continue;if(frags[fi].disc>bd){bd=frags[fi].disc;bfi=fi;}}
    if(bfi>=0){used.add(bfi);grid[r][c]={...frags[bfi],onPath:false};}
  }
  return{grid,usedIds:used};
}

function scoreGrid(grid,board,combos){
  let pP=0,dP=0,filled=0,onC=0;
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){const t=grid[r][c];if(t){filled++;if(t.onPath){pP+=t.conn;onC++;}else{dP+=t.disc;}}}
  const fB=filled===16?SC.FULL:0,hB=onC===16?SC.HAM:0;
  let cP=0;
  if(combos>0){
    const cands=[];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){const t=grid[r][c];if(!t)continue;let cn=0;
      for(const n of t.notches){const[dr,dc]=DIRS[n];const nr=r+dr,nc=c+dc;if(nr>=0&&nr<4&&nc>=0&&nc<4&&grid[nr][nc]&&grid[nr][nc].notches.includes(OPP[n]))cn++;}
      cands.push({cn});}
    cands.sort((a,b)=>b.cn-a.cn);
    for(let i=0;i<Math.min(combos,cands.length);i++)cP+=cands[i].cn*SC.COMBO;
  }
  return{filled,onC,dC:filled-onC,empty:16-filled,pP,dP,fB,hB,cP,perfectClear:filled===16&&onC===16,boardCleared:filled===16,total:pP+dP+fB+hB+cP};
}

// ── Progressive simulation ──
function runProgressive(invs,iters=120){
  const data={};
  for(let a=0;a<invs.length;a++){
    const perBoard=[];for(let b=0;b<6;b++)perBoard.push({runs:[],stopped:0,usageRuns:[]});
    for(let it=0;it<iters;it++){
      const{frags,combos}=mkInv(invs[a]);let rem=[...frags],cum=0;
      for(let b=0;b<6;b++){
        const emptyU={};FK.forEach(k=>emptyU[k]=0);
        if(rem.length===0){perBoard[b].runs.push({filled:0,onC:0,dC:0,empty:16,pP:0,dP:0,fB:0,hB:0,cP:0,perfectClear:false,boardCleared:false,total:0,cumTotal:cum,stopped:true,fragsAvail:0});perBoard[b].stopped++;perBoard[b].usageRuns.push(emptyU);continue;}
        const{grid,usedIds}=solveBoard(BOARDS[b],rem);
        const sc=scoreGrid(grid,BOARDS[b],combos);cum+=sc.total;
        const usage={...emptyU};for(const idx of usedIds)usage[rem[idx].type]=(usage[rem[idx].type]||0)+1;
        perBoard[b].usageRuns.push(usage);
        perBoard[b].runs.push({...sc,cumTotal:cum,stopped:sc.filled===0,fragsAvail:rem.length});
        if(sc.filled===0)perBoard[b].stopped++;
        rem=rem.filter((_,i)=>!usedIds.has(i));
      }
    }
    data[a]=perBoard.map((br,bi)=>{
      const R=br.runs,N=R.length;const av=fn=>R.reduce((s,r)=>s+fn(r),0)/N;const vs=R.map(r=>r.total);const avgT=av(r=>r.total);
      const avgUsage={};FK.forEach(k=>{avgUsage[k]=+(br.usageRuns.reduce((s,u)=>s+(u[k]||0),0)/N).toFixed(1);});
      return{bi,avgScore:+avgT.toFixed(1),minScore:Math.min(...vs),maxScore:Math.max(...vs),stdDev:+(Math.sqrt(av(r=>(r.total-avgT)**2)).toFixed(1)),avgFilled:+av(r=>r.filled).toFixed(1),avgOnPath:+av(r=>r.onC).toFixed(1),pctFull:+((R.filter(r=>r.boardCleared).length/N*100).toFixed(1)),pctPC:+((R.filter(r=>r.perfectClear).length/N*100).toFixed(1)),avgCombo:+av(r=>r.cP).toFixed(1),avgCum:+av(r=>r.cumTotal).toFixed(1),stopPct:+((br.stopped/N*100).toFixed(1)),avgFrags:+av(r=>r.fragsAvail).toFixed(1),avgUsage};
    });
  }
  return data;
}

function runComboSens(invs,iters=60){
  const out={};
  for(let a=0;a<invs.length;a++){
    const wC=[],woC=[];
    for(let i=0;i<iters;i++){
      const{frags,combos}=mkInv(invs[a]);let r1=[...frags],r2=[...frags],s1=0,s2=0;
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

// ── SVG Fragment Component (matches Figma style) ──
function FragSVG({shape,notches,size=48,color="#888"}){
  const s=size,r=s*0.12,nw=s*0.18,nh=s*0.08,cr=s*0.15;
  const hasN=notches?.includes("N"),hasS=notches?.includes("S"),hasE=notches?.includes("E"),hasW=notches?.includes("W");
  return(
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <rect x={1} y={1} width={s-2} height={s-2} rx={r} fill="#1a1a2a" stroke={color} strokeWidth={1.5}/>
      {/* Notches */}
      {hasN&&<rect x={s/2-nw/2} y={0} width={nw} height={nh} rx={1} fill={color}/>}
      {hasS&&<rect x={s/2-nw/2} y={s-nh} width={nw} height={nh} rx={1} fill={color}/>}
      {hasW&&<rect x={0} y={s/2-nw/2} width={nh} height={nw} rx={1} fill={color}/>}
      {hasE&&<rect x={s-nh} y={s/2-nw/2} width={nh} height={nw} rx={1} fill={color}/>}
      {/* Transistor hole */}
      <circle cx={s/2} cy={s/2} r={cr} fill="none" stroke={color} strokeWidth={1} opacity={0.5}/>
      <circle cx={s/2} cy={s/2} r={cr*0.5} fill="none" stroke={color} strokeWidth={0.8} opacity={0.4}/>
    </svg>
  );
}

// ── Board SVG ──
function BoardSVG({board,size=240}){
  const pad=18,gap=3;const cs=(size-pad*2-gap*3)/4;
  const pMap={};board.path.forEach(([r,c],i)=>pMap[`${r},${c}`]=i);
  const reqs=pathReqs(board);const reqMap={};reqs.forEach(rq=>reqMap[`${rq.r},${rq.c}`]=rq.need);
  const cc=(r,c)=>({x:pad+c*(cs+gap)+cs/2,y:pad+r*(cs+gap)+cs/2});
  const pts=board.path.map(([r,c])=>cc(r,c));
  const dOff={N:[0,-(cs/2+8)],S:[0,cs/2+8],E:[cs/2+8,0],W:[-(cs/2+8),0]};
  const eC=cc(board.entry.row,board.entry.col),xC=cc(board.exit.row,board.exit.col);
  const eS={x:eC.x+dOff[board.entry.dir][0],y:eC.y+dOff[board.entry.dir][1]};
  const xE={x:xC.x+dOff[board.exit.dir][0],y:xC.y+dOff[board.exit.dir][1]};

  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
      <defs>
        <marker id="ah" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto"><polygon points="0 0,5 2,0 4" fill="#FBBF24" opacity="0.8"/></marker>
        <marker id="ae" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill="#22D3EE"/></marker>
        <marker id="ax" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill="#F472B6"/></marker>
      </defs>
      {Array.from({length:16},(_,idx)=>{
        const r=idx>>2,c=idx&3,x=pad+c*(cs+gap),y=pad+r*(cs+gap);
        const pi=pMap[`${r},${c}`];const isE=r===board.entry.row&&c===board.entry.col;const isX=r===board.exit.row&&c===board.exit.col;
        const needs=reqMap[`${r},${c}`]||[];
        return(<g key={idx}>
          <rect x={x} y={y} width={cs} height={cs} rx={3} fill={pi!==undefined?"#1E293B":"#0F172A"} stroke={isE?"#22D3EE":isX?"#F472B6":"#1E293B"} strokeWidth={isE||isX?1.5:0.5}/>
          {needs.map(d=>{const nw=7,nh=2.5;let nx,ny,nW,nH;if(d==="N"){nx=x+cs/2-nw/2;ny=y;nW=nw;nH=nh;}else if(d==="S"){nx=x+cs/2-nw/2;ny=y+cs-nh;nW=nw;nH=nh;}else if(d==="W"){nx=x;ny=y+cs/2-nw/2;nW=nh;nH=nw;}else{nx=x+cs-nh;ny=y+cs/2-nw/2;nW=nh;nH=nw;}return<rect key={d} x={nx} y={ny} width={nW} height={nH} rx={0.5} fill="#FBBF24" opacity={0.6}/>;})}
          {pi!==undefined&&<text x={x+cs/2} y={y+cs/2+1} textAnchor="middle" dominantBaseline="middle" fill="#F8FAFC" fontSize={cs>46?11:9} fontWeight="700" fontFamily="monospace">{pi+1}</text>}
          {isE&&<text x={x+3} y={y+8} fill="#22D3EE" fontSize={5} fontWeight="800" fontFamily="monospace">IN</text>}
          {isX&&<text x={x+cs-14} y={y+8} fill="#F472B6" fontSize={5} fontWeight="800" fontFamily="monospace">OUT</text>}
        </g>);
      })}
      {OUTER.map((m,i)=>{const p=cc(m.r,m.c);const o=cs/2+5;let dx=p.x,dy=p.y;if(m.d==="N")dy=p.y-o;else if(m.d==="S")dy=p.y+o;else if(m.d==="W")dx=p.x-o;else dx=p.x+o;const isE=board.entry.row===m.r&&board.entry.col===m.c&&board.entry.dir===m.d;const isX=board.exit.row===m.r&&board.exit.col===m.c&&board.exit.dir===m.d;return<circle key={i} cx={dx} cy={dy} r={isE||isX?3.5:2} fill={isE?"#22D3EE":isX?"#F472B6":"#FBBF24"} opacity={isE||isX?1:0.2}/>;})}
      <polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#FBBF24" strokeWidth={1.5} strokeOpacity={0.45} strokeLinejoin="round" strokeLinecap="round" markerEnd="url(#ah)"/>
      <line x1={eS.x} y1={eS.y} x2={eC.x} y2={eC.y} stroke="#22D3EE" strokeWidth={2} markerEnd="url(#ae)" strokeDasharray="3 2"/>
      <line x1={xC.x} y1={xC.y} x2={xE.x} y2={xE.y} stroke="#F472B6" strokeWidth={2} markerEnd="url(#ax)" strokeDasharray="3 2"/>
    </svg>
  );
}

// ── SVG image helper ──
const F_IMG={
  straightWE:"/frags/straight-we.svg", straightNS:"/frags/straight-ns.svg",
  cornerWN:"/frags/corner-wn-b.svg", cornerNE:"/frags/corner-ne-b.svg",
  cornerWS:"/frags/corner-ws-a.svg", cornerSE:"/frags/corner-se-a.svg",
  tpieceWNE:"/frags/tpiece-wne.svg", tpieceWSE:"/frags/tpiece-wse.svg",
  crossSpecial:"/frags/cross-special.svg", crossUnique:"/frags/cross-unique.svg",
  crossHidden:"/frags/cross-hidden.svg",
  board2x2:"/frags/board-2x2.svg", board3x3:"/frags/board-3x3.svg",
  board4x4:"/frags/board-4x4.svg", memsystem:"/frags/memsystem-4x4.svg",
  inventory:"/frags/inventory.svg", progression:"/frags/progression.svg",
};
function FImg({src,size=40,style={}}){return<img src={src} width={size} height={size} style={{display:"inline-block",...style}} alt=""/>;}

// ── Inventory Editor ──
function InvEditor({inventories:inv,setInventories:setInv}){
  const up=(ai,k,v)=>{const n=[...inv];n[ai]={...n[ai],frags:{...n[ai].frags,[k]:Math.max(0,parseInt(v)||0)}};setInv(n);};
  const upC=(ai,v)=>{const n=[...inv];n[ai]={...n[ai],combos:Math.max(0,parseInt(v)||0)};setInv(n);};
  const upN=(ai,v)=>{const n=[...inv];n[ai]={...n[ai],name:v};setInv(n);};
  // Global set: apply a value to ALL archetypes for a specific key
  const setAll=(k,v)=>{const n=inv.map(item=>({...item,frags:{...item.frags,[k]:Math.max(0,parseInt(v)||0)}}));setInv(n);};
  const setAllCombos=(v)=>{const n=inv.map(item=>({...item,combos:Math.max(0,parseInt(v)||0)}));setInv(n);};
  return(
    <div style={{background:"#111827",border:"1px solid #334155",borderRadius:10,padding:14,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <h3 style={{fontSize:12,fontWeight:700,color:"#A78BFA",margin:0,letterSpacing:.5,textTransform:"uppercase"}}>✏️ Archetype Inventories</h3>
        <button onClick={()=>setInv(JSON.parse(JSON.stringify(DEFAULT_INV)))} style={{padding:"3px 10px",background:"#1E293B",border:"1px solid #334155",borderRadius:4,color:"#94A3B8",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>Reset to Defaults</button>
      </div>

      {/* Global Action Badge Controls */}
      <div style={{background:"#0F172A",border:"1px solid #334155",borderRadius:6,padding:10,marginBottom:10}}>
        <div style={{fontSize:9,color:"#64748B",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>
          ⚡ Set Action Badges Globally (applies to ALL archetypes)
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          {[["SPECIAL","Special (max 8)","#8B5CF6",8],["UNIQUE","Unique (max 5)","#EC4899",5],["HIDDEN","Hidden (max 5)","#10B981",5]].map(([key,label,color,max])=>(
            <div key={key} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:9,color}}>{label}:</span>
              <input type="number" min={0} max={max} value={inv[0]?.frags[key]||0} onChange={e=>setAll(key,e.target.value)}
                style={{background:"#1E293B",border:`1px solid ${color}40`,borderRadius:3,padding:"3px 4px",color,fontSize:10,fontFamily:"inherit",width:36,textAlign:"center"}}/>
              <button onClick={()=>setAll(key,max)} style={{padding:"2px 6px",background:`${color}20`,border:`1px solid ${color}40`,borderRadius:3,color,fontSize:7,cursor:"pointer",fontFamily:"inherit"}}>Max</button>
            </div>
          ))}
        </div>
        <p style={{fontSize:8,color:"#475569",margin:"6px 0 0"}}>
          Special badges are earned through actions (Profile Complete, First Claim, etc.). Every engaged player can earn all 8.
          Use per-row overrides below for different engagement levels per archetype.
        </p>
      </div>

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
          <thead><tr style={{color:"#64748B"}}>
            <th style={{padding:"4px 5px",textAlign:"left",borderBottom:"1px solid #1E293B",fontSize:8}}>Name</th>
            {FK.map(k=><th key={k} style={{padding:"4px 3px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:7,whiteSpace:"nowrap"}}><span style={{color:FT[k].cl}}>{FL[k]}</span></th>)}
            <th style={{padding:"4px 5px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:8,color:"#FF00E5"}}>Combos</th>
            <th style={{padding:"4px 5px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:8,color:"#FBBF24"}}>Tiles</th>
          </tr></thead>
          <tbody>{inv.map((item,ai)=>(
            <tr key={ai}>
              <td style={{padding:"3px 5px",borderBottom:"1px solid #1E293B20"}}><input value={item.name} onChange={e=>upN(ai,e.target.value)} style={{background:"#0F172A",border:"1px solid #1E293B",borderRadius:3,padding:"2px 5px",color:"#E2E8F0",fontSize:9,fontFamily:"inherit",width:140}}/></td>
              {FK.map(k=>{
                const isAction=k==="SPECIAL"||k==="UNIQUE"||k==="HIDDEN";
                return<td key={k} style={{padding:"3px 2px",textAlign:"center",borderBottom:"1px solid #1E293B20"}}><input type="number" min={0} max={50} value={item.frags[k]} onChange={e=>up(ai,k,e.target.value)} style={{background:isAction?"#1E293B":"#0F172A",border:`1px solid ${isAction?FT[k].cl+"40":"#1E293B"}`,borderRadius:3,padding:"2px",color:isAction?FT[k].cl:"#F8FAFC",fontSize:9,fontFamily:"inherit",width:32,textAlign:"center"}}/></td>;
              })}
              <td style={{padding:"3px 2px",textAlign:"center",borderBottom:"1px solid #1E293B20"}}><input type="number" min={0} max={30} value={item.combos} onChange={e=>upC(ai,e.target.value)} style={{background:"#0F172A",border:"1px solid #FF00E530",borderRadius:3,padding:"2px",color:"#FF00E5",fontSize:9,fontFamily:"inherit",width:32,textAlign:"center"}}/></td>
              <td style={{padding:"3px 5px",textAlign:"center",borderBottom:"1px solid #1E293B20",color:"#FBBF24",fontWeight:700}}>{totalF(item)}</td>
            </tr>
          ))}</tbody>
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
  const[inv,setInv]=useState(()=>JSON.parse(JSON.stringify(DEFAULT_INV)));
  const[holderSearch,setHolderSearch]=useState("");
  const[selectedHolder,setSelectedHolder]=useState(null);
  const[holderSim,setHolderSim]=useState(null);
  // Game state
  const[gameBoard,setGameBoard]=useState(()=>Array.from({length:4},()=>Array(4).fill(null)));
  const[gameInv,setGameInv]=useState([]);
  const[gameSelected,setGameSelected]=useState(null); // index in inventory
  const[gameBoardIdx,setGameBoardIdx]=useState(0);
  const[gameCombos,setGameCombos]=useState([]);
  const[gameComboCount,setGameComboCount]=useState(3);
  const[carrying,setCarrying]=useState(null); // {frag, invIdx} — fragment picked up and following cursor
  const[cursorPos,setCursorPos]=useState({x:0,y:0});

  // Global mouse tracking for carry mode
  useEffect(()=>{
    const onMove=(e)=>setCursorPos({x:e.clientX,y:e.clientY});
    if(carrying){window.addEventListener("mousemove",onMove);return()=>window.removeEventListener("mousemove",onMove);}
  },[carrying]);

  // Parse wallet data
  const holders=useMemo(()=>WALLETS.map(w=>({addr:w[0],short:w[0].slice(0,6)+"..."+w[0].slice(-4),tokens:w[1],cd:w[2],b:w[3],a:w[4],s:w[5],combos:w[6],badges:w[7]?w[7].split(","):[],comboNames:w[8]?w[8].split(",").filter(Boolean):[],totalFrags:w[2]+w[3]+w[4]+w[5]})),[]);

  // Simulate a single holder across all 6 boards
  const simHolder=useCallback((h)=>{
    setSelectedHolder(h);
    // Build their fragment inventory (trait badges only — no Special/Unique/Hidden yet since those are action-based)
    const fragList=[];let id=0;
    for(let i=0;i<h.cd;i++)fragList.push(mkFrag("CD_STRAIGHT",id++));
    for(let i=0;i<h.b;i++)fragList.push(mkFrag("B_CORNER",id++));
    for(let i=0;i<h.a;i++)fragList.push(mkFrag("A_CORNER",id++));
    for(let i=0;i<h.s;i++)fragList.push(mkFrag("S_TPIECE",id++));
    // Estimate action badges: assume active holders earn some
    const estSpecial=Math.min(8,Math.max(2,Math.floor(h.tokens>=5?8:h.tokens>=2?5:2)));
    const estUnique=Math.min(5,h.tokens>=10?3:h.tokens>=2?2:0);
    const estHidden=Math.min(5,h.tokens>=20?Math.min(3,Math.floor(h.tokens/30)):0);
    for(let i=0;i<estSpecial;i++)fragList.push(mkFrag("SPECIAL",id++));
    for(let i=0;i<estUnique;i++)fragList.push(mkFrag("UNIQUE",id++));
    for(let i=0;i<estHidden;i++)fragList.push(mkFrag("HIDDEN",id++));

    // Run progressive simulation (single pass, 20 iterations for speed)
    const results=[];
    const iters=20;
    for(let b=0;b<6;b++)results.push({runs:[],usageRuns:[]});
    for(let it=0;it<iters;it++){
      // Re-randomize orientations each iteration
      const freshFrags=fragList.map((f,i)=>({...f,notches:randOrient(f.shape),id:i}));
      let rem=[...freshFrags],cum=0;
      for(let b=0;b<6;b++){
        const emptyU={};FK.forEach(k=>emptyU[k]=0);
        if(rem.length===0){results[b].runs.push({filled:0,onC:0,total:0,cumTotal:cum,perfectClear:false,boardCleared:false});results[b].usageRuns.push(emptyU);continue;}
        const{grid,usedIds}=solveBoard(BOARDS[b],rem);
        const sc=scoreGrid(grid,BOARDS[b],h.combos);cum+=sc.total;
        const usage={...emptyU};for(const idx of usedIds)usage[rem[idx].type]=(usage[rem[idx].type]||0)+1;
        results[b].runs.push({...sc,cumTotal:cum});results[b].usageRuns.push(usage);
        rem=rem.filter((_,i)=>!usedIds.has(i));
      }
    }
    // Aggregate
    const agg=results.map((br,bi)=>{
      const R=br.runs,N=R.length;const av=fn=>R.reduce((s,r)=>s+fn(r),0)/N;
      const avgUsage={};FK.forEach(k=>{avgUsage[k]=+(br.usageRuns.reduce((s,u)=>s+(u[k]||0),0)/N).toFixed(1);});
      return{avgScore:+av(r=>r.total).toFixed(1),avgFilled:+av(r=>r.filled).toFixed(1),avgOnPath:+av(r=>r.onC).toFixed(1),pctPC:+((R.filter(r=>r.perfectClear).length/N*100).toFixed(1)),pctFull:+((R.filter(r=>r.boardCleared).length/N*100).toFixed(1)),avgCum:+av(r=>r.cumTotal).toFixed(1),avgCombo:+av(r=>r.cP||0).toFixed(1),avgUsage};
    });
    setHolderSim({holder:h,frags:{CD:h.cd,B:h.b,A:h.a,S:h.s,Sp:estSpecial,Un:estUnique,Hd:estHidden},totalFrags:fragList.length,boards:agg});
  },[]);

  const bAnal=useMemo(()=>BOARDS.map(b=>({turns:countTurns(b.path),...analyzeBoardNeeds(b)})),[]);

  const runSim=useCallback(()=>{
    setRunning(true);setProgress(0);
    setTimeout(()=>{
      const data=runProgressive(inv,120);setProgress(80);
      const sens=runComboSens(inv,60);setProgress(100);
      setSimData(data);setSensData(sens);setRunning(false);setPhase(2);
    },50);
  },[inv]);

  const css=`*{margin:0;padding:0;box-sizing:border-box}body{background:#0A0F1C}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{opacity:1}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#0F172A}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}@keyframes pulseGlow{0%,100%{stroke-opacity:0.2;stroke-width:2}50%{stroke-opacity:0.6;stroke-width:4}}`;

  const tb=(p,l)=>(<button onClick={()=>{if(p===5||p===6)setPhase(p);else if(p===1)setPhase(1);else if(simData)setPhase(p);else runSim();}} style={{padding:"6px 14px",background:phase===p?"#6366F1":"transparent",border:`1px solid ${phase===p?"#6366F1":"#334155"}`,borderRadius:6,color:phase===p?"#FFF":"#94A3B8",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>);

  return(
    <div style={{minHeight:"100vh",background:"#0A0F1C",color:"#E2E8F0",fontFamily:"'SF Mono','Cascadia Code','JetBrains Mono',monospace"}}>
      <style>{css}</style>
      <div style={{background:"linear-gradient(135deg,#0F172A,#1a1340,#0F172A)",borderBottom:"1px solid #1E293B",padding:"14px 20px",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:1440,margin:"0 auto",flexWrap:"wrap",gap:8}}>
          <div>
            <h1 style={{fontSize:16,fontWeight:800,background:"linear-gradient(90deg,#22D3EE,#A78BFA,#F472B6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>MEM Fragment Board System</h1>
            <p style={{fontSize:8,color:"#64748B",marginTop:1,letterSpacing:2,textTransform:"uppercase"}}>V1 Phase A • Progressive • A/B Corners • Locked T-Pieces</p>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{tb(1,"Guide & Boards")}{tb(2,"Results")}{tb(3,"Analysis")}{tb(4,"Balance")}{tb(5,"Real Holders")}{tb(6,"🎮 Game")}</div>
        </div>
      </div>

      <div style={{maxWidth:1440,margin:"0 auto",padding:"14px 20px"}}>

{/* ═══════════════════════ PHASE 1: GUIDE & BOARDS ═══════════════════════ */}
{phase===1&&(<div>

{/* Badge Guide */}
<div style={{marginBottom:20}}>
  <h2 style={{fontSize:15,fontWeight:700,color:"#F8FAFC",margin:"0 0 4px"}}>Badge Fragment Guide</h2>
  <p style={{fontSize:10,color:"#64748B",margin:"0 0 14px",maxWidth:700,lineHeight:1.6}}>
    Each badge you earn becomes a fragment tile on your board. Different badge tiers create different fragment shapes with different connection points (notches).
  </p>

  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
    {/* C/D Straight */}
    <div style={{background:"#111827",border:"1px solid #64748B40",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <FImg src={F_IMG.straightWE} size={38}/><FImg src={F_IMG.straightNS} size={38}/>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Standard C/D Tier</h4>
      <p style={{fontSize:10,color:"#FBBF24",margin:"0 0 4px",fontStyle:"italic"}}>2-Notch Straight • 16 badges</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>Freely rotatable between W-E and N-S. Most common fragments — every collector has at least one. Faction IDs and appearance traits.</p>
    </div>
    {/* B Corner */}
    <div style={{background:"#111827",border:"1px solid #3B82F640",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <FImg src={F_IMG.cornerWN} size={38}/><FImg src={F_IMG.cornerNE} size={38}/>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Standard B Tier</h4>
      <p style={{fontSize:10,color:"#3B82F6",margin:"0 0 4px",fontStyle:"italic"}}>2-Notch Upper Corner • 6 badges</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>Limited rotation: WN ↔ NE only. Cannot become an A-tier corner. Mid-rarity inventory items (One Punch, Code Bender, etc.)</p>
    </div>
    {/* A Corner */}
    <div style={{background:"#111827",border:"1px solid #60A5FA40",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <FImg src={F_IMG.cornerWS} size={38}/><FImg src={F_IMG.cornerSE} size={38}/>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Standard A Tier</h4>
      <p style={{fontSize:10,color:"#60A5FA",margin:"0 0 4px",fontStyle:"italic"}}>2-Notch Lower Corner • 5 badges</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>Limited rotation: WS ↔ SE only. Cannot become a B-tier corner. Rare inventory items (Bosu Badge, Endo's Archive, etc.)</p>
    </div>
    {/* S T-Piece */}
    <div style={{background:"#111827",border:"1px solid #F59E0B40",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <FImg src={F_IMG.tpieceWNE} size={38}/><FImg src={F_IMG.tpieceWSE} size={38}/>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Standard S Tier</h4>
      <p style={{fontSize:10,color:"#F59E0B",margin:"0 0 4px",fontStyle:"italic"}}>3-Notch T-Piece • 6 badges • LOCKED</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>No rotation allowed. Issued randomly as WNE, NES, ESW, or SWN. Very rare Growth Path and Type traits. Your board's key puzzle piece.</p>
    </div>
    {/* Special Cross */}
    <div style={{background:"#111827",border:"1px solid #8B5CF640",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <FImg src={F_IMG.crossSpecial} size={38}/>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Special</h4>
      <p style={{fontSize:10,color:"#8B5CF6",margin:"0 0 4px",fontStyle:"italic"}}>4-Notch Cross • 8 badges</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>All sides open — fits anywhere. Earned through actions (Profile Complete, First Claim, etc.). No supply cap. The great equalizer.</p>
    </div>
    {/* Unique Cross */}
    <div style={{background:"#111827",border:"1px solid #EC489940",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <FImg src={F_IMG.crossUnique} size={38}/>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Unique</h4>
      <p style={{fontSize:10,color:"#EC4899",margin:"0 0 4px",fontStyle:"italic"}}>4-Notch Cross • 5 badges</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>All sides open. Time or quantity limited (Launch Day, Pioneer 100, etc.). Supply capped forever once windows close.</p>
    </div>
    {/* Hidden Cross */}
    <div style={{background:"#111827",border:"1px solid #10B98140",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <FImg src={F_IMG.crossHidden} size={38}/>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Hidden</h4>
      <p style={{fontSize:10,color:"#10B981",margin:"0 0 4px",fontStyle:"italic"}}>4-Notch Cross • 5 badges</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>All sides open. One per faction. Secret criteria — no name, no hint. Fully greyed out until discovered.</p>
    </div>
    {/* Combo Transistor */}
    <div style={{background:"#111827",border:"1px solid #FF00E540",borderRadius:8,padding:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <div style={{width:38,height:38,borderRadius:"50%",background:"#FF00E520",border:"2px solid #FF00E5",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:14,height:14,borderRadius:"50%",background:"#FF00E5"}}/>
        </div>
      </div>
      <h4 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>Combo Transistor</h4>
      <p style={{fontSize:10,color:"#FF00E5",margin:"0 0 4px",fontStyle:"italic"}}>Power-up • 19+ badges</p>
      <p style={{fontSize:9,color:"#94A3B8",margin:0,lineHeight:1.5}}>NOT a board tile. Placed in the center hole of an existing fragment. Earns +15 pts per matching notch connection with neighbors.</p>
    </div>
  </div>
</div>

{/* Board Reading Guide */}
<div style={{background:"#111827",border:"1px solid #334155",borderRadius:10,padding:14,marginBottom:16}}>
  <h3 style={{fontSize:13,fontWeight:700,color:"#22D3EE",margin:"0 0 8px"}}>📖 How to Read the Board</h3>
  <p style={{fontSize:11,color:"#CBD5E1",margin:"0 0 8px",lineHeight:1.7}}>
    The board is a <b>4×4 grid</b> with <b>4 rows</b> and <b>4 columns</b>. Each position is written as <b>R</b> (Row) + <b>C</b> (Column).
  </p>
  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
    <div style={{background:"#0F172A",borderRadius:6,padding:10,fontSize:10,color:"#94A3B8",lineHeight:1.8,fontFamily:"monospace"}}>
      <div><span style={{color:"#22D3EE"}}>R1C1</span> <span style={{color:"#475569"}}>R1C2  R1C3  R1C4</span> ← Row 1</div>
      <div><span style={{color:"#475569"}}>R2C1  R2C2  R2C3  R2C4</span> ← Row 2</div>
      <div><span style={{color:"#475569"}}>R3C1  R3C2  R3C3  R3C4</span> ← Row 3</div>
      <div><span style={{color:"#475569"}}>R4C1  R4C2  R4C3  </span><span style={{color:"#F472B6"}}>R4C4</span> ← Row 4</div>
    </div>
    <div style={{fontSize:10,color:"#94A3B8",lineHeight:1.8}}>
      <div><b style={{color:"#F8FAFC"}}>Example:</b> R1C4 → R1C3</div>
      <div>= Move from <span style={{color:"#22D3EE"}}>Row 1, Column 4</span> to <span style={{color:"#22D3EE"}}>Row 1, Column 3</span></div>
      <div style={{marginTop:6}}><b style={{color:"#F8FAFC"}}>Path direction:</b> Numbers 1→16 show the Hamiltonian path order</div>
      <div><span style={{color:"#22D3EE"}}>●</span> Cyan = Entry point &nbsp; <span style={{color:"#F472B6"}}>●</span> Pink = Exit point</div>
      <div><span style={{color:"#FBBF24"}}>●</span> Yellow dots = All 16 possible entry/exit positions</div>
    </div>
  </div>
</div>

{/* Scoring Guide */}
<div style={{background:"#111827",border:"1px solid #334155",borderRadius:10,padding:14,marginBottom:16}}>
  <h3 style={{fontSize:13,fontWeight:700,color:"#FBBF24",margin:"0 0 8px"}}>⚡ How Scoring Works</h3>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,fontSize:10,color:"#94A3B8"}}>
    <div><b style={{color:"#F8FAFC"}}>Path Score:</b> Fragments on the continuous entry→exit path score full value (C/D: 10, A/B: 15, S: 25, Cross: 40 pts)</div>
    <div><b style={{color:"#F8FAFC"}}>Disconnected:</b> Fragments placed but NOT on the path score 50% value</div>
    <div><b style={{color:"#F8FAFC"}}>Full Board:</b> All 16 slots filled = <span style={{color:"#34D399"}}>+50 bonus</span></div>
    <div><b style={{color:"#F8FAFC"}}>Perfect Clear:</b> Full board + Hamiltonian path through all 16 = <span style={{color:"#FBBF24"}}>+100 bonus</span></div>
    <div><b style={{color:"#F8FAFC"}}>Combo Bonus:</b> Each matching notch connection on a combo host = <span style={{color:"#EC4899"}}>+15 pts</span></div>
    <div><b style={{color:"#F8FAFC"}}>Progressive:</b> Fragments used on a board stay there. Remaining carry to the next board.</div>
  </div>
</div>

{/* Boards */}
<h2 style={{fontSize:15,fontWeight:700,color:"#F8FAFC",margin:"0 0 10px"}}>Board Designs & Hamiltonian Paths</h2>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(440px,1fr))",gap:10}}>
  {BOARDS.map((board,bi)=>{
    const a=bAnal[bi];
    return(
      <div key={bi} style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <h3 style={{fontSize:13,fontWeight:700,color:"#F8FAFC",margin:0}}>{board.name}</h3>
            <span style={{display:"inline-block",marginTop:3,padding:"1px 8px",borderRadius:20,fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:board.difficulty==="Easy"?"#34D399":board.difficulty==="Normal"?"#FBBF24":"#F87171",background:board.difficulty==="Easy"?"#065F4620":board.difficulty==="Normal"?"#78350F20":"#7F1D1D20",border:`1px solid ${board.difficulty==="Easy"?"#34D39940":board.difficulty==="Normal"?"#FBBF2440":"#F8717140"}`}}>{board.difficulty}</span>
          </div>
          <div style={{textAlign:"right",fontSize:9,color:"#64748B"}}>
            <div>Turns: <b style={{color:"#F59E0B"}}>{a.turns}</b></div>
          </div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <BoardSVG board={board} size={220}/>
          <div style={{flex:1,fontSize:9,color:"#94A3B8",lineHeight:1.7}}>
            <div><span style={{color:"#22D3EE"}}>Entry:</span> {board.entry.dir} of R{board.entry.row+1}C{board.entry.col+1}</div>
            <div><span style={{color:"#F472B6"}}>Exit:</span> {board.exit.dir} of R{board.exit.row+1}C{board.exit.col+1}</div>
            <div style={{marginTop:5,color:"#A78BFA",fontSize:8}}>Fragments needed (minimum):</div>
            <div style={{fontSize:8}}>
              <span style={{color:"#64748B"}}>{a.straights}× Straight</span>{" • "}
              <span style={{color:"#3B82F6"}}>{a.bCorners}× B Corner</span>{" • "}
              <span style={{color:"#60A5FA"}}>{a.aCorners}× A Corner</span>
              {a.flexSlots>0&&<span>{" • "}<span style={{color:"#8B5CF6"}}>{a.flexSlots}× Any (3+ notch)</span></span>}
            </div>
            <div style={{fontSize:7,color:"#475569",marginTop:4}}>{board.desc}</div>
            <div style={{fontSize:7,color:"#FBBF2480",marginTop:3}}>
              Path: {board.path.map(([r,c])=>`R${r+1}C${c+1}`).join(" → ")}
            </div>
          </div>
        </div>
      </div>
    );
  })}
</div>

{/* Inventory Editor */}
<div style={{marginTop:16}}><InvEditor inventories={inv} setInventories={setInv}/></div>

<div style={{marginTop:10,textAlign:"center"}}>
  <button onClick={runSim} disabled={running} style={{padding:"11px 36px",background:running?"#334155":"linear-gradient(135deg,#6366F1,#A78BFA)",border:"none",borderRadius:8,color:"#FFF",fontSize:12,fontWeight:700,cursor:running?"wait":"pointer",fontFamily:"inherit"}}>
    {running?`Simulating... ${progress}%`:"▶ Run Progressive Simulation"}
  </button>
  <p style={{fontSize:8,color:"#475569",marginTop:4}}>120 iterations × {inv.length} archetypes × 6 boards</p>
</div>
</div>)}

{/* ═══════════════════════ PHASE 2: RESULTS ═══════════════════════ */}
{phase===2&&simData&&(<div>
  <h2 style={{fontSize:14,fontWeight:700,color:"#F8FAFC",margin:"0 0 12px"}}>Progressive Simulation Results</h2>

  {/* Heatmap */}
  <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:12,marginBottom:12,overflowX:"auto"}}>
    <h3 style={{fontSize:10,fontWeight:700,color:"#A78BFA",margin:"0 0 8px",letterSpacing:1,textTransform:"uppercase"}}>Avg Score Heatmap</h3>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
      <thead><tr>
        <th style={{padding:"4px 6px",textAlign:"left",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:8}}>Archetype</th>
        {BOARDS.map((b,i)=><th key={i} style={{padding:"4px 5px",textAlign:"center",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:8}}>B{i+1}</th>)}
        <th style={{padding:"4px 6px",textAlign:"center",color:"#FBBF24",borderBottom:"1px solid #1E293B",fontSize:8}}>Cumul.</th>
      </tr></thead>
      <tbody>{inv.map((item,a)=>{
        if(!simData[a])return null;const bds=simData[a];const mx=Math.max(...Object.values(simData).flatMap(d=>d.map(b=>b.avgScore)),1);
        return(<tr key={a}>
          <td style={{padding:"6px",color:"#E2E8F0",fontWeight:600,borderBottom:"1px solid #1E293B20",fontSize:9,whiteSpace:"nowrap"}}>{item.name}</td>
          {bds.map((bd,b)=><td key={b} style={{padding:"6px",textAlign:"center",fontWeight:700,color:bd.avgScore>0?"#F8FAFC":"#334155",background:`rgba(99,102,241,${bd.avgScore/mx*0.5})`,borderBottom:"1px solid #1E293B20",fontSize:9}}>{bd.avgScore}{bd.stopPct>=99&&<div style={{fontSize:6,color:"#F87171"}}>⛔</div>}</td>)}
          <td style={{padding:"6px",textAlign:"center",fontWeight:700,color:"#FBBF24",borderBottom:"1px solid #1E293B20"}}>{bds[5].avgCum}</td>
        </tr>);
      })}</tbody>
    </table>
  </div>

  {/* Per-archetype detail */}
  {inv.map((item,a)=>{
    if(!simData[a])return null;const bds=simData[a];const firstStop=bds.findIndex(b=>b.stopPct>=99);
    return(
      <div key={a} style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:12,marginBottom:10}}>
        <h3 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px"}}>{item.name} <span style={{fontSize:9,color:"#64748B",fontWeight:400}}>— {totalF(item)} frags, {item.combos} combos</span></h3>
        {firstStop>=0&&<p style={{fontSize:8,color:"#FCA5A5",margin:"3px 0 6px",padding:"3px 7px",background:"#7F1D1D15",border:"1px solid #F8717125",borderRadius:4}}>⚠ Depleted after Board {firstStop}. Later boards have no fragments.</p>}

        {/* Badge breakdown */}
        <div style={{marginBottom:8,overflowX:"auto"}}>
          <div style={{fontSize:8,color:"#64748B",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>🧩 Badge Breakdown</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:8}}>
            <thead><tr>
              <th style={{padding:"3px 5px",textAlign:"left",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:7}}>Type</th>
              <th style={{padding:"3px 4px",textAlign:"center",color:"#FBBF24",borderBottom:"1px solid #1E293B",fontSize:7}}>Owned</th>
              {BOARDS.map((_,b)=><th key={b} style={{padding:"3px 4px",textAlign:"center",color:"#64748B",borderBottom:"1px solid #1E293B",fontSize:7}}>B{b+1}</th>)}
              <th style={{padding:"3px 4px",textAlign:"center",color:"#F472B6",borderBottom:"1px solid #1E293B",fontSize:7}}>Used</th>
              <th style={{padding:"3px 4px",textAlign:"center",color:"#34D399",borderBottom:"1px solid #1E293B",fontSize:7}}>Left</th>
            </tr></thead>
            <tbody>
              {FK.map(k=>{
                const owned=item.frags[k]||0;if(owned===0&&bds.every(bd=>(bd.avgUsage?.[k]||0)===0))return null;
                const perB=bds.map(bd=>bd.avgUsage?.[k]||0);const tot=+perB.reduce((s,v)=>s+v,0).toFixed(1);
                return(<tr key={k}>
                  <td style={{padding:"3px 5px",color:FT[k].cl,fontWeight:600,borderBottom:"1px solid #1E293B10",fontSize:8}}>{FL[k]}</td>
                  <td style={{padding:"3px 4px",textAlign:"center",color:"#FBBF24",fontWeight:700,borderBottom:"1px solid #1E293B10"}}>{owned}</td>
                  {perB.map((u,b)=><td key={b} style={{padding:"3px 4px",textAlign:"center",borderBottom:"1px solid #1E293B10",color:u>0?"#E2E8F0":"#334155"}}>{u>0?u.toFixed(1):"—"}</td>)}
                  <td style={{padding:"3px 4px",textAlign:"center",color:"#F472B6",fontWeight:700,borderBottom:"1px solid #1E293B10"}}>{tot}</td>
                  <td style={{padding:"3px 4px",textAlign:"center",fontWeight:700,borderBottom:"1px solid #1E293B10",color:(owned-tot)>0.5?"#34D399":"#475569"}}>{(owned-tot).toFixed(1)}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>

        {/* Board results table */}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:8}}>
            <thead><tr style={{color:"#64748B"}}>
              {["Board","Frags","Score","Min","Max","σ","Filled","Path","Full%","PC ✦","Combo","Cum","Status"].map(h=><th key={h} style={{padding:"3px 4px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:7,whiteSpace:"nowrap"}}>{h}</th>)}
            </tr></thead>
            <tbody>{bds.map((bd,b)=>{
              const dead=bd.stopPct>=99;
              return(<tr key={b} style={{opacity:dead?0.3:1}}>
                <td style={{padding:"4px",color:"#A78BFA",fontWeight:600,textAlign:"center",fontSize:8}}>{BOARDS[b].name}</td>
                <td style={{padding:"4px",textAlign:"center",color:bd.avgFrags<3?"#F87171":"#94A3B8"}}>{bd.avgFrags.toFixed(0)}</td>
                <td style={{padding:"4px",textAlign:"center",color:"#22D3EE",fontWeight:700}}>{bd.avgScore}</td>
                <td style={{padding:"4px",textAlign:"center",color:"#475569"}}>{bd.minScore}</td>
                <td style={{padding:"4px",textAlign:"center",color:"#475569"}}>{bd.maxScore}</td>
                <td style={{padding:"4px",textAlign:"center",color:"#F59E0B"}}>{bd.stdDev}</td>
                <td style={{padding:"4px",textAlign:"center"}}>{bd.avgFilled}/16</td>
                <td style={{padding:"4px",textAlign:"center"}}>{bd.avgOnPath}</td>
                <td style={{padding:"4px",textAlign:"center",color:bd.pctFull>0?"#34D399":"#334155"}}>{bd.pctFull}%</td>
                <td style={{padding:"4px",textAlign:"center",fontWeight:700,color:bd.pctPC>0?"#FBBF24":"#334155"}}>{bd.pctPC>0?`${bd.pctPC}%`:"—"}</td>
                <td style={{padding:"4px",textAlign:"center",color:"#EC4899"}}>{bd.avgCombo}</td>
                <td style={{padding:"4px",textAlign:"center",color:"#FBBF24",fontWeight:600}}>{bd.avgCum}</td>
                <td style={{padding:"4px",textAlign:"center"}}>{dead?<span style={{color:"#F87171",fontWeight:700}}>⛔</span>:bd.stopPct>0?<span style={{color:"#F59E0B"}}>⚠</span>:<span style={{color:"#34D399"}}>✓</span>}</td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>
    );
  })}
</div>)}

{/* ═══════════════════════ PHASE 3: ANALYSIS ═══════════════════════ */}
{phase===3&&simData&&(<div>
  <h2 style={{fontSize:14,fontWeight:700,color:"#F8FAFC",margin:"0 0 12px"}}>Analysis Report</h2>
  {[
    {q:"1. Can a passive holder have a meaningful experience?",a:()=>{const d=simData[0];if(!d)return"N/A";return`With ${totalF(inv[0])} fragments: Board 1 fills ~${d[0].avgFilled}/16 slots (avg ${d[0].avgScore} pts). Empty squares show what earning more badges unlocks.`;}},
    {q:"2. Can an active single-holder complete an easy board?",a:()=>{const d=simData[1];if(!d)return"N/A";return`With ${totalF(inv[1])} fragments: Board 1 avg ${d[0].avgFilled}/16 filled, ${d[0].pctFull}% full board, ${d[0].pctPC}% perfect clear.`;}},
    {q:"3. Scoring gap: smallest vs largest holder?",a:()=>{if(!simData[0]||!simData[inv.length-1])return"N/A";const c0=simData[0][5].avgCum,cN=simData[inv.length-1][5].avgCum;return`Cumulative: ${inv[0].name} ~${c0} pts vs ${inv[inv.length-1].name} ~${cN} pts (${(cN/Math.max(c0,1)).toFixed(1)}× multiplier).`;}},
    {q:"4. Do A/B corner constraints create meaningful decisions?",a:()=>"Yes. B corners (WN↔NE) and A corners (WS↔SE) cannot substitute for each other. Board 6 needs 8 B-corners and 6 A-corners — players must have both types to clear hard boards."},
    {q:"5. How impactful are combo badges?",a:()=>{if(!sensData)return"N/A";return inv.map((item,a)=>{if(!sensData[a])return"";const d=sensData[a];return`${item.name}: +${(d.w-d.wo).toFixed(0)} pts (${((d.w-d.wo)/Math.max(d.w,1)*100).toFixed(1)}%)`;}).filter(Boolean).join(" • ");}},
    {q:"6. Is T-piece lock the right call?",a:()=>"Yes. T-pieces locked with 4 random orientations (WNE/NES/ESW/SWN) create the deepest placement decision. Players must build their board around where the T-piece fits."},
    {q:"7. Do hard boards require better fragments?",a:()=>{const mid=simData[Math.min(2,inv.length-1)];if(!mid)return"N/A";return`Board 1 (easy): avg ${mid[0].avgOnPath} on path. Board 6 (hard): avg ${mid[5]?.avgOnPath||0} on path. Hard boards demand specific corner types.`;}},
    {q:"8. Random orientation variance?",a:()=>{const mid=simData[Math.min(2,inv.length-1)];if(!mid)return"N/A";const stds=mid.map(b=>b.stdDev);return`σ ranges ${Math.min(...stds)}–${Math.max(...stds)}. Moderate variance — consequential but not punishing.`;}},
  ].map(({q,a},i)=>(
    <div key={i} style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:12,marginBottom:8}}>
      <h4 style={{fontSize:10,fontWeight:700,color:"#A78BFA",margin:"0 0 5px"}}>{q}</h4>
      <p style={{fontSize:10,color:"#CBD5E1",margin:0,lineHeight:1.7}}>{a()}</p>
    </div>
  ))}
  {sensData&&<div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:12,marginTop:10}}>
    <h3 style={{fontSize:10,fontWeight:700,color:"#F59E0B",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:1}}>Combo Impact (Cumulative)</h3>
    <table style={{borderCollapse:"collapse",fontSize:9,maxWidth:500}}>
      <thead><tr style={{color:"#64748B"}}>{["Archetype","With","Without","Δ","%"].map(h=><th key={h} style={{padding:"4px 7px",textAlign:"center",borderBottom:"1px solid #1E293B"}}>{h}</th>)}</tr></thead>
      <tbody>{inv.map((item,a)=>{if(!sensData[a])return null;const d=sensData[a];return(<tr key={a}><td style={{padding:"5px 7px",color:"#E2E8F0",fontWeight:600,fontSize:9}}>{item.name}</td><td style={{padding:"5px 7px",textAlign:"center",color:"#22D3EE"}}>{d.w}</td><td style={{padding:"5px 7px",textAlign:"center",color:"#94A3B8"}}>{d.wo}</td><td style={{padding:"5px 7px",textAlign:"center",color:"#34D399",fontWeight:700}}>+{(d.w-d.wo).toFixed(0)}</td><td style={{padding:"5px 7px",textAlign:"center",color:"#F59E0B"}}>{(d.w>0?((d.w-d.wo)/d.w*100):0).toFixed(1)}%</td></tr>);})}</tbody>
    </table>
  </div>}
</div>)}

{/* ═══════════════════════ PHASE 4: BALANCE ═══════════════════════ */}
{phase===4&&simData&&(<div>
  <h2 style={{fontSize:14,fontWeight:700,color:"#F8FAFC",margin:"0 0 12px"}}>Balance Recommendations</h2>
  {[
    {t:"Scoring Balance",i:"⚖️",c:"#22D3EE",x:()=>`${inv[0].name}→${inv[inv.length-1].name} cumulative: ${simData[0]?.[5]?.avgCum||0} → ${simData[inv.length-1]?.[5]?.avgCum||0} pts. Consider scaling bonuses by difficulty: +50/+75/+100 for Easy/Normal/Hard.`},
    {t:"A/B Corner Split",i:"🔀",c:"#3B82F6",x:()=>{const b6=bAnal[5];return`Board 6 needs ${b6.bCorners} B-corners and ${b6.aCorners} A-corners. This split creates genuine strategic tension — players need BOTH types to clear hard boards. A whale with only B-corners can't solve A-corner positions.`;}},
    {t:"T-Piece Lock Impact",i:"🔒",c:"#F59E0B",x:()=>"Locked T-pieces (4 random orientations: WNE/NES/ESW/SWN) are the deepest strategic element. With only 6 T-piece badges in the system and each locked to its issued orientation, every T-piece placement is a critical decision."},
    {t:"Progressive Depletion",i:"🔋",c:"#A78BFA",x:()=>inv.map((item,a)=>{if(!simData[a])return"";const s=simData[a].findIndex(b=>b.stopPct>=99);return`${item.name}: ${s>=0?`stops after B${s}`:"all 6 boards"}`;}).filter(Boolean).join(" • ")},
    {t:"Key Findings",i:"💡",c:"#F59E0B",x:()=>"1) A/B corner split is the strongest balance lever — it doubles the strategic decision space for corners. 2) T-piece lock makes S-tier badges feel truly special. 3) Cross pieces (Special/Unique/Hidden) are powerful but earned through engagement, not purchases. 4) Progressive consumption means board order strategy matters."},
  ].map(({t,i,c,x},idx)=>(
    <div key={idx} style={{background:"#111827",borderLeft:`3px solid ${c}`,border:`1px solid ${c}30`,borderRadius:10,padding:12,marginBottom:8}}>
      <h4 style={{fontSize:10,fontWeight:700,color:c,margin:"0 0 5px"}}>{i} {t}</h4>
      <p style={{fontSize:10,color:"#CBD5E1",margin:0,lineHeight:1.7}}>{x()}</p>
    </div>
  ))}
  <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:12,marginTop:10}}>
    <h3 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 8px"}}>Cumulative Score Distribution</h3>
    {inv.map((item,a)=>{
      if(!simData[a])return null;const cum=simData[a][5].avgCum;const gMax=Math.max(...Object.values(simData).map(d=>d?.[5]?.avgCum||0),1);
      const colors=["#64748B","#3B82F6","#F59E0B","#EC4899","#8B5CF6","#10B981"];
      return(<div key={a} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
        <div style={{width:140,fontSize:9,color:"#94A3B8",textAlign:"right",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
        <div style={{flex:1,position:"relative",height:20,background:"#0F172A",borderRadius:4}}>
          <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${cum/gMax*100}%`,background:`linear-gradient(90deg,${colors[a%colors.length]}60,${colors[a%colors.length]}CC)`,borderRadius:4}}/>
          <div style={{position:"absolute",left:`${Math.min(cum/gMax*100,85)}%`,top:"50%",transform:"translate(-10%,-50%)",fontSize:9,color:"#F8FAFC",fontWeight:700,textShadow:"0 0 6px #000"}}>{cum}</div>
        </div>
      </div>);
    })}
  </div>
</div>)}

{/* ═══════════════════════ PHASE 5: REAL HOLDERS ═══════════════════════ */}
{phase===5&&(<div>
  <h2 style={{fontSize:14,fontWeight:700,color:"#F8FAFC",margin:"0 0 4px"}}>Real Holder Simulation</h2>
  <p style={{fontSize:10,color:"#64748B",margin:"0 0 12px",lineHeight:1.6}}>
    {holders.length} real wallets from on-chain data. Search by address, then click to simulate their board placement across all 6 boards.
    Action badges (Special/Unique/Hidden) are estimated based on holder size.
  </p>

  {/* Search */}
  <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
    <input value={holderSearch} onChange={e=>setHolderSearch(e.target.value)} placeholder="Search wallet address..." style={{flex:1,maxWidth:400,background:"#0F172A",border:"1px solid #334155",borderRadius:6,padding:"8px 12px",color:"#E2E8F0",fontSize:11,fontFamily:"inherit"}}/>
    <span style={{fontSize:9,color:"#64748B"}}>{holders.length} wallets</span>
  </div>

  <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
    {/* Wallet list */}
    <div style={{width:380,flexShrink:0,background:"#111827",border:"1px solid #1E293B",borderRadius:10,overflow:"hidden"}}>
      <div style={{padding:"8px 12px",background:"#1E293B",fontSize:9,color:"#64748B",display:"flex",justifyContent:"space-between"}}>
        <span>Wallet</span><span>NFTs</span><span>Badges</span><span>Frags</span>
      </div>
      <div style={{maxHeight:500,overflowY:"auto"}}>
        {holders.filter(h=>!holderSearch||h.addr.toLowerCase().includes(holderSearch.toLowerCase())).slice(0,100).map((h,i)=>(
          <div key={i} onClick={()=>simHolder(h)} style={{
            padding:"6px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontSize:9,
            background:selectedHolder?.addr===h.addr?"#6366F120":"transparent",
            borderBottom:"1px solid #1E293B20",
            color:selectedHolder?.addr===h.addr?"#A78BFA":"#94A3B8",
          }}>
            <span style={{fontFamily:"monospace",fontSize:8,width:100}}>{h.short}</span>
            <span style={{width:40,textAlign:"center",color:"#FBBF24"}}>{h.tokens}</span>
            <span style={{width:40,textAlign:"center"}}>{h.badges.length}</span>
            <span style={{width:40,textAlign:"center",color:"#22D3EE"}}>{h.totalFrags}</span>
          </div>
        ))}
        {holders.filter(h=>!holderSearch||h.addr.toLowerCase().includes(holderSearch.toLowerCase())).length>100&&
          <div style={{padding:8,textAlign:"center",fontSize:8,color:"#475569"}}>Showing first 100 of {holders.filter(h=>!holderSearch||h.addr.toLowerCase().includes(holderSearch.toLowerCase())).length} results</div>
        }
      </div>
    </div>

    {/* Selected holder detail */}
    {holderSim&&(<div style={{flex:1,minWidth:300}}>
      {/* Holder info card */}
      <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <h3 style={{fontSize:12,fontWeight:700,color:"#F8FAFC",margin:"0 0 2px",fontFamily:"monospace"}}>{holderSim.holder.short}</h3>
            <p style={{fontSize:8,color:"#475569",margin:0,fontFamily:"monospace"}}>{holderSim.holder.addr}</p>
          </div>
          <div style={{textAlign:"right",fontSize:10}}>
            <div style={{color:"#FBBF24",fontWeight:700}}>{holderSim.holder.tokens} NFTs</div>
            <div style={{color:"#64748B",fontSize:9}}>{holderSim.holder.badges.length} trait badges</div>
          </div>
        </div>

        {/* Fragment inventory */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {[["C/D",holderSim.frags.CD,"#64748B"],["B Cor",holderSim.frags.B,"#3B82F6"],["A Cor",holderSim.frags.A,"#60A5FA"],["S T-pc",holderSim.frags.S,"#F59E0B"],["Special",holderSim.frags.Sp,"#8B5CF6"],["Unique",holderSim.frags.Un,"#EC4899"],["Hidden",holderSim.frags.Hd,"#10B981"]].map(([label,count,color])=>(
            <div key={label} style={{background:`${color}15`,border:`1px solid ${color}40`,borderRadius:4,padding:"3px 8px",fontSize:8}}>
              <span style={{color}}>{count}</span> <span style={{color:"#94A3B8"}}>{label}</span>
            </div>
          ))}
          <div style={{background:"#FF00E515",border:"1px solid #FF00E540",borderRadius:4,padding:"3px 8px",fontSize:8}}>
            <span style={{color:"#FF00E5"}}>{holderSim.holder.combos}</span> <span style={{color:"#94A3B8"}}>Combos</span>
          </div>
        </div>
        <div style={{fontSize:8,color:"#64748B"}}>
          Total board tiles: <span style={{color:"#22D3EE",fontWeight:700}}>{holderSim.totalFrags}</span> • 
          Combo transistors: <span style={{color:"#FF00E5",fontWeight:700}}>{holderSim.holder.combos}</span>
        </div>
      </div>

      {/* Badge names */}
      {(()=>{
        // Calculate summary stats
        const bds=holderSim.boards;
        const cumScore=bds[5].avgCum;
        const cumWithoutCombo=bds.reduce((s,bd)=>s+(bd.avgScore-bd.avgCombo||0),0);
        const boardsCleared=bds.filter(bd=>bd.pctFull>50).length;
        const perfectClears=bds.filter(bd=>bd.pctPC>50).length;
        const totalCombo=bds.reduce((s,bd)=>s+(bd.avgCombo||0),0);
        return(
          <div style={{background:"#111827",border:"2px solid #10B981",borderRadius:12,padding:20,marginBottom:10,textAlign:"center"}}>
            <div style={{fontSize:48,fontWeight:900,color:"#F8FAFC",lineHeight:1,marginBottom:2}}>
              {Math.round(cumScore)}<span style={{fontSize:20,fontWeight:600,color:"#94A3B8"}}>pts</span>
            </div>
            <div style={{fontSize:11,color:"#94A3B8",marginTop:8,lineHeight:1.8}}>
              without combo: {Math.round(cumScore - totalCombo)}
            </div>
            <div style={{fontSize:11,color:"#94A3B8",lineHeight:1.8}}>
              Boards cleared: {boardsCleared}
            </div>
            <div style={{fontSize:11,color:"#94A3B8",lineHeight:1.8}}>
              Perfect clear: {perfectClears}
            </div>
          </div>
        );
      })()}
      <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginBottom:10}}>
        <h4 style={{fontSize:10,fontWeight:700,color:"#A78BFA",margin:"0 0 6px"}}>Trait Badges Owned</h4>
        <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
          {holderSim.holder.badges.map((b,i)=><span key={i} style={{fontSize:7,padding:"2px 6px",borderRadius:3,background:"#1E293B",color:"#CBD5E1",border:"1px solid #33415530"}}>{b}</span>)}
        </div>
        {holderSim.holder.comboNames.length>0&&(<>
          <h4 style={{fontSize:10,fontWeight:700,color:"#FF00E5",margin:"8px 0 4px"}}>Combo Badges</h4>
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {holderSim.holder.comboNames.map((b,i)=><span key={i} style={{fontSize:7,padding:"2px 6px",borderRadius:3,background:"#FF00E510",color:"#FF00E5",border:"1px solid #FF00E530"}}>{b}</span>)}
          </div>
        </>)}
      </div>

      {/* Board simulation results */}
      <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14}}>
        <h4 style={{fontSize:10,fontWeight:700,color:"#22D3EE",margin:"0 0 8px"}}>Progressive Board Simulation (20 iterations)</h4>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:8}}>
          <thead><tr style={{color:"#64748B"}}>
            {["Board","Score","Filled","Path","Full%","PC ✦","Cumul."].map(h=><th key={h} style={{padding:"4px 5px",textAlign:"center",borderBottom:"1px solid #1E293B",fontSize:7}}>{h}</th>)}
          </tr></thead>
          <tbody>{holderSim.boards.map((bd,b)=>(
            <tr key={b} style={{opacity:bd.avgScore===0?0.3:1}}>
              <td style={{padding:"5px",color:"#A78BFA",fontWeight:600,textAlign:"center"}}>{BOARDS[b].name}</td>
              <td style={{padding:"5px",textAlign:"center",color:"#22D3EE",fontWeight:700}}>{bd.avgScore}</td>
              <td style={{padding:"5px",textAlign:"center"}}>{bd.avgFilled}/16</td>
              <td style={{padding:"5px",textAlign:"center"}}>{bd.avgOnPath}</td>
              <td style={{padding:"5px",textAlign:"center",color:bd.pctFull>0?"#34D399":"#334155"}}>{bd.pctFull}%</td>
              <td style={{padding:"5px",textAlign:"center",color:bd.pctPC>0?"#FBBF24":"#334155"}}>{bd.pctPC>0?`${bd.pctPC}%`:"—"}</td>
              <td style={{padding:"5px",textAlign:"center",color:"#FBBF24",fontWeight:600}}>{bd.avgCum}</td>
            </tr>
          ))}</tbody>
        </table>

        {/* Per-board fragment usage */}
        <div style={{marginTop:8}}>
          <h5 style={{fontSize:8,color:"#64748B",margin:"0 0 4px",textTransform:"uppercase"}}>Fragment Usage per Board</h5>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:7}}>
            <thead><tr style={{color:"#475569"}}>
              <th style={{padding:"2px 4px",textAlign:"left",borderBottom:"1px solid #1E293B"}}>Type</th>
              {BOARDS.map((_,b)=><th key={b} style={{padding:"2px 4px",textAlign:"center",borderBottom:"1px solid #1E293B"}}>B{b+1}</th>)}
            </tr></thead>
            <tbody>{FK.map(k=>{
              const vals=holderSim.boards.map(bd=>bd.avgUsage?.[k]||0);
              if(vals.every(v=>v===0))return null;
              return(<tr key={k}>
                <td style={{padding:"2px 4px",color:FT[k].cl,fontWeight:600}}>{FL[k]}</td>
                {vals.map((v,b)=><td key={b} style={{padding:"2px 4px",textAlign:"center",color:v>0?"#E2E8F0":"#334155"}}>{v>0?v.toFixed(1):"—"}</td>)}
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>
    </div>)}
  </div>

  {/* Distribution overview */}
  <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:14,marginTop:12}}>
    <h3 style={{fontSize:11,fontWeight:700,color:"#F8FAFC",margin:"0 0 8px"}}>Holder Distribution Overview</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
      {[
        ["1 NFT",holders.filter(h=>h.tokens===1).length,"#64748B"],
        ["2-5 NFTs",holders.filter(h=>h.tokens>=2&&h.tokens<=5).length,"#3B82F6"],
        ["6-10 NFTs",holders.filter(h=>h.tokens>=6&&h.tokens<=10).length,"#F59E0B"],
        ["11-50 NFTs",holders.filter(h=>h.tokens>=11&&h.tokens<=50).length,"#EC4899"],
        ["51+ NFTs",holders.filter(h=>h.tokens>=51).length,"#8B5CF6"],
      ].map(([label,count,color])=>(
        <div key={label} style={{background:"#0F172A",borderRadius:6,padding:10,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color}}>{count}</div>
          <div style={{fontSize:9,color:"#64748B"}}>{label}</div>
          <div style={{fontSize:8,color:"#475569"}}>{(count/holders.length*100).toFixed(1)}%</div>
        </div>
      ))}
    </div>
    <div style={{marginTop:8,fontSize:9,color:"#64748B"}}>
      Avg badges per wallet: <span style={{color:"#22D3EE"}}>{(holders.reduce((s,h)=>s+h.badges.length,0)/holders.length).toFixed(1)}</span> • 
      Avg fragments: <span style={{color:"#FBBF24"}}>{(holders.reduce((s,h)=>s+h.totalFrags,0)/holders.length).toFixed(1)}</span>
    </div>
  </div>
</div>)}

{/* ═══════════════════════ PHASE 6: INTERACTIVE GAME ═══════════════════════ */}
{phase===6&&(()=>{
  const board=BOARDS[gameBoardIdx];
  const cellSz=72,gp=5,pd=24;
  const bW=cellSz*4+gp*3+pd*2;

  const fragImg=(shape,notches)=>{
    const ns=[...notches].sort().join(",");
    if(shape==="Straight")return ns.includes("N")?F_IMG.straightNS:F_IMG.straightWE;
    if(shape==="CornerB")return ns.includes("W")?F_IMG.cornerWN:F_IMG.cornerNE;
    if(shape==="CornerA")return ns.includes("W")?F_IMG.cornerWS:F_IMG.cornerSE;
    if(shape==="T-piece")return!notches.includes("S")?F_IMG.tpieceWNE:F_IMG.tpieceWSE;
    return F_IMG.crossSpecial;
  };

  const[placeFx,setPlaceFx]=useState(null); // {r,c,key} for lottie animation

  const spawnFrag=(type)=>setGameInv(p=>[...p,mkFrag(type,Date.now()+Math.random())]);
  const pickUp=(frag,invIdx)=>{setCarrying({frag,invIdx});setGameSelected(invIdx);};
  const cancelCarry=()=>{setCarrying(null);};
  const placeOnBoard=(r,c)=>{
    if(!carrying||gameBoard[r][c])return;
    setGameBoard(p=>{const n=p.map(row=>[...row]);n[r][c]={...carrying.frag};return n;});
    setGameInv(p=>p.filter((_,i)=>i!==carrying.invIdx));
    setCarrying(null);setGameSelected(null);
    // Trigger electricity lottie at placement position
    const key=Date.now();setPlaceFx({r,c,key});
    setTimeout(()=>setPlaceFx(prev=>prev&&prev.key===key?null:prev),900);
  };
  const removeFromBoard=(r,c)=>{
    if(!gameBoard[r][c])return;
    setGameInv(p=>[...p,gameBoard[r][c]]);
    setGameBoard(p=>{const n=p.map(r=>[...r]);n[r][c]=null;return n;});
  };
  const toggleCombo=(r,c)=>{if(!gameBoard[r][c])return;const k=r*4+c;setGameCombos(p=>p.includes(k)?p.filter(x=>x!==k):[...p,k].slice(-gameComboCount));};
  const rotateFrag=(idx)=>{
    setGameInv(p=>{const n=[...p];const f={...n[idx]};const rots=allRots(f.shape,f.notches);if(rots.length<=1)return p;const ck=[...f.notches].sort().join(",");const ci=rots.findIndex(r=>[...r].sort().join(",")===ck);f.notches=[...rots[(ci+1)%rots.length]];n[idx]=f;
    if(carrying&&carrying.invIdx===idx)setCarrying({frag:f,invIdx:idx});return n;});
  };
  const resetGame=()=>{setGameBoard(Array.from({length:4},()=>Array(4).fill(null)));setGameInv([]);setGameSelected(null);setGameCombos([]);setCarrying(null);setPlaceFx(null);};
  const autoSolve=()=>{const all=[...gameInv];for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(gameBoard[r][c])all.push(gameBoard[r][c]);const{grid,usedIds}=solveBoard(board,all);setGameBoard(grid.map(r=>r.map(c=>c?{...c}:null)));setGameInv(all.filter((_,i)=>!usedIds.has(i)));setGameSelected(null);setCarrying(null);};

  // Live score
  const ls=(()=>{
    const reqs=pathReqs(board);let onP=0,pP=0,dP=0,fl=0;
    for(let i=0;i<16;i++){const{r,c,need}=reqs[i];const t=gameBoard[r][c];if(t&&canFit(t.notches,need)){onP++;pP+=t.conn;}else break;}
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(gameBoard[r][c])fl++;
    const pMap={};board.path.forEach(([r,c],i)=>pMap[`${r},${c}`]=i);
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){const t=gameBoard[r][c];if(!t)continue;const pi=pMap[`${r},${c}`];if(pi===undefined||pi>=onP)dP+=t.disc;}
    const fB=fl===16?SC.FULL:0,hB=onP===16?SC.HAM:0;
    let cP=0;for(const k of gameCombos){const cr=k>>2,cc=k&3;const t=gameBoard[cr][cc];if(!t)continue;for(const n of t.notches){const[dr,dc]=DIRS[n];const nr=cr+dr,nc=cc+dc;if(nr>=0&&nr<4&&nc>=0&&nc<4&&gameBoard[nr][nc]&&gameBoard[nr][nc].notches.includes(OPP[n]))cP+=SC.COMBO;}}
    return{pP,dP,onP,fl,fB,hB,cP,tot:pP+dP+fB+hB+cP};
  })();

  const eR=board.entry.row,eC=board.entry.col,eD=board.entry.dir;
  const xR=board.exit.row,xC=board.exit.col,xD=board.exit.dir;
  // Marker position helper
  const markerPos=(row,col,dir)=>{
    const x=pd+col*(cellSz+gp)+cellSz/2;const y=pd+row*(cellSz+gp)+cellSz/2;
    const off=cellSz/2+16;
    if(dir==="N")return{mx:x,my:y-off};if(dir==="S")return{mx:x,my:y+off};
    if(dir==="W")return{mx:x-off,my:y};return{mx:x+off,my:y};
  };
  const ep=markerPos(eR,eC,eD),xp=markerPos(xR,xC,xD);
  const eCtr={x:pd+eC*(cellSz+gp)+cellSz/2,y:pd+eR*(cellSz+gp)+cellSz/2};
  const xCtr={x:pd+xC*(cellSz+gp)+cellSz/2,y:pd+xR*(cellSz+gp)+cellSz/2};

  return(<div>
    <h2 style={{fontSize:15,fontWeight:700,color:"#F8FAFC",margin:"0 0 4px"}}>🎮 Interactive Board Builder</h2>
    <p style={{fontSize:10,color:"#64748B",margin:"0 0 12px",lineHeight:1.6}}>
      Click a fragment in inventory to pick it up — it follows your cursor. Click a board slot to place it. Right-click placed tiles to remove.
    </p>

    <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
      <select value={gameBoardIdx} onChange={e=>{setGameBoardIdx(+e.target.value);resetGame();}} style={{background:"#1E293B",border:"1px solid #334155",borderRadius:6,padding:"6px 10px",color:"#E2E8F0",fontSize:11,fontFamily:"inherit"}}>
        {BOARDS.map((b,i)=><option key={i} value={i}>{b.name} ({b.difficulty})</option>)}
      </select>
      <button onClick={autoSolve} style={{padding:"6px 14px",background:"#6366F130",border:"1px solid #6366F1",borderRadius:6,color:"#A78BFA",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>⚡ Auto-Solve</button>
      <button onClick={resetGame} style={{padding:"6px 14px",background:"#7F1D1D20",border:"1px solid #F8717140",borderRadius:6,color:"#F87171",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>↺ Reset</button>
      <div style={{fontSize:10,color:"#64748B"}}>Combos: <input type="number" min={0} max={20} value={gameComboCount} onChange={e=>setGameComboCount(Math.max(0,+e.target.value||0))} style={{background:"#0F172A",border:"1px solid #FF00E540",borderRadius:3,padding:"2px 4px",color:"#FF00E5",fontSize:10,width:32,textAlign:"center",fontFamily:"inherit"}}/></div>
      {carrying&&<button onClick={cancelCarry} style={{padding:"6px 14px",background:"#F59E0B20",border:"1px solid #F59E0B",borderRadius:6,color:"#F59E0B",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕ Cancel</button>}
    </div>

    <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
      {/* Board */}
      <div>
        {/* Score */}
        <div style={{background:"#111827",border:`2px solid ${ls.onP===16?"#10B981":ls.fl===16?"#FBBF24":"#334155"}`,borderRadius:10,padding:12,marginBottom:10,textAlign:"center",width:bW}}>
          <div style={{fontSize:38,fontWeight:900,color:"#F8FAFC",lineHeight:1}}>{ls.tot}<span style={{fontSize:16,color:"#94A3B8"}}>pts</span></div>
          <div style={{fontSize:9,color:"#94A3B8",marginTop:4}}>Path: {ls.pP} • Disc: {ls.dP} • Full: {ls.fB>0?"✓":"—"} • Ham: {ls.hB>0?"✓":"—"} • Combo: {ls.cP}</div>
          <div style={{fontSize:9,color:"#64748B",marginTop:2}}>{ls.onP}/16 on path • {ls.fl}/16 filled</div>
        </div>

        {/* Board with entry/exit SVG overlay */}
        <div style={{position:"relative",width:bW,height:cellSz*4+gp*3+pd*2}}>
          {/* Entry/Exit SVG lines */}
          <svg style={{position:"absolute",left:0,top:0,width:bW,height:cellSz*4+gp*3+pd*2,pointerEvents:"none",zIndex:5}}>
            <defs>
              <marker id="gae" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#22D3EE"/></marker>
              <marker id="gax" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#F472B6"/></marker>
            </defs>
            {/* Entry line */}
            <line x1={ep.mx} y1={ep.my} x2={eCtr.x} y2={eCtr.y} stroke="#22D3EE" strokeWidth={2.5} strokeDasharray="5 3" markerEnd="url(#gae)"/>
            <circle cx={ep.mx} cy={ep.my} r={6} fill="#0A0F1C" stroke="#22D3EE" strokeWidth={2}/>
            <text x={ep.mx} y={ep.my-10} textAnchor="middle" fill="#22D3EE" fontSize={10} fontWeight="800" fontFamily="monospace">IN</text>
            {/* Exit line */}
            <line x1={xCtr.x} y1={xCtr.y} x2={xp.mx} y2={xp.my} stroke="#F472B6" strokeWidth={2.5} strokeDasharray="5 3" markerEnd="url(#gax)"/>
            <circle cx={xp.mx} cy={xp.my} r={6} fill="#0A0F1C" stroke="#F472B6" strokeWidth={2}/>
            <text x={xp.mx} y={xp.my-10} textAnchor="middle" fill="#F472B6" fontSize={10} fontWeight="800" fontFamily="monospace">OUT</text>
          </svg>

          {/* Grid */}
          <div style={{display:"grid",gridTemplateColumns:`repeat(4,${cellSz}px)`,gridTemplateRows:`repeat(4,${cellSz}px)`,gap:gp,background:"#111827",padding:pd,borderRadius:12,border:"2px solid #1E293B",position:"relative",zIndex:1}}>
            {Array.from({length:16},(_,idx)=>{
              const r=idx>>2,c=idx&3;
              const tile=gameBoard[r][c];
              const pi=board.path.findIndex(([pr,pc])=>pr===r&&pc===c);
              const hasCombo=gameCombos.includes(r*4+c);
              const isEn=r===eR&&c===eC;const isEx=r===xR&&c===xC;
              return(
                <div key={idx}
                  onClick={()=>{if(carrying&&!tile)placeOnBoard(r,c);else if(tile&&!carrying)toggleCombo(r,c);}}
                  onContextMenu={e=>{e.preventDefault();removeFromBoard(r,c);}}
                  style={{
                    width:cellSz,height:cellSz,borderRadius:7,
                    cursor:carrying?(tile?"not-allowed":"copy"):"pointer",
                    position:"relative",
                    background:tile?(tile.conn>=40?"#1a1040":"#1E293B"):(carrying?"#0F172A":"#0A0F1C"),
                    border:isEn?`2px solid #22D3EE60`:isEx?`2px solid #F472B660`:tile?`2px solid ${tile.cl}40`:`1px solid ${carrying?"#6366F140":"#1E293B50"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    transition:"border-color 0.15s, background 0.15s",
                    boxShadow:carrying&&!tile?"inset 0 0 20px rgba(99,102,241,0.08)":"none",
                  }}>
                  {tile?(<>
                    <img src={fragImg(tile.shape,tile.notches)} width={cellSz-12} height={cellSz-12} style={{opacity:0.9,pointerEvents:"none"}} alt=""/>
                    {hasCombo&&<div style={{position:"absolute",width:18,height:18,borderRadius:"50%",background:"#FF00E5",border:"2px solid #FF00E580",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:3,pointerEvents:"none"}}/>}
                    {/* Lottie placement effect */}
                    {placeFx&&placeFx.r===r&&placeFx.c===c&&(
                      <div style={{position:"absolute",inset:-20,zIndex:10,pointerEvents:"none"}}>
                        <dotlottie-player src="/frags/electricity.lottie" autoplay speed="1.5" style={{width:"100%",height:"100%"}}/>
                      </div>
                    )}
                  </>):(
                    <span style={{fontSize:10,color:carrying?"#6366F140":"#1E293B80",fontFamily:"monospace",fontWeight:700,pointerEvents:"none"}}>{pi>=0?pi+1:""}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hamiltonian path glow — shows when path has tiles on it */}
          {ls.onP>=2&&(
            <svg style={{position:"absolute",left:0,top:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:4}}>
              <defs>
                <filter id="pathGlow">
                  <feGaussianBlur stdDeviation={ls.onP===16?"6":"3"} result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <polyline
                points={board.path.slice(0,ls.onP).map(([r,c])=>`${pd+c*(cellSz+gp)+cellSz/2},${pd+r*(cellSz+gp)+cellSz/2}`).join(" ")}
                fill="none"
                stroke={ls.onP===16?"#22D3EE":"#10B981"}
                strokeWidth={ls.onP===16?4:2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeOpacity={ls.onP===16?0.9:0.5}
                filter="url(#pathGlow)"
              />
              {ls.onP===16&&<polyline
                points={board.path.map(([r,c])=>`${pd+c*(cellSz+gp)+cellSz/2},${pd+r*(cellSz+gp)+cellSz/2}`).join(" ")}
                fill="none"
                stroke="#22D3EE"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeOpacity={0.3}
                style={{animation:"pulseGlow 2s ease-in-out infinite"}}
              />}
            </svg>
          )}
        </div>
      </div>

      {/* Inventory */}
      <div style={{width:290}}>
        {/* Spawn */}
        <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:10,marginBottom:10}}>
          <h4 style={{fontSize:10,fontWeight:700,color:"#A78BFA",margin:"0 0 8px"}}>Spawn Fragments</h4>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {FK.map(k=>(<button key={k} onClick={()=>spawnFrag(k)} style={{padding:"4px 8px",background:`${FT[k].cl}15`,border:`1px solid ${FT[k].cl}40`,borderRadius:4,color:FT[k].cl,fontSize:8,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{FL[k]}</button>))}
          </div>
          <div style={{display:"flex",gap:4,marginTop:6}}>
            <button onClick={()=>{for(let i=0;i<3;i++)spawnFrag("CD_STRAIGHT");for(let i=0;i<2;i++)spawnFrag("B_CORNER");spawnFrag("A_CORNER");for(let i=0;i<4;i++)spawnFrag("SPECIAL");}} style={{padding:"4px 8px",background:"#334155",border:"1px solid #475569",borderRadius:4,color:"#94A3B8",fontSize:8,cursor:"pointer",fontFamily:"inherit"}}>+ Starter Pack</button>
            <button onClick={()=>{FK.forEach(k=>{for(let i=0;i<3;i++)spawnFrag(k);});}} style={{padding:"4px 8px",background:"#334155",border:"1px solid #475569",borderRadius:4,color:"#94A3B8",fontSize:8,cursor:"pointer",fontFamily:"inherit"}}>+ Full Set</button>
          </div>
        </div>

        {/* Inventory grid */}
        <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:10,maxHeight:440,overflowY:"auto"}}>
          <h4 style={{fontSize:10,fontWeight:700,color:"#22D3EE",margin:"0 0 6px"}}>Inventory ({gameInv.length}) {carrying&&<span style={{color:"#F59E0B",fontWeight:400}}>— carrying fragment, click a board slot</span>}</h4>
          {gameInv.length===0&&<p style={{fontSize:9,color:"#475569"}}>Spawn fragments above to start.</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
            {gameInv.map((f,i)=>{
              const isCarrying=carrying&&carrying.invIdx===i;
              return(
                <div key={f.id+"-"+i}
                  onClick={()=>{if(carrying&&carrying.invIdx===i){cancelCarry();}else{pickUp(f,i);}}}
                  style={{
                    width:58,height:58,borderRadius:5,cursor:isCarrying?"grabbing":"grab",position:"relative",
                    background:isCarrying?"#6366F130":gameSelected===i?"#6366F115":"#0F172A",
                    border:isCarrying?`2px solid #6366F1`:gameSelected===i?`2px solid #6366F160`:`1px solid ${f.cl}25`,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    opacity:isCarrying?0.4:1,
                    transition:"all 0.1s",
                  }}>
                  <img src={fragImg(f.shape,f.notches)} width={38} height={38} style={{opacity:0.85,pointerEvents:"none"}} alt=""/>
                  <span style={{fontSize:6,color:f.cl,marginTop:1,pointerEvents:"none"}}>{f.tier}</span>
                </div>
              );
            })}
          </div>
          {/* Selected fragment info */}
          {gameSelected!==null&&gameInv[gameSelected]&&!carrying&&(
            <div style={{marginTop:8,padding:8,background:"#0F172A",borderRadius:6,border:"1px solid #6366F140"}}>
              <div style={{fontSize:9,color:"#A78BFA",fontWeight:600,marginBottom:3}}>Selected: {FL[gameInv[gameSelected].type]}</div>
              <div style={{fontSize:8,color:"#94A3B8"}}>Notches: {gameInv[gameSelected].notches.join(", ")}</div>
              <div style={{display:"flex",gap:6,marginTop:4}}>
                {gameInv[gameSelected].shape!=="T-piece"&&gameInv[gameSelected].shape!=="Cross"&&(
                  <button onClick={()=>rotateFrag(gameSelected)} style={{padding:"3px 10px",background:"#6366F120",border:"1px solid #6366F1",borderRadius:4,color:"#A78BFA",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>⟳ Rotate</button>
                )}
                <button onClick={()=>pickUp(gameInv[gameSelected],gameSelected)} style={{padding:"3px 10px",background:"#22D3EE20",border:"1px solid #22D3EE",borderRadius:4,color:"#22D3EE",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>Pick Up</button>
              </div>
              {gameInv[gameSelected].shape==="T-piece"&&<div style={{fontSize:8,color:"#F59E0B",marginTop:3}}>🔒 Locked — cannot rotate</div>}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Floating cursor fragment */}
    {carrying&&(<div style={{position:"fixed",left:cursorPos.x-30,top:cursorPos.y-30,width:60,height:60,pointerEvents:"none",zIndex:9999,opacity:0.9,filter:"drop-shadow(0 0 16px rgba(99,102,241,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))",transition:"left 0.02s,top 0.02s"}}>
      <img src={fragImg(carrying.frag.shape,carrying.frag.notches)} width={60} height={60} alt="" style={{pointerEvents:"none"}}/>
    </div>)}

    {/* Instructions */}
    <div style={{background:"#111827",border:"1px solid #1E293B",borderRadius:10,padding:12,marginTop:12}}>
      <h4 style={{fontSize:10,fontWeight:700,color:"#64748B",margin:"0 0 6px"}}>How to Play</h4>
      <div style={{fontSize:9,color:"#475569",lineHeight:1.8,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8}}>
        <div><b style={{color:"#22D3EE"}}>1. Pick Up:</b> Click a fragment in inventory — it attaches to your cursor</div>
        <div><b style={{color:"#22D3EE"}}>2. Place:</b> Click an empty board slot to drop the fragment</div>
        <div><b style={{color:"#22D3EE"}}>3. Cancel:</b> Click the same fragment again or press Cancel to put it back</div>
        <div><b style={{color:"#22D3EE"}}>4. Rotate:</b> Select (don't pick up) and click Rotate. T-pieces are 🔒 locked</div>
        <div><b style={{color:"#22D3EE"}}>5. Remove:</b> Right-click any placed tile to return it to inventory</div>
        <div><b style={{color:"#22D3EE"}}>6. Combo:</b> Click a placed tile to toggle combo badge (pink dot)</div>
        <div><b style={{color:"#F472B6"}}>Entry/Exit:</b> <span style={{color:"#22D3EE"}}>● IN</span> = path start, <span style={{color:"#F472B6"}}>● OUT</span> = path end</div>
        <div><b style={{color:"#A78BFA"}}>Auto-Solve:</b> Let the AI find optimal placement for your fragments</div>
      </div>
    </div>
  </div>);
})()}


{running&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
  <div style={{background:"#1E293B",padding:20,borderRadius:10,textAlign:"center",border:"1px solid #334155"}}>
    <div style={{width:160,height:4,background:"#0F172A",borderRadius:2,overflow:"hidden",marginBottom:8}}>
      <div style={{width:`${progress}%`,height:"100%",background:"linear-gradient(90deg,#6366F1,#A78BFA)",borderRadius:2,transition:"width .3s"}}/>
    </div>
    <p style={{fontSize:10,color:"#A78BFA",margin:0,fontWeight:600}}>Simulating... {progress}%</p>
  </div>
</div>}
      </div>
    </div>
  );
}
