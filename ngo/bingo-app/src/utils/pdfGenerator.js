// src/utils/pdfGenerator.js
// Client-side PDF using jsPDF — teal/yellow branding
import jsPDF from 'jspdf';

const TEAL   = [0,   194, 179];
const YELLOW = [245, 200,  66];
const NAVY   = [11,   15,  26];
const WHITE  = [240, 244, 255];
const GRAY   = [136, 150, 168];

function addWrappedText(pdf, text, x, y, maxWidth, lineHeight = 6) {
  const lines = pdf.splitTextToSize(String(text || '—'), maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function sectionTitle(pdf, text, y) {
  pdf.setFillColor(...TEAL);
  pdf.rect(14, y - 4, 182, 7, 'F');
  pdf.setTextColor(...WHITE);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(text.toUpperCase(), 16, y + 0.5);
  pdf.setTextColor(30, 30, 30);
  return y + 9;
}

export async function generatePdf({ group, s1, s2 }) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = W - margin * 2;

  // ── Header ──────────────────────────────────────────────────────────────
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, W, 28, 'F');

  pdf.setTextColor(...TEAL);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(group.ngoName || 'NGO Info Package', margin, 12);

  pdf.setTextColor(...YELLOW);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'italic');
  pdf.text(`"${group.tagline || ''}"`, margin, 18);

  pdf.setTextColor(...GRAY);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Group members: ${(group.memberNames || []).join(', ')}`, margin, 24);

  pdf.setTextColor(30, 30, 30);

  let y = 36;

  // ── Section 1: The Problem ───────────────────────────────────────────────
  y = sectionTitle(pdf, '1. The Problem', y);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Specific Problem:', margin, y + 2);
  pdf.setFont('helvetica', 'normal');
  y = addWrappedText(pdf, s2.specificProblem, margin, y + 7, contentW);
  y += 2;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Root Causes:', margin, y);
  pdf.setFont('helvetica', 'normal');
  y = addWrappedText(pdf, s2.rootCauses, margin, y + 5, contentW);
  y += 2;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Who Is Affected:', margin, y);
  pdf.setFont('helvetica', 'normal');
  y = addWrappedText(pdf, s2.whoAffected, margin, y + 5, contentW);
  y += 6;

  // ── Section 2: The Evidence ──────────────────────────────────────────────
  y = sectionTitle(pdf, '2. The Evidence', y);
  pdf.setFontSize(8);
  [[s2.stat1, s2.stat1Source], [s2.stat2, s2.stat2Source]].forEach(([stat, src]) => {
    pdf.setFillColor(240, 250, 249);
    const statLines = pdf.splitTextToSize(`"${stat || '—'}"`, contentW - 8);
    pdf.rect(margin, y, contentW, statLines.length * 5 + 8, 'F');
    pdf.setTextColor(...TEAL);
    pdf.setFont('helvetica', 'italic');
    pdf.text(statLines, margin + 4, y + 5);
    y += statLines.length * 5 + 10;
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(`Source: ${src || '—'}`, margin + 4, y - 4);
    pdf.setFontSize(8);
    pdf.setTextColor(30, 30, 30);
  });
  y += 4;

  // ── Section 3: Our Intervention ─────────────────────────────────────────
  y = sectionTitle(pdf, '3. Our Intervention', y);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30, 30, 30);
  y = addWrappedText(pdf, s2.intervention, margin, y + 4, contentW);
  y += 6;

  // ── Section 4: Timeline ──────────────────────────────────────────────────
  y = sectionTitle(pdf, '4. Implementation Timeline', y);
  const timeline = (s2.timeline ?? [])
    .filter((r) => r.month && r.milestone)
    .sort((a, b) => a.month - b.month);

  if (timeline.length > 0) {
    const nodeW = contentW / timeline.length;
    const lineY = y + 10;

    // Connector line
    pdf.setDrawColor(...TEAL);
    pdf.setLineWidth(0.5);
    pdf.line(margin + nodeW / 2, lineY, margin + contentW - nodeW / 2, lineY);

    timeline.forEach((item, i) => {
      const cx = margin + nodeW * i + nodeW / 2;
      // Circle
      pdf.setFillColor(...TEAL);
      pdf.circle(cx, lineY, 3, 'F');
      // Month label
      pdf.setTextColor(...WHITE);
      pdf.setFontSize(5.5);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`M${item.month}`, cx, lineY + 1, { align: 'center' });
      // Milestone text
      pdf.setTextColor(30, 30, 30);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      const msLines = pdf.splitTextToSize(item.milestone, nodeW - 4);
      pdf.text(msLines, cx, lineY + 7, { align: 'center' });
    });
    y = lineY + 24;
  } else {
    y += 8;
  }
  y += 4;

  // ── Section 5: Budget ────────────────────────────────────────────────────
  y = sectionTitle(pdf, '5. Budget Breakdown', y);
  const budget = (s2.budget ?? []).filter((r) => r.category && r.amount);
  if (budget.length > 0) {
    const total = budget.reduce((s, r) => s + (parseInt(r.amount, 10) || 0), 0);
    const barW  = contentW - 60;

    budget.forEach((item) => {
      const amt  = parseInt(item.amount, 10) || 0;
      const pct  = total > 0 ? amt / total : 0;
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      pdf.text(item.category, margin, y + 4);
      pdf.text(`$${amt.toLocaleString()}`, W - margin, y + 4, { align: 'right' });

      // Background bar
      pdf.setFillColor(220, 240, 238);
      pdf.rect(margin, y + 6, barW, 3, 'F');
      // Filled bar
      pdf.setFillColor(...TEAL);
      pdf.rect(margin, y + 6, barW * pct, 3, 'F');
      y += 12;
    });

    // Total row
    pdf.setFillColor(...YELLOW);
    pdf.rect(margin, y, contentW, 7, 'F');
    pdf.setTextColor(...NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('TOTAL', margin + 2, y + 5);
    pdf.text('$500,000', W - margin - 2, y + 5, { align: 'right' });
    y += 12;
  }

  pdf.save(`${group.ngoName || 'bingo'}-info-package.pdf`);
}
