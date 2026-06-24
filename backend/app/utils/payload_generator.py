"""
KAVACH — Pre-made Payload Generator
Generates three ZIP files (low_risk, medium_risk, high_risk) for sandbox testing.
"""

import io
import os
import zipfile
from pathlib import Path
import structlog

logger = structlog.get_logger(__name__)


# ── Payload Files Configuration ───────────────────────────────────────────────

LOW_RISK_FILES = {
    "requirements.txt": (
        "fastapi==0.110.0\n"
        "pydantic==2.6.4\n"
    ),
    "main.py": (
        "from fastapi import FastAPI\n\n"
        "app = FastAPI(title='Secure Banking API')\n\n"
        "@app.get('/')\n"
        "def read_root():\n"
        "    return {'status': 'healthy', 'platform': 'Kavach-Secure-Sandbox'}\n\n"
        "@app.get('/accounts/{account_id}')\n"
        "def get_account(account_id: str):\n"
        "    # Secure parameterization used downstream\n"
        "    return {'account_id': account_id, 'type': 'checking'}\n"
    ),
    ".env": (
        "DEBUG=false\n"
        "SSL_ENABLED=true\n"
        "ALLOWED_ORIGINS=https://kavach-secure-banking.com\n"
    ),
    "Dockerfile": (
        "FROM python:3.11-slim\n"
        "WORKDIR /app\n"
        "COPY requirements.txt .\n"
        "RUN pip install --no-cache-dir -r requirements.txt\n"
        "COPY . .\n"
        "EXPOSE 8080\n"
        "CMD ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8080']\n"
    )
}

MEDIUM_RISK_FILES = {
    "requirements.txt": (
        "requests==2.26.0\n"
        "jinja2==3.0.1\n"
    ),
    "main.py": (
        "import random\n"
        "import hashlib\n"
        "import os\n"
        "from fastapi import FastAPI, HTTPException\n\n"
        "app = FastAPI(title='Semi-Secure Banking API')\n\n"
        "@app.get('/generate-session-id')\n"
        "def generate_session_id():\n"
        "    # INSECURE: Standard random module is not cryptographically secure (CWE-330)\n"
        "    session_id = str(random.random())\n"
        "    return {'session_id': session_id}\n\n"
        "@app.get('/verify-checksum')\n"
        "def verify_checksum(data: str):\n"
        "    # INSECURE: SHA-1 is deprecated for security hashes (CWE-327)\n"
        "    h = hashlib.sha1(data.encode()).hexdigest()\n"
        "    return {'sha1': h}\n\n"
        "@app.get('/read-document')\n"
        "def read_document(doc_path: str):\n"
        "    # INSECURE: Path Traversal vulnerability (CWE-22)\n"
        "    base_dir = '/app/documents'\n"
        "    full_path = os.path.join(base_dir, doc_path)\n"
        "    with open(full_path, 'r') as f:\n"
        "        return {'content': f.read()}\n"
    ),
    ".env": (
        "DEBUG=false\n"
        "SSL_ENABLED=true\n"
        "allow_origins=*\n"
    ),
    "Dockerfile": (
        "FROM python:3.11-slim\n"
        "WORKDIR /app\n"
        "COPY requirements.txt .\n"
        "RUN pip install --no-cache-dir -r requirements.txt\n"
        "COPY . .\n"
        "# INSECURE: Exposing database port publicly (CWE-668)\n"
        "EXPOSE 3306\n"
        "CMD ['python', 'main.py']\n"
    )
}

HIGH_RISK_FILES = {
    "requirements.txt": (
        "pyyaml==5.3\n"
        "django==3.2\n"
        "cryptography==3.3\n"
    ),
    "main.py": (
        "import os\n"
        "import pickle\n"
        "import yaml\n"
        "from fastapi import FastAPI\n\n"
        "app = FastAPI(title='Vulnerable Banking API')\n\n"
        "# INSECURE: Hardcoded credentials (CWE-798)\n"
        "AWS_ACCESS_KEY_ID = 'AKIA1234567890ABCDEF'\n"
        "API_KEY = 'AIzaSyD-1234567890ABCDEF'\n"
        "DB_PASSWORD = 'admin'\n\n"
        "@app.get('/login')\n"
        "def login(username: str):\n"
        "    # INSECURE: SQL Injection via string formatting (CWE-89)\n"
        "    query = f'SELECT * FROM accounts WHERE username = \"{username}\"'\n"
        "    return {'query': query, 'status': 'simulated_execution'}\n\n"
        "@app.get('/load-config')\n"
        "def load_config(user_yaml: str):\n"
        "    # INSECURE: Unsafe yaml.load (CWE-502)\n"
        "    data = yaml.load(user_yaml)\n"
        "    return {'yaml_data': str(data)}\n\n"
        "@app.get('/deserialize')\n"
        "def deserialize(user_data: bytes):\n"
        "    # INSECURE: Unsafe deserialization with pickle (CWE-502)\n"
        "    obj = pickle.loads(user_data)\n"
        "    return {'status': 'deserialized'}\n\n"
        "@post('/ping-host')\n"
        "def ping_host(host: str):\n"
        "    # INSECURE: Command injection via os.system (CWE-78)\n"
        "    cmd = f'ping -c 1 {host}'\n"
        "    os.system(cmd)\n"
        "    return {'status': 'executed'}\n"
    ),
    ".env": (
        "# INSECURE: DEBUG mode active, secret key leaks, SSL disabled (CWE-16)\n"
        "DEBUG=true\n"
        "SECRET_KEY=django-insecure-development-placeholder-key\n"
        "SSL_ENABLED=false\n"
        "aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n"
        "verify_ssl=false\n"
    ),
    "Dockerfile": (
        "FROM python:3.11-slim\n"
        "WORKDIR /app\n"
        "COPY requirements.txt .\n"
        "RUN pip install --no-cache-dir -r requirements.txt\n"
        "COPY . .\n"
        "# INSECURE: Exposing privileged services and ports\n"
        "EXPOSE 22\n"
        "EXPOSE 5432\n"
    )
}


def _create_zip_file(files: dict[str, str], output_path: Path):
    """Write the dictionary of filenames and contents into a ZIP file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for filename, content in files.items():
            zip_file.writestr(filename, content)


def generate_premade_payloads(data_dir: Path):
    """Generate the pre-made ZIP payloads if they do not exist."""
    payloads_dir = data_dir / "payloads"
    payloads_dir.mkdir(parents=True, exist_ok=True)

    configs = [
        ("low_risk.zip", LOW_RISK_FILES),
        ("medium_risk.zip", MEDIUM_RISK_FILES),
        ("high_risk.zip", HIGH_RISK_FILES),
    ]

    for filename, files_dict in configs:
        zip_path = payloads_dir / filename
        if not zip_path.exists():
            logger.info("payload_generator.creating", file=filename)
            try:
                _create_zip_file(files_dict, zip_path)
                logger.info("payload_generator.created_successfully", file=filename)
            except Exception as exc:
                logger.exception("payload_generator.failed_to_create", file=filename, error=str(exc))
        else:
            logger.debug("payload_generator.exists", file=filename)
