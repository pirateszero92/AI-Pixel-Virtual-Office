'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

export default function Home() {
  const [status, setStatus] = useState('Disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKanbanOpen, setIsKanbanOpen] = useState(false);

  // Task & Kanban State
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  // Draggable Chat State
  const [chatPos, setChatPos] = useState({ x: 300, y: 150 });
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const dragStartChat = useRef({ x: 0, y: 0 });

  const handleMouseDownChat = (e: React.MouseEvent) => {
      setIsDraggingChat(true);
      dragStartChat.current = { x: e.clientX - chatPos.x, y: e.clientY - chatPos.y };
  };

  useEffect(() => {
      const handleMouseMoveChat = (e: MouseEvent) => {
          if (isDraggingChat) {
              setChatPos({ x: e.clientX - dragStartChat.current.x, y: e.clientY - dragStartChat.current.y });
          }
      };
      const handleMouseUpChat = () => setIsDraggingChat(false);

      if (isDraggingChat) {
          window.addEventListener('mousemove', handleMouseMoveChat);
          window.addEventListener('mouseup', handleMouseUpChat);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMoveChat);
          window.removeEventListener('mouseup', handleMouseUpChat);
      }
  }, [isDraggingChat]);

  // Agents & Providers State
  const [existingAgents, setExistingAgents] = useState<any[]>([]);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('');
  const [newAgentX, setNewAgentX] = useState('');
  const [newAgentY, setNewAgentY] = useState('');
  const [newAgentScale, setNewAgentScale] = useState('1.0');
  const [selectedProvId, setSelectedProvId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [lastClickedPos, setLastClickedPos] = useState<{x: number, y: number} | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [editAgentId, setEditAgentId] = useState<number | null>(null);
  
  const showSpeechBubbleRef = useRef<((id: number, text: string) => void) | null>(null);
  
  const [providerStatuses, setProviderStatuses] = useState<{ [key: number]: string }>({});
  const [chatAgent, setChatAgent] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const [providers, setProviders] = useState<any[]>([]);
  const [newProvName, setNewProvName] = useState('');
  const [newProvType, setNewProvType] = useState('openai_compatible');
  const [newProvUrl, setNewProvUrl] = useState('');
  const [newProvKey, setNewProvKey] = useState('');

  // Settings State
  const [walkSpeed, setWalkSpeed] = useState(2.0);
  const walkSpeedRef = useRef(2.0);
  const [maxTokens, setMaxTokens] = useState(1024);

  useEffect(() => {
    walkSpeedRef.current = walkSpeed;
  }, [walkSpeed]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/settings')
      .then(res => res.json())
      .then(data => {
        if (data.max_tokens) setMaxTokens(parseInt(data.max_tokens));
      })
      .catch(err => console.error("โหลดตั้งค่าล้มเหลว:", err));
  }, []);

  const saveMaxTokens = async () => {
    try {
      await fetch('http://127.0.0.1:8000/settings/max_tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: maxTokens.toString() })
      });
      alert('บันทึก Max Tokens เรียบร้อยแล้ว!');
    } catch (err) {
      console.error("เซฟค่าล้มเหลว", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("โหลด Task ล้มเหลว", e);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/agents');
      const data = await res.json();
      setExistingAgents(data);
    } catch (e) {
      console.error("โหลด Agent ล้มเหลว", e);
    }
  };

    const loadProviders = async () => {
      const res = await fetch('http://127.0.0.1:8000/providers');
      const data = await res.json();
      setProviders(data);
      // Check health for each
      data.forEach(async (p: any) => {
          try {
              const hres = await fetch(`http://127.0.0.1:8000/providers/${p.id}/health`);
              const hdata = await hres.json();
              setProviderStatuses(prev => ({ ...prev, [p.id]: hdata.status }));
          } catch {
              setProviderStatuses(prev => ({ ...prev, [p.id]: 'error' }));
          }
      });
    };

  useEffect(() => {
    fetchTasks();
    fetchAgents();
    loadProviders();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTask = async () => {
    try {
      await fetch('http://127.0.0.1:8000/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            title: newTaskTitle, 
            description: newTaskDesc,
            agent_id: newTaskAssignee ? parseInt(newTaskAssignee) : null
        })
      });
      setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskAssignee('');
      fetchTasks();
    } catch (e) {
      console.error("สร้าง Task ล้มเหลว", e);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgentName || !newAgentRole) return;
    try {
      let avatarUrl = '';
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const uploadRes = await fetch('http://127.0.0.1:8000/agents/upload_avatar', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        avatarUrl = uploadData.avatar_url;
      }

      let url = `http://127.0.0.1:8000/agents?name=${encodeURIComponent(newAgentName)}&role=${encodeURIComponent(newAgentRole)}`;
      if (selectedProvId) url += `&provider_id=${selectedProvId}`;
      if (selectedModel) url += `&model_name=${encodeURIComponent(selectedModel)}`;
      if (avatarUrl) url += `&avatar=${encodeURIComponent(avatarUrl)}`;
      if (newAgentX) url += `&x=${newAgentX}`;
      if (newAgentY) url += `&y=${newAgentY}`;
      if (newAgentScale) url += `&sprite_scale=${newAgentScale}`;

      await fetch(url, { method: 'POST' });
      setNewAgentName(''); setNewAgentRole(''); setNewAgentX(''); setNewAgentY('');
      setNewAgentScale('1.0');
      setSelectedProvId(''); setSelectedModel(''); setAvatarFile(null);
      setEditAgentId(null);
      fetchAgents();
      window.location.reload();
    } catch (e) {
      console.error("สร้าง Agent ล้มเหลว", e);
    }
  };

  const handleUpdateAgent = async () => {
    if (!editAgentId || !newAgentName || !newAgentRole) return;
    try {
      let finalAvatarUrl = null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const uploadRes = await fetch('http://127.0.0.1:8000/agents/upload_avatar', {
            method: 'POST', body: formData
        });
        const uploadData = await uploadRes.json();
        finalAvatarUrl = uploadData.avatar_url;
      }

      const payload: any = {
          name: newAgentName,
          role: newAgentRole,
          provider_id: selectedProvId ? parseInt(selectedProvId) : null,
          model_name: selectedModel || null,
          x: newAgentX ? parseFloat(newAgentX) : 0,
          y: newAgentY ? parseFloat(newAgentY) : 0,
          sprite_scale: newAgentScale ? parseFloat(newAgentScale) : 1.0
      };
      if (finalAvatarUrl) {
          payload.avatar = finalAvatarUrl;
      }

      await fetch(`http://127.0.0.1:8000/agents/${editAgentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setNewAgentName(''); setNewAgentRole(''); setNewAgentX(''); setNewAgentY('');
      setNewAgentScale('1.0');
      setSelectedProvId(''); setSelectedModel(''); setAvatarFile(null);
      setEditAgentId(null);
      fetchAgents();
      window.location.reload();
    } catch (e) {
      console.error("อัปเดต Agent ล้มเหลว", e);
    }
  };

  const handleDeleteAgent = async (id: number) => {
      if (!confirm('Are you sure you want to fire this employee?')) return;
      try {
          await fetch(`http://127.0.0.1:8000/agents/${id}`, { method: 'DELETE' });
          fetchAgents();
          window.location.reload();
      } catch (e) {
          console.error("ลบ Agent ล้มเหลว", e);
      }
  };

  const handleEditAgent = (agent: any) => {
      setEditAgentId(agent.id);
      setNewAgentName(agent.name);
      setNewAgentRole(agent.role);
      setNewAgentX(agent.x.toString());
      setNewAgentY(agent.y.toString());
      setNewAgentScale(agent.sprite_scale.toString());
      setSelectedProvId(agent.provider_id ? agent.provider_id.toString() : '');
      setSelectedModel(agent.model_name || '');
      setAvatarFile(null); // Force re-upload if they want to change avatar
  };

  const handleCreateProvider = async () => {
    if (!newProvName || !newProvType) return;
    try {
      await fetch('http://127.0.0.1:8000/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProvName, provider_type: newProvType, base_url: newProvUrl, api_key: newProvKey })
      });
      setNewProvName(''); setNewProvUrl(''); setNewProvKey('');
      loadProviders();
    } catch (err) {
        console.error(err);
    }
  };

  const handleOpenChat = async (agent: any) => {
      setChatAgent(agent);
      setIsChatting(true);
      // Fetch previous memory
      try {
          const res = await fetch(`http://127.0.0.1:8000/agents/${agent.id}/memory`);
          setChatMessages(await res.json());
      } catch (err) {
          console.error(err);
      }
  };

  const handleSendChat = async () => {
      if (!chatInput.trim() || !chatAgent) return;
      
      const userMsg = { id: Date.now(), content: `User: ${chatInput}`, timestamp: new Date().toISOString() };
      setChatMessages(prev => [...prev, userMsg]);
      const currentInput = chatInput;
      setChatInput('');

      try {
          const res = await fetch(`http://127.0.0.1:8000/agents/${chatAgent.id}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: currentInput })
          });
          const data = await res.json();
          const aiMsg = { id: Date.now()+1, content: `${chatAgent.name}: ${data.reply}`, timestamp: new Date().toISOString() };
          setChatMessages(prev => [...prev, aiMsg]);
      } catch (err) {
          console.error(err);
      }
  };

  const targetPositions = useRef<{ [key: number]: { x: number; y: number } }>({});
  const agentDesks = useRef<{ [key: number]: { x: number; y: number } }>({});
  const agentSprites = useRef<{ [key: number]: PIXI.Graphics }>({});

  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    
    // Clear old canvas if React strict mode double-invokes
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const app = new PIXI.Application();
    
    async function initPixi() {
      await app.init({
        resizeTo: container,
        backgroundColor: 0x111827,
      });
      
      container.appendChild(app.canvas);

      let bgTexture: PIXI.Texture;
      try {
        bgTexture = await PIXI.Assets.load('/office_map.png');
        const bgSprite = new PIXI.Sprite(bgTexture);
        app.stage.addChildAt(bgSprite, 0);
      } catch (err) {
        console.warn("office_map.png not found. Using dark background.");
        // Mock texture if missing
        const g = new PIXI.Graphics().rect(0,0,1920,1080).fill(0x222222);
        bgTexture = app.renderer.generateTexture(g);
        const bgSprite = new PIXI.Sprite(bgTexture);
        app.stage.addChildAt(bgSprite, 0);
      }

      // No static updateScale needed, handled in ticker below

      // ระบบหาพิกัด (Developer Style) - Use PixiJS event system
      app.stage.eventMode = 'static';
      app.stage.hitArea = new PIXI.Rectangle(0, 0, bgTexture.width, bgTexture.height);
      app.stage.on('pointerdown', (e) => {
          const pos = e.getLocalPosition(app.stage);
          console.log(`🎯 พิกัดที่คุณคลิก -> x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}`);
          if (pos.x >= 0 && pos.x <= bgTexture.width && pos.y >= 0 && pos.y <= bgTexture.height) {
              setLastClickedPos({ x: Math.round(pos.x), y: Math.round(pos.y) });
          }
      });

      // Mock Room Positions
      const locations = [
        { name: "CEO Room", x: bgTexture.width * 0.2, y: bgTexture.height * 0.2, color: 0x38bdf8 },
        { name: "Large Office", x: bgTexture.width * 0.7, y: bgTexture.height * 0.4, color: 0xa855f7 },
        { name: "Meeting Room", x: bgTexture.width * 0.5, y: bgTexture.height * 0.2, color: 0xef4444 },
      ];

      locations.forEach(loc => {
        const box = new PIXI.Graphics();
        box.rect(loc.x, loc.y, 40, 40);
        // ซ่อนกล่อง debug ชั่วคราว (ปรับ alpha เป็น 0) เพื่อความสวยงามของภาพพื้นหลัง
        box.fill({ color: loc.color, alpha: 0.0 });
        box.stroke({ color: loc.color, width: 2, alpha: 0.0 });
        app.stage.addChild(box);
      });

      showSpeechBubbleRef.current = (agentId: number, textStr: string) => {
          const container = agentSprites.current[agentId];
          if (!container) return;
      
          // Remove old bubble if exists
          const oldBubble = container.getChildByName("speech_bubble");
          if (oldBubble) {
              container.removeChild(oldBubble);
          }
      
          const bubbleContainer = new PIXI.Container();
          bubbleContainer.name = "speech_bubble";
          
          // Format text (limit length)
          const displayStr = textStr.length > 50 ? textStr.substring(0, 50) + "..." : textStr;
          
          const text = new PIXI.Text({
              text: displayStr,
              style: { fontFamily: 'Arial', fontSize: 12, fill: 0x000000, align: 'center', wordWrap: true, wordWrapWidth: 150 }
          });
          
          const bg = new PIXI.Graphics();
          bg.roundRect(-10, -10, text.width + 20, text.height + 20, 10);
          bg.fill(0xffffff);
          
          const tail = new PIXI.Graphics();
          tail.poly([0, 0, 10, -10, 20, 0]);
          tail.fill(0xffffff);
          tail.y = text.height + 10;
          tail.x = text.width / 2 - 10;
      
          bubbleContainer.addChild(bg, tail, text);
          
          const nametag = container.children.find(c => c instanceof PIXI.Text);
          bubbleContainer.y = (nametag ? nametag.y : -80) - text.height - 20;
          bubbleContainer.x = -text.width / 2;
      
          container.addChild(bubbleContainer);
      
          setTimeout(() => {
              if (container && container.children.includes(bubbleContainer)) {
                  container.removeChild(bubbleContainer);
              }
          }, 8000);
      };

      try {
        const res = await fetch('http://127.0.0.1:8000/agents');
        const agents = await res.json();

        agents.forEach(async (agent: any, index: number) => {
          const spriteContainer = new PIXI.Container();
          
          if (agent.avatar) {
             try {
                const tex = await PIXI.Assets.load(agent.avatar);
                const sprite = new PIXI.Sprite(tex);
                
                const baseHeight = 80;
                const finalHeight = baseHeight * (agent.sprite_scale || 1.0);
                const scale = finalHeight / tex.height;
                sprite.scale.set(scale);
                sprite.anchor.set(0.5, 1);
                
                spriteContainer.addChild(sprite);
             } catch (e) {
                const circle = new PIXI.Graphics();
                circle.circle(0, 0, 15);
                const colors = [0x4ade80, 0xfacc15, 0xf472b6, 0x2dd4bf];
                circle.fill(colors[index % colors.length]);
                spriteContainer.addChild(circle);
             }
          } else {
              const circle = new PIXI.Graphics();
              circle.circle(0, 0, 15);
              const colors = [0x4ade80, 0xfacc15, 0xf472b6, 0x2dd4bf];
              circle.fill(colors[index % colors.length]);
              spriteContainer.addChild(circle);
          }
          
          spriteContainer.eventMode = 'static';
          spriteContainer.cursor = 'pointer';
          spriteContainer.on('pointerdown', (e) => {
              e.stopPropagation(); // Prevent the stage from receiving this click
              handleOpenChat(agent);
          });
          
          // คำนวณความสูงของป้ายชื่อให้สัมพันธ์กับสเกล
          const finalHeight = agent.avatar ? (80 * (agent.sprite_scale || 1.0)) : 30;

          // Nametag
          const text = new PIXI.Text({
            text: agent.name,
            style: { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, align: 'center', stroke: {color: '#000000', width: 4} }
          });
          text.x = -text.width / 2;
          // เลื่อนป้ายชื่อขึ้นไปเหนือหัวตัวละครตามความสูงจริง
          text.y = -(finalHeight + 15);
          spriteContainer.addChild(text);

          // ตั้งค่าพิกัดโต๊ะทำงานจากฐานข้อมูล
          let deskX = agent.x || bgTexture.width * 0.5;
          let deskY = agent.y || bgTexture.height * 0.5;

          spriteContainer.x = deskX;
          spriteContainer.y = deskY;

          app.stage.addChild(spriteContainer);
          agentSprites.current[agent.id] = spriteContainer as any;
          targetPositions.current[agent.id] = { x: deskX, y: deskY };
          agentDesks.current[agent.id] = { x: deskX, y: deskY };
        });
      } catch (err) {
        console.error("โหลดข้อมูลพนักงานล้มเหลว:", err);
      }

      app.ticker.add(() => {
        // อัปเดต Scale ทุกเฟรมเพื่อป้องกันภาพเพี้ยนตอนย่อหน้าต่าง
        if (bgTexture) {
          const scale = Math.min(app.screen.width / bgTexture.width, app.screen.height / bgTexture.height);
          app.stage.scale.set(scale);
          app.stage.x = (app.screen.width - bgTexture.width * scale) / 2;
          app.stage.y = (app.screen.height - bgTexture.height * scale) / 2;
        }

        const currentWalkSpeed = walkSpeedRef.current;
        Object.keys(agentSprites.current).forEach((idStr) => {
          const id = parseInt(idStr);
          const sprite = agentSprites.current[id];
          const target = targetPositions.current[id];

          if (!sprite || !target) return;

          const dx = target.x - sprite.x;
          const dy = target.y - sprite.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > currentWalkSpeed) {
            sprite.x += (dx / distance) * currentWalkSpeed;
            sprite.y += (dy / distance) * currentWalkSpeed;
          } else {
            sprite.x = target.x;
            sprite.y = target.y;
          }
        });
      });
      
      // Auto resize logic
      window.addEventListener('resize', () => {
        app.resize();
        // Option: resize background map as well
        const bg = app.stage.getChildAt(0);
        if (bg instanceof PIXI.Sprite) {
          bg.width = app.screen.width;
          bg.height = app.screen.height;
        }
      });
    }

    initPixi();

    return () => {
      app.destroy(true, { children: true, texture: true });
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket('ws://127.0.0.1:8000/ws');

    socket.onopen = () => setStatus('Connected 🟢');
    socket.onclose = () => setStatus('Disconnected 🔴');

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'agent_state_changed') {
        const { agent_id, name, action } = data;
        setLogs((prev) => [`[${name}]: ${action}`, ...prev.slice(0, 5)]);

        if (canvasContainerRef.current) {
            const w = canvasContainerRef.current.clientWidth;
            const h = canvasContainerRef.current.clientHeight;
            if (action === 'walking_to_desk') {
                const desk = agentDesks.current[agent_id];
                if (desk) {
                    targetPositions.current[agent_id] = { x: desk.x, y: desk.y };
                }
            } else if (action === 'return_to_idle') {
                const desk = agentDesks.current[agent_id];
                if (desk) {
                    targetPositions.current[agent_id] = { x: desk.x, y: desk.y };
                }
            }
        }
      } else if (data.event === 'agent_speech') {
        const { agent_id, message } = data;
        if (showSpeechBubbleRef.current) {
            showSpeechBubbleRef.current(agent_id, message);
        }
      }
    };

    return () => socket.close();
  }, []);

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-[280px]' : 'w-[0px]'} transition-all duration-300 ease-in-out bg-[#0b1120] flex flex-col border-r border-slate-800 z-10 shrink-0 shadow-xl overflow-hidden relative`}>
        {/* Toggle Button Inside Sidebar (when open) */}
        {isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-6 right-4 text-slate-400 hover:text-white z-20">
            ◀
          </button>
        )}
        
        <div className="min-w-[280px] flex-1 flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 flex items-center gap-3">
              <div className="text-blue-500 font-bold text-2xl tracking-tighter">&lt;/&gt; PIXEL</div>
              <div className="text-slate-400 text-xs mt-1 tracking-widest uppercase">Software</div>
            </div>
        
        {/* User Profile */}
        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-800/50">
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold border-2 border-slate-600">You</div>
          <div>
            <div className="font-semibold text-white">Guest User</div>
            <div className="text-xs text-green-400 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> {status}
            </div>
          </div>
        </div>

        {/* People List */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-500 mb-4 uppercase tracking-widest">People ({existingAgents.length})</div>
          <div className="flex flex-col gap-4">
            {existingAgents.map(a => (
              <div key={a.id} className="flex items-center gap-3 group cursor-pointer">
                 {a.avatar ? (
                    <img src={a.avatar} alt={a.name} className="w-9 h-9 rounded-full object-cover border border-slate-700 shadow-inner" />
                 ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs shadow-inner">
                        {a.name.charAt(0)}
                    </div>
                 )}
                 <div className="min-w-0 flex-1">
                   <div className="text-sm font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors">{a.name}</div>
                   <div className="text-xs text-slate-500 truncate">{a.role}</div>
                 </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-bold text-slate-500 mb-4 mt-8 uppercase tracking-widest">Spaces</div>
          <div className="flex flex-col gap-1">
             {['🏠 Lobby', '💻 Large Office', '🗣️ Meeting Room', '👑 CEO Room', '🎧 Focus Room'].map(space => (
               <div key={space} className="text-sm text-slate-400 hover:bg-slate-800/50 hover:text-white px-3 py-2 rounded-md cursor-pointer transition-all">
                 {space}
               </div>
             ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800/50 flex justify-between bg-[#0b1120]">
           <button onClick={() => setIsKanbanOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
              📋 Tasks
           </button>
           <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
              ⚙️ Settings
           </button>
        </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-full bg-[#05080f]">
        {/* Toggle Button Outside Sidebar (when closed) */}
        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-50 bg-[#0b1120] border border-slate-700 text-white p-2 rounded-md hover:bg-slate-800 shadow-lg">
            ☰
          </button>
        )}
        <div ref={canvasContainerRef} className="absolute inset-0" />
        
        {/* Floating Activity Feed */}
        <div className="absolute bottom-6 right-6 w-80 bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl pointer-events-none">
          <h3 className="text-yellow-400 text-sm font-bold mb-2 uppercase tracking-wider">Live Activity</h3>
          {logs.length === 0 ? <p className="text-slate-500 text-xs">Waiting for events...</p> : 
            logs.map((log, i) => <div key={i} className="py-1 text-xs text-slate-300 border-b border-slate-700/50 last:border-0">{log}</div>)
          }
        </div>

        {/* Modals */}
        {isSettingsOpen && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f172a] border border-slate-700 p-8 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl custom-scrollbar">
              <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-bold text-white">⚙️ Configuration</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white text-xl">✖</button>
              </div>
              
              <div className="space-y-8">
                {/* Global Settings */}
                <section>
                    <h3 className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-4">Global Preferences</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Walk Speed: {walkSpeed.toFixed(1)}</label>
                            <input type="range" min="0.5" max="10" step="0.5" value={walkSpeed} onChange={(e) => setWalkSpeed(parseFloat(e.target.value))} className="w-full cursor-pointer accent-yellow-400" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Max Tokens (Fallback)</label>
                            <div className="flex gap-2">
                                <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
                                <button onClick={saveMaxTokens} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-semibold transition-colors">Save</button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI Providers */}
                <section className="border-t border-slate-800 pt-6">
                    <h3 className="text-pink-400 text-sm font-bold uppercase tracking-wider mb-4">🔌 AI Providers Registry</h3>
                    <ul className="space-y-2 mb-4">
                        {providers.map(p => (
                            <li key={p.id} className="bg-slate-900/50 px-3 py-2 rounded-md border border-slate-800 text-sm flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${providerStatuses[p.id] === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                                    <span className="text-white font-medium">{p.name}</span>
                                </div>
                                <span className="text-slate-500 text-xs uppercase">{p.provider_type}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-3">
                        <input type="text" placeholder="Provider Alias (e.g. My LM Studio)" value={newProvName} onChange={e => setNewProvName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        <select value={newProvType} onChange={e => setNewProvType(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm appearance-none">
                            <option value="lm-studio">LM-Studio</option>
                            <option value="ollama">Ollama</option>
                            <option value="openclaw">OpenClaw Agent</option>
                            <option value="hermes">Hermes Agent</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-20">Base URL:</span>
                            <input type="text" placeholder="http://host.docker.internal:1234/v1" value={newProvUrl} onChange={e => setNewProvUrl(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-20">Token:</span>
                            <input type="password" placeholder="API Key / Gateway Token" value={newProvKey} onChange={e => setNewProvKey(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        </div>
                        <button onClick={handleCreateProvider} className="w-full bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-md font-semibold text-sm transition-colors mt-2">Add Provider</button>
                    </div>
                </section>

                {/* Create/Edit Agent */}
                <section className="border-t border-slate-800 pt-6">
                    <h3 className="text-green-400 text-sm font-bold uppercase tracking-wider mb-4">🤖 Employee Management</h3>
                    
                    {/* List of existing employees */}
                    {existingAgents.length > 0 && (
                        <div className="mb-4 space-y-2">
                            {existingAgents.map(ag => (
                                <div key={ag.id} className="bg-slate-900/50 px-3 py-2 rounded-md border border-slate-800 text-sm flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {ag.avatar && <img src={ag.avatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />}
                                        <span className="text-white font-medium">{ag.name}</span>
                                        <span className="text-xs text-slate-500">({ag.role})</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditAgent(ag)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                                        <button onClick={() => handleDeleteAgent(ag.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-3">
                        <div className="text-xs font-bold text-slate-400 mb-2">{editAgentId ? 'Update Employee' : 'Onboard New Employee'}</div>
                        <input type="text" placeholder="Name (e.g. Alice)" value={newAgentName} onChange={e => setNewAgentName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        <input type="text" placeholder="Role (e.g. DevOps Engineer)" value={newAgentRole} onChange={e => setNewAgentRole(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        <select value={selectedProvId} onChange={e => setSelectedProvId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm appearance-none">
                            <option value="">-- Use Default Provider --</option>
                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">Model:</span>
                            <input type="text" placeholder="google/gemma-4-e4b" value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">Spawn X:</span>
                            <input type="number" placeholder="245" value={newAgentX} onChange={e => setNewAgentX(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">Spawn Y:</span>
                            <input type="number" placeholder="177" value={newAgentY} onChange={e => setNewAgentY(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">Scale:</span>
                            <input type="number" step="0.1" placeholder="1.0" value={newAgentScale} onChange={e => setNewAgentScale(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm" />
                        </div>
                        <div className="text-xs text-slate-500 mb-2">
                          * Tip: ใช้พิกัดจากมุมขวาล่าง / Scale 1.0 = สูง 80px
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">Avatar:</span>
                            <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1 text-slate-400 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700" />
                        </div>
                        {editAgentId ? (
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleUpdateAgent} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-semibold text-sm transition-colors">Update & Restart</button>
                                <button onClick={() => { setEditAgentId(null); setNewAgentName(''); setNewAgentRole(''); setNewAgentX(''); setNewAgentY(''); setNewAgentScale('1.0'); setSelectedProvId(''); setSelectedModel(''); setAvatarFile(null); }} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md font-semibold text-sm transition-colors">Cancel</button>
                            </div>
                        ) : (
                            <button onClick={handleCreateAgent} className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-semibold text-sm transition-colors mt-2">Create & Restart Simulation</button>
                        )}
                    </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {isKanbanOpen && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f172a] border border-slate-700 p-8 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-purple-400">📋 Kanban Board</h2>
                <button onClick={() => setIsKanbanOpen(false)} className="text-slate-500 hover:text-white text-xl">✖</button>
              </div>
              
              <div className="flex gap-4 mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <input type="text" placeholder="Task Title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-64 bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-white text-sm" />
                <input type="text" placeholder="Description (Optional)" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-white text-sm" />
                <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="w-48 bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-white text-sm appearance-none">
                    <option value="">Auto Assign (Any)</option>
                    {existingAgents.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                </select>
                <button onClick={handleCreateTask} className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-md font-bold text-sm transition-colors">+ Add Task</button>
              </div>

              <div className="flex gap-6 flex-1 min-h-0 overflow-x-auto pb-2">
                {['Todo', 'In Progress', 'Done'].map(status => (
                  <div key={status} className="flex-1 bg-slate-900/30 border border-slate-800 rounded-xl p-4 flex flex-col min-w-[280px]">
                    <h3 className="font-bold text-slate-400 border-b border-slate-700 pb-3 mb-4">{status} <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full ml-2">{tasks.filter(t => t.status === status).length}</span></h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {tasks.filter(t => t.status === status).map(task => (
                            <div key={task.id} className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 p-4 rounded-lg shadow-sm transition-colors cursor-grab border-l-4 border-l-purple-500">
                                <div className="font-bold text-slate-100 text-sm mb-1">{task.title}</div>
                                <div className="text-xs text-slate-400 line-clamp-2">{task.description}</div>
                                {task.agent_id && (
                                    <div className="mt-3 text-[10px] font-bold text-purple-300 bg-purple-900/30 inline-block px-2 py-1 rounded">
                                        Assigned to: {existingAgents.find(a => a.id === task.agent_id)?.name || `Agent ID: ${task.agent_id}`}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
      {/* Interactive Chat Box Modal (Draggable) */}
      {isChatting && chatAgent && (
        <div style={{ position: 'absolute', left: chatPos.x, top: chatPos.y, width: '450px', zIndex: 60 }} className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                <div onMouseDown={handleMouseDownChat} className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700 cursor-move select-none">
                    <div className="flex items-center gap-3">
                        {chatAgent.avatar ? (
                            <img src={chatAgent.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-green-500" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">{chatAgent.name[0]}</div>
                        )}
                        <div>
                            <h3 className="text-white font-bold">{chatAgent.name}</h3>
                            <p className="text-xs text-green-400">{chatAgent.role}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsChatting(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-96 min-h-64 bg-slate-950">
                    {chatMessages.length === 0 ? (
                        <div className="text-center text-slate-500 mt-10">เริ่มพูดคุยเพื่อทักทาย {chatAgent.name}</div>
                    ) : (
                        chatMessages.map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.content.startsWith('User:') ? 'items-end' : 'items-start'}`}>
                                <div className={`px-4 py-2 rounded-lg max-w-[80%] text-sm ${msg.content.startsWith('User:') ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                                    {msg.content.replace('User: ', '').replace(`${chatAgent.name}: `, '')}
                                </div>
                                <span className="text-[10px] text-slate-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
                    <input 
                        type="text" 
                        value={chatInput} 
                        onChange={e => setChatInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                        placeholder={`Message ${chatAgent.name}...`} 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={handleSendChat} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold">Send</button>
                </div>
            </div>
      )}

      {/* Developer Tool: Coordinate Logger */}
      {lastClickedPos && (
        <div className="absolute bottom-4 right-4 bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs font-mono text-green-400 z-50 animate-pulse">
            🎯 พิกัดล่าสุด: X: {lastClickedPos.x}, Y: {lastClickedPos.y}
        </div>
      )}

    </div>
  );
}