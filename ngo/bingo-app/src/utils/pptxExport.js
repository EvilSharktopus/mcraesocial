import pptxgen from "pptxgenjs";

// Returns hex color string without '#'
const rgbToHex = (r, g, b) => {
  return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

export async function generatePptx({ group, s1, s2, palette }) {
  const accent = palette?.accent || [0, 194, 179]; // default TEAL
  const secondary = palette?.secondary || [245, 200, 66]; // default YELLOW
  
  const accentHex = rgbToHex(...accent);
  const secondaryHex = rgbToHex(...secondary);
  const darkNavyHex = "0B0F1A";
  const whiteHex = "F0F4FF";

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "NGO Project";
  pptx.company = "School Project";
  pptx.title = group.ngoName || "NGO Pitch Deck";

  // Slide 1: Title
  let slide = pptx.addSlide();
  slide.background = { color: darkNavyHex };
  slide.addText(group.ngoName || "NGO Title", {
    x: "10%", y: "30%", w: "80%", fontSize: 44, bold: true, color: accentHex, align: "center"
  });
  slide.addText(`"${group.tagline || 'Tagline'}"`, {
    x: "10%", y: "45%", w: "80%", fontSize: 24, italic: true, color: secondaryHex, align: "center"
  });
  slide.addText(`Issue: ${s1.issue || '—'}\nGroup members: ${(group.memberNames || []).join(', ')}`, {
    x: "10%", y: "65%", w: "80%", fontSize: 16, color: whiteHex, align: "center"
  });

  // Slide 2: The Problem
  slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "15%", fill: { color: accentHex } });
  slide.addText("The Problem", { x: "5%", y: "2%", w: "90%", fontSize: 32, bold: true, color: whiteHex });
  slide.addText(`Specific Problem:\n${s2.specificProblem || '—'}\n\nRoot Causes:\n${s2.rootCauses || '—'}\n\nWho Is Affected:\n${s2.whoAffected || '—'}`, {
    x: "5%", y: "20%", w: "90%", fontSize: 18, color: "333333", valign: "top", bullet: true
  });

  // Slide 3: The Evidence
  slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "15%", fill: { color: accentHex } });
  slide.addText("The Evidence", { x: "5%", y: "2%", w: "90%", fontSize: 32, bold: true, color: whiteHex });
  slide.addText(`"${s2.stat1 || '—'}"\n— ${s2.stat1Source || '—'}`, {
    x: "5%", y: "25%", w: "40%", fontSize: 22, italic: true, color: darkNavyHex, fill: { color: "F2F2F2" }, p: 10
  });
  slide.addText(`"${s2.stat2 || '—'}"\n— ${s2.stat2Source || '—'}`, {
    x: "55%", y: "25%", w: "40%", fontSize: 22, italic: true, color: darkNavyHex, fill: { color: "F2F2F2" }, p: 10
  });

  // Slide 4: Our Intervention
  slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "15%", fill: { color: accentHex } });
  slide.addText("Our Solution", { x: "5%", y: "2%", w: "90%", fontSize: 32, bold: true, color: whiteHex });
  slide.addText(s2.intervention || '—', {
    x: "5%", y: "20%", w: "90%", fontSize: 20, color: "333333", valign: "top"
  });

  // Slide 5: Timeline
  slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "15%", fill: { color: accentHex } });
  slide.addText("Implementation Timeline", { x: "5%", y: "2%", w: "90%", fontSize: 32, bold: true, color: whiteHex });
  
  const timeline = (s2.timeline ?? [])
    .filter((r) => r.month && r.milestone)
    .sort((a, b) => a.month - b.month);
  
  const timelineText = timeline.length > 0 
    ? timeline.map((r) => `Month ${r.month}: ${r.milestone}`).join('\n')
    : '(No milestones entered)';

  slide.addText(timelineText, {
    x: "5%", y: "20%", w: "90%", fontSize: 20, color: "333333", valign: "top", bullet: true
  });

  // Slide 6: Budget
  slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "15%", fill: { color: accentHex } });
  slide.addText("Budget Breakdown", { x: "5%", y: "2%", w: "90%", fontSize: 32, bold: true, color: whiteHex });
  
  const budget = (s2.budget ?? []).filter((r) => r.category && r.amount);
  const budgetText = budget.length > 0 
    ? budget.map((r) => `${r.category}: $${Number(r.amount).toLocaleString()}`).join('\n') + `\n\nTotal: $500,000`
    : '(No budget entries)';

  slide.addText(budgetText, {
    x: "5%", y: "20%", w: "90%", fontSize: 20, color: "333333", valign: "top", bullet: true
  });

  // Slide 7: The Ask
  slide = pptx.addSlide();
  slide.background = { color: darkNavyHex };
  slide.addText(group.ngoName || "NGO Title", {
    x: "10%", y: "20%", w: "80%", fontSize: 44, bold: true, color: accentHex, align: "center"
  });
  slide.addText(`"${group.tagline || 'Tagline'}"`, {
    x: "10%", y: "35%", w: "80%", fontSize: 24, italic: true, color: secondaryHex, align: "center"
  });
  slide.addText(`Funding Ask: $500,000`, {
    x: "10%", y: "55%", w: "80%", fontSize: 32, bold: true, color: whiteHex, align: "center"
  });
  slide.addText(`Location: ${s1.locationChosen || '—'}\nGroup members: ${(group.memberNames || []).join(', ')}`, {
    x: "10%", y: "70%", w: "80%", fontSize: 18, color: whiteHex, align: "center"
  });

  // Generate and Download
  const filename = `${group.ngoName ? group.ngoName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'ngo'}_pitch_deck.pptx`;
  await pptx.writeFile({ fileName: filename });
}
