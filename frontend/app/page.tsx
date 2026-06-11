'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import * as EasyStar from 'easystarjs';

export type NavGridConfig = {
  walls: { x1: number, y1: number, x2: number, y2: number }[];
  doors: { x1: number, y1: number, x2: number, y2: number }[];
  rooms: { name: string, minX: number, minY: number, maxX: number, maxY: number }[];
};

export default function Home() {
  const [status, setStatus] = useState('Disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMapConfigOpen, setIsMapConfigOpen] = useState(false);
  const [mapTimestamp, setMapTimestamp] = useState(Date.now());
  const [isKanbanOpen, setIsKanbanOpen] = useState(false);
  const [navConfig, setNavConfig] = useState<NavGridConfig | null>(null);
  const navConfigRef = useRef<NavGridConfig | null>(null);
  
  // Drawing State for Map Configurator
  const [drawMode, setDrawMode] = useState<'wall'|'door'|'room'|null>(null);
  const [dragStart, setDragStart] = useState<{x:number, y:number}|null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x:number, y:number}|null>(null);

  // Resize State
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(300);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        let newW = e.clientX;
        const maxW = window.innerWidth * 0.3;
        if (newW < 200) newW = 200;
        if (newW > maxW) newW = maxW;
        setLeftWidth(newW);
      } else if (isDraggingRight) {
        let newW = window.innerWidth - e.clientX;
        const maxW = window.innerWidth * 0.3;
        if (newW < 200) newW = 200;
        if (newW > maxW) newW = maxW;
        setRightWidth(newW);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };
    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

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
  const [agentStatuses, setAgentStatuses] = useState<Record<number, {status: string, desc: string}>>({});
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
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [editAgentId, setEditAgentId] = useState<number | null>(null);

  // Training Stats
  const [trainingStats, setTrainingStats] = useState<any>(null);

  // Workspace Files state
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [isWorkspaceExplorerOpen, setIsWorkspaceExplorerOpen] = useState(false);
  const [isRefreshingWorkspace, setIsRefreshingWorkspace] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [filePos, setFilePos] = useState({ x: 400, y: 100 });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragStartFile = useRef({ x: 0, y: 0 });
  const [isTyping, setIsTyping] = useState(false);
  const chatAgentRef = useRef<any>(null);

  useEffect(() => {
      const handleMouseMoveFile = (e: MouseEvent) => {
          if (isDraggingFile) {
              setFilePos({ x: e.clientX - dragStartFile.current.x, y: e.clientY - dragStartFile.current.y });
          }
      };
      const handleMouseUpFile = () => setIsDraggingFile(false);

      if (isDraggingFile) {
          window.addEventListener('mousemove', handleMouseMoveFile);
          window.addEventListener('mouseup', handleMouseUpFile);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMoveFile);
          window.removeEventListener('mouseup', handleMouseUpFile);
      }
  }, [isDraggingFile]);

  const handleMouseDownFile = (e: React.MouseEvent) => {
      setIsDraggingFile(true);
      dragStartFile.current = { x: e.clientX - filePos.x, y: e.clientY - filePos.y };
  };
  
  const showSpeechBubbleRef = useRef<((id: number, text: string, color?: string) => void) | null>(null);
  
  const [providerStatuses, setProviderStatuses] = useState<{ [key: number]: string }>({});
  const [chatAgent, setChatAgent] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (isChatting && messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatMessages, isChatting]);

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
      if (res.ok) setTasks(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkspaceFiles = async () => {
      setIsRefreshingWorkspace(true);
      try {
          const res = await fetch('http://127.0.0.1:8000/workspace/files');
          if (res.ok) setWorkspaceFiles(await res.json());
      } catch (e) {
          console.error("Workspace files fetch error", e);
      } finally {
          setIsRefreshingWorkspace(false);
      }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/agents');
      const data = await res.json();
      setExistingAgents(data);
      const initStats: Record<number, {status: string, desc: string}> = {};
      data.forEach((a: any) => initStats[a.id] = {status: a.status || 'Idle', desc: a.status === 'Idle' ? 'ว่างงาน' : 'กำลังปฏิบัติภารกิจ'});
      setAgentStatuses(initStats);
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

  const fetchTrainingStats = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/training/stats');
      const data = await res.json();
      setTrainingStats(data);
    } catch (err) { console.error('Training stats error:', err); }
  };

  const handleStartMassTraining = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/training/mass_start', { method: 'POST' });
      const data = await res.json();
      console.log('Mass training started:', data);
      alert(`Started mass training for ${data.agents_training} idle agents!`);
    } catch (err) {
      console.error('Mass training error:', err);
      alert('Failed to start mass training');
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchAgents();
    loadProviders();
    fetchWorkspaceFiles();
    fetchTrainingStats();
    const interval = setInterval(fetchTasks, 5000);
    const trainingInterval = setInterval(fetchTrainingStats, 15000);
    return () => { clearInterval(interval); clearInterval(trainingInterval); };
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

  const handleCancelTask = async (taskId: number) => {
    if (!confirm("คุณต้องการยกเลิกและลบงานนี้ใช่หรือไม่?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTasks();
      } else {
        alert("ไม่สามารถยกเลิกงานได้");
      }
    } catch (e) {
      console.error("ยกเลิก Task ล้มเหลว", e);
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

  const handleDeleteProvider = async (id: number) => {
      if (!confirm('Are you sure you want to delete this AI Provider?')) return;
      try {
          const res = await fetch(`http://127.0.0.1:8000/providers/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
              loadProviders();
          } else {
              alert(data.detail || data.message || "Cannot delete provider");
          }
      } catch (e) {
          console.error(e);
          alert("Error deleting provider");
      }
  };

  const handleOpenChat = async (agent: any) => {
      setChatAgent(agent);
      chatAgentRef.current = agent;
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
      setIsTyping(true);

      try {
          const res = await fetch(`http://127.0.0.1:8000/agents/${chatAgent.id}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: currentInput })
          });
          const data = await res.json();
          const aiMsg = { id: Date.now()+1, content: `${chatAgent.name}: ${data.reply}`, timestamp: new Date().toISOString() };
          setChatMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.content === aiMsg.content) return prev;
              return [...prev, aiMsg];
          });
          setIsTyping(false);
      } catch (err) {
          console.error(err);
      }
  };

  const targetPositions = useRef<Record<number, { x: number; y: number }>>({});
  const agentDesks = useRef<Record<number, { x: number; y: number }>>({});
  const bgTextureRef = useRef<{width: number, height: number} | null>(null);
  const agentSprites = useRef<{ [key: number]: PIXI.Graphics }>({});
  const easystarRef = useRef<any>(null);
  const agentPaths = useRef<Record<number, {x: number, y: number}[]>>({});

  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    
    // Clear old canvas if React strict mode double-invokes
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const app = new PIXI.Application();
    
    async function initPixi() {
      // 1. Init app FIRST
      await app.init({
        width: 1920,
        height: 1080,
        backgroundColor: 0x111827,
      });

      // Move navConfig loading OUTSIDE the texture loading try-catch
      // so the Map Configurator always works even if the map fails to load.
      let config = null;
      try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const res = await fetch(`${apiUrl}/settings`);
          const data = await res.json();
          if (data.navgrid_config) {
              config = JSON.parse(data.navgrid_config);
          }
      } catch (e) {
          console.error("Failed to load nav config", e);
      }

      if (!config) {
          config = {
              walls: [
                  { x1: 0, y1: 605, x2: 1920, y2: 605 },
                  { x1: 717, y1: 0, x2: 717, y2: 605 },
                  { x1: 1152, y1: 0, x2: 1152, y2: 1080 },
                  { x1: 0, y1: 864, x2: 1920, y2: 864 }
              ],
              doors: [
                  { x1: 560, y1: 605, x2: 717, y2: 605 },
                  { x1: 840, y1: 605, x2: 1000, y2: 605 },
                  { x1: 1152, y1: 645, x2: 1152, y2: 805 },
                  { x1: 600, y1: 864, x2: 720, y2: 864 },
                  { x1: 960, y1: 864, x2: 1040, y2: 864 },
                  { x1: 1200, y1: 864, x2: 1280, y2: 864 },
                  { x1: 1440, y1: 864, x2: 1520, y2: 864 }
              ],
              rooms: [
                  { name: "Meeting Room", minX: 800, minY: 380, maxX: 1100, maxY: 530 }
              ]
          };
      }
      navConfigRef.current = config;
      setNavConfig(config);

      let bgTexture: PIXI.Texture;
      try {
        bgTexture = await PIXI.Assets.load(`/office_map.png?t=${mapTimestamp}`);
        bgTextureRef.current = { width: bgTexture.width, height: bgTexture.height };
        
        easystarRef.current = new EasyStar.js();
        const gridSize = 40;
        const gridCols = Math.ceil(bgTexture.width / gridSize);
        const gridRows = Math.ceil(bgTexture.height / gridSize);
        const grid = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));
        
        // Helper to draw walls
        const addWall = (r1: number, c1: number, r2: number, c2: number) => {
            for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
                for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
                    if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
                        grid[r][c] = 1;
                    }
                }
            }
        };
        const addGap = (r1: number, c1: number, r2: number, c2: number) => {
            for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
                for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
                    if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
                        grid[r][c] = 0;
                    }
                }
            }
        };

        const addWallPixels = (x1: number, y1: number, x2: number, y2: number) => {
            const r1 = Math.floor(y1 / gridSize);
            const r2 = Math.floor(y2 / gridSize);
            const c1 = Math.floor(x1 / gridSize);
            const c2 = Math.floor(x2 / gridSize);
            for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
                for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
                    if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) grid[r][c] = 1;
                }
            }
        };

        const addGapPixels = (x1: number, y1: number, x2: number, y2: number) => {
            const r1 = Math.floor(y1 / gridSize);
            const r2 = Math.floor(y2 / gridSize);
            const c1 = Math.floor(x1 / gridSize);
            const c2 = Math.floor(x2 / gridSize);
            for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
                for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
                    if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) grid[r][c] = 0;
                }
            }
        };

        if (config.walls) config.walls.forEach((w: any) => addWallPixels(w.x1, w.y1, w.x2, w.y2));
        if (config.doors) config.doors.forEach((d: any) => addGapPixels(d.x1, d.y1, d.x2, d.y2));
        
        // Fallback: Make edges walkable just in case agents spawn slightly off-screen
        for(let r=0; r<gridRows; r++) { grid[r][0] = 0; grid[r][gridCols-1] = 0; }
        for(let c=0; c<gridCols; c++) { grid[0][c] = 0; grid[gridRows-1][c] = 0; }

        easystarRef.current.setGrid(grid);
        easystarRef.current.setAcceptableTiles([0]);
        easystarRef.current.enableDiagonals();
        easystarRef.current.enableCornerCutting();
        easystarRef.current.enableSync();
      } catch (err) {
        console.warn("Error initializing map or pathfinding:", err);
        const g = new PIXI.Graphics().rect(0,0,1920,1080).fill(0x222222);
        bgTexture = app.renderer.generateTexture(g);
        bgTextureRef.current = { width: 1920, height: 1080 };
      }
      
      // Update app size if texture is different from default 1920x1080
      if (bgTexture.width !== 1920 || bgTexture.height !== 1080) {
        app.renderer.resize(bgTexture.width, bgTexture.height);
      }
      
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      container.appendChild(app.canvas);

      const resizeCanvas = () => {
          const parent = container.parentElement;
          if (!parent) return;
          const parentWidth = parent.clientWidth;
          const parentHeight = parent.clientHeight;
          const mapRatio = bgTexture.width / bgTexture.height;
          const parentRatio = parentWidth / parentHeight;
          
          if (parentRatio > mapRatio) {
              container.style.width = `${parentHeight * mapRatio}px`;
              container.style.height = `${parentHeight}px`;
          } else {
              container.style.width = `${parentWidth}px`;
              container.style.height = `${parentWidth / mapRatio}px`;
          }
      };
      
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      const bgSprite = new PIXI.Sprite(bgTexture);
      app.stage.addChildAt(bgSprite, 0);

      // (Background and texture init moved up)

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

      showSpeechBubbleRef.current = (agentId: number, textStr: string, colorStr?: string) => {
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
          const displayStr = textStr.length > 80 ? textStr.substring(0, 80) + "..." : textStr;
          
          const text = new PIXI.Text({
              text: displayStr,
              style: { fontFamily: 'Arial', fontSize: 12, fill: 0x000000, align: 'center', wordWrap: true, wordWrapWidth: 150 }
          });
          
          let bgColor = 0xffffff;
          if (colorStr === "green") bgColor = 0xd4edda;
          else if (colorStr === "red") bgColor = 0xf8d7da;
          else if (colorStr === "yellow") bgColor = 0xfff3cd;

          const bg = new PIXI.Graphics();
          bg.roundRect(-10, -10, text.width + 20, text.height + 20, 10);
          bg.fill(bgColor);
          bg.stroke({ color: 0x000000, width: 1, alpha: 0.1 });
          
          const tail = new PIXI.Graphics();
          tail.poly([0, 0, 10, -10, 20, 0]);
          tail.fill(bgColor);
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
          }, 12000); // Extended to 12s
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
        // scale logic removed, using CSS wrapper now

        const currentWalkSpeed = walkSpeedRef.current;
        Object.keys(agentSprites.current).forEach((idStr) => {
          const id = parseInt(idStr);
          const sprite = agentSprites.current[id];
          if (!sprite) return;
          
          const path = agentPaths.current[id];
          if (path && path.length > 0) {
              const nextPt = path[0];
              const dx = nextPt.x - sprite.x;
              const dy = nextPt.y - sprite.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance > currentWalkSpeed) {
                  sprite.x += (dx / distance) * currentWalkSpeed;
                  sprite.y += (dy / distance) * currentWalkSpeed;
              } else {
                  sprite.x = nextPt.x;
                  sprite.y = nextPt.y;
                  path.shift();
                  if (path.length === 0) {
                      delete agentPaths.current[id];
                  }
              }
              return; // Skip normal target movement
          }

          const target = targetPositions.current[id];
          if (!target) return;

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
        const { agent_id, name, action, status } = data;
        let activityDesc = action;
        if (action === 'walking_to_desk') activityDesc = "กำลังเริ่มทำงานที่ได้รับมอบหมาย 💻";
        else if (action === 'return_to_idle') activityDesc = "ทำงานเสร็จสิ้น กลับมาพักผ่อนที่โต๊ะ ☕";
        else if (action === 'walking_to_meeting') activityDesc = "กำลังเดินไปเข้าห้องประชุม 🤝";
        else if (action === 'walking_to_training') activityDesc = "กำลังเดินไปห้องเทรนนิ่ง 📚";
        setLogs((prev) => [`[${name}] ${activityDesc}`, ...prev.slice(0, 200)]);
        
        let newStatus = status;
        if (action === 'return_to_idle') newStatus = 'Idle';
        else if (action === 'walking_to_desk' || action === 'walking_to_meeting' || action === 'walking_to_training') newStatus = 'Working';
        
        setAgentStatuses(prev => ({...prev, [agent_id]: {
            status: newStatus || prev[agent_id]?.status || 'Working',
            desc: activityDesc
        }}));

        const setTargetAndPathfind = (agent_id: number, targetX: number, targetY: number) => {
            if (easystarRef.current && bgTextureRef.current) {
                const gridSize = 40;
                const gridCols = Math.ceil(bgTextureRef.current.width / gridSize);
                const gridRows = Math.ceil(bgTextureRef.current.height / gridSize);
                
                const sprite = agentSprites.current[agent_id];
                if (!sprite) {
                    targetPositions.current[agent_id] = { x: targetX, y: targetY };
                    return;
                }
                
                const startCol = Math.min(gridCols-1, Math.max(0, Math.floor(sprite.x / gridSize)));
                const startRow = Math.min(gridRows-1, Math.max(0, Math.floor(sprite.y / gridSize)));
                const endCol = Math.min(gridCols-1, Math.max(0, Math.floor(targetX / gridSize)));
                const endRow = Math.min(gridRows-1, Math.max(0, Math.floor(targetY / gridSize)));
                
                easystarRef.current.findPath(startCol, startRow, endCol, endRow, (path: any) => {
                    if (path === null) {
                        targetPositions.current[agent_id] = { x: targetX, y: targetY };
                    } else {
                        agentPaths.current[agent_id] = path.map((p: any) => ({
                            x: p.x * gridSize + gridSize/2,
                            y: p.y * gridSize + gridSize/2
                        }));
                        agentPaths.current[agent_id].push({ x: targetX, y: targetY });
                    }
                });
                easystarRef.current.calculate();
            } else {
                targetPositions.current[agent_id] = { x: targetX, y: targetY };
            }
        };

        if (canvasContainerRef.current) {
            if (action === 'walking_to_desk') {
                const desk = agentDesks.current[agent_id];
                if (desk) setTargetAndPathfind(agent_id, desk.x, desk.y);
            } else if (action === 'return_to_idle') {
                const desk = agentDesks.current[agent_id];
                if (desk) setTargetAndPathfind(agent_id, desk.x, desk.y);
            } else if (action === 'walking_to_meeting') {
                let meetX = 800 + (Math.random() * 300);
                let meetY = 380 + (Math.random() * 150);
                if (navConfigRef.current && navConfigRef.current.rooms) {
                    const mr = navConfigRef.current.rooms.find((r:any) => r.name === "Meeting Room");
                    if (mr) {
                        meetX = mr.minX + Math.random() * (mr.maxX - mr.minX);
                        meetY = mr.minY + Math.random() * (mr.maxY - mr.minY);
                    }
                }
                setTargetAndPathfind(agent_id, meetX, meetY);
            } else if (action === 'walking_to_training') {
                let trainX = 1400 + (Math.random() * 200);
                let trainY = 600 + (Math.random() * 200);
                if (navConfigRef.current && navConfigRef.current.rooms) {
                    const mr = navConfigRef.current.rooms.find((r:any) => r.name === "Meeting Room");
                    if (mr) {
                        // Just scatter them around the meeting room or anywhere
                        trainX = mr.minX + Math.random() * (mr.maxX - mr.minX);
                        trainY = mr.minY + Math.random() * (mr.maxY - mr.minY);
                    }
                }
                setTargetAndPathfind(agent_id, trainX, trainY);
            }
        }
      } else if (data.event === 'agent_speech') {
        const { agent_id, message, name, color } = data;
        if (showSpeechBubbleRef.current) {
            showSpeechBubbleRef.current(agent_id, message, color);
        }
        
        // Add speech to Live Activity Log
        setLogs((prev) => [`[${name}] พูดว่า: "${message}"`, ...prev.slice(0, 200)]);

        if (chatAgentRef.current && chatAgentRef.current.id === agent_id) {
            setChatMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.content.includes(message)) return prev;
                return [...prev, { id: Date.now(), content: `${name || chatAgentRef.current.name}: ${message}`, timestamp: new Date().toISOString() }];
            });
            setIsTyping(false);
        }
      }
    };

    return () => socket.close();
  }, []);

  const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!drawMode) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = 1920 / rect.width;
      const scaleY = 1080 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      setDragStart({ x, y });
      setDragCurrent({ x, y });
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragStart) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = 1920 / rect.width;
      const scaleY = 1080 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      setDragCurrent({ x, y });
  };

  const handleMapMouseUp = () => {
      if (!dragStart || !dragCurrent || !navConfig) return;
      const minX = Math.round(Math.min(dragStart.x, dragCurrent.x));
      const minY = Math.round(Math.min(dragStart.y, dragCurrent.y));
      const maxX = Math.round(Math.max(dragStart.x, dragCurrent.x));
      const maxY = Math.round(Math.max(dragStart.y, dragCurrent.y));
      
      if (maxX - minX > 5 || maxY - minY > 5) {
          const newConfig = { ...navConfig };
          if (drawMode === 'wall') {
              newConfig.walls.push({ x1: minX, y1: minY, x2: maxX, y2: maxY });
          } else if (drawMode === 'door') {
              newConfig.doors.push({ x1: minX, y1: minY, x2: maxX, y2: maxY });
          } else if (drawMode === 'room') {
              newConfig.rooms.push({ name: `Room ${newConfig.rooms.length + 1}`, minX, minY, maxX, maxY });
          }
          setNavConfig(newConfig);
      }
      setDragStart(null);
      setDragCurrent(null);
  };

  return (
    <div className="relative h-screen w-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div style={{ width: isSidebarOpen ? `${leftWidth}px` : '0px', transition: isDraggingLeft ? 'none' : 'width 0.3s ease-in-out' }} className={`absolute top-0 bottom-0 left-0 bg-[#0b1120] flex flex-col border-r border-slate-800 z-20 shrink-0 shadow-xl overflow-hidden`}>
        {/* Toggle Button Inside Sidebar (when open) */}
        {isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-6 right-4 text-slate-400 hover:text-white z-20">
            ◀
          </button>
        )}
        
        <div style={{ width: `${leftWidth}px` }} className="flex-1 flex flex-col h-full">
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
                   <div className="text-sm font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors flex items-center justify-between">
                       <span>{a.name}</span>
                       {agentStatuses[a.id]?.status === 'Idle' ? (
                           <span className="flex items-center gap-1 text-[9px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded border border-green-400/20"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> ว่าง</span>
                       ) : agentStatuses[a.id]?.status === 'Training' ? (
                           <span className="flex items-center gap-1 text-[9px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span> Training</span>
                       ) : (
                           <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Working</span>
                       )}
                   </div>
                   <div className="text-xs text-slate-500 truncate">{a.role}</div>
                   {agentStatuses[a.id]?.status !== 'Idle' && (
                       <div className="text-[9px] text-slate-400 truncate mt-0.5">{agentStatuses[a.id]?.desc}</div>
                   )}
                 </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-bold text-slate-500 mb-4 mt-8 flex justify-between items-center uppercase tracking-widest">
            <span>Workspace</span>
            <button onClick={fetchWorkspaceFiles} className={`hover:text-white ${isRefreshingWorkspace ? 'animate-spin text-blue-400' : ''}`} title="Refresh">🔄</button>
          </div>
          <div className="flex flex-col gap-1 max-h-[30vh] overflow-y-auto custom-scrollbar">
             {workspaceFiles.length === 0 ? (
                 <div className="text-xs text-slate-600 italic px-3 py-2">No files yet.</div>
             ) : (
                 workspaceFiles.map(file => (
                   <div 
                     key={file} 
                     onClick={async () => {
                         try {
                             const res = await fetch(`http://127.0.0.1:8000/workspace/files/${encodeURIComponent(file)}`);
                             if (res.ok) {
                                 const data = await res.json();
                                 setPreviewFile(file);
                                 setPreviewContent(data.content);
                                 setIsPreviewOpen(true);
                             }
                         } catch (e) {
                             console.error("Error loading file", e);
                         }
                     }}
                     className="text-sm text-slate-400 hover:bg-slate-800/50 hover:text-white px-3 py-2 rounded-md cursor-pointer transition-all flex items-center gap-2 truncate"
                   >
                     📄 {file}
                   </div>
                 ))
             )}
          </div>
          {workspaceFiles.length > 0 && (
             <button onClick={() => setIsWorkspaceExplorerOpen(true)} className="text-xs text-blue-400 hover:text-blue-300 mt-3 flex items-center gap-2 w-full justify-center border border-blue-500/20 py-2 rounded-md transition-colors hover:bg-blue-500/10">
                 <span className="text-lg">🗂️</span> Open Explorer
             </button>
          )}

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
      <div className="absolute inset-0 flex flex-col h-full bg-[#05080f] overflow-hidden z-0">
        {/* Toggle Button Outside Sidebar (when closed) */}
        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-50 bg-[#0b1120] border border-slate-700 text-white p-2 rounded-md hover:bg-slate-800 shadow-lg">
            ☰
          </button>
        )}
        {/* Toggle Button Outside Right Panel (when closed) */}
        {!isRightPanelOpen && (
          <button onClick={() => setIsRightPanelOpen(true)} className="absolute top-4 right-4 z-50 bg-[#0b1120] border border-slate-700 text-white p-2 rounded-md hover:bg-slate-800 shadow-lg">
            ☰
          </button>
        )}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div ref={canvasContainerRef} className="pointer-events-auto" />
        </div>

        {/* Modals */}
        {isWorkspaceExplorerOpen && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f172a] border border-slate-700 p-8 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  🗂️ Workspace Explorer
                  <span className="text-sm font-normal text-slate-400 bg-slate-800 px-3 py-1 rounded-full">{workspaceFiles.length} files</span>
                </h2>
                <div className="flex items-center gap-4">
                  <button onClick={fetchWorkspaceFiles} className={`text-xl hover:text-white ${isRefreshingWorkspace ? 'animate-spin text-blue-400' : 'text-slate-400'}`} title="Refresh">🔄</button>
                  <button onClick={() => setIsWorkspaceExplorerOpen(false)} className="text-slate-500 hover:text-white text-2xl font-bold">✖</button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 content-start">
                {workspaceFiles.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-slate-500 italic">No files in workspace.</div>
                ) : (
                    workspaceFiles.map(file => (
                      <div 
                        key={file} 
                        onClick={async () => {
                            setIsWorkspaceExplorerOpen(false);
                            try {
                                const res = await fetch(`http://127.0.0.1:8000/workspace/files/${encodeURIComponent(file)}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    setPreviewFile(file);
                                    setPreviewContent(data.content);
                                    setIsPreviewOpen(true);
                                }
                            } catch (e) {
                                console.error("Error loading file", e);
                            }
                        }}
                        className="bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700 hover:border-blue-500/50 p-4 rounded-xl cursor-pointer transition-all group flex flex-col items-center gap-3"
                      >
                        <span className="text-4xl group-hover:scale-110 transition-transform">📄</span>
                        <span className="text-sm text-slate-300 text-center w-full truncate" title={file}>{file}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

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
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">NavMesh Grid (A* Pathfinding)</label>
                            <button onClick={() => { setIsSettingsOpen(false); setIsMapConfigOpen(true); }} className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md font-semibold transition-colors flex items-center justify-center gap-2">
                                🗺️ Open Map Configurator
                            </button>
                        </div>
                    </div>
                </section>

                {/* AI Providers */}
                <section className="border-t border-slate-800 pt-6">
                    <h3 className="text-pink-400 text-sm font-bold uppercase tracking-wider mb-4">🔌 AI Providers Registry</h3>
                    <ul className="space-y-2 mb-4">
                        {providers.map(p => (
                            <li key={p.id} className="bg-slate-900/50 px-3 py-2 rounded-md border border-slate-800 text-sm flex justify-between items-center group">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${providerStatuses[p.id] === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                                    <span className="text-white font-medium">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-500 text-xs uppercase hidden sm:block">{p.provider_type}</span>
                                    <button onClick={() => {
                                        setNewProvName(p.name);
                                        setNewProvType(p.provider_type);
                                        alert("Please update details and re-enter Token, then click Add Provider. You can delete the old one afterwards.");
                                    }} className="text-blue-400 hover:text-blue-300 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                                    <button onClick={() => handleDeleteProvider(p.id)} className="text-red-400 hover:text-red-300 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                                </div>
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
                            <div key={task.id} className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 p-4 rounded-lg shadow-sm transition-colors cursor-grab border-l-4 border-l-purple-500 relative pr-8">
                                <button onClick={() => handleCancelTask(task.id)} className="text-slate-500 hover:text-red-400 text-xs font-bold p-1 hover:bg-red-500/10 rounded transition-colors absolute top-2 right-2" title="ยกเลิกงาน">
                                    ✖
                                </button>
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

        {isPreviewOpen && (
            <div style={{ position: 'absolute', left: filePos.x, top: filePos.y, width: '600px', height: '500px', zIndex: 70, resize: 'both', minWidth: '300px', minHeight: '300px' }} className="bg-[#0f172a] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                <div onMouseDown={handleMouseDownFile} className="flex justify-between items-center bg-slate-800 px-4 py-3 border-b border-slate-700 cursor-move select-none">
                    <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">📄 {previewFile}</h2>
                    <button onClick={() => setIsPreviewOpen(false)} className="text-slate-500 hover:text-white text-xl">✖</button>
                </div>
                <div className="flex-1 overflow-auto bg-[#0a0f18] p-4 custom-scrollbar">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{previewContent}</pre>
                </div>
            </div>
        )}

        {isMapConfigOpen && navConfig && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-[95vw] h-[95vh] shadow-2xl flex flex-col overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-[#0a0f18]">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    🗺️ Interactive NavMesh Configurator
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded ml-2 font-normal">Native Size: 1920x1080</span>
                </h2>
                <div className="flex gap-4 items-center">
                  <label className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md font-semibold cursor-pointer transition-colors text-sm flex items-center gap-2">
                    <input type="file" accept="image/png" className="hidden" onChange={async (e) => {
                        if (!e.target.files || e.target.files.length === 0) return;
                        const formData = new FormData();
                        formData.append('file', e.target.files[0]);
                        try {
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                            const res = await fetch(`${apiUrl}/api/map/upload`, {
                                method: 'POST',
                                body: formData
                            });
                            if (res.ok) {
                                setMapTimestamp(Date.now());
                                alert('Map uploaded successfully! Note: You may need to completely refresh the browser page (F5) to apply it to the main game view.');
                            } else {
                                alert("Failed to upload map");
                            }
                        } catch (err) {
                            alert("Error uploading map");
                        }
                    }} />
                    📤 Upload Map (.png)
                  </label>
                  <button onClick={async () => {
                      await fetch('http://127.0.0.1:8000/settings/navgrid_config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ value: JSON.stringify(navConfig) })
                      });
                      alert('Saved successfully! Refresh page to apply.');
                      setIsMapConfigOpen(false);
                  }} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-semibold transition-colors text-sm">💾 Save Config</button>
                  <button onClick={() => setIsMapConfigOpen(false)} className="text-slate-500 hover:text-white text-xl">✖</button>
                </div>
              </div>
              
              <div className="flex flex-1 min-h-0">
                  {/* Left: Interactive Canvas */}
                  <div className="flex-1 bg-black relative flex items-center justify-center p-4">
                      <div className="relative border-2 border-slate-800 shadow-2xl" style={{ aspectRatio: '1920/1080', width: '100%', height: 'auto', maxHeight: '100%', maxWidth: '100%' }}>
                          <img src={`/office_map.png?t=${mapTimestamp}`} alt="Office Map" className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-80" />
                          
                          {/* Event Overlay */}
                          <div 
                              className={`absolute inset-0 z-10 ${drawMode ? 'cursor-crosshair' : 'cursor-default'}`}
                              onMouseDown={handleMapMouseDown}
                              onMouseMove={handleMapMouseMove}
                              onMouseUp={handleMapMouseUp}
                              onMouseLeave={handleMapMouseUp}
                          >
                              {/* Render Walls */}
                              {navConfig.walls.map((w,i) => (
                                  <div key={`w-${i}`} className="absolute bg-red-500/40 border border-red-500 pointer-events-none" 
                                    style={{
                                        left: `${(Math.min(w.x1, w.x2) / 1920) * 100}%`, top: `${(Math.min(w.y1, w.y2) / 1080) * 100}%`,
                                        width: `${(Math.max(2, Math.abs(w.x2 - w.x1)) / 1920) * 100}%`, height: `${(Math.max(2, Math.abs(w.y2 - w.y1)) / 1080) * 100}%`
                                    }}
                                  />
                              ))}
                              {/* Render Doors */}
                              {navConfig.doors.map((d,i) => (
                                  <div key={`d-${i}`} className="absolute bg-green-500/40 border border-green-500 pointer-events-none" 
                                    style={{
                                        left: `${(Math.min(d.x1, d.x2) / 1920) * 100}%`, top: `${(Math.min(d.y1, d.y2) / 1080) * 100}%`,
                                        width: `${(Math.max(2, Math.abs(d.x2 - d.x1)) / 1920) * 100}%`, height: `${(Math.max(2, Math.abs(d.y2 - d.y1)) / 1080) * 100}%`
                                    }}
                                  />
                              ))}
                              {/* Render Rooms */}
                              {navConfig.rooms.map((r,i) => (
                                  <div key={`r-${i}`} className="absolute bg-yellow-500/20 border-2 border-dashed border-yellow-500 pointer-events-none flex items-center justify-center" 
                                    style={{
                                        left: `${(Math.min(r.minX, r.maxX) / 1920) * 100}%`, top: `${(Math.min(r.minY, r.maxY) / 1080) * 100}%`,
                                        width: `${(Math.max(2, Math.abs(r.maxX - r.minX)) / 1920) * 100}%`, height: `${(Math.max(2, Math.abs(r.maxY - r.minY)) / 1080) * 100}%`
                                    }}
                                  >
                                      <span className="bg-slate-900/80 text-yellow-400 text-xs px-2 py-1 rounded">{r.name}</span>
                                  </div>
                              ))}
                              
                              {/* Live Drawing Preview */}
                              {dragStart && dragCurrent && drawMode && (
                                  <div className={`absolute border-2 pointer-events-none ${drawMode === 'wall' ? 'bg-red-500/50 border-red-400' : drawMode === 'door' ? 'bg-green-500/50 border-green-400' : 'bg-yellow-500/30 border-dashed border-yellow-400'}`}
                                    style={{
                                        left: `${(Math.min(dragStart.x, dragCurrent.x) / 1920) * 100}%`,
                                        top: `${(Math.min(dragStart.y, dragCurrent.y) / 1080) * 100}%`,
                                        width: `${(Math.max(2, Math.abs(dragCurrent.x - dragStart.x)) / 1920) * 100}%`,
                                        height: `${(Math.max(2, Math.abs(dragCurrent.y - dragStart.y)) / 1080) * 100}%`
                                    }}
                                  />
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Right: Data Panel */}
                  <div className="w-[350px] bg-[#0a0f18] border-l border-slate-800 flex flex-col p-4 overflow-y-auto custom-scrollbar">
                      <div className="mb-6">
                          <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Draw Mode</h3>
                          <div className="flex gap-2">
                              <button onClick={() => setDrawMode(drawMode === 'wall' ? null : 'wall')} className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${drawMode === 'wall' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🧱 Wall</button>
                              <button onClick={() => setDrawMode(drawMode === 'door' ? null : 'door')} className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${drawMode === 'door' ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🚪 Door</button>
                              <button onClick={() => setDrawMode(drawMode === 'room' ? null : 'room')} className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${drawMode === 'room' ? 'bg-yellow-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>🏢 Room</button>
                          </div>
                          {drawMode && <p className="text-[10px] text-blue-400 mt-2 text-center animate-pulse">Select mode active. Click and drag on map!</p>}
                      </div>

                      {/* Walls List */}
                      <div className="mb-6">
                          <h3 className="text-red-400 font-bold text-sm mb-2 border-b border-slate-800 pb-1">🧱 Walls ({navConfig.walls.length})</h3>
                          <div className="space-y-1">
                              {navConfig.walls.map((w, i) => (
                                  <div key={i} className="flex justify-between items-center bg-slate-900 p-1.5 rounded text-xs">
                                      <span className="text-slate-400">[{w.x1},{w.y1}] to [{w.x2},{w.y2}]</span>
                                      <button onClick={() => { const n = navConfig.walls.filter((_, idx) => idx !== i); setNavConfig({...navConfig, walls: n}); }} className="text-red-500 hover:text-red-400">✖</button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Doors List */}
                      <div className="mb-6">
                          <h3 className="text-green-400 font-bold text-sm mb-2 border-b border-slate-800 pb-1">🚪 Doors ({navConfig.doors.length})</h3>
                          <div className="space-y-1">
                              {navConfig.doors.map((d, i) => (
                                  <div key={i} className="flex justify-between items-center bg-slate-900 p-1.5 rounded text-xs">
                                      <span className="text-slate-400">[{d.x1},{d.y1}] to [{d.x2},{d.y2}]</span>
                                      <button onClick={() => { const n = navConfig.doors.filter((_, idx) => idx !== i); setNavConfig({...navConfig, doors: n}); }} className="text-red-500 hover:text-red-400">✖</button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Rooms List */}
                      <div>
                          <h3 className="text-yellow-400 font-bold text-sm mb-2 border-b border-slate-800 pb-1">🏢 Rooms ({navConfig.rooms.length})</h3>
                          <div className="space-y-2">
                              {navConfig.rooms.map((r, i) => (
                                  <div key={i} className="bg-slate-900 p-2 rounded text-xs">
                                      <div className="flex justify-between mb-1">
                                          <input type="text" value={r.name} onChange={e => { const n = [...navConfig.rooms]; n[i].name = e.target.value; setNavConfig({...navConfig, rooms: n}); }} className="bg-slate-950 border border-slate-700 text-white p-1 rounded w-24" />
                                          <button onClick={() => { const n = navConfig.rooms.filter((_, idx) => idx !== i); setNavConfig({...navConfig, rooms: n}); }} className="text-red-500 hover:text-red-400">✖</button>
                                      </div>
                                      <div className="text-slate-500 text-[10px]">Min: {r.minX},{r.minY} Max: {r.maxX},{r.maxY}</div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Left Resizer */}
      {isSidebarOpen && (
        <div 
          onMouseDown={() => setIsDraggingLeft(true)} 
          style={{ left: `${leftWidth - 2}px` }} 
          className="absolute top-0 bottom-0 w-4 cursor-col-resize z-30 hover:bg-blue-500/20 active:bg-blue-500/50" 
        />
      )}

      {/* Right Panel for Live Activity */}
      <div style={{ width: isRightPanelOpen ? `${rightWidth}px` : '0px', transition: isDraggingRight ? 'none' : 'width 0.3s ease-in-out' }} className={`absolute top-0 bottom-0 right-0 shrink-0 bg-[#0b1120] border-l border-slate-800 flex flex-col shadow-xl z-20 overflow-hidden`}>
        {/* Toggle Button Inside Right Panel (when open) */}
        {isRightPanelOpen && (
          <button onClick={() => setIsRightPanelOpen(false)} className="absolute top-6 left-4 text-slate-400 hover:text-white z-20">
            ▶
          </button>
        )}
        <div style={{ width: `${rightWidth}px` }} className="flex-1 flex flex-col h-full">
            <div className="p-4 border-b border-slate-800/50 flex items-center gap-3 pl-12">
              <h3 className="text-yellow-400 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                </span>
                Live Activity
              </h3>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? <p className="text-slate-500 text-xs italic">Waiting for events...</p> : 
                logs.map((log, i) => <div key={i} className="py-2 text-xs text-slate-300 border-b border-slate-800 last:border-0 leading-relaxed">{log}</div>)
              }
            </div>
            
            {/* Training Stats Dashboard */}
            <div className="p-4 border-t border-slate-800/50">
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/80 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>🧠</span> AI Training Progress
                </h4>
                {trainingStats ? (
                  <>
                    {/* Total Progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Total Dataset</span>
                        <span className="text-white font-mono font-bold">{trainingStats.total.toLocaleString()} <span className="text-slate-500">/ {trainingStats.target.toLocaleString()}</span></span>
                      </div>
                      <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ 
                            width: `${trainingStats.progress_pct}%`,
                            background: trainingStats.progress_pct < 30 
                              ? 'linear-gradient(90deg, #ef4444, #f97316)' 
                              : trainingStats.progress_pct < 70 
                                ? 'linear-gradient(90deg, #f59e0b, #eab308)' 
                                : 'linear-gradient(90deg, #22c55e, #10b981)'
                          }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-slate-500 mt-1">{trainingStats.progress_pct}% Complete</div>
                    </div>
                    {/* Per-Category Bars */}
                    <div className="space-y-2">
                      {trainingStats.categories && Object.entries(trainingStats.categories).map(([key, cat]: [string, any]) => (
                        <div key={key}>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-slate-400">{cat.label}</span>
                            <span className="text-slate-300 font-mono">{cat.count.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-purple-500/80 transition-all duration-700"
                              style={{ width: `${Math.min((cat.count / (trainingStats.target / 5)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Training Agents Count */}
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">🎯 Target: Gemma Fine-tune</span>
                      <div className="flex gap-2">
                        <button onClick={handleStartMassTraining} className="bg-purple-600/80 hover:bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded transition-colors shadow-sm border border-purple-500/50">
                          🚀 Start Mass Train
                        </button>
                        <button onClick={fetchTrainingStats} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">↻ Refresh</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-500 text-xs py-4">
                    <div className="animate-spin inline-block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full mb-2"></div>
                    <div>Loading stats...</div>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Right Resizer */}
      {isRightPanelOpen && (
        <div 
          onMouseDown={() => setIsDraggingRight(true)} 
          style={{ right: `${rightWidth - 2}px` }} 
          className="absolute top-0 bottom-0 w-4 cursor-col-resize z-30 hover:bg-blue-500/20 active:bg-blue-500/50" 
        />
      )}

      {/* Interactive Chat Box Modal (Draggable) */}
      {isChatting && chatAgent && (
        <div style={{ position: 'absolute', left: chatPos.x, top: chatPos.y, width: '450px', height: '500px', zIndex: 60, resize: 'both', minWidth: '300px', minHeight: '400px' }} className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
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
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950">
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
                        {isTyping && (
                            <div className="mb-3 p-3 rounded-lg max-w-[85%] bg-slate-700 border border-slate-600 text-slate-400 mr-auto flex items-center gap-2">
                                <div className="text-sm italic">กำลังประมวลผล</div>
                                <div className="flex gap-1 mt-1">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></div>
                                </div>
                            </div>
                        )}
                    <div ref={messagesEndRef} />
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