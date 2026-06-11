import asyncio
import json
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from providers import ProviderFactory
import os


# Define roles mapping for stages
STAGE_ROLES = {
    "pending": ["ceo", "manager"],
    "coding": ["developer", "engineer", "programmer"],
    "designing": ["designer", "ux", "ui"],
    "testing": ["qa", "tester", "quality"],
    "security": ["security", "audit", "hacker"],
    "deploying": ["devops", "infrastructure", "sysadmin"],
    "reviewing": ["ceo", "manager"]
}

async def process_collaboration(task_id: int, agent_id: int):
    from main import manager, get_agent_provider
    db = SessionLocal()
    agent = None
    try:
        task = db.query(models.TaskModel).filter(models.TaskModel.id == task_id).first()
        agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
        
        if not task or not agent or agent.status != "Idle":
            return

        # Update status
        agent.status = "Working"
        task.status = "In Progress"
        task.agent_id = agent.id
        if not task.pipeline_stage:
            task.pipeline_stage = "pending"
        db.commit()

        # Broadcast walking
        await manager.broadcast({
            "event": "agent_state_changed", 
            "agent_id": agent.id, 
            "name": agent.name, 
            "status": "Working", 
            "action": "walking_to_desk"
        })
        
        await asyncio.sleep(4) # Walk time
        
        await manager.broadcast({
            "event": "agent_state_changed", 
            "agent_id": agent.id, 
            "name": agent.name, 
            "status": "Working", 
            "action": f"กำลังดำเนินการ: {task.title[:20]}..."
        })

        # Fetch Goals
        goals_list = []
        if agent.goals:
            try:
                goals_list = json.loads(agent.goals)
            except Exception as ge:
                print(f"Error parsing agent goals: {ge}")
        goals_section = ""
        if goals_list:
            goals_text = "\n".join([f"- {g}" for g in goals_list])
            goals_section = f"\nYour Current Goals/Objectives:\n{goals_text}\n"

        system_prompt = f"""You are {agent.name}, role: {agent.role}. 
You are working on a collaborative project task.
{goals_section}

Task: {task.title}
Description: {task.description}
Current Pipeline Stage: {task.pipeline_stage}

Pipeline Context (Previous stages):
{task.pipeline_context[-2000:] if task.pipeline_context else "None"}

Your job is to advance the work in your stage. 
After doing your work (you can write code, suggest designs, review, etc.), you MUST decide what happens next.

Output EXACTLY one JSON block at the end of your response with your decision:
```json
{{
  "action": "delegate|review|approve|reject|escalate",
  "target_stage": "coding|designing|testing|security|deploying|reviewing|done",
  "message": "Detailed context or instructions for the next person",
  "speech": "A short 1-2 sentence spoken message for your speech bubble. Make it natural and conversational in Thai."
}}
```

Available target stages: coding, designing, testing, security, deploying, reviewing, done.
- delegate: Pass work forward (e.g. CEO to coding, coding to testing)
- approve: Pass work forward after review (e.g. testing to security)
- reject: Send back for fixes (e.g. QA to coding)
- escalate: Send directly to CEO (reviewing) if there is a blocking issue
"""

        agent_provider = get_agent_provider(agent, db)
        model_name = agent.model_name or "llama3"
        
        ai_response = await agent_provider.chat(
            model=model_name, 
            system_prompt=system_prompt, 
            user_prompt="Please perform your work and output the JSON decision block.", 
            max_tokens=2048
        )
        
        # Parse decision
        decision = None
        import re
        match = re.search(r'```(?:json)?\s*(\{.*?"action".*?\})\s*```', ai_response, re.DOTALL)
        if match:
            try:
                decision = json.loads(match.group(1))
            except Exception as e:
                print(f"JSON Parse Error 1: {e}\nRaw: {match.group(1)}")
        
        if not decision:
            # Fallback regex
            match = re.search(r'(\{.*?"action".*?\})', ai_response, re.DOTALL)
            if match:
                try:
                    decision = json.loads(match.group(1))
                except Exception as e:
                    print(f"JSON Parse Error 2: {e}\nRaw: {match.group(1)}")
                    
        if not decision:
            print(f"AI Response format invalid: {ai_response}")
                    
        if not decision:
            # Absolute fallback
            decision = {
                "action": "delegate",
                "target_stage": "done" if task.pipeline_stage == "reviewing" else "reviewing",
                "message": "AI could not format decision.",
                "speech": "ผมทำส่วนของผมเสร็จแล้วครับ"
            }
            
        action = decision.get("action", "delegate")
        target_stage = decision.get("target_stage", "done")
        message = decision.get("message", "Moving forward.")
        speech = decision.get("speech", "งานส่วนนี้เรียบร้อยครับ")
        
        # Color code based on action
        color = "white"
        if action == "approve": color = "green"
        elif action == "reject": color = "red"
        elif action == "escalate": color = "yellow"

        # Broadcast speech with color
        await manager.broadcast({
            "event": "agent_speech",
            "agent_id": agent.id,
            "name": agent.name,
            "message": speech,
            "color": color
        })
        
        # Update task context and stage
        new_context = f"\n--- Stage: {task.pipeline_stage} by {agent.name} ({agent.role}) ---\nAction: {action} -> {target_stage}\nMessage: {message}\n"
        task.pipeline_context = (task.pipeline_context or "") + new_context
        
        if target_stage == "done" or action == "done":
            task.status = "Done"
            task.pipeline_stage = "done"
        else:
            task.status = "Todo"  # Put back in queue
            task.pipeline_stage = target_stage
            
        task.agent_id = None # Unassign so next person can pick up
        
    except Exception as e:
        print(f"Process Collaboration Error: {e}")
        if task:
            task.status = "Todo"
            task.agent_id = None
    finally:
        if agent:
            agent.status = "Idle"
            db.commit()
            asyncio.create_task(manager.broadcast({
                "event": "agent_state_changed", 
                "agent_id": agent.id, 
                "name": agent.name, 
                "status": "Idle", 
                "action": "return_to_idle"
            }))
        db.close()

# Track when agents became idle
idle_start_times = {}

async def collaboration_loop():
    while True:
        await asyncio.sleep(10)
        db = SessionLocal()
        try:
            tasks = db.query(models.TaskModel).filter(models.TaskModel.status == "Todo").order_by(models.TaskModel.id.asc()).all()
            idle_agents = db.query(models.AgentModel).filter(models.AgentModel.status == "Idle").all()
            
            if not idle_agents:
                continue

            running_coros = []
            import time
            current_time = time.time()
            
            # Update idle_start_times
            for agent in idle_agents:
                if agent.id not in idle_start_times:
                    idle_start_times[agent.id] = current_time
            
            # Remove agents no longer idle
            idle_agent_ids = {a.id for a in idle_agents}
            for k in list(idle_start_times.keys()):
                if k not in idle_agent_ids:
                    del idle_start_times[k]
                    
            from main import process_training
            
            # Auto-train any agent idle for more than 10 minutes (600 seconds)
            # regardless of whether there are tasks or not
            currently_training = db.query(models.AgentModel).filter(models.AgentModel.status == "Training").count()
            available_slots = max(0, 2 - currently_training)
            
            for agent in list(idle_agents):
                if available_slots <= 0:
                    break
                # We use 10 minutes (600 seconds) as requested
                if current_time - idle_start_times[agent.id] >= 600:
                    idle_agents.remove(agent)
                    running_coros.append(process_training(agent.id))
                    del idle_start_times[agent.id]
                    available_slots -= 1
            
            if not tasks:
                # If NO tasks at all, also train some devs immediately (fallback behavior)
                import random
                devs = [a for a in idle_agents if a.role and any(r in a.role.lower() for r in ["develop", "engineer", "architect", "design", "devops", "security", "test", "qa"])]
                
                # Pick up to available_slots devs to train simultaneously
                trainers = random.sample(devs, min(available_slots, len(devs)))
                for trainer in trainers:
                    idle_agents.remove(trainer)
                    running_coros.append(process_training(trainer.id))
                    if trainer.id in idle_start_times:
                        del idle_start_times[trainer.id]
            else:
                for t in tasks:
                    if not idle_agents:
                        break
                    
                    stage = t.pipeline_stage or "pending"
                    if stage == "done":
                        continue
                        
                    allowed_roles = STAGE_ROLES.get(stage, [])
                    
                    selected_agent = None
                    # Find first idle agent that matches the required role
                    for a in idle_agents:
                        role_lower = a.role.lower()
                        if any(r in role_lower for r in allowed_roles) or not allowed_roles:
                            selected_agent = a
                            break
                            
                    if selected_agent:
                        idle_agents.remove(selected_agent)
                        running_coros.append(process_collaboration(t.id, selected_agent.id))
            
            for coro in running_coros:
                asyncio.create_task(coro)
            
        except Exception as e:
            print(f"Collaboration Loop Error: {e}")
        finally:
            db.close()
