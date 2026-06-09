from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware # 👈 1. ดึงเครื่องมือเปิดประตู CORS มาร่วมงาน
from sqlalchemy.orm import Session
from database import get_db, engine, SessionLocal
import models
from providers import ProviderFactory
import json
import redis
import asyncio
from contextlib import asynccontextmanager
import tools
import os

def get_agent_provider(agent, db: Session):
    if agent.provider_id:
        provider = db.query(models.ProviderModel).filter(models.ProviderModel.id == agent.provider_id).first()
        if provider:
            return ProviderFactory.create_provider(
                provider_type=provider.provider_type,
                base_url=provider.base_url,
                api_key=provider.api_key
            )
    # Default fallback
    ai_provider_url = os.getenv("AI_PROVIDER_URL", "http://host.docker.internal:1234/v1")
    return ProviderFactory.create_provider("openai_compatible", base_url=ai_provider_url, api_key="lm-studio")

async def autonomous_agent_loop():
    while True:
        await asyncio.sleep(30)
        db = SessionLocal()
        try:
            # 1. Query all Todo tasks in order
            tasks = db.query(models.TaskModel).filter(models.TaskModel.status == "Todo").order_by(models.TaskModel.id.asc()).all()
            if not tasks:
                continue

            assigned = False
            for t in tasks:
                if t.agent_id:
                    # Task assigned to specific agent
                    agent = db.query(models.AgentModel).filter(models.AgentModel.id == t.agent_id, models.AgentModel.status == "Idle").first()
                else:
                    # Pick first idle agent
                    agent = db.query(models.AgentModel).filter(models.AgentModel.status == "Idle").first()
                
                if agent:
                    task = t
                    assigned = True
                    break
            
            if not assigned:
                continue

            # Update status
            agent.status = "Working"
            task.status = "In Progress"
            task.agent_id = agent.id
            db.commit()

            # Broadcast walking
            event_start = {"event": "agent_state_changed", "agent_id": agent.id, "name": agent.name, "status": "Working", "action": "walking_to_desk"}
            await manager.broadcast(event_start)

            # Fetch global memories
            all_agents = {a.id: a.name for a in db.query(models.AgentModel).all()}
            memories = db.query(models.MemoryModel).order_by(models.MemoryModel.timestamp.desc()).limit(10).all()
            memories.reverse() # Chronological
            memory_text = "\n".join([f"- [{all_agents.get(m.agent_id, 'Unknown')}]: {m.content}" for m in memories])
            memory_section = f"\n\nGlobal Office Context / Memory:\n{memory_text}" if memories else ""

            # Let AI think
            system_prompt = f"You are {agent.name}, role: {agent.role}. Personality: {agent.personality}. You are currently working autonomously." + memory_section
            system_prompt += "\n\n" + tools.TOOL_INSTRUCTIONS
            
            setting = db.query(models.SettingModel).filter(models.SettingModel.key == "max_tokens").first()
            max_tokens = int(setting.value) if setting else 1024
            
            prompt = f"You are tasked with: {task.title}. Description: {task.description}. How do you want to proceed?"
            
            agent_provider = get_agent_provider(agent, db)
            model_name = agent.model_name or "llama3"

            # ReAct Loop
            max_iterations = 3
            final_response = ""
            for i in range(max_iterations):
                ai_response = await agent_provider.chat(model=model_name, system_prompt=system_prompt, user_prompt=prompt, max_tokens=max_tokens)
                print(f"Autonomous [{agent.name}] (Step {i+1}): {ai_response}")
                
                await manager.broadcast({
                    "event": "agent_speech",
                    "agent_id": agent.id,
                    "name": agent.name,
                    "message": ai_response
                })
                
                tool_call = tools.parse_tool_call(ai_response)
                if tool_call and "name" in tool_call and "arguments" in tool_call:
                    tool_result = tools.execute_tool(tool_call["name"], tool_call["arguments"])
                    print(f"Tool Executed [{tool_call['name']}]: {tool_result}")
                    prompt = f"Tool result for {tool_call['name']}: {tool_result}\nWhat do you want to do next? Remember to output [DONE] if the task is finished."
                else:
                    final_response = ai_response
                    break
            
            # Save memory
            new_memory = models.MemoryModel(agent_id=agent.id, content=f"Task: {task.title} -> Result: {final_response}")
            db.add(new_memory)

            # Return to idle and complete task conditionally
            agent.status = "Idle"
            if "[DONE]" in final_response:
                task.status = "Done"
            else:
                task.status = "Todo"
                task.agent_id = None
            db.commit()

            event_end = {"event": "agent_state_changed", "agent_id": agent.id, "name": agent.name, "status": "Idle", "action": "return_to_idle"}
            await manager.broadcast(event_end)
            
        except Exception as e:
            print(f"Autonomous Loop Error: {e}")
        finally:
            db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(autonomous_agent_loop())
    yield
    task.cancel()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Company OS", lifespan=lifespan)

# Mount avatars directory for static file serving
avatar_dir = os.path.join(os.path.dirname(__file__), "avatars")
os.makedirs(avatar_dir, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=avatar_dir), name="avatars")

# 🔓 2. สั่งปลดล็อกประตูให้หน้าบ้าน (พอร์ต 3000) คุยกับหลังบ้านได้แบบไร้รอยต่อ
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # อนุญาตให้ทุกที่เข้าถึงได้ในช่วงพัฒนาโปรเจกต์
    allow_credentials=True,
    allow_methods=["*"], # อนุญาตให้ใช้ POST, GET, PUT, DELETE ได้ทุกแบบ
    allow_headers=["*"], # อนุญาต Custom Headers ทุกประเภท
)

import os
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_client = redis.Redis(host=redis_host, port=6379, decode_responses=True)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_text(json.dumps(message))

manager = ConnectionManager()

@app.get("/")
def read_root():
    return {"status": "online", "message": "WebSocket & Redis Core ready."}

class SettingUpdate(BaseModel):
    value: str

@app.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(models.SettingModel).all()
    return {s.key: s.value for s in settings}

@app.post("/settings/{key}")
def update_setting(key: str, payload: SettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(models.SettingModel).filter(models.SettingModel.key == key).first()
    if setting:
        setting.value = payload.value
    else:
        setting = models.SettingModel(key=key, value=payload.value)
        db.add(setting)
    db.commit()
    return {"status": "success", "key": key, "value": payload.value}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps({"event": "connected", "message": "Welcome to AI OS Real-time Stream"}))
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/agents/{agent_id}/think")
async def agent_think(agent_id: int, prompt: str, model_name: str = "llama3", db: Session = Depends(get_db)):
    agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="ไม่พบ Agent")

    event_start = {"event": "agent_state_changed", "agent_id": agent.id, "name": agent.name, "status": "Working", "action": "walking_to_desk"}
    await manager.broadcast(event_start)
    
    agent.status = "Working"
    db.commit()

    # Fetch global memories
    all_agents = {a.id: a.name for a in db.query(models.AgentModel).all()}
    memories = db.query(models.MemoryModel).order_by(models.MemoryModel.timestamp.desc()).limit(10).all()
    memories.reverse()
    memory_text = "\n".join([f"- [{all_agents.get(m.agent_id, 'Unknown')}]: {m.content}" for m in memories])
    memory_section = f"\n\nGlobal Office Context / Memory:\n{memory_text}" if memories else ""

    system_prompt = f"You are {agent.name}, role: {agent.role}. Personality: {agent.personality}." + memory_section
    
    setting = db.query(models.SettingModel).filter(models.SettingModel.key == "max_tokens").first()
    max_tokens = int(setting.value) if setting else 1024
    
    agent_provider = get_agent_provider(agent, db)
    target_model = agent.model_name or model_name

    ai_response = await agent_provider.chat(model=target_model, system_prompt=system_prompt, user_prompt=prompt, max_tokens=max_tokens)

    await manager.broadcast({
        "event": "agent_speech",
        "agent_id": agent.id,
        "name": agent.name,
        "message": ai_response
    })

    # Save memory
    new_memory = models.MemoryModel(agent_id=agent.id, content=f"User prompted: {prompt} -> Result: {ai_response}")
    db.add(new_memory)

    event_end = {"event": "agent_state_changed", "agent_id": agent.id, "name": agent.name, "status": "Idle", "action": "return_to_idle"}
    await manager.broadcast(event_end)

    agent.status = "Idle"
    db.commit()

    return {
        "agent": {"id": agent.id, "name": agent.name},
        "agent_thought_response": ai_response
    }

@app.post("/agents/upload_avatar")
async def upload_avatar(file: UploadFile = File(...)):
    import shutil
    import uuid
    # Ensure directory exists in backend
    avatar_dir = os.path.join(os.path.dirname(__file__), "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(avatar_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"avatar_url": f"http://127.0.0.1:8000/avatars/{filename}"}

from sprites import generate_agent_svg

@app.get("/agents/{agent_id}/sprite.svg")
def get_agent_sprite(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="ไม่พบ Agent")
        
    svg_content = generate_agent_svg(agent)
    return Response(content=svg_content, media_type="image/svg+xml")

@app.get("/sprite_preview")
def get_sprite_preview(body_type: str = "male", body_size: str = "normal", skin_tone: str = "#fcd5ce", hair_style: str = "short", hair_color: str = "#333333", eye_color: str = "#000000", facial_hair: str = "none", glasses: str = "none", hat: str = "none", costume: str = "casual", held_item: str = "none", emoji: str = "😐", badge_color: str = "#4ade80"):
    class DummyAgent:
        pass
    dummy = DummyAgent()
    dummy.body_type = body_type
    dummy.body_size = body_size
    dummy.skin_tone = skin_tone
    dummy.hair_style = hair_style
    dummy.hair_color = hair_color
    dummy.eye_color = eye_color
    dummy.facial_hair = facial_hair
    dummy.glasses = glasses
    dummy.hat = hat
    dummy.costume = costume
    dummy.held_item = held_item
    dummy.emoji = emoji
    dummy.badge_color = badge_color
    
    svg_content = generate_agent_svg(dummy)
    return Response(content=svg_content, media_type="image/svg+xml")

@app.post("/agents")
def create_agent(name: str, role: str, personality: str = None, provider_id: int = None, model_name: str = None, avatar: str = None, x: float = 0.0, y: float = 0.0, sprite_scale: float = 1.0, db: Session = Depends(get_db)):
    new_agent = models.AgentModel(name=name, role=role, personality=personality, provider_id=provider_id, model_name=model_name, avatar=avatar, x=x, y=y, sprite_scale=sprite_scale)
    db.add(new_agent)
    db.commit()
    db.refresh(new_agent)
    return {"agent": new_agent}

@app.get("/agents")
def get_all_agents(db: Session = Depends(get_db)):
    agents = db.query(models.AgentModel).all()
    result = []
    for a in agents:
        a_dict = {
            "id": a.id, "name": a.name, "role": a.role, "status": a.status,
            "x": a.x, "y": a.y, "provider_id": a.provider_id, "model_name": a.model_name,
            "avatar": a.avatar, "sprite_scale": a.sprite_scale
        }
        result.append(a_dict)
    return result

class AgentUpdate(BaseModel):
    name: str
    role: str
    provider_id: int = None
    model_name: str = None
    avatar: str = None
    x: float = 0.0
    y: float = 0.0
    sprite_scale: float = 1.0

@app.put("/agents/{agent_id}")
def update_agent(agent_id: int, payload: AgentUpdate, db: Session = Depends(get_db)):
    agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    if payload.name: agent.name = payload.name
    if payload.role: agent.role = payload.role
    if payload.provider_id is not None: agent.provider_id = payload.provider_id
    if payload.model_name is not None: agent.model_name = payload.model_name
    if payload.avatar is not None: agent.avatar = payload.avatar
    agent.x = payload.x
    agent.y = payload.y
    agent.sprite_scale = payload.sprite_scale
        
    db.commit()
    return {"status": "success", "agent": agent.id}

@app.delete("/agents/{agent_id}")
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Also delete associated memories
    db.query(models.MemoryModel).filter(models.MemoryModel.agent_id == agent_id).delete()
    db.delete(agent)
    db.commit()
    return {"status": "deleted"}

class ProviderCreate(BaseModel):
    name: str
    provider_type: str
    base_url: str = None
    api_key: str = None

@app.post("/providers")
def create_provider(provider: ProviderCreate, db: Session = Depends(get_db)):
    new_prov = models.ProviderModel(
        name=provider.name,
        provider_type=provider.provider_type,
        base_url=provider.base_url,
        api_key=provider.api_key
    )
    db.add(new_prov)
    db.commit()
    db.refresh(new_prov)
    return new_prov

@app.get("/providers")
def get_providers(db: Session = Depends(get_db)):
    providers = db.query(models.ProviderModel).all()
    return [{"id": p.id, "name": p.name, "provider_type": p.provider_type, "base_url": p.base_url} for p in providers]

@app.get("/providers/{provider_id}/health")
async def provider_health(provider_id: int, db: Session = Depends(get_db)):
    provider = db.query(models.ProviderModel).filter(models.ProviderModel.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    try:
        prv = ProviderFactory.create_provider(
            provider_type=provider.provider_type,
            base_url=provider.base_url,
            api_key=provider.api_key
        )
        is_healthy = await prv.healthcheck()
        return {"status": "connected" if is_healthy else "disconnected"}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}

@app.get("/agents/{agent_id}/memory")
def get_agent_memory(agent_id: int, db: Session = Depends(get_db)):
    memories = db.query(models.MemoryModel).filter(models.MemoryModel.agent_id == agent_id).order_by(models.MemoryModel.timestamp.asc()).all()
    return memories

class ChatRequest(BaseModel):
    message: str

@app.post("/agents/{agent_id}/chat")
async def direct_chat(agent_id: int, req: ChatRequest, db: Session = Depends(get_db)):
    agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Save user message to memory
    db.add(models.MemoryModel(agent_id=agent.id, content=f"User: {req.message}"))
    db.commit()

    agent_provider = get_agent_provider(agent, db)
    model_name = agent.model_name or "llama3"
    
    # Fetch recent global memories
    all_agents = {a.id: a.name for a in db.query(models.AgentModel).all()}
    memories = db.query(models.MemoryModel).order_by(models.MemoryModel.timestamp.desc()).limit(15).all()
    memories.reverse()
    memory_text = "\n".join([f"- [{all_agents.get(m.agent_id, 'Unknown')}]: {m.content}" for m in memories])
    
    system_prompt = f"You are {agent.name}, role: {agent.role}. Personality: {agent.personality}. You are talking directly to the user (your boss)."
    if memory_text:
        system_prompt += f"\n\nGlobal Office Context / Memory:\n{memory_text}"
        
    try:
        response = await agent_provider.chat(model=model_name, system_prompt=system_prompt, user_prompt=req.message)
        
        await manager.broadcast({
            "event": "agent_speech",
            "agent_id": agent.id,
            "name": agent.name,
            "message": response
        })
        
        # Save AI response to memory
        db.add(models.MemoryModel(agent_id=agent.id, content=f"{agent.name}: {response}"))
        db.commit()
        
        return {"reply": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    agent_id: Optional[int] = None

@app.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return db.query(models.TaskModel).all()

@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    new_task = models.TaskModel(title=task.title, description=task.description, agent_id=task.agent_id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task