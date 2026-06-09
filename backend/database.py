from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

import os

# 1. ที่อยู่ของฐานข้อมูล PostgreSQL ใน Docker ของเรา
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:supersecretpassword@localhost:5432/ai_company_db")

# 2. สร้างตัวขับเคลื่อนหลัก (Engine)
engine = create_engine(DATABASE_URL)

# 3. สร้างห้องสำหรับเปิด-ปิด Connection (Session)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. ตัวแม่สำหรับสร้างตารางในอนาคต
Base = declarative_base()

# 5. ฟังก์ชันสำหรับให้โค้ดส่วนอื่นหยิบฐานข้อมูลไปใช้ แล้วปิดให้ฟัตโนมัติเมื่อใช้เสร็จ
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()