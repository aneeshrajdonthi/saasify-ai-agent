import random
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import SessionLocal, init_db, Email, KnowledgeItem
from agent import run_agent

# Initialize FastAPI App
app = FastAPI(title="SaaSify AI Agent Automation API")

import os
@app.get("/api/status")
def get_api_status():
    api_key = os.getenv("GEMINI_API_KEY")
    return {
        "status": "online",
        "gemini_active": bool(api_key and api_key != "your_gemini_api_key_here" and api_key.strip() != "")
    }

# Configure CORS so React app can talk to it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to verify database initialization
@app.on_event("startup")
def startup_event():
    init_db()

# DB Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schemas
class EmailResponse(BaseModel):
    id: int
    sender: str
    subject: str
    body: str
    status: str
    category: str
    sentiment: str
    confidence: float
    ai_draft: Optional[str] = None
    raw_prompt: Optional[str] = None
    raw_response: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

class KnowledgeItemSchema(BaseModel):
    id: Optional[int] = None
    category: str
    question: str
    answer: str

    class Config:
        from_attributes = True

class SendReplyRequest(BaseModel):
    reply_body: str

# Email Templates for Simulation
SIMULATED_TEMPLATES = [
    {
        "sender": "sarah.jenkins@techcorp.io",
        "subject": "Discount for non-profits?",
        "body": "Hi there! I am the Operations Manager at a local charity. We work on providing educational resources to kids. We really like SaaSify and want to use it for our project tracking. Do you offer special pricing or discounts for non-profit organizations?"
    },
    {
        "sender": "dev_guy_alex@hotmail.com",
        "subject": "Can we host SaaSify on-premise?",
        "body": "Hello, our company has a strict data privacy policy and we cannot use cloud-hosted software. Do you have a self-hosted or on-premise version of SaaSify? Also, does it support LDAP authentication?"
    },
    {
        "sender": "spammer_bob@wealthy-fast.biz",
        "subject": "!!! WEBCAM OFFER !!! VERY LOW PRICE !!!",
        "body": "Buy high quality HD webcams for your team starting from $4.99! Limited stock, buy bulk to get free shipping. Click here to purchase now before prices double tomorrow!"
    },
    {
        "sender": "mike_smith@consulting.com",
        "subject": "Does SaaSify connect to Microsoft Teams?",
        "body": "Hello sales team, our company is heavily invested in the Microsoft stack. We want to know if SaaSify has an integration with Microsoft Teams. If so, how can we set it up to send alerts whenever a task is completed?"
    },
    {
        "sender": "disappointed_user@gmail.com",
        "subject": "Want a refund - dashboard is too slow",
        "body": "I purchased the Pro plan yesterday but the main dashboard takes like 10 seconds to load every time I log in. This is unusable for me. I would like to cancel my plan and request a full refund please."
    },
    {
        "sender": "partnership@ventures-group.com",
        "subject": "Investment/Partnership Proposal",
        "body": "Dear founders, we have been tracking SaaSify's growth in the project management space and are highly impressed. We are an early-stage venture capital firm and would love to chat about a potential funding round or partnership opportunities. Let me know if you have time for a short call next week."
    }
]

# Helper function to convert model instances to dicts or schemas with ISO strings
def format_email_response(email: Email) -> dict:
    return {
        "id": email.id,
        "sender": email.sender,
        "subject": email.subject,
        "body": email.body,
        "status": email.status,
        "category": email.category,
        "sentiment": email.sentiment,
        "confidence": email.confidence,
        "ai_draft": email.ai_draft,
        "raw_prompt": email.raw_prompt,
        "raw_response": email.raw_response,
        "created_at": email.created_at.isoformat()
    }

# Routes
@app.get("/api/emails")
def get_emails(db: Session = Depends(get_db)):
    emails = db.query(Email).order_by(Email.created_at.desc()).all()
    return [format_email_response(e) for e in emails]

@app.post("/api/emails/simulate")
def simulate_email(db: Session = Depends(get_db)):
    template = random.choice(SIMULATED_TEMPLATES)
    
    # Check if we should randomize the sender address a bit to avoid exact repeats
    random_id = random.randint(100, 999)
    name_parts = template["sender"].split("@")
    sender = f"{name_parts[0]}_{random_id}@{name_parts[1]}"
    
    new_email = Email(
        sender=sender,
        subject=template["subject"],
        body=template["body"],
        status="pending_review",
        category="uncategorized",
        sentiment="neutral"
    )
    db.add(new_email)
    db.commit()
    db.refresh(new_email)
    return format_email_response(new_email)

@app.post("/api/emails/{email_id}/process")
def process_email(email_id: int, db: Session = Depends(get_db)):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
        
    # Get all knowledge items for context
    knowledge_items = db.query(KnowledgeItem).all()
    kb_list = [
        {"category": item.category, "question": item.question, "answer": item.answer}
        for item in knowledge_items
    ]
    
    # Run the Agentic process
    agent_output = run_agent(email.subject, email.body, kb_list)
    
    # Update Email record
    email.category = agent_output.get("category", "general")
    email.sentiment = agent_output.get("sentiment", "neutral")
    email.confidence = agent_output.get("confidence", 0.0)
    email.ai_draft = agent_output.get("ai_draft", "")
    email.raw_prompt = agent_output.get("raw_prompt", "")
    email.raw_response = agent_output.get("raw_response", "")
    
    # If categorized as spam, we can auto-resolve it
    if email.category == "spam":
        email.status = "ignored"
        
    db.commit()
    db.refresh(email)
    return format_email_response(email)

@app.post("/api/emails/{email_id}/send")
def send_email_reply(email_id: int, payload: SendReplyRequest, db: Session = Depends(get_db)):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
        
    # Update status to replied and save the actual final response sent
    email.status = "replied"
    email.ai_draft = payload.reply_body
    db.commit()
    db.refresh(email)
    return format_email_response(email)

@app.post("/api/emails/{email_id}/ignore")
def ignore_email(email_id: int, db: Session = Depends(get_db)):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
        
    email.status = "ignored"
    db.commit()
    db.refresh(email)
    return format_email_response(email)

@app.get("/api/knowledge", response_model=List[KnowledgeItemSchema])
def get_knowledge(db: Session = Depends(get_db)):
    return db.query(KnowledgeItem).all()

@app.post("/api/knowledge", response_model=KnowledgeItemSchema)
def add_knowledge_item(item: KnowledgeItemSchema, db: Session = Depends(get_db)):
    new_item = KnowledgeItem(
        category=item.category,
        question=item.question,
        answer=item.answer
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.delete("/api/knowledge/{item_id}")
def delete_knowledge_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    db.delete(item)
    db.commit()
    return {"message": "Knowledge item deleted successfully"}
