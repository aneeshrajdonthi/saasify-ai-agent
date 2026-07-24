import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database URL
DATABASE_URL = "sqlite:///./automation.db"

# Create engine and sessionmaker
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String, index=True)
    subject = Column(String)
    body = Column(Text)
    status = Column(String, default="pending_review")  # pending_review, replied, ignored
    category = Column(String, default="uncategorized")  # lead, support, spam, general
    sentiment = Column(String, default="neutral")       # positive, negative, neutral
    confidence = Column(Float, default=0.0)
    ai_draft = Column(Text, nullable=True)
    raw_prompt = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class KnowledgeItem(Base):
    __tablename__ = "knowledge"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True) # general, pricing, technical
    question = Column(String)
    answer = Column(Text)

# Create tables
def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if database already has data, if not seed it
        if db.query(KnowledgeItem).count() == 0:
            seed_knowledge(db)
        if db.query(Email).count() == 0:
            seed_emails(db)
    finally:
        db.close()

def seed_knowledge(db):
    items = [
        KnowledgeItem(
            category="pricing",
            question="What are your pricing plans?",
            answer="SaaSify offers three plans: \n1. Starter: $19/month for up to 5 users.\n2. Pro: $49/month for up to 20 users and standard integrations.\n3. Enterprise: $149/month for unlimited users, custom API access, and 24/7 dedicated support. We also offer a 14-day free trial for Starter and Pro plans."
        ),
        KnowledgeItem(
            category="technical",
            question="Do you support integrations with other platforms?",
            answer="Yes! SaaSify integrates natively with Slack, Google Drive, Microsoft Teams, and GitHub. For custom integrations, our Enterprise plan includes API access and webhook support, allowing you to connect SaaSify with any software stack."
        ),
        KnowledgeItem(
            category="general",
            question="How can I cancel my subscription or get a refund?",
            answer="You can cancel your subscription at any time directly from the billing section in your Account Settings. We offer a 30-day money-back guarantee for all new subscriptions. If you are unsatisfied, contact billing@saasify.co within 30 days of purchase for a full refund."
        ),
        KnowledgeItem(
            category="general",
            question="What is SaaSify?",
            answer="SaaSify is an all-in-one project management and workspace automation platform. It helps teams collaborate, track tasks, automate reporting, and connect different cloud platforms in a unified, modern interface."
        )
    ]
    db.add_all(items)
    db.commit()

def seed_emails(db):
    emails = [
        Email(
            sender="john.doe@gmail.com",
            subject="Pricing query for 15 users",
            body="Hello team,\n\nI am looking at SaaSify for my agency. We have a team of 15 people. Which plan would be best for us and is there a discount for annual billing? Thanks!",
            status="pending_review",
            category="uncategorized",
            sentiment="neutral"
        ),
        Email(
            sender="angry_client99@yahoo.com",
            subject="URGENT: Integration keeps failing",
            body="Hey, I tried connecting SaaSify to our Slack channel but it gives me an 'auth_error' code 403 every single time. This is blocking our launch. Can someone fix this asap??",
            status="pending_review",
            category="uncategorized",
            sentiment="neutral"
        ),
        Email(
            sender="crypto-rewards@spambot.net",
            subject="Earn $5000/day guaranteed with zero effort!!!",
            body="DEAR FRIEND, CLICK THIS LINK TO CLAIM YOUR FREE BITCOIN REWARDS RIGHT NOW. LIMITED TIME OFFER, DON'T MISS OUT ON THIS SECURE FINANCIAL OPPORTUNITY!!!",
            status="pending_review",
            category="uncategorized",
            sentiment="neutral"
        )
    ]
    db.add_all(emails)
    db.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
