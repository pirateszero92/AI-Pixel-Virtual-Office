from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from database import Base
import datetime
from pgvector.sqlalchemy import Vector

class AgentModel(Base):
    __tablename__ = "agents" # ชื่อตารางในฐานข้อมูล

    # ข้อมูลพื้นฐานประจำตัว Agent
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False) # เช่น CEO, DevOps, Engineer
    status = Column(String, default="Idle") # สถานะเริ่มต้น: ว่างงาน (Idle)
    
    # พิกัดตำแหน่งสำหรับเดินในออฟฟิศพิกเซล (เริ่มต้นที่กลางห้อง x=0, y=0)
    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    
    # สไตล์และหน้าตา
    avatar = Column(String, nullable=True) # ภาพอัปโหลดเดิม (ถ้ามี)
    sprite_scale = Column(Float, default=1.0)
    personality = Column(String, nullable=True)
    
    # Character Customization Fields
    body_type = Column(String, default="male") # โครงร่าง/เพศ
    body_size = Column(String, default="normal") # slim, normal, thick
    skin_tone = Column(String, default="#fcd5ce") # สีผิว
    hair_style = Column(String, default="short") # ทรงผม
    hair_color = Column(String, default="#333333") # สีผม
    eye_color = Column(String, default="#000000") # สีตา
    facial_hair = Column(String, default="none") # หนวดเครา
    glasses = Column(String, default="none") # แว่นตา
    hat = Column(String, default="none") # หมวก
    costume = Column(String, default="casual") # ชุด
    held_item = Column(String, default="none") # ของถือ
    emoji = Column(String, default="😐") # อิโมจิประจำตัว
    badge_color = Column(String, default="#4ade80") # สีป้ายพนักงาน

    # การตั้งค่า AI ประจำตัว Agent
    provider_id = Column(Integer, nullable=True) # อ้างอิง ID ของ ProviderModel
    model_name = Column(String, nullable=True) # เช่น gemini-1.5-flash, llama-3-8b

    # เป้าหมายและความนึกคิด
    goals = Column(String, nullable=True, default="[]") # เก็บเป็น JSON string ของเป้าหมาย

class MapItemModel(Base):
    __tablename__ = "map_items"
    
    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String, nullable=False) # e.g. "desk", "couch", "plant"
    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    rotation = Column(Integer, default=0) # 0, 90, 180, 270
    z_index = Column(Integer, default=1)
    
class RoomModel(Base):
    __tablename__ = "rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    width = Column(Float, default=100.0)
    height = Column(Float, default=100.0)
    color = Column(String, default="#38bdf8")

class ProviderModel(Base):
    __tablename__ = "providers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # e.g. "My Local LM Studio", "Google Gemini"
    provider_type = Column(String, nullable=False) # "openai_compatible", "gemini"
    base_url = Column(String, nullable=True)
    api_key = Column(String, nullable=True)

class SettingModel(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)

class TaskModel(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Todo") # Todo, In Progress, Review, Done
    agent_id = Column(Integer, nullable=True) # ID ของ Agent ที่รับงานนี้ไปทำ
    pipeline_stage = Column(String, default="pending") # pending, planning, coding, designing, testing, security, deploying, reviewing, done
    pipeline_context = Column(Text, default="") # สะสม context จากทุกขั้นตอนของ pipeline

class MemoryModel(Base):
    __tablename__ = "memories"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, index=True, nullable=False)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384)) # For all-MiniLM-L6-v2 which has 384 dimensions
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MeetingModel(Base):
    __tablename__ = "meetings"
    
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False)
    status = Column(String, default="Scheduled") # Scheduled, In Progress, Completed
    participants = Column(String, nullable=False) # JSON string array of agent IDs: "[1, 2, 3]"
    meeting_type = Column(String, default="team") # 1-on-1, team, department, company
    transcript = Column(Text, nullable=True, default="")
    summary = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True) # JSON array of auto-generated tasks
    created_at = Column(DateTime, default=datetime.datetime.utcnow)