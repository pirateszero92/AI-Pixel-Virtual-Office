import os
import json
import re

WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), "agent_workspace")

# Ensure the workspace exists
os.makedirs(WORKSPACE_DIR, exist_ok=True)

def safe_path(filename: str) -> str:
    """Ensure the path stays within the workspace."""
    base_name = os.path.basename(filename)
    return os.path.join(WORKSPACE_DIR, base_name)

def write_file(filename: str, content: str) -> str:
    try:
        filepath = safe_path(filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Success: File '{filename}' written to workspace."
    except Exception as e:
        return f"Error writing file: {str(e)}"

def read_file(filename: str) -> str:
    try:
        filepath = safe_path(filename)
        if not os.path.exists(filepath):
            return f"Error: File '{filename}' does not exist in workspace."
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

def execute_tool(tool_name: str, args: dict) -> str:
    if tool_name == "write_file":
        return write_file(args.get("filename", ""), args.get("content", ""))
    elif tool_name == "read_file":
        return read_file(args.get("filename", ""))
    else:
        return f"Error: Tool '{tool_name}' not found."

def parse_tool_call(response_text: str):
    """Parse JSON block from AI response."""
    try:
        # Find json block: greedy match to capture the whole JSON object
        match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', response_text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        
        # Fallback: if no markdown block, try to parse the whole string
        match = re.search(r'(\{.*"tool_call".*\})', response_text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
    except Exception as e:
        print(f"JSON Parse Error: {e}")
    return None

TOOL_INSTRUCTIONS = """
You have access to the following tools. To use a tool, you MUST output a JSON block in the exact format below. Do not use tools if you don't need to.

Tools available:
1. write_file: Write code or text to a file in the workspace. Arguments: {"filename": "string", "content": "string"}
2. read_file: Read a file from the workspace. Arguments: {"filename": "string"}

To use a tool, output EXACTLY this JSON format somewhere in your response:
```json
{
  "tool_call": {
    "name": "tool_name",
    "arguments": {
      "filename": "value",
      "content": "value"
    }
  }
}
```
If you do not want to use a tool, just output your normal text response. Make sure to include the exact word [DONE] in your response if you consider the current task fully completed.
"""
