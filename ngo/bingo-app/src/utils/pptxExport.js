import pptxgen from "pptxgenjs";

// Returns hex color string without '#'
const rgbToHex = (r, g, b) => {
  return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

// Helper to draw an image placeholder
const addImagePlaceholder = (slide, { x, y, w, h }) => {
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: "F3F4F6" }, // light gray
    line: { type: "dash", color: "9CA3AF", width: 2, dashType: "dash" }
  });
  slide.addText("🖼️\nInsert Graphic Here", {
    x, y, w, h,
    align: "center",
    valign: "middle",
    color: "6B7280",
    fontSize: 14,
    bold: true
  });
};

export async function generatePptx({ group, s1, s2, palette }) {
  const accent = palette?.accent || [0, 194, 179]; // default TEAL
  const secondary = palette?.secondary || [245, 200, 66]; // default YELLOW
  
  const accentHex = rgbToHex(...accent);
  const secondaryHex = rgbToHex(...secondary);
  const darkNavyHex = "0B0F1A";
  const whiteHex = "FFFFFF";
  const textDark = "1F2937";
  const fontFace = "Arial"; // Clean modern default

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "NGO Project";
  pptx.company = "School Project";
  pptx.title = group.ngoName || "NGO Pitch Deck";

  // SLIDE 1: TITLE
  let slide = pptx.addSlide();
  slide.background = { color: darkNavyHex };
  
  // Decorative modern shapes
  slide.addShape("rect", { x: 0, y: "85%", w: "100%", h: "15%", fill: { color: accentHex } });
  slide.addShape("rect", { x: "85%", y: 0, w: "15%", h: "100%", fill: { color: secondaryHex } });

  slide.addText(group.ngoName || "NGO Title", {
    x: "10%", y: "30%", w: "70%", fontSize: 52, bold: true, color: whiteHex, align: "left", fontFace
  });
  slide.addText(`"${group.tagline || 'Tagline'}"`, {
    x: "10%", y: "50%", w: "70%", fontSize: 24, italic: true, color: secondaryHex, align: "left", fontFace
  });
  slide.addText(`Issue: ${s1.issue || '—'}\nTeam: ${(group.memberNames || []).join(', ')}`, {
    x: "10%", y: "70%", w: "70%", fontSize: 16, color: "D1D5DB", align: "left", fontFace
  });

  // SLIDE 2: THE PROBLEM
  slide = pptx.addSlide();
  slide.background = { color: "F9FAFB" }; // off-white
  slide.addShape("rect", { x: 0, y: 0, w: "10%", h: "100%", fill: { color: accentHex } });
  
  slide.addText("The Problem", { x: "12%", y: "5%", w: "80%", fontSize: 36, bold: true, color: textDark, fontFace });

  // 3 Columns for Problem, Causes, Affected
  const colY = "18%";
  const colH = "40%";
  const colW = "26%";
  
  // Specific Problem
  slide.addShape("rect", { x: "12%", y: colY, w: colW, h: colH, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
  slide.addText("Specific Problem", { x: "13%", y: "19%", w: "24%", fontSize: 16, bold: true, color: accentHex, fontFace });
  slide.addText(s2.specificProblem || '—', { x: "13%", y: "25%", w: "24%", h: "30%", fontSize: 14, color: textDark, valign: "top", fontFace });

  // Root Causes
  slide.addShape("rect", { x: "41%", y: colY, w: colW, h: colH, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
  slide.addText("Root Causes", { x: "42%", y: "19%", w: "24%", fontSize: 16, bold: true, color: accentHex, fontFace });
  slide.addText(s2.rootCauses || '—', { x: "42%", y: "25%", w: "24%", h: "30%", fontSize: 14, color: textDark, valign: "top", fontFace });

  // Who is Affected
  slide.addShape("rect", { x: "70%", y: colY, w: colW, h: colH, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
  slide.addText("Who is Affected", { x: "71%", y: "19%", w: "24%", fontSize: 16, bold: true, color: accentHex, fontFace });
  slide.addText(s2.whoAffected || '—', { x: "71%", y: "25%", w: "24%", h: "30%", fontSize: 14, color: textDark, valign: "top", fontFace });

  // Graphic Placeholder at the bottom
  addImagePlaceholder(slide, { x: "12%", y: "65%", w: "84%", h: "25%" });


  // SLIDE 3: THE EVIDENCE
  slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addShape("rect", { x: 0, y: 0, w: "100%", h: "12%", fill: { color: darkNavyHex } });
  slide.addText("The Evidence", { x: "5%", y: "2%", w: "90%", fontSize: 32, bold: true, color: whiteHex, fontFace });

  // Graphic Placeholder
  addImagePlaceholder(slide, { x: "5%", y: "18%", w: "40%", h: "70%" });

  // Quote Blocks
  slide.addShape("rect", { x: "50%", y: "18%", w: "45%", h: "32%", fill: { color: "F3F4F6" }, line: { color: accentHex, width: 4 } });
  slide.addText(`"${s2.stat1 || '—'}"\n\n— ${s2.stat1Source || '—'}`, {
    x: "52%", y: "20%", w: "41%", h: "28%", fontSize: 18, italic: true, color: textDark, valign: "middle", fontFace
  });

  slide.addShape("rect", { x: "50%", y: "56%", w: "45%", h: "32%", fill: { color: "F3F4F6" }, line: { color: secondaryHex, width: 4 } });
  slide.addText(`"${s2.stat2 || '—'}"\n\n— ${s2.stat2Source || '—'}`, {
    x: "52%", y: "58%", w: "41%", h: "28%", fontSize: 18, italic: true, color: textDark, valign: "middle", fontFace
  });


  // SLIDE 4: OUR INTERVENTION
  slide = pptx.addSlide();
  slide.background = { color: "F9FAFB" };
  slide.addShape("rect", { x: 0, y: 0, w: "100%", h: "12%", fill: { color: accentHex } });
  slide.addText("Our Solution", { x: "5%", y: "2%", w: "90%", fontSize: 32, bold: true, color: whiteHex, fontFace });

  slide.addShape("rect", { x: "5%", y: "20%", w: "50%", h: "70%", fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
  slide.addText(s2.intervention || '—', {
    x: "7%", y: "22%", w: "46%", h: "66%", fontSize: 20, color: textDark, valign: "top", fontFace
  });

  addImagePlaceholder(slide, { x: "60%", y: "20%", w: "35%", h: "70%" });


  // SLIDE 5: TIMELINE
  slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText("Implementation Timeline", { x: "5%", y: "5%", w: "90%", fontSize: 32, bold: true, color: textDark, fontFace });
  slide.addShape("line", { x: "5%", y: "15%", w: "90%", h: 0, line: { color: "E5E7EB", width: 2 } });

  const timeline = (s2.timeline ?? [])
    .filter((r) => r.month && r.milestone)
    .sort((a, b) => a.month - b.month);

  if (timeline.length === 0) {
    slide.addText("(No milestones entered)", { x: "5%", y: "20%", w: "90%", fontSize: 20, color: "9CA3AF", fontFace });
  } else {
    // Vertical timeline
    const startY = 25;
    const endY = 85;
    const step = timeline.length > 1 ? (endY - startY) / (timeline.length - 1) : 0;
    
    // Draw central vertical line
    slide.addShape("line", { x: "15%", y: `${startY}%`, w: 0, h: `${endY - startY}%`, line: { color: accentHex, width: 4 } });

    timeline.forEach((m, idx) => {
      const yPos = startY + (step * idx);
      
      // Node
      slide.addShape("oval", { 
        x: "14.2%", y: `${yPos - 2}%`, w: "1.6%", h: "4%", 
        fill: { color: whiteHex }, line: { color: secondaryHex, width: 3 } 
      });

      // Text Box
      slide.addText(`Month ${m.month}`, {
        x: "18%", y: `${yPos - 3}%`, w: "15%", h: "6%", fontSize: 16, bold: true, color: accentHex, fontFace
      });
      slide.addText(m.milestone, {
        x: "30%", y: `${yPos - 3}%`, w: "65%", h: "6%", fontSize: 16, color: textDark, fontFace, valign: "middle"
      });
    });
  }


  // SLIDE 6: BUDGET
  slide = pptx.addSlide();
  slide.background = { color: "F9FAFB" };
  slide.addText("Budget Breakdown", { x: "5%", y: "5%", w: "90%", fontSize: 32, bold: true, color: textDark, fontFace });
  
  const budget = (s2.budget ?? []).filter((r) => r.category && r.amount);
  
  if (budget.length === 0) {
    slide.addText("(No budget entries)", { x: "5%", y: "20%", w: "90%", fontSize: 20, color: "9CA3AF", fontFace });
  } else {
    // Generate Table rows
    const tableRows = [];
    tableRows.push([
      { text: "Category", options: { bold: true, color: whiteHex, fill: darkNavyHex, fontFace, margin: 10 } },
      { text: "Estimated Cost", options: { bold: true, color: whiteHex, fill: darkNavyHex, align: "right", fontFace, margin: 10 } }
    ]);

    let total = 0;
    budget.forEach((item, idx) => {
      const cost = Number(item.amount) || 0;
      total += cost;
      const rowFill = idx % 2 === 0 ? "FFFFFF" : "F3F4F6";
      tableRows.push([
        { text: item.category, options: { fill: rowFill, color: textDark, fontFace, margin: 10 } },
        { text: `$${cost.toLocaleString()}`, options: { fill: rowFill, color: textDark, align: "right", fontFace, margin: 10 } }
      ]);
    });

    // Total Row
    tableRows.push([
      { text: "Total Request", options: { bold: true, color: textDark, fill: "E5E7EB", fontFace, margin: 10 } },
      { text: `$500,000`, options: { bold: true, color: accentHex, fill: "E5E7EB", align: "right", fontFace, margin: 10 } }
    ]);

    slide.addTable(tableRows, {
      x: "5%", y: "20%", w: "50%", colW: [4, 3], border: { type: "solid", color: "D1D5DB", pt: 1 }
    });

    // Graphic Placeholder for a pie chart or image
    addImagePlaceholder(slide, { x: "60%", y: "20%", w: "35%", h: "60%" });
  }


  // SLIDE 7: THE ASK (END SLIDE)
  slide = pptx.addSlide();
  slide.background = { color: darkNavyHex };
  
  // Decorative modern shapes
  slide.addShape("rect", { x: "85%", y: 0, w: "15%", h: "100%", fill: { color: accentHex } });
  
  slide.addText(group.ngoName || "NGO Title", {
    x: "10%", y: "20%", w: "70%", fontSize: 52, bold: true, color: whiteHex, align: "left", fontFace
  });
  slide.addText(`"${group.tagline || 'Tagline'}"`, {
    x: "10%", y: "35%", w: "70%", fontSize: 24, italic: true, color: secondaryHex, align: "left", fontFace
  });
  slide.addText(`Funding Ask: $500,000`, {
    x: "10%", y: "55%", w: "70%", fontSize: 36, bold: true, color: accentHex, align: "left", fontFace
  });
  slide.addText(`Location: ${s1.locationChosen || '—'}\nTeam: ${(group.memberNames || []).join(', ')}`, {
    x: "10%", y: "70%", w: "70%", fontSize: 18, color: "D1D5DB", align: "left", fontFace
  });

  // Generate and Download
  const filename = `${group.ngoName ? group.ngoName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'ngo'}_pitch_deck.pptx`;
  await pptx.writeFile({ fileName: filename });
}
