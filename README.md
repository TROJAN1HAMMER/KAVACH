# KAVACH 🛡️
**AI-Powered DevSecOps Security Platform for Banking & Financial Applications**

KAVACH is a comprehensive, zero-infrastructure DevSecOps prototype built to detect vulnerabilities, evaluate regulatory compliance, and predict zero-day risks in financial software. It automates security scanning and provides actionable, business-focused insights using the Google Gemini AI engine.

## 🌟 Key Features

- **Banking Risk Score (BRS):** A proprietary metric calculating the financial and operational risk of vulnerabilities based on CVSS, module criticality, and exploitability.
- **Regulatory Compliance Mapping:** Automatically maps detected vulnerabilities to strict financial regulations including **RBI IT Framework 2021, PCI-DSS v4.0, and SWIFT CSP**.
- **AI-Powered Insights:** Uses Google Gemini to translate highly technical vulnerabilities into plain-language business impact and provides specific, actionable remediation steps.
- **Zero-Day Risk Prediction:** Analyzes outdated dependencies and high-risk code patterns to estimate the probability of unknown vulnerabilities.
- **Comprehensive Reporting:** Generates professional Executive PDFs, SARIF (Static Analysis Results Interchange Format) exports, and CycloneDX Software Bill of Materials (SBOM).
- **Zero-Infrastructure Local Storage:** Runs completely locally using thread-safe JSON persistence—no PostgreSQL or Docker required.

## 🏗️ Architecture

- **Backend:** FastAPI, Python 3.11+, asyncio threading, ReportLab.
- **Frontend:** React, TypeScript, Vite, Tailwind CSS v4, Framer Motion.
- **AI Engine:** Google Gemini.
- **Scanners Integrated:** Semgrep (Static Analysis), Pip-Audit (Dependency Scanning), Pattern-based Config Scanning.

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend Setup

Navigate to the backend directory and install dependencies:
```bash
cd backend
python3 -m venv venv
source venv/bin/activatef
pip install -r requirements.txt
```

Set up your environment variables by creating a `.env` file in the `backend` directory (a template is provided as `.env.example`):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the FastAPI server:
```bash
uvicorn app.main:app --reload
```
*The API will be available at `http://localhost:8000`.*

### 2. Frontend Setup

In a new terminal, navigate to the frontend directory:
```bash
cd frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*The dashboard will be available at `http://localhost:5173`.*

## 💻 Usage

1. Open the frontend dashboard in your browser.
2. Compress a target source code repository into a `.zip` file.
3. Drag and drop the `.zip` file into the KAVACH upload zone.
4. Watch the pipeline extract, scan, aggregate, and analyze the codebase in real-time.
5. Review the resulting Banking Risk Score, Compliance Violations, and AI Insights.
6. Download the generated PDF, SARIF, and SBOM reports.

## 📂 Project Structure

```text
Kavach/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints
│   │   ├── schemas/         # Pydantic data models
│   │   ├── services/        # Orchestrator, Scanners, AI Engine, BRS Engine
│   │   ├── storage/         # JSON persistence engine (local_store.py)
│   │   └── data/            # Compliance mappings
│   ├── data/                # Local JSON persistence storage
│   ├── reports/             # Generated PDF, SARIF, and SBOM artifacts
│   ├── uploads/             # Temporary storage for extracted ZIPs
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # React UI Components (Dashboard, AI Insights, etc.)
│   │   ├── lib/             # API client and UI utilities
│   │   ├── App.tsx          # Main React Application
│   │   └── index.css        # Tailwind CSS configuration and glassmorphism tokens
│   └── package.json         # Node dependencies
└── README.md
```

## 📜 License
This prototype was developed for hackathon demonstration purposes.
