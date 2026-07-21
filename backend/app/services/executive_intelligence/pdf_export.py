"""
KAVACH — Executive Intelligence PDF Export
Renders a PREVIOUSLY-GIVEN answer to PDF — the caller (the API endpoint)
passes back exactly the question/answer/evidence/citations the client
already displayed, rather than this module re-deriving them. That's
deliberate: re-running evidence aggregation moments later could pick up a
scan that just completed and produce a PDF that no longer matches what
the user actually saw and reviewed on screen. Self-contained (own
reportlab usage, own styles) rather than extending
app/services/reports/report_generator.py — a one-off on-demand export
with no persisted Report row/storage backend, unlike that module's
scan-report pipeline, so reuse would mean bending its shape rather than
sharing real logic.
"""

import io
from datetime import datetime, timezone
from typing import Optional
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _metric_rows(evidence: dict) -> list[list[str]]:
    rows = [["Metric", "Value"]]
    rows.append(["Data as of", evidence.get("generated_at", "N/A")])
    rows.append(["Total repositories", str(evidence.get("total_repositories", 0))])
    rows.append(["Total completed scans", str(evidence.get("total_completed_scans", 0))])
    rows.append(["Total findings", str(evidence.get("total_findings", 0))])
    avg_brs = evidence.get("portfolio_average_brs")
    rows.append(["Portfolio average BRS", f"{avg_brs:.1f}" if avg_brs is not None else "N/A"])

    severity = evidence.get("findings_by_severity") or {}
    if severity:
        rows.append(["Findings by severity", ", ".join(f"{k}={v}" for k, v in sorted(severity.items()))])

    for framework in evidence.get("compliance_by_framework") or []:
        total = framework["compliant_repo_count"] + framework["non_compliant_repo_count"]
        rows.append(
            [
                f"Compliance — {framework['framework_name']}",
                f"{framework['compliant_repo_count']} of {total} repos compliant, "
                f"{framework['total_violations']} violation(s)",
            ]
        )

    wow = evidence.get("week_over_week")
    if wow:
        rows.append(
            [
                "This week vs. last week",
                f"{wow['scans_this_week']} vs {wow['scans_last_week']} scans, "
                f"{wow['findings_this_week']} vs {wow['findings_last_week']} findings",
            ]
        )
    return rows


def render_pdf(
    *,
    question: str,
    answer: str,
    evidence: dict,
    citations: list[dict],
    confidence: Optional[float] = None,
    generated_at: Optional[str] = None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm, leftMargin=2 * cm, rightMargin=2 * cm
    )
    styles = getSampleStyleSheet()
    excerpt_style = ParagraphStyle("Excerpt", parent=styles["Normal"], leftIndent=12, textColor=colors.HexColor("#444444"))

    story = [
        Paragraph("KAVACH — Executive Intelligence Report", styles["Title"]),
        Spacer(1, 0.2 * cm),
        Paragraph(
            f"Generated {generated_at or datetime.now(timezone.utc).isoformat()}",
            ParagraphStyle("Meta", parent=styles["Normal"], textColor=colors.HexColor("#666666")),
        ),
        Spacer(1, 0.6 * cm),
        Paragraph("Question", styles["Heading2"]),
        Paragraph(xml_escape(question), styles["Normal"]),
        Spacer(1, 0.4 * cm),
        Paragraph("Answer", styles["Heading2"]),
    ]

    for paragraph in answer.split("\n\n"):
        cleaned = paragraph.strip()
        if cleaned:
            story.append(Paragraph(xml_escape(cleaned).replace("\n", "<br/>"), styles["Normal"]))
            story.append(Spacer(1, 0.2 * cm))

    if confidence is not None:
        story.append(
            Paragraph(
                f"Knowledge-base citation confidence: {round(confidence * 100)}%",
                ParagraphStyle("Meta", parent=styles["Normal"], textColor=colors.HexColor("#666666")),
            )
        )

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Evidence (scan history)", styles["Heading2"]))
    table = Table(_metric_rows(evidence), colWidths=[7 * cm, 9.5 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)

    if citations:
        story.append(Spacer(1, 0.5 * cm))
        story.append(Paragraph("Sources", styles["Heading2"]))
        for index, citation in enumerate(citations, start=1):
            header = f"[{index}] {citation.get('filename', 'unknown')}"
            if citation.get("section_path"):
                header += f" — {citation['section_path']}"
            if citation.get("page_number") is not None:
                header += f" (page {citation['page_number']})"
            story.append(Paragraph(xml_escape(header), styles["Normal"]))
            story.append(Paragraph(xml_escape(citation.get("excerpt", "")).replace("\n", "<br/>"), excerpt_style))
            story.append(Spacer(1, 0.25 * cm))

    doc.build(story)
    return buffer.getvalue()
