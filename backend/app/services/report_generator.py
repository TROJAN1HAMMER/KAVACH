"""
KAVACH — Report Generation Engine
Produces PDF, SARIF, and CycloneDX SBOM export artifacts.

A. PDF Report (ReportLab)
   - Executive Summary
   - Banking Risk Score visualization
   - Findings table
   - Compliance mappings
   - AI Recommendations

B. SARIF Export (OASIS SARIF 2.1.0)
   - Valid SARIF JSON for IDE integration and CI/CD pipelines

C. CycloneDX SBOM Export
   - Re-export the stored SBOM

Input:  Scan data + findings from DB
Output: PDF path, SARIF path, SBOM path
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import structlog

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import KeepTogether

logger = structlog.get_logger(__name__)


# ── Color Palette ─────────────────────────────────────────────────────────────

KAVACH_DARK = colors.HexColor("#0F172A")
KAVACH_BLUE = colors.HexColor("#3B82F6")
KAVACH_TEAL = colors.HexColor("#14B8A6")
KAVACH_LIGHT = colors.HexColor("#F8FAFC")
KAVACH_MUTED = colors.HexColor("#64748B")

SEVERITY_COLORS = {
    "CRITICAL": colors.HexColor("#DC2626"),
    "HIGH": colors.HexColor("#EA580C"),
    "MEDIUM": colors.HexColor("#D97706"),
    "LOW": colors.HexColor("#16A34A"),
    "INFO": colors.HexColor("#2563EB"),
}

RISK_COLORS = {
    "Critical": colors.HexColor("#DC2626"),
    "High": colors.HexColor("#EA580C"),
    "Medium": colors.HexColor("#D97706"),
    "Low": colors.HexColor("#16A34A"),
}


# ── PDF Generation ────────────────────────────────────────────────────────────

class KavachPDFReport:
    """Builds a professional PDF security audit report."""

    def __init__(self, output_path: Path):
        self.output_path = output_path
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _setup_styles(self):
        self.styles.add(ParagraphStyle(
            "KavachTitle",
            parent=self.styles["Title"],
            fontSize=26,
            textColor=KAVACH_DARK,
            spaceAfter=6,
            fontName="Helvetica-Bold",
        ))
        self.styles.add(ParagraphStyle(
            "KavachH1",
            parent=self.styles["Heading1"],
            fontSize=16,
            textColor=KAVACH_DARK,
            spaceAfter=8,
            spaceBefore=14,
            fontName="Helvetica-Bold",
            borderPad=4,
        ))
        self.styles.add(ParagraphStyle(
            "KavachH2",
            parent=self.styles["Heading2"],
            fontSize=13,
            textColor=KAVACH_BLUE,
            spaceAfter=6,
            spaceBefore=10,
            fontName="Helvetica-Bold",
        ))
        self.styles.add(ParagraphStyle(
            "KavachBody",
            parent=self.styles["Normal"],
            fontSize=9,
            textColor=KAVACH_DARK,
            spaceAfter=4,
            leading=14,
        ))
        self.styles.add(ParagraphStyle(
            "KavachSmall",
            parent=self.styles["Normal"],
            fontSize=8,
            textColor=KAVACH_MUTED,
            spaceAfter=2,
        ))
        self.styles.add(ParagraphStyle(
            "KavachCode",
            parent=self.styles["Normal"],
            fontSize=8,
            fontName="Courier",
            textColor=KAVACH_DARK,
            backColor=colors.HexColor("#F1F5F9"),
        ))

    def _severity_badge(self, severity: str) -> Paragraph:
        color = SEVERITY_COLORS.get(severity.upper(), KAVACH_MUTED)
        style = ParagraphStyle(
            "badge",
            fontSize=8,
            textColor=colors.white,
            backColor=color,
            fontName="Helvetica-Bold",
            alignment=TA_CENTER,
        )
        return Paragraph(severity.upper(), style)

    def generate(
        self,
        scan_id: str,
        repo_name: str,
        brs_score: float,
        brs_risk_level: str,
        zero_day_score: float,
        zero_day_level: str,
        findings: list[dict],
        compliance_summary: dict,
        summary: dict,
        generated_at: datetime,
    ) -> Path:
        """Generate the complete PDF report."""

        doc = SimpleDocTemplate(
            str(self.output_path),
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
            title=f"KAVACH Security Report — {repo_name}",
            author="KAVACH Platform",
            subject="Banking Application Security Audit Report",
        )

        story = []

        # ── Cover Page ──
        story.extend(self._build_cover(scan_id, repo_name, brs_score, brs_risk_level, generated_at))
        story.append(PageBreak())

        # ── Executive Summary ──
        story.extend(self._build_executive_summary(
            repo_name, brs_score, brs_risk_level,
            zero_day_score, zero_day_level, summary, compliance_summary
        ))
        story.append(PageBreak())

        # ── Findings Table ──
        story.extend(self._build_findings_section(findings))
        story.append(PageBreak())

        # ── Compliance Mapping ──
        story.extend(self._build_compliance_section(compliance_summary, findings))
        story.append(PageBreak())

        # ── AI Recommendations ──
        story.extend(self._build_ai_recommendations(findings))

        doc.build(story)
        logger.info("report_generator.pdf.generated", path=str(self.output_path))
        return self.output_path

    def _build_cover(self, scan_id, repo_name, brs_score, brs_risk_level, generated_at):
        elements = []
        elements.append(Spacer(1, 3 * cm))

        # Logo text
        elements.append(Paragraph(
            "⚡ KAVACH",
            ParagraphStyle("logo", fontSize=32, fontName="Helvetica-Bold",
                           textColor=KAVACH_BLUE, alignment=TA_CENTER)
        ))
        elements.append(Paragraph(
            "AI-Powered DevSecOps Security Platform",
            ParagraphStyle("tagline", fontSize=12, textColor=KAVACH_MUTED, alignment=TA_CENTER)
        ))
        elements.append(Spacer(1, 1 * cm))
        elements.append(HRFlowable(width="100%", thickness=2, color=KAVACH_BLUE))
        elements.append(Spacer(1, 0.5 * cm))

        elements.append(Paragraph(
            "Security Audit Report",
            ParagraphStyle("report_title", fontSize=22, fontName="Helvetica-Bold",
                           textColor=KAVACH_DARK, alignment=TA_CENTER)
        ))
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph(
            f"Repository: {repo_name}",
            ParagraphStyle("repo", fontSize=14, textColor=KAVACH_MUTED, alignment=TA_CENTER)
        ))

        elements.append(Spacer(1, 2 * cm))

        # BRS Score Box
        risk_color = RISK_COLORS.get(brs_risk_level, KAVACH_MUTED)
        brs_data = [
            ["Banking Risk Score (BRS)", "Risk Level"],
            [f"{brs_score:.1f} / 100", brs_risk_level],
        ]
        brs_table = Table(brs_data, colWidths=[8 * cm, 8 * cm])
        brs_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), KAVACH_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 1), (-1, 1), 20),
            ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 1), (0, 1), KAVACH_BLUE),
            ("TEXTCOLOR", (1, 1), (1, 1), risk_color),
            ("BACKGROUND", (0, 1), (-1, 1), KAVACH_LIGHT),
            ("ROWBACKGROUND", (0, 1), (-1, 1), KAVACH_LIGHT),
            ("BOX", (0, 0), (-1, -1), 1, KAVACH_BLUE),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        elements.append(brs_table)

        elements.append(Spacer(1, 1 * cm))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
        elements.append(Spacer(1, 0.5 * cm))

        # Metadata
        meta_data = [
            ["Scan ID:", str(scan_id)],
            ["Generated:", generated_at.strftime("%Y-%m-%d %H:%M UTC")],
            ["Platform:", "KAVACH v1.0.0 | Hackathon Prototype"],
            ["Compliance:", "RBI IT Framework 2021 | PCI DSS v4.0 | SWIFT CSP"],
        ]
        meta_table = Table(meta_data, colWidths=[4 * cm, 12 * cm])
        meta_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (0, -1), KAVACH_MUTED),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(meta_table)

        return elements

    def _build_executive_summary(
        self, repo_name, brs_score, brs_risk_level,
        zero_day_score, zero_day_level, summary, compliance_summary
    ):
        elements = []
        elements.append(Paragraph("Executive Summary", self.styles["KavachH1"]))
        elements.append(HRFlowable(width="100%", thickness=1, color=KAVACH_BLUE))
        elements.append(Spacer(1, 0.3 * cm))

        intro = (
            f"KAVACH conducted an automated security assessment of the <b>{repo_name}</b> repository. "
            f"The assessment included static code analysis, dependency vulnerability scanning, "
            f"and configuration security review. "
            f"A total of <b>{summary.get('total', 0)} findings</b> were identified across all scan modules."
        )
        elements.append(Paragraph(intro, self.styles["KavachBody"]))
        elements.append(Spacer(1, 0.5 * cm))

        # Findings Severity Summary
        elements.append(Paragraph("Findings by Severity", self.styles["KavachH2"]))
        sev_data = [
            ["Severity", "Count", "Action Required"],
            ["CRITICAL", str(summary.get("CRITICAL", 0)), "Immediate remediation"],
            ["HIGH", str(summary.get("HIGH", 0)), "Remediate within 7 days"],
            ["MEDIUM", str(summary.get("MEDIUM", 0)), "Remediate within 30 days"],
            ["LOW", str(summary.get("LOW", 0)), "Track and remediate"],
            ["INFO", str(summary.get("INFO", 0)), "Review and document"],
        ]
        sev_table = Table(sev_data, colWidths=[4 * cm, 3 * cm, 9 * cm])
        sev_style = [
            ("BACKGROUND", (0, 0), (-1, 0), KAVACH_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#FEE2E2")),  # CRITICAL
            ("TEXTCOLOR", (0, 1), (0, 1), SEVERITY_COLORS["CRITICAL"]),
            ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
            ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#FFEDD5")),  # HIGH
            ("TEXTCOLOR", (0, 2), (0, 2), SEVERITY_COLORS["HIGH"]),
            ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#FEF9C3")),  # MEDIUM
            ("TEXTCOLOR", (0, 3), (0, 3), SEVERITY_COLORS["MEDIUM"]),
            ("BACKGROUND", (0, 4), (-1, 4), colors.HexColor("#DCFCE7")),  # LOW
        ]
        sev_table.setStyle(TableStyle(sev_style))
        elements.append(sev_table)
        elements.append(Spacer(1, 0.5 * cm))

        # Risk Scores
        elements.append(Paragraph("Risk Assessment", self.styles["KavachH2"]))
        risk_data = [
            ["Metric", "Score", "Level"],
            ["Banking Risk Score (BRS)", f"{brs_score:.1f}", brs_risk_level],
            ["Zero-Day Prediction Risk", f"{zero_day_score:.1f}", zero_day_level],
        ]
        risk_table = Table(risk_data, colWidths=[7 * cm, 4 * cm, 5 * cm])
        risk_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), KAVACH_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 1), (-1, -1), KAVACH_LIGHT),
            ("FONTNAME", (1, 1), (2, -1), "Helvetica-Bold"),
        ]))
        elements.append(risk_table)

        return elements

    def _build_findings_section(self, findings: list[dict]):
        elements = []
        elements.append(Paragraph("Security Findings", self.styles["KavachH1"]))
        elements.append(HRFlowable(width="100%", thickness=1, color=KAVACH_BLUE))
        elements.append(Spacer(1, 0.3 * cm))

        if not findings:
            elements.append(Paragraph("No findings detected.", self.styles["KavachBody"]))
            return elements

        # Table header
        table_data = [["#", "Title", "Severity", "CVSS", "BRS", "File"]]

        for i, f in enumerate(findings[:100], 1):  # Cap at 100 for PDF
            title = (f.get("title") or "")[:60]
            if len(f.get("title", "")) > 60:
                title += "..."
            file_path = (f.get("file_path") or "N/A")[-40:]  # Show last 40 chars
            table_data.append([
                str(i),
                title,
                f.get("severity", ""),
                f"{f.get('cvss', 0):.1f}",
                f"{f.get('brs', 0):.1f}",
                file_path,
            ])

        findings_table = Table(
            table_data,
            colWidths=[0.7 * cm, 6.5 * cm, 1.8 * cm, 1.3 * cm, 1.3 * cm, 4.4 * cm],
            repeatRows=1,
        )

        style = [
            ("BACKGROUND", (0, 0), (-1, 0), KAVACH_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, KAVACH_LIGHT]),
        ]

        # Color severity column
        for i, f in enumerate(findings[:100], 1):
            sev = f.get("severity", "").upper()
            if sev in SEVERITY_COLORS:
                style.append(("TEXTCOLOR", (2, i), (2, i), SEVERITY_COLORS[sev]))
                style.append(("FONTNAME", (2, i), (2, i), "Helvetica-Bold"))

        findings_table.setStyle(TableStyle(style))
        elements.append(findings_table)

        if len(findings) > 100:
            elements.append(Spacer(1, 0.3 * cm))
            elements.append(Paragraph(
                f"Note: Showing first 100 of {len(findings)} findings. "
                "See SARIF export for complete results.",
                self.styles["KavachSmall"]
            ))

        return elements

    def _build_compliance_section(self, compliance_summary: dict, findings: list[dict]):
        elements = []
        elements.append(Paragraph("Regulatory Compliance Mapping", self.styles["KavachH1"]))
        elements.append(HRFlowable(width="100%", thickness=1, color=KAVACH_BLUE))
        elements.append(Spacer(1, 0.3 * cm))

        elements.append(Paragraph(
            "The following regulatory frameworks have been assessed against the detected findings:",
            self.styles["KavachBody"]
        ))
        elements.append(Spacer(1, 0.3 * cm))

        for key, data in compliance_summary.items():
            status_color = colors.HexColor("#16A34A") if data["compliant"] else colors.HexColor("#DC2626")
            status = "COMPLIANT" if data["compliant"] else f"NON-COMPLIANT ({data['violations']} violations)"

            comp_data = [
                [data["name"], status],
            ]
            comp_table = Table(comp_data, colWidths=[10 * cm, 6 * cm])
            comp_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), KAVACH_DARK),
                ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                ("BACKGROUND", (1, 0), (1, 0), status_color),
                ("TEXTCOLOR", (1, 0), (1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]))
            elements.append(comp_table)
            elements.append(Spacer(1, 0.2 * cm))

        elements.append(Spacer(1, 0.5 * cm))

        # Sample compliance details
        elements.append(Paragraph("Key Compliance Violations", self.styles["KavachH2"]))
        compliant_findings = [
            f for f in findings
            if f.get("compliance") and f["severity"].upper() in {"CRITICAL", "HIGH"}
        ][:10]

        if compliant_findings:
            for f in compliant_findings:
                comp = f.get("compliance", {})
                elements.append(Paragraph(
                    f"<b>{f.get('title', '')}</b> ({f.get('severity', '')})",
                    self.styles["KavachBody"]
                ))
                if comp.get("rbi_clause"):
                    elements.append(Paragraph(
                        f"  • RBI: {comp['rbi_clause'][:120]}",
                        self.styles["KavachSmall"]
                    ))
                if comp.get("pci_clause"):
                    elements.append(Paragraph(
                        f"  • PCI: {comp['pci_clause'][:120]}",
                        self.styles["KavachSmall"]
                    ))
                elements.append(Spacer(1, 0.2 * cm))

        return elements

    def _build_ai_recommendations(self, findings: list[dict]):
        elements = []
        elements.append(Paragraph("AI-Powered Recommendations", self.styles["KavachH1"]))
        elements.append(HRFlowable(width="100%", thickness=1, color=KAVACH_BLUE))
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph(
            "The following recommendations were generated by the KAVACH AI engine "
            "(powered by Google Gemini) to help remediate the most critical findings:",
            self.styles["KavachBody"]
        ))
        elements.append(Spacer(1, 0.3 * cm))

        priority_findings = [
            f for f in findings
            if f.get("severity", "").upper() in {"CRITICAL", "HIGH"}
            and (f.get("ai_explanation") or f.get("ai_remediation"))
        ][:8]

        if not priority_findings:
            elements.append(Paragraph(
                "No AI insights available for current findings.",
                self.styles["KavachBody"]
            ))
            return elements

        for f in priority_findings:
            sev_color = SEVERITY_COLORS.get(f.get("severity", "").upper(), KAVACH_MUTED)
            title_style = ParagraphStyle(
                "finding_title",
                fontSize=10, fontName="Helvetica-Bold",
                textColor=sev_color, spaceAfter=4
            )
            elements.append(Paragraph(
                f"[{f.get('severity', '')}] {f.get('title', '')}",
                title_style
            ))

            if f.get("ai_explanation"):
                elements.append(Paragraph(
                    f"<b>What it is:</b> {f['ai_explanation']}",
                    self.styles["KavachBody"]
                ))

            if f.get("ai_business_impact"):
                elements.append(Paragraph(
                    f"<b>Business Impact:</b> {f['ai_business_impact']}",
                    self.styles["KavachBody"]
                ))

            if f.get("ai_remediation"):
                elements.append(Paragraph(
                    f"<b>Remediation:</b> {f['ai_remediation']}",
                    self.styles["KavachBody"]
                ))

            elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
            elements.append(Spacer(1, 0.3 * cm))

        return elements


# ── SARIF Generator ───────────────────────────────────────────────────────────

def generate_sarif(
    scan_id: str,
    repo_name: str,
    findings: list[dict],
) -> dict:
    """
    Generate a valid SARIF 2.1.0 report from findings.
    SARIF is the standard format for static analysis results.
    """
    rules = {}
    results = []

    for finding in findings:
        rule_id = finding.get("category", "unknown").replace(" ", "_").replace("-", "_")
        severity = finding.get("severity", "warning").lower()

        # Map to SARIF severity levels
        sarif_level = {
            "critical": "error",
            "high": "error",
            "medium": "warning",
            "low": "note",
            "info": "none",
        }.get(severity, "warning")

        # Register rule if not seen
        if rule_id not in rules:
            rules[rule_id] = {
                "id": rule_id,
                "name": rule_id.replace("_", " ").title(),
                "shortDescription": {"text": finding.get("title", rule_id)},
                "fullDescription": {"text": finding.get("description", "")},
                "helpUri": "https://kavach.security/rules/" + rule_id,
                "properties": {
                    "tags": [finding.get("category", "security")],
                    "precision": "medium",
                    "problem.severity": severity,
                },
            }

        # Build result
        result: dict = {
            "ruleId": rule_id,
            "level": sarif_level,
            "message": {"text": finding.get("description", finding.get("title", ""))},
            "properties": {
                "cvss": finding.get("cvss", 0.0),
                "brs": finding.get("brs", 0.0),
                "source": finding.get("source", ""),
            },
        }

        if finding.get("file_path"):
            location = {
                "physicalLocation": {
                    "artifactLocation": {
                        "uri": finding["file_path"],
                        "uriBaseId": "%SRCROOT%",
                    },
                }
            }
            if finding.get("line_number"):
                location["physicalLocation"]["region"] = {
                    "startLine": finding["line_number"],
                }
            result["locations"] = [location]

        results.append(result)

    sarif = {
        "version": "2.1.0",
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "KAVACH",
                        "version": "1.0.0",
                        "informationUri": "https://kavach.security",
                        "rules": list(rules.values()),
                    }
                },
                "results": results,
                "properties": {
                    "scan_id": scan_id,
                    "repository": repo_name,
                    "scanDate": datetime.now(timezone.utc).isoformat(),
                },
                "artifacts": [
                    {
                        "location": {"uri": "%SRCROOT%"},
                        "description": {"text": f"Source repository: {repo_name}"},
                    }
                ],
            }
        ],
    }

    return sarif


# ── Main Report Generator ─────────────────────────────────────────────────────

def generate_all_reports(
    scan_id: str,
    repo_name: str,
    findings: list[dict],
    brs_score: float,
    brs_risk_level: str,
    zero_day_score: float,
    zero_day_level: str,
    compliance_summary: dict,
    summary: dict,
    sbom: dict | None,
    reports_dir: str | Path,
) -> dict[str, str | None]:
    """
    Generate all report artifacts: PDF, SARIF, and SBOM export.

    Returns:
        dict with keys: pdf_path, sarif_path, sbom_path
    """
    reports_dir = Path(reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc)

    paths: dict[str, str | None] = {
        "pdf_path": None,
        "sarif_path": None,
        "sbom_path": None,
    }

    # ── PDF ──
    try:
        pdf_path = reports_dir / f"{scan_id}_report.pdf"
        reporter = KavachPDFReport(pdf_path)
        reporter.generate(
            scan_id=scan_id,
            repo_name=repo_name,
            brs_score=brs_score,
            brs_risk_level=brs_risk_level,
            zero_day_score=zero_day_score,
            zero_day_level=zero_day_level,
            findings=findings,
            compliance_summary=compliance_summary,
            summary=summary,
            generated_at=generated_at,
        )
        paths["pdf_path"] = str(pdf_path)
        logger.info("report_generator.pdf.ok", path=str(pdf_path))
    except Exception as exc:
        logger.exception("report_generator.pdf.error", error=str(exc))

    # ── SARIF ──
    try:
        sarif_path = reports_dir / f"{scan_id}_findings.sarif"
        sarif_data = generate_sarif(scan_id, repo_name, findings)
        sarif_path.write_text(json.dumps(sarif_data, indent=2), encoding="utf-8")
        paths["sarif_path"] = str(sarif_path)
        logger.info("report_generator.sarif.ok", path=str(sarif_path))
    except Exception as exc:
        logger.exception("report_generator.sarif.error", error=str(exc))

    # ── SBOM ──
    try:
        sbom_path = reports_dir / f"{scan_id}_sbom.json"
        if sbom:
            sbom_path.write_text(json.dumps(sbom, indent=2), encoding="utf-8")
        elif sbom_path.exists():
            pass  # Already written by dependency scanner
        paths["sbom_path"] = str(sbom_path) if sbom_path.exists() else None
        logger.info("report_generator.sbom.ok", path=str(sbom_path))
    except Exception as exc:
        logger.exception("report_generator.sbom.error", error=str(exc))

    return paths
