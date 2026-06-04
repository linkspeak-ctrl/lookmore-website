const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, WidthType, BorderStyle, ShadingType
} = require("docx");

const imageDir = "/Users/wenglianfeng/Desktop/Claude Code test/杭州";
const outputPath = "/Users/wenglianfeng/Desktop/Claude Code test/杭州人物照片.docx";

// docx-js ImageRun uses pixels at 96 DPI by default
// 5cm = 5 / 2.54 inches * 96 DPI = 189 pixels
const IMAGE_SIZE = Math.round(5 / 2.54 * 96);

// A4 portrait: 11906 x 16838 DXA
// 1 inch (1440 DXA) margins
const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;
const MARGIN = 1440;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;

// Two columns, each half of content width
const COL_WIDTH = Math.floor(CONTENT_WIDTH / 2);

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

const cellMargins = { top: 100, bottom: 100, left: 80, right: 80 };

// Spacer row with height for gap between photo rows (1cm)
const SPACER_HEIGHT = Math.round(1 / 2.54 * 1440);
const spacerRow = new TableRow({
  height: { value: SPACER_HEIGHT, rule: "atLeast" },
  children: [
    new TableCell({
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
      },
      width: { size: COL_WIDTH, type: WidthType.DXA },
      children: [new Paragraph({ children: [] })],
    }),
    new TableCell({
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
      },
      width: { size: COL_WIDTH, type: WidthType.DXA },
      children: [new Paragraph({ children: [] })],
    }),
  ],
});

// Get all jpg files sorted by name
const files = fs.readdirSync(imageDir)
  .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
  .sort();

console.log("Found images:", files);

// Build table rows: each photo duplicated, 2 copies per row, with spacers
const rows = [];
for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const name = path.parse(file).name;
  const imageData = fs.readFileSync(path.join(imageDir, file));
  const ext = path.extname(file).slice(1).toLowerCase();
  const imageType = ext === "png" ? "png" : "jpg";

  const makeCell = () =>
    new TableCell({
      borders: noBorder,
      width: { size: COL_WIDTH, type: WidthType.DXA },
      margins: cellMargins,
      verticalAlign: "center",
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          children: [
            new ImageRun({
              type: imageType,
              data: imageData,
              transformation: { width: IMAGE_SIZE, height: IMAGE_SIZE },
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60 },
          keepLines: true,
          children: [
            new TextRun({ text: name, font: "Arial", size: 20, bold: true }),
          ],
        }),
      ],
    });

  rows.push(new TableRow({
    cantSplit: true,
    children: [makeCell(), makeCell()],
  }));

  // Add spacer after each row except the last
  if (i < files.length - 1) {
    rows.push(spacerRow);
  }
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 24 },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: A4_WIDTH, height: A4_HEIGHT },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [COL_WIDTH, COL_WIDTH],
          rows,
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log("Document created:", outputPath);
});
