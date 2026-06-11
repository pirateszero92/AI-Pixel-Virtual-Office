from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile, BackgroundTasks
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

async def process_task(task_id: int, agent_id: int):
    db = SessionLocal()
    try:
        task = db.query(models.TaskModel).filter(models.TaskModel.id == task_id).first()
        agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
        
        if not task or not agent or agent.status != "Idle":
            return

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

        # Fetch Peers
        peers = db.query(models.AgentModel).filter(models.AgentModel.id != agent.id).all()
        peer_text = "\n".join([f"- ID: {p.id}, Name: {p.name}, Role: {p.role}" for p in peers])
        peer_section = f"\n\nYour Colleagues (You can assign tasks using create_task or send_message to their ID):\n{peer_text}" if peers else ""

        # Let AI think
        system_prompt = f"You are {agent.name}, role: {agent.role}. Personality: {agent.personality}. You are working autonomously on a background task. The user CANNOT reply to you. You MUST complete the task using the tools and information available. If you need someone else to do a part of the job, use create_task to assign it to them. ALWAYS output [DONE] when you finish your turn." + memory_section + peer_section
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
                tool_result = tools.execute_tool(tool_call["name"], tool_call["arguments"], agent_id=agent.id)
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
        db.commit()

        event_end = {"event": "agent_state_changed", "agent_id": agent.id, "name": agent.name, "status": "Idle", "action": "return_to_idle"}
        await manager.broadcast(event_end)
        
    except Exception as e:
        print(f"Process Task Error: {e}")
    finally:
        db.close()

async def process_training(agent_id: int):
    db = SessionLocal()
    agent = None
    try:
        agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
        if not agent or agent.status != "Idle":
            print(f"[Training] Skipped agent {agent_id}: not found or status={agent.status if agent else 'N/A'}")
            return
            
        agent.status = "Training"
        db.commit()
        print(f"[Training] {agent.name} ({agent.role}) started training")
        
        await manager.broadcast({
            "event": "agent_state_changed",
            "agent_id": agent.id,
            "name": agent.name,
            "status": "Training",
            "action": "walking_to_training"
        })
        
        await asyncio.sleep(5)
        
        await manager.broadcast({
            "event": "agent_state_changed",
            "agent_id": agent.id,
            "name": agent.name,
            "status": "Training",
            "action": "กำลังฝึกฝนวิทยายุทธ 📚"
        })
        
        # Read knowledge base
        knowledge = ""
        try:
            knowledge_path = os.path.join(os.path.dirname(__file__), "knowledge.txt")
            with open(knowledge_path, "r", encoding="utf-8") as f:
                knowledge = f.read()
        except Exception as ke:
            print(f"[Training] Warning: Could not read knowledge.txt: {ke}")

        # Pick a random training category for diversity
        import random
        task_categories = {
            "Architect": ["SYSTEM_DESIGN", "API_DESIGN", "DATABASE_DESIGN", "SCALABILITY", "ARCHITECTURE_REVIEW"],
            "UX/UI": ["UI_COMPONENTS", "USER_FLOW", "ACCESSIBILITY", "DESIGN_SYSTEM", "WIREFRAMING"],
            "DevOps": ["CI_CD_PIPELINE", "INFRASTRUCTURE_AS_CODE", "CLOUD_DEPLOYMENT", "MONITORING", "DOCKER_KUBERNETES"],
            "Developer": ["CODE_GENERATION", "BUG_FIXING", "CODE_REFACTORING", "TEST_DRIVEN_DEVELOPMENT", "API_IMPLEMENTATION"],
            "Test": ["UNIT_TESTING", "INTEGRATION_TESTING", "E2E_TESTING", "TEST_CASE_GENERATION", "BUG_REPORTING"],
            "Business": ["REQUIREMENT_ANALYSIS", "USER_STORIES", "PRODUCT_STRATEGY", "MARKET_RESEARCH", "PROCESS_MAPPING"],
            "Financ": ["FINANCIAL_MODELING", "BUDGETING", "COST_ANALYSIS", "REVENUE_FORECASTING", "RISK_MANAGEMENT"],
            "CEO": ["STRATEGIC_PLANNING", "COMPANY_VISION", "RESOURCE_ALLOCATION", "LEADERSHIP_COMMUNICATION", "PERFORMANCE_REVIEW"],
            "Security": ["SECURITY_AUDIT", "VULNERABILITY_SCAN", "PENETRATION_TESTING", "DATA_PRIVACY", "SECURE_CODING"]
        }
        # Find matching category list
        role_cats = task_categories.get("Developer")  # default
        for role_key, cats in task_categories.items():
            if role_key.lower() in agent.role.lower():
                role_cats = cats
                break
        chosen_category = random.choice(role_cats)

        system_prompt = f"""You are {agent.name}, role: {agent.role}. You are generating HIGH-QUALITY training data for fine-tuning a programming AI model (Gemma).

Knowledge Base:
{knowledge}

TRAINING TASK CATEGORY: {chosen_category}

You MUST output a single valid JSON object (no markdown, no code blocks) with exactly these 3 fields:
{{
  "instruction": "A clear, specific programming problem or task description related to {chosen_category}. Include constraints, edge cases, and expected behavior.",
  "context": "Any relevant existing code, configuration, schema, or background information that provides context for the problem. Leave empty string if not applicable.",
  "response": "A complete, production-quality solution with step-by-step Chain-of-Thought reasoning. Explain WHY each decision was made, not just WHAT the code does. Include error handling, edge cases, and best practices."
}}

QUALITY RULES:
- The instruction must be realistic and specific (NOT generic like 'write a hello world')
- The response must follow SOLID, Clean Code, and Clean Architecture principles
- Include TypeScript/Python type annotations where applicable
- The response must be complete and runnable, NOT pseudo code
- Add inline comments explaining complex logic
- Output ONLY the JSON object, nothing else"""

        agent_provider = get_agent_provider(agent, db)
        model_name = agent.model_name or "llama3"
        
        try:
            ai_response = await agent_provider.chat(
                model=model_name, 
                system_prompt=system_prompt, 
                user_prompt=f"Generate a HIGH-QUALITY {chosen_category} training example for your role as {agent.role}. Output valid JSON only.", 
                max_tokens=2048
            )
            print(f"[Training] {agent.name} got AI response ({len(ai_response)} chars)")
            
            # Broadcast the training result as speech
            await manager.broadcast({
                "event": "agent_speech",
                "agent_id": agent.id,
                "name": agent.name,
                "message": f"📚 ฝึกฝนเสร็จแล้ว! บันทึก Dataset สำเร็จ"
            })
            
            # Map role to dataset file
            role_lower = agent.role.lower()
            if "architect" in role_lower:
                filename = "architecture_dataset.jsonl"
            elif "design" in role_lower or "ux" in role_lower or "ui" in role_lower:
                filename = "uiux_dataset.jsonl"
            elif "devops" in role_lower:
                filename = "devops_dataset.jsonl"
            elif "security" in role_lower:
                filename = "security_dataset.jsonl"
            elif "test" in role_lower or "qa" in role_lower:
                filename = "testing_dataset.jsonl"
            elif "business" in role_lower or "analyst" in role_lower:
                filename = "business_dataset.jsonl"
            elif "finance" in role_lower:
                filename = "finance_dataset.jsonl"
            elif "ceo" in role_lower or "manage" in role_lower:
                filename = "management_dataset.jsonl"
            else:
                filename = "coding_dataset.jsonl"
                
            dataset_dir = os.path.join(os.path.dirname(__file__), "datasets")
            os.makedirs(dataset_dir, exist_ok=True)
            dataset_path = os.path.join(dataset_dir, filename)
            
            # Ensure it's a valid single line JSON
            try:
                clean_json = ai_response.strip()
                if clean_json.startswith("```json"):
                    clean_json = clean_json[7:]
                elif clean_json.startswith("```"):
                    clean_json = clean_json[3:]
                if clean_json.endswith("```"):
                    clean_json = clean_json[:-3]
                
                parsed = json.loads(clean_json.strip())
                jsonl_line = json.dumps(parsed, ensure_ascii=False) + "\n"
            except:
                jsonl_line = json.dumps({"instruction": "Generate problem", "output": ai_response}, ensure_ascii=False) + "\n"
                
            with open(dataset_path, "a", encoding="utf-8") as f:
                f.write(jsonl_line)
            
            log_path = os.path.join(dataset_dir, "fine_tuning_logs.jsonl")
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"agent": agent.name, "category": chosen_category, "content": ai_response}, ensure_ascii=False) + "\n")
            
            print(f"[Training] Saved to {filename}")
        except Exception as e:
            print(f"[Training] AI Generation Error for {agent.name}: {e}")

    except Exception as e:
        print(f"[Training] Process Error for agent {agent_id}: {e}")
    finally:
        # ALWAYS return agent to Idle no matter what
        try:
            if agent:
                agent.status = "Idle"
                db.commit()
                await manager.broadcast({
                    "event": "agent_state_changed", 
                    "agent_id": agent.id, 
                    "name": agent.name, 
                    "status": "Idle", 
                    "action": "return_to_idle"
                })
                print(f"[Training] {agent.name} returned to Idle")
        except Exception as fe:
            print(f"[Training] Failed to reset agent status: {fe}")
        db.close()

async def autonomous_agent_loop():
    while True:
        await asyncio.sleep(10)
        db = SessionLocal()
        try:
            tasks = db.query(models.TaskModel).filter(models.TaskModel.status == "Todo").order_by(models.TaskModel.id.asc()).all()
            idle_agents = db.query(models.AgentModel).filter(models.AgentModel.status == "Idle").all()
            
            if not idle_agents:
                continue

            running_coros = []
            
            if not tasks:
                # Fallback to Training Mode for Developers, Engineers, Architects, Designers
                devs = [a for a in idle_agents if a.role and any(r in a.role.lower() for r in ["develop", "engineer", "architect", "design"])]
                if devs:
                    trainer = devs[0]
                    idle_agents.remove(trainer)
                    running_coros.append(process_training(trainer.id))
            else:
                for t in tasks:
                    if not idle_agents:
                        break
                    
                    selected_agent = None
                    if t.agent_id:
                        for a in idle_agents:
                            if a.id == t.agent_id:
                                selected_agent = a
                                break
                    else:
                        selected_agent = idle_agents[0]
                    
                    if selected_agent:
                        idle_agents.remove(selected_agent)
                        running_coros.append(process_task(t.id, selected_agent.id))
            
            for coro in running_coros:
                asyncio.create_task(coro)
            
        except Exception as e:
            print(f"Autonomous Loop Error: {e}")
        finally:
            db.close()

async def process_meeting(meeting_id: int):
    db = SessionLocal()
    try:
        meeting = db.query(models.MeetingModel).filter(models.MeetingModel.id == meeting_id).first()
        if not meeting or meeting.status != "Scheduled":
            return
            
        participant_ids = json.loads(meeting.participants)
        agents = db.query(models.AgentModel).filter(models.AgentModel.id.in_(participant_ids)).all()
        
        if not agents:
            return

        # Mark as In Progress
        meeting.status = "In Progress"
        for a in agents:
            a.status = "Meeting"
        db.commit()
        
        # Broadcast walk to meeting
        for a in agents:
            await manager.broadcast({
                "event": "agent_state_changed", 
                "agent_id": a.id, 
                "name": a.name, 
                "status": "Meeting", 
                "action": "walking_to_meeting"
            })
            
        # Give them time to walk
        await asyncio.sleep(5)
        
        for a in agents:
            await manager.broadcast({
                "event": "agent_state_changed", 
                "agent_id": a.id, 
                "name": a.name, 
                "status": "Meeting", 
                "action": f"เข้าร่วมประชุมหัวข้อ: {meeting.topic}"
            })
        
        transcript = f"--- Meeting Started: {meeting.topic} ---\n"
        
        # Simple turn-based talking
        max_turns = len(agents) * 3
        turn = 0
        
        while turn < max_turns:
            speaker = agents[turn % len(agents)]
            agent_provider = get_agent_provider(speaker, db)
            
            system_prompt = f"You are {speaker.name}, role: {speaker.role}. You are in a meeting. Topic: {meeting.topic}. Other participants: {[a.name for a in agents if a.id != speaker.id]}. You must contribute to the meeting discussion. Keep your response conversational and short (1-2 sentences). End your response with [END MEETING] ONLY IF you think the meeting objective is fully resolved and everyone can go back to work."
            
            prompt = transcript + f"\n\nIt is your turn to speak, {speaker.name}."
            
            try:
                ai_response = await agent_provider.chat(
                    model=speaker.model_name or "llama3", 
                    system_prompt=system_prompt, 
                    user_prompt=prompt,
                    max_tokens=200
                )
            except Exception as e:
                ai_response = f"I seem to be having technical difficulties: {e}"
            
            transcript += f"\n{speaker.name}: {ai_response}"
            
            await manager.broadcast({
                "event": "agent_speech",
                "agent_id": speaker.id,
                "name": speaker.name,
                "message": ai_response
            })
            
            if "[END MEETING]" in ai_response:
                break
                
            turn += 1
            await asyncio.sleep(4) # Pause between speakers
            
        meeting.status = "Completed"
        meeting.transcript = transcript
        
        # Generate Summary & Action Items
        try:
            summary_prompt = f"Summarize the following meeting transcript into a short paragraph, and extract action items as a JSON array of strings under 'action_items'. Only output the JSON block with 'summary' and 'action_items'.\n\nTranscript:\n{transcript}"
            # Use the CEO or the first agent's provider for summarization
            summarizer_agent = next((a for a in agents if "ceo" in a.role.lower()), agents[0])
            summarizer_provider = get_agent_provider(summarizer_agent, db)
            summary_response = await summarizer_provider.chat(
                model=summarizer_agent.model_name or "llama3",
                system_prompt="You are a helpful assistant that summarizes meetings. Output valid JSON only.",
                user_prompt=summary_prompt,
                max_tokens=500
            )
            import re
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', summary_response, re.DOTALL)
            if not match:
                match = re.search(r'(\{.*?\})', summary_response, re.DOTALL)
            if match:
                parsed = json.loads(match.group(1))
                meeting.summary = parsed.get("summary", "")
                action_items = parsed.get("action_items", [])
                meeting.action_items = json.dumps(action_items)
                
                # Auto-create tasks for action items
                for ai_task in action_items:
                    new_task = models.TaskModel(
                        title=ai_task[:100],
                        description=f"Action item from meeting '{meeting.topic}'.\n\nSummary: {meeting.summary}",
                        status="Todo",
                        pipeline_stage="pending"
                    )
                    db.add(new_task)
        except Exception as e:
            print(f"Meeting Summary Generation Error: {e}")
            
        for a in agents:
            a.status = "Idle"
        db.commit()
        
        # Return to idle
        for a in agents:
            await manager.broadcast({
                "event": "agent_state_changed", 
                "agent_id": a.id, 
                "name": a.name, 
                "status": "Idle", 
                "action": "return_to_idle"
            })
            
    except Exception as e:
        print(f"Meeting Error: {e}")
    finally:
        db.close()

async def meeting_loop():
    while True:
        await asyncio.sleep(15)
        db = SessionLocal()
        try:
            meetings = db.query(models.MeetingModel).filter(models.MeetingModel.status == "Scheduled").all()
            for m in meetings:
                asyncio.create_task(process_meeting(m.id))
        except Exception as e:
            print(f"Meeting Loop Error: {e}")
        finally:
            db.close()

from storage import init_minio, minio_client
import collaboration

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_minio()
    
    # Reset all agents to Idle on startup to fix stuck statuses
    db = SessionLocal()
    try:
        db.query(models.AgentModel).update({"status": "Idle"})
        db.commit()
    except Exception as e:
        print(f"Error resetting agent statuses: {e}")
    finally:
        db.close()
        
    task1 = asyncio.create_task(collaboration.collaboration_loop())
    task2 = asyncio.create_task(meeting_loop())
    yield
    task1.cancel()
    task2.cancel()

from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

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
        return {"status": "error", "message": str(e)}

@app.delete("/providers/{provider_id}")
async def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    prov = db.query(models.ProviderModel).filter(models.ProviderModel.id == provider_id).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Check if any agents are using this provider
    agents = db.query(models.AgentModel).filter(models.AgentModel.provider_id == provider_id).count()
    if agents > 0:
        raise HTTPException(status_code=400, detail="Cannot delete provider. It is currently assigned to one or more employees.")
        
    db.delete(prov)
    db.commit()
    return {"status": "success", "message": "Provider deleted successfully"}

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
    
    # Fetch Peers
    peers = db.query(models.AgentModel).filter(models.AgentModel.id != agent.id).all()
    peer_text = "\n".join([f"- ID: {p.id}, Name: {p.name}, Role: {p.role}" for p in peers])
    peer_section = f"\n\nYour Colleagues (You can assign tasks using create_task or send_message to their ID):\n{peer_text}" if peers else ""

    system_prompt = f"You are {agent.name}, role: {agent.role}. Personality: {agent.personality}. You are talking directly to the user (your boss)."
    if memory_text:
        system_prompt += f"\n\nGlobal Office Context / Memory:\n{memory_text}"
    system_prompt += peer_section
    system_prompt += "\n\n" + tools.TOOL_INSTRUCTIONS
        
    try:
        max_iterations = 3
        prompt = req.message
        final_response = ""
        for i in range(max_iterations):
            response = await agent_provider.chat(model=model_name, system_prompt=system_prompt, user_prompt=prompt)
            
            await manager.broadcast({
                "event": "agent_speech",
                "agent_id": agent.id,
                "name": agent.name,
                "message": response
            })
            
            tool_call = tools.parse_tool_call(response)
            if tool_call and "name" in tool_call and "arguments" in tool_call:
                tool_result = tools.execute_tool(tool_call["name"], tool_call["arguments"], agent_id=agent.id)
                print(f"Chat Tool Executed [{tool_call['name']}]: {tool_result}")
                prompt = f"Tool result for {tool_call['name']}: {tool_result}\nWhat do you want to say or do next? Remember to output [DONE] if you are finished."
            else:
                final_response = response
                break
        
        # Save AI response to memory
        db.add(models.MemoryModel(agent_id=agent.id, content=f"{agent.name}: {final_response}"))
        db.commit()
        
        return {"reply": final_response}
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

@app.get("/workspace/files")
def list_workspace_files():
    try:
        objects = minio_client.list_objects("agent-workspace")
        return [obj.object_name for obj in objects]
    except Exception as e:
        print("MinIO list error:", e)
        return []

@app.get("/workspace/files/{filename}")
def get_workspace_file(filename: str):
    try:
        response = minio_client.get_object("agent-workspace", filename)
        content = response.read().decode("utf-8")
        response.close()
        response.release_conn()
        return {"filename": filename, "content": content}
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/training/stats")
def get_training_stats():
    import os
    dataset_dir = os.path.join(os.path.dirname(__file__), "datasets")
    total = 0
    categories = {}
    if os.path.exists(dataset_dir):
        for filename in os.listdir(dataset_dir):
            if filename.endswith(".jsonl") and filename != "fine_tuning_logs.jsonl":
                filepath = os.path.join(dataset_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        count = sum(1 for _ in f)
                        key = filename.replace("_dataset.jsonl", "")
                        categories[key] = {"label": key.title() + " Dataset", "count": count}
                        total += count
                except Exception as e:
                    print(f"Error reading {filename}: {e}")
                    
    return {
        "total": total,
        "target": 10000,
        "progress_pct": round(min(total / 10000 * 100, 100), 1) if total > 0 else 0,
        "categories": categories
    }

@app.post("/api/training/mass_start")
async def start_mass_training(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Find all idle agents but limit to 2 to prevent LLM overload
    currently_training = db.query(models.AgentModel).filter(models.AgentModel.status == "Training").count()
    available_slots = max(0, 2 - currently_training)
    
    if available_slots <= 0:
        return {"status": "skipped", "message": "Training queue is full. Please wait."}
        
    idle_agents = db.query(models.AgentModel).filter(models.AgentModel.status == "Idle").limit(available_slots).all()
    count = 0
    for agent in idle_agents:
        # Schedule training in background for each idle agent
        background_tasks.add_task(process_training, agent.id)
        count += 1
    return {"status": "started", "agents_training": count}

from fastapi.responses import Response
import io
import shutil

MAP_FILE = os.path.join(os.path.dirname(__file__), "maps", "office_map.png")

@app.post("/api/map/upload")
async def upload_map(file: UploadFile = File(...)):
    """Upload office map image to local maps folder"""
    os.makedirs(os.path.dirname(MAP_FILE), exist_ok=True)
    with open(MAP_FILE, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"status": "success", "message": "Map uploaded successfully"}

@app.get("/api/map")
def get_map():
    """Serve office map image from local maps folder"""
    if not os.path.exists(MAP_FILE):
        raise HTTPException(status_code=404, detail="Map not found")
    with open(MAP_FILE, "rb") as f:
        data = f.read()
    return Response(content=data, media_type="image/png")