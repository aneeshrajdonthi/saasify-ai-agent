[![Portfolio](https://img.shields.io/badge/Developer_Portfolio-Aneesh_Raj_Donthi-f59e0b.svg?style=for-the-badge&logo=github)](https://github.com/aneeshrajdonthi/freelanceportfolio)

# SaaSify: AI Support Agent & Business Automation Dashboard

👨‍💻 **Developer Portfolio:** [https://github.com/aneeshrajdonthi/freelanceportfolio](https://github.com/aneeshrajdonthi/freelanceportfolio)

![Developer Portfolio Preview](portfolio-preview.png)

SaaSify is a production-grade, local-friendly, and containerized **AI-Powered Customer Support & Email Automation Agent**. It automates inbox sorting, sentiment analysis, context search, and custom response drafting, providing support teams with an interactive glassmorphic dashboard to inspect AI reasoning.

![Dashboard Preview](https://raw.githubusercontent.com/your-username/your-repo-name/main/preview.png) *(Replace this with a screenshot of your running dashboard)*

---

## 🚀 Key Features

* **Agentic Reasoning (Gemini 2.5 Flash):** Reads incoming emails, performs zero-shot classification, gauges sender sentiment, and drafts context-aware responses.
* **Knowledge Base Context Injector:** Includes a CRUD policy editor. The AI agent dynamically queries this database to answer specific customer inquiries (e.g., pricing, technical steps, refunds) without hallucination.
* **AI Logs & Telemetry Console:** Full developer/operator transparency. Displays the exact system instructions, context variables, raw prompt, and raw JSON returned by the model for real-time debugging.
* **Local CSV Exporter:** One-click report utility that exports processed logs, categorizations, and replies into an Excel-ready CSV format.
* **Real-time Toast Alerts:** Modern notification toast overlays that alert operators when new emails are simulated in the background.
* **Offline Mock Fallback:** Seamlessly degrades to a local deterministic regex responder if no Gemini API Key is loaded in the environment.

---

## 🛠️ Technology Stack

* **Backend:** FastAPI, Python, SQLite (local database), SQLAlchemy (ORM), Google Generative AI SDK, Pydantic, Uvicorn.
* **Frontend:** React.js, Vite, Custom CSS (Minimalist Dark Glassmorphism, animated glows, hover micro-animations).
* **Containerization:** Docker, Multi-Stage Dockerfile (React + Nginx), Docker Compose.

---

## 🏃‍♂️ Getting Started

Make sure you have [Node.js](https://nodejs.org/) and [Python 3.10+](https://www.python.org/) installed.

### Method 1: Running Locally (Recommended for Development)

#### 1. Clone the project and navigate to the directory
```bash
git clone https://github.com/your-username/saasify-ai-agent.git
cd saasify-ai-agent
```

#### 2. Set up the Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If left blank, the app will run in Offline Mock Mode).*

Initialize the database and start the API:
```bash
python database.py
uvicorn main:app --reload
```
The backend API documentation is available at `http://127.0.0.1:8000/docs`.

#### 3. Set up the Frontend
Open a new terminal window at the project root:
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

---

### Method 2: Running via Docker Compose (Single-Command Run)

To run the entire multi-container service in production mode:
1. Open a terminal at the project root folder.
2. Run:
   ```bash
   docker-compose up --build
   ```
3. Access the web dashboard at **[http://localhost:5173/](http://localhost:5173/)**.

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
