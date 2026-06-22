"""
KAVACH — AI Risk Explanation Engine
Uses Google Gemini API to generate business-language explanations of security findings.

For each finding, generates:
  1. Plain-language vulnerability explanation
  2. Banking-specific business impact
  3. Why auditors (RBI / PCI-DSS / SWIFT) care
  4. Suggested remediation steps

Includes:
  - Graceful degradation (returns template explanation if Gemini unavailable)
  - Rate limiting with exponential backoff (tenacity)
  - Response caching to avoid redundant API calls for similar categories

Input:  RawFinding, compliance_data
Output: AIInsight (explanation, business_impact, remediation)
"""

import hashlib
import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional
import structlog
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.config import get_settings
from app.schemas.finding import RawFinding
from app.services.compliance_mapper import ComplianceMappingData

logger = structlog.get_logger(__name__)
settings = get_settings()


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class AIInsight:
    explanation: str
    business_impact: str
    remediation: str
    generated_by: str = "gemini"  # "gemini" | "template"


# ── Gemini Client ─────────────────────────────────────────────────────────────

def _get_gemini_model():
    """Initialize Gemini model. Returns None if API key not configured."""
    if not settings.gemini_api_key:
        logger.warning("ai_engine.gemini_key_not_set — using template fallback")
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        return genai.GenerativeModel(settings.gemini_model)
    except ImportError:
        logger.warning("ai_engine.google_generativeai_not_installed")
        return None
    except Exception as exc:
        logger.error("ai_engine.gemini_init_error", error=str(exc))
        return None


# ── Prompt Builder ────────────────────────────────────────────────────────────

def _build_prompt(finding: RawFinding, compliance: Optional[ComplianceMappingData]) -> str:
    compliance_section = ""
    if compliance:
        compliance_section = f"""
Regulatory Mappings:
- RBI IT Framework 2021: {compliance.rbi_clause or 'N/A'}
- PCI DSS v4.0: {compliance.pci_clause or 'N/A'}
- SWIFT CSP: {compliance.swift_clause or 'N/A'}
"""

    return f"""You are a senior cybersecurity expert specializing in banking and financial systems security.

A security scan has found the following vulnerability in a banking application:

Vulnerability Title: {finding.title}
Severity: {finding.severity}
Category: {finding.category}
CVSS Score: {finding.cvss}
File: {finding.file_path or 'N/A'}
Line: {finding.line_number or 'N/A'}
Description: {finding.description}
{compliance_section}

Please provide a structured analysis in the following exact JSON format (no markdown, just JSON):

{{
  "explanation": "2-3 sentence plain language explanation of what this vulnerability is and how it can be exploited. Avoid technical jargon.",
  "business_impact": "2-3 sentences explaining the specific business impact on a banking institution — financial loss, regulatory penalties, reputational damage, customer data risk.",
  "why_auditors_care": "1-2 sentences explaining why RBI/PCI-DSS/SWIFT auditors specifically flag this type of issue.",
  "remediation": "3-5 concrete, actionable steps to fix this vulnerability. Be specific to the technology and context."
}}

Focus on banking context: payment systems, customer data, regulatory compliance, and financial risk.
Respond with ONLY the JSON object. No preamble, no markdown."""


# ── Template Fallback ─────────────────────────────────────────────────────────

TEMPLATE_INSIGHTS: dict[str, dict] = {
    "hardcoded_secret": {
        "explanation": (
            "Hardcoded secrets embed sensitive credentials (API keys, passwords, tokens) "
            "directly in source code. When code is shared via version control or decompiled, "
            "attackers gain immediate access to these credentials."
        ),
        "business_impact": (
            "Exposed credentials in banking systems can lead to unauthorized account access, "
            "fraudulent transactions, and complete system compromise. "
            "RBI guidelines mandate immediate incident reporting and can result in operational restrictions."
        ),
        "remediation": (
            "1. Remove the hardcoded secret from source code immediately. "
            "2. Rotate/revoke the exposed credential. "
            "3. Store secrets in environment variables or a secrets manager (HashiCorp Vault, AWS Secrets Manager). "
            "4. Implement pre-commit hooks to scan for secrets before code is committed. "
            "5. Audit git history for any previously committed secrets."
        ),
    },
    "sql_injection": {
        "explanation": (
            "SQL Injection occurs when user-controlled input is inserted directly into database queries. "
            "Attackers can manipulate the query to read, modify, or delete data, "
            "and in some cases execute commands on the database server."
        ),
        "business_impact": (
            "In banking systems, SQL injection can expose complete customer account databases, "
            "enable fraudulent fund transfers, and compromise transaction records. "
            "This constitutes a reportable data breach under RBI and DPDP Act, "
            "with potential fines and license implications."
        ),
        "remediation": (
            "1. Replace string concatenation with parameterized queries or prepared statements. "
            "2. Use ORM frameworks (SQLAlchemy, Hibernate) which provide automatic parameterization. "
            "3. Implement input validation and allowlisting. "
            "4. Apply principle of least privilege for database accounts. "
            "5. Deploy a Web Application Firewall (WAF) as an additional layer."
        ),
    },
    "weak_cryptography": {
        "explanation": (
            "Weak cryptographic algorithms (MD5, SHA-1, DES, RC4) have known mathematical weaknesses "
            "that allow attackers to break the encryption, forge signatures, or reverse hashes "
            "using modern computing resources."
        ),
        "business_impact": (
            "Banking data protected with weak cryptography can be decrypted by sophisticated adversaries. "
            "Customer PINs, card data, and transaction records could be exposed. "
            "PCI-DSS 4.0 explicitly prohibits weak ciphers for cardholder data protection."
        ),
        "remediation": (
            "1. Replace MD5/SHA-1 with SHA-256 or SHA-3 for hashing. "
            "2. Replace DES/3DES with AES-256-GCM. "
            "3. Replace RC4 with ChaCha20-Poly1305 for stream encryption. "
            "4. Enforce TLS 1.2+ for all communications (disable TLS 1.0/1.1). "
            "5. Implement a cryptographic algorithm policy and review cycle."
        ),
    },
    "unsafe_deserialization": {
        "explanation": (
            "Unsafe deserialization allows attackers to craft malicious serialized objects "
            "that, when deserialized by the application, execute arbitrary code on the server. "
            "Python's pickle and PHP's unserialize are common attack vectors."
        ),
        "business_impact": (
            "Remote Code Execution (RCE) in banking servers can lead to complete system takeover, "
            "data theft, ransomware deployment, and unauthorized fund transfers. "
            "This is classified as a critical breach requiring immediate RBI notification."
        ),
        "remediation": (
            "1. Never deserialize data from untrusted sources with pickle or similar tools. "
            "2. Use safe alternatives: JSON for data exchange, yaml.safe_load() for YAML. "
            "3. Implement integrity checks (HMAC signatures) before deserializing any data. "
            "4. Apply sandboxing and process isolation for deserialization operations. "
            "5. Monitor for unusual process spawning that may indicate exploitation."
        ),
    },
    "security_misconfiguration": {
        "explanation": (
            "Security misconfigurations occur when systems are deployed with insecure default settings, "
            "unnecessary features enabled, or sensitive information exposed through configuration files. "
            "These are often the easiest vulnerabilities for attackers to exploit."
        ),
        "business_impact": (
            "Misconfigurations in banking systems can expose debug endpoints, admin interfaces, "
            "or raw database connections to the internet. "
            "This can violate RBI IS Audit requirements and PCI-DSS Requirement 2."
        ),
        "remediation": (
            "1. Apply CIS Benchmark hardening guides for all system components. "
            "2. Disable DEBUG mode in all production environments. "
            "3. Remove default credentials and enforce strong password policies. "
            "4. Restrict exposed ports to only those required for operation. "
            "5. Implement regular configuration drift detection."
        ),
    },
    "vulnerable_dependency": {
        "explanation": (
            "Vulnerable dependencies are third-party libraries included in the application "
            "that contain known security flaws. "
            "Attackers actively scan for applications using vulnerable library versions."
        ),
        "business_impact": (
            "Known CVEs in banking application dependencies are exploited in automated attacks. "
            "Financial malware specifically targets unpatched library vulnerabilities. "
            "RBI requires vulnerability remediation within defined SLA windows."
        ),
        "remediation": (
            "1. Update the affected package to the patched version immediately. "
            "2. Subscribe to vulnerability advisories (NVD, GitHub Security Advisories). "
            "3. Implement automated dependency scanning in the CI/CD pipeline. "
            "4. Maintain a Software Bill of Materials (SBOM) for all components. "
            "5. Define and enforce patch SLA policies aligned with CVSS severity."
        ),
    },
    "command_injection": {
        "explanation": (
            "Command injection occurs when user input is passed to system shell commands without validation. "
            "Attackers can inject additional commands separated by metacharacters (;, |, &&) "
            "to execute arbitrary operating system commands."
        ),
        "business_impact": (
            "OS command execution in banking servers can enable data exfiltration, "
            "lateral movement across the network, and complete server compromise. "
            "This is a severe breach scenario requiring immediate regulatory notification."
        ),
        "remediation": (
            "1. Avoid using os.system() or shell=True wherever possible. "
            "2. Use subprocess with a list of arguments (no shell interpretation). "
            "3. Validate and sanitize all user inputs against strict allowlists. "
            "4. Run application processes with minimal OS privileges. "
            "5. Implement process monitoring and anomaly detection for unexpected child processes."
        ),
    },
}

DEFAULT_TEMPLATE = {
    "explanation": (
        "A security vulnerability has been detected that could pose a risk to the application. "
        "Review the finding details and consult security documentation for more context."
    ),
    "business_impact": (
        "This vulnerability could expose banking customer data, enable unauthorized access, "
        "or create compliance violations with RBI, PCI-DSS, or SWIFT regulations."
    ),
    "remediation": (
        "1. Review the code at the identified file and line number. "
        "2. Apply secure coding best practices relevant to this vulnerability category. "
        "3. Test the fix in a non-production environment. "
        "4. Document the remediation for audit purposes."
    ),
}


def _get_template_insight(finding: RawFinding) -> AIInsight:
    """Return a template-based insight for the finding category."""
    category = (finding.category or "unknown").lower().replace("-", "_")
    template = TEMPLATE_INSIGHTS.get(category, DEFAULT_TEMPLATE)
    return AIInsight(
        explanation=template["explanation"],
        business_impact=template["business_impact"],
        remediation=template["remediation"],
        generated_by="template",
    )


# ── Cache ──────────────────────────────────────────────────────────────────────
# Cache keyed by (category, severity) to avoid redundant API calls
_insight_cache: dict[str, AIInsight] = {}


def _cache_key(finding: RawFinding) -> str:
    key = f"{finding.category}|{finding.severity}|{finding.title[:40]}"
    return hashlib.md5(key.encode()).hexdigest()


# ── Gemini Call with Retry ────────────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=False,
)
def _call_gemini(model, prompt: str) -> str | None:
    """Call Gemini API with retry logic."""
    response = model.generate_content(prompt)
    return response.text


def generate_ai_insight(
    finding: RawFinding,
    compliance: Optional[ComplianceMappingData] = None,
) -> AIInsight:
    """
    Generate AI-powered insight for a finding.

    Tries Gemini first; falls back to template if:
    - API key not configured
    - API call fails
    - Response cannot be parsed

    Args:
        finding: The vulnerability finding to explain.
        compliance: Optional compliance mapping data to include in context.

    Returns:
        AIInsight with explanation, business_impact, and remediation.
    """
    cache_k = _cache_key(finding)
    if cache_k in _insight_cache:
        logger.debug("ai_engine.cache_hit", category=finding.category)
        return _insight_cache[cache_k]

    model = _get_gemini_model()

    if model is None:
        insight = _get_template_insight(finding)
        _insight_cache[cache_k] = insight
        return insight

    try:
        prompt = _build_prompt(finding, compliance)
        raw_response = _call_gemini(model, prompt)

        if not raw_response:
            raise ValueError("Empty Gemini response")

        # Parse JSON response
        # Strip potential markdown code fences
        clean = raw_response.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            clean = "\n".join(lines[1:-1]) if len(lines) > 2 else clean

        data = json.loads(clean)

        insight = AIInsight(
            explanation=data.get("explanation", ""),
            business_impact=data.get("business_impact", data.get("why_auditors_care", "")),
            remediation=data.get("remediation", ""),
            generated_by="gemini",
        )

        _insight_cache[cache_k] = insight
        logger.info("ai_engine.insight_generated", category=finding.category, source="gemini")
        return insight

    except Exception as exc:
        logger.warning("ai_engine.gemini_failed — using template", error=str(exc))
        insight = _get_template_insight(finding)
        _insight_cache[cache_k] = insight
        return insight


def generate_batch_insights(
    findings: list[RawFinding],
    compliance_list: list[Optional[ComplianceMappingData]],
    max_ai_calls: int = 10,
) -> list[AIInsight]:
    """
    Generate insights for a batch of findings.
    Limits Gemini API calls to `max_ai_calls` to control costs.
    Remaining findings get template-based insights.

    Args:
        findings: List of findings to process.
        compliance_list: Compliance data in same order as findings.
        max_ai_calls: Maximum number of Gemini API calls to make.

    Returns:
        List of AIInsight objects in same order as findings.
    """
    insights = []
    ai_calls_made = 0

    for i, finding in enumerate(findings):
        compliance = compliance_list[i] if i < len(compliance_list) else None

        # Prioritize AI calls for CRITICAL and HIGH severity
        use_ai = (
            ai_calls_made < max_ai_calls
            and finding.severity.upper() in {"CRITICAL", "HIGH"}
        )

        if use_ai:
            insight = generate_ai_insight(finding, compliance)
            if insight.generated_by == "gemini":
                ai_calls_made += 1
        else:
            insight = _get_template_insight(finding)

        insights.append(insight)

    logger.info(
        "ai_engine.batch_complete",
        total=len(findings),
        ai_generated=ai_calls_made,
        template_generated=len(findings) - ai_calls_made,
    )

    return insights
