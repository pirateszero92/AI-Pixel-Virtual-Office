import os
import json
import re
import subprocess
import requests
import io
from storage import minio_client
try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None

WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), "agent_workspace")
os.makedirs(WORKSPACE_DIR, exist_ok=True)

def safe_path(filename: str) -> str:
    """Ensure the path stays within the workspace."""
    base_name = os.path.basename(filename)
    return os.path.join(WORKSPACE_DIR, base_name)

class ToolRegistry:
    def __init__(self):
        self.tools = {}
        self.instructions = []

    def register(self, name: str, func, description: str, args_schema: str):
        self.tools[name] = func
        self.instructions.append(f"{len(self.tools)}. {name}: {description} Arguments: {args_schema}")

    def execute(self, name: str, args: dict) -> str:
        if name not in self.tools:
            return f"Error: Tool '{name}' not found."
        try:
            return self.tools[name](**args)
        except Exception as e:
            return f"Error executing '{name}': {str(e)}"
            
    def get_instructions(self) -> str:
        tools_list = "\n".join(self.instructions)
        return f"""
You have access to the following tools. To use a tool, you MUST output a JSON block in the exact format below. Do not use tools if you don't need to.

Tools available:
{tools_list}

To use a tool, output EXACTLY this JSON format somewhere in your response:
```json
{{
  "tool_call": {{
    "name": "tool_name",
    "arguments": {{
      "arg1": "value1"
    }}
  }}
}}
```
If you do not want to use a tool, just output your normal text response. Make sure to include the exact word [DONE] in your response if you consider the current task fully completed.
"""

registry = ToolRegistry()

# ----------------- Tools Definitions -----------------

def write_file(filename: str, content: str, **kwargs) -> str:
    try:
        data = content.encode('utf-8')
        length = len(data)
        minio_client.put_object("agent-workspace", filename, io.BytesIO(data), length)
        return f"Success: File '{filename}' written to MinIO workspace."
    except Exception as e:
        return f"Error writing file: {str(e)}"

def read_file(filename: str, **kwargs) -> str:
    try:
        response = minio_client.get_object("agent-workspace", filename)
        content = response.read().decode("utf-8")
        response.close()
        response.release_conn()
        return content
    except Exception as e:
        return f"Error reading file: {str(e)}"

def run_shell(command: str, **kwargs) -> str:
    try:
        # Run safely in WORKSPACE_DIR
        result = subprocess.run(command, shell=True, cwd=WORKSPACE_DIR, capture_output=True, text=True, timeout=10)
        output = result.stdout
        if result.stderr:
            output += f"\nSTDERR:\n{result.stderr}"
        return output if output else "Command executed successfully (no output)."
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 10 seconds."
    except Exception as e:
        return f"Error executing shell command: {str(e)}"

def search_internet(query: str, max_results: int = 3, **kwargs) -> str:
    if not DDGS:
        return "Error: duckduckgo_search is not installed."
    try:
        results = DDGS().text(query, max_results=max_results)
        if not results:
            return "No results found."
        formatted = []
        for r in results:
            formatted.append(f"Title: {r.get('title')}\nURL: {r.get('href')}\nSnippet: {r.get('body')}")
        return "\n\n".join(formatted)
    except Exception as e:
        return f"Error searching internet: {str(e)}"

def call_api(url: str, method: str = "GET", headers: dict = None, body: dict = None, **kwargs) -> str:
    try:
        req_headers = headers or {}
        if method.upper() == "GET":
            res = requests.get(url, headers=req_headers, timeout=10)
        elif method.upper() == "POST":
            res = requests.post(url, headers=req_headers, json=body, timeout=10)
        else:
            return f"Error: Unsupported method {method}"
        return f"Status: {res.status_code}\nResponse: {res.text[:1000]}"
    except Exception as e:
        return f"Error calling API: {str(e)}"

# ------ DB / Agent Aware Tools ------
def query_knowledge(query: str, **kwargs) -> str:
    try:
        from database import SessionLocal
        import knowledge
        db = SessionLocal()
        try:
            return knowledge.get_knowledge_as_text(db, query, limit=3)
        finally:
            db.close()
    except Exception as e:
        return f"Error querying knowledge base: {str(e)}"

def update_goals(goals: list, agent_id: int = None, **kwargs) -> str:
    if not agent_id:
        return "Error: agent_id context is missing."
    try:
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            agent = db.query(models.AgentModel).filter(models.AgentModel.id == agent_id).first()
            if not agent:
                return "Error: Agent not found."
            agent.goals = json.dumps(goals)
            db.commit()
            return f"Success: Goals updated to {goals}"
        finally:
            db.close()
    except Exception as e:
        return f"Error updating goals: {str(e)}"

def create_task(title: str, description: str, assign_to_agent_id: int = None, **kwargs) -> str:
    try:
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            new_task = models.TaskModel(
                title=title,
                description=description,
                status="Todo",
                agent_id=assign_to_agent_id
            )
            db.add(new_task)
            db.commit()
            db.refresh(new_task)
            agent_name = "Unassigned"
            if assign_to_agent_id:
                agent = db.query(models.AgentModel).filter(models.AgentModel.id == assign_to_agent_id).first()
                if agent:
                    agent_name = agent.name
            return f"Success: Task '{title}' (ID: {new_task.id}) created and assigned to {agent_name}."
        finally:
            db.close()
    except Exception as e:
        return f"Error creating task: {str(e)}"

def update_task_status(task_id: int, status: str, **kwargs) -> str:
    try:
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            task = db.query(models.TaskModel).filter(models.TaskModel.id == task_id).first()
            if not task:
                return f"Error: Task ID {task_id} not found."
            task.status = status
            db.commit()
            return f"Success: Task {task_id} status updated to {status}."
        finally:
            db.close()
    except Exception as e:
        return f"Error updating task status: {str(e)}"

def send_message(recipient_agent_id: int, message: str, sender_id: int = None, **kwargs) -> str:
    try:
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            # We can log this as a memory for the recipient so they read it next time they think!
            new_memory = models.MemoryModel(
                agent_id=recipient_agent_id,
                content=f"Direct Message from Agent ID {sender_id}: {message}"
            )
            db.add(new_memory)
            db.commit()
            return f"Success: Message sent to Agent ID {recipient_agent_id}."
        finally:
            db.close()
    except Exception as e:
        return f"Error sending message: {str(e)}"

def schedule_meeting(topic: str, participant_ids: list, meeting_type: str = "team", **kwargs) -> str:
    try:
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            # Check if all agents exist
            agents = db.query(models.AgentModel).filter(models.AgentModel.id.in_(participant_ids)).all()
            if len(agents) != len(participant_ids):
                return "Error: One or more agent IDs do not exist."
            
            # Create the meeting
            new_meeting = models.MeetingModel(
                topic=topic,
                participants=json.dumps(participant_ids),
                meeting_type=meeting_type
            )
            db.add(new_meeting)
            db.commit()
            db.refresh(new_meeting)
            agent_names = [a.name for a in agents]
            return f"Success: Meeting '{topic}' ({meeting_type}) scheduled with {', '.join(agent_names)}. (Meeting ID: {new_meeting.id})"
        finally:
            db.close()
    except Exception as e:
        return f"Error scheduling meeting: {str(e)}"

# Register Tools
registry.register("write_file", write_file, "Write code or text to a file in the workspace.", '{"filename": "string", "content": "string"}')
registry.register("read_file", read_file, "Read a file from the workspace.", '{"filename": "string"}')
registry.register("run_shell", run_shell, "Run a shell command safely in the workspace directory.", '{"command": "string"}')
registry.register("search_internet", search_internet, "Search the internet using DuckDuckGo.", '{"query": "string"}')
registry.register("call_api", call_api, "Make an HTTP request to an external API.", '{"url": "string", "method": "GET|POST", "headers": {"key":"value"}, "body": {}}')
registry.register("query_knowledge", query_knowledge, "Search the company knowledge base for instructions or context.", '{"query": "string"}')
registry.register("update_goals", update_goals, "Update your internal short-term and long-term goals.", '{"goals": ["string"]}')
registry.register("create_task", create_task, "Create a new task in the Kanban board and optionally assign it to another agent.", '{"title": "string", "description": "string", "assign_to_agent_id": "integer (optional)"}')
registry.register("update_task_status", update_task_status, "Update the status of an existing task (Todo, In Progress, Review, Done).", '{"task_id": "integer", "status": "string"}')
registry.register("send_message", send_message, "Send a direct message to another agent. This will be added to their memory.", '{"recipient_agent_id": "integer", "message": "string"}')
registry.register("schedule_meeting", schedule_meeting, "Schedule a meeting with other agents to discuss a specific topic. Participants will walk to the meeting room.", '{"topic": "string", "participant_ids": [1, 2, 3], "meeting_type": "1-on-1|team|department|company"}')

# -----------------------------------------------------

TOOL_INSTRUCTIONS = registry.get_instructions()

def parse_tool_call(response_text: str):
    """Parse JSON block from AI response."""
    try:
        parsed = None
        match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', response_text, re.DOTALL)
        if match:
            parsed = json.loads(match.group(1), strict=False)
        else:
            match = re.search(r'(\{.*"tool_call".*\})', response_text, re.DOTALL)
            if match:
                parsed = json.loads(match.group(1), strict=False)
        
        if parsed and "tool_call" in parsed:
            return parsed["tool_call"]
        return parsed
    except Exception as e:
        print(f"Parse Tool Call Error: {e}")
        # FALLBACK: Local LLM often misses closing brackets. Extract using regex.
        if "write_file" in response_text:
            fname_match = re.search(r'"filename"\s*:\s*"([^"]+)"', response_text)
            if fname_match:
                filename = fname_match.group(1)
                # find content starting after "content": " until the end of the text
                c_match = re.search(r'"content"\s*:\s*"(.*)', response_text, re.DOTALL)
                if c_match:
                    content_str = c_match.group(1)
                    # Remove trailing JSON brackets and markdown backticks from the end
                    content_str = re.sub(r'"?\s*\}?\s*\}?\s*\}?\s*```.*$', '', content_str, flags=re.DOTALL)
                    # Also remove the final "[DONE]" text if it accidentally got caught
                    content_str = re.sub(r'\[DONE\].*$', '', content_str, flags=re.DOTALL).strip()
                    
                    # We might have trailing text like "ไฟล์ dev_emp.txt ได้ถูกสร้าง... " which is hard to separate if not wrapped in quotes.
                    # A better way is to stop at the first ` ``` `
                    content_parts = content_str.split('```')
                    content_str = content_parts[0].strip()
                    # Remove trailing quotes and brackets
                    content_str = re.sub(r'"\s*\}?\s*\}?\s*\}?$', '', content_str).strip()
                    # Unescape actual newlines if they are \\n
                    content_str = content_str.replace('\\n', '\n')

                    print(f"Fallback Parser Extracted: {filename}")
                    return {
                        "name": "write_file",
                        "arguments": {
                            "filename": filename,
                            "content": content_str
                        }
                    }
    return None

def execute_tool(tool_name: str, args: dict, agent_id: int = None) -> str:
    # Inject agent_id context
    args["agent_id"] = agent_id
    args["sender_id"] = agent_id
    return registry.execute(tool_name, args)
