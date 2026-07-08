import os
import json
import re
from typing import List, Dict, Any
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Gemini API key
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

def get_offline_mock_response(subject: str, body: str, knowledge_base: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    A lightweight, deterministic fallback logic that simulates AI behavior.
    Uses regex keyword matching to categorize and draft responses based on the local knowledge base.
    """
    content = (subject + " " + body).lower()
    res = {}
    
    # 1. Detect Spam
    if any(keyword in content for keyword in ["crypto", "bitcoin", "rewards", "claim your", "free cash", "viagra", "million dollars"]):
        res = {
            "category": "spam",
            "sentiment": "neutral",
            "confidence": 0.95,
            "ai_draft": "[Automated Filter] This email has been marked as spam. No response drafted."
        }
    
    # 2. Detect Technical Support
    elif any(keyword in content for keyword in ["fail", "error", "bug", "broken", "connect", "integration", "slack", "api", "auth", "loading"]):
        category = "support"
        sentiment = "negative" if any(keyword in content for keyword in ["urgent", "bad", "angry", "terrible", "worst", "blocking", "asap"]) else "neutral"
        
        # Find technical answers in knowledge base
        tech_answer = next((item["answer"] for item in knowledge_base if item["category"] == "technical"), 
                           "Our technical support team has been notified. We will inspect our integration logs and get back to you within 2-4 hours.")
        
        draft = (
            f"Hello,\n\n"
            f"Thank you for contacting SaaSify support. I understand you are experiencing an issue with your integration.\n\n"
            f"{tech_answer}\n\n"
            f"If you continue to experience problems, please reply to this email directly with any screenshot or error log details.\n\n"
            f"Best regards,\nSaaSify Support Bot (Offline Mode)"
        )
        res = {
            "category": category,
            "sentiment": sentiment,
            "confidence": 0.85,
            "ai_draft": draft
        }
        
    # 3. Detect Pricing / Lead
    elif any(keyword in content for keyword in ["price", "pricing", "cost", "quote", "discount", "plan", "subscription", "trial", "buy", "purchase"]):
        category = "lead"
        sentiment = "positive" if any(keyword in content for keyword in ["interested", "looking at", "excited", "love"]) else "neutral"
        
        pricing_answer = next((item["answer"] for item in knowledge_base if item["category"] == "pricing"), 
                             "SaaSify offers flexible plans starting at $19/month. Please contact sales@saasify.co for detailed pricing.")
        
        draft = (
            f"Hello,\n\n"
            f"Thank you for your interest in SaaSify! We'd love to help you and your team get set up.\n\n"
            f"{pricing_answer}\n\n"
            f"We also offer a 14-day free trial so you can explore the features before committing. Let me know if you would like me to connect you with one of our account executives for a live demo.\n\n"
            f"Best regards,\nSaaSify Sales Assistant (Offline Mode)"
        )
        res = {
            "category": category,
            "sentiment": sentiment,
            "confidence": 0.90,
            "ai_draft": draft
        }

    # 4. Default / General
    else:
        general_answer = next((item["answer"] for item in knowledge_base if item["category"] == "general"), 
                             "SaaSify is an all-in-one project management and workspace automation platform.")
        
        draft = (
            f"Hello,\n\n"
            f"Thank you for reaching out to SaaSify.\n\n"
            f"{general_answer}\n\n"
            f"If you have any other specific questions about our services or need help getting started, feel free to ask!\n\n"
            f"Best regards,\nSaaSify Assistant (Offline Mode)"
        )
        res = {
            "category": "general",
            "sentiment": "neutral",
            "confidence": 0.70,
            "ai_draft": draft
        }
        
    res["raw_prompt"] = f"Local Offline Fallback Parser Context:\n- Subject: {subject}\n- Body length: {len(body)} chars\n- Match Rule: Regex keyword mapping\n- KB items searched: {len(knowledge_base)}"
    res["raw_response"] = json.dumps(res, indent=2)
    return res

def run_agent(subject: str, body: str, knowledge_items: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Main agent orchestration logic. Attempts to use Gemini 1.5 Flash for reasoning,
    falling back to local keyword rule-matching if API keys or connections fail.
    """
    api_key_loaded = os.getenv("GEMINI_API_KEY")
    
    if not api_key_loaded:
        print("[AI AGENT] No GEMINI_API_KEY found in environment. Running in OFFLINE mock fallback mode...")
        return get_offline_mock_response(subject, body, knowledge_items)

    try:
        # Prepare context from knowledge base
        kb_context = "\n---\n".join([
            f"Category: {item['category']}\nQuestion: {item['question']}\nAnswer: {item['answer']}"
            for item in knowledge_items
        ])
        
        prompt = f"""
You are a smart, customer-focused AI Support & Sales Agent for a project management SaaS company named 'SaaSify'.
Your job is to read an incoming customer email, analyze it, and write a professional draft reply.

Here is the company's Knowledge Base context to base your replies on:
{kb_context}

---

Incoming Email details:
Subject: {subject}
Body: {body}

---

Instructions:
1. Categorize the email into exactly one of: 'lead', 'support', 'spam', 'general'.
2. Identify the sender's sentiment as one of: 'positive', 'neutral', 'negative'.
3. Assign a confidence score from 0.0 to 1.0 representing how confident you are in your response.
4. Draft a helpful, concise, and polite response email addressing the customer's query.
   - You MUST stick to the facts inside the provided Knowledge Base. Do NOT make up pricing or integrations not mentioned.
   - If the answer is NOT in the Knowledge Base, politely explain that you've escalated this inquiry to a human agent who will get back to them shortly.
   - If the category is 'spam', set the reply draft to '[Spam Filtered] No response drafted.'
5. Output your response as a valid JSON object matching this structure EXACTLY:
{{
  "category": "lead" | "support" | "spam" | "general",
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": 0.95,
  "ai_draft": "Your drafted response email text..."
}}

Ensure you return ONLY a clean JSON block. Do not include markdown wraps like ```json ... ``` in your output.
"""
        
        # Configure model
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Generate content
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        # Parse JSON output
        result = json.loads(response.text.strip())
        print(f"[AI AGENT] Gemini processed email successfully. Category: {result.get('category')}")
        return {
            "category": result.get("category", "general"),
            "sentiment": result.get("sentiment", "neutral"),
            "confidence": float(result.get("confidence", 0.8)),
            "ai_draft": result.get("ai_draft", ""),
            "raw_prompt": prompt,
            "raw_response": response.text
        }

    except Exception as e:
        print(f"[AI AGENT] Error during Gemini API execution: {str(e)}. Falling back to OFFLINE mock mode...")
        return get_offline_mock_response(subject, body, knowledge_items)
