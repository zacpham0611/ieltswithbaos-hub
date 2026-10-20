import { ReadingQuestion } from '../types';
import type { Paragraph, Table } from 'docx';

export interface DocxGeneratorOptions {
  title: string;
  courseTitle?: string;
  teacherName?: string;
  targetBand?: string;
  instructions?: string;
  passage?: string;
  questions?: ReadingQuestion[];
  rawText?: string;
  templateStyle?: 'academic' | 'clean';
  includeAnswerKey?: boolean;
}

/**
 * Builds a genuine, beautifully styled Microsoft Word (.docx) document
 */
export async function generateDocxBlob(options: DocxGeneratorOptions): Promise<Blob> {
  const docx = await import('docx');
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    PageBreak,
  } = docx;
  const {
    title,
    courseTitle = 'IELTS Master Preparation',
    teacherName = 'IELTS Teaching Hub Instructor',
    targetBand = 'Band 7.0+',
    instructions = 'Read the instructions and text carefully before answering all questions.',
    passage,
    questions = [],
    rawText,
    templateStyle = 'academic',
    includeAnswerKey = true,
  } = options;

  const children: (Paragraph | Table)[] = [];

  // ==========================================
  // 1. HEADER & COVER METADATA
  // ==========================================
  if (templateStyle === 'academic') {
    // Academic Header banner
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'IELTS TEACHING HUB — OFFICIAL ACADEMIC PRACTICE',
            bold: true,
            size: 20,
            color: '1E3A8A', // Deep Blue
            font: 'Montserrat',
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 36,
            color: '0F172A', // Slate 900
            font: 'Montserrat',
          }),
        ],
      })
    );

    // Metadata Table Box
    const metaTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Course: ', bold: true, size: 20, color: '475569' }),
                    new TextRun({ text: courseTitle, size: 20, color: '0F172A' }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Instructor: ', bold: true, size: 20, color: '475569' }),
                    new TextRun({ text: teacherName, size: 20, color: '0F172A' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Target Band: ', bold: true, size: 20, color: '475569' }),
                    new TextRun({ text: targetBand, size: 20, color: '2563EB', bold: true }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Date Generated: ', bold: true, size: 20, color: '475569' }),
                    new TextRun({ text: new Date().toLocaleDateString('en-GB'), size: 20, color: '0F172A' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    children.push(metaTable);
    children.push(new Paragraph({ spacing: { after: 200 } }));
  } else {
    // Clean Minimal Header
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 32,
            color: '1E293B',
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `${courseTitle} | ${teacherName} | Target: ${targetBand}`, italics: true, size: 20, color: '64748B' }),
        ],
      })
    );
  }

  // ==========================================
  // 2. INSTRUCTIONS CALLOUT
  // ==========================================
  if (instructions) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 100, after: 80 },
        children: [
          new TextRun({ text: 'INSTRUCTIONS', bold: true, size: 22, color: '1E3A8A' }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({ text: instructions, italics: true, size: 21, color: '334155' }),
        ],
      })
    );
  }

  // ==========================================
  // 3. READING PASSAGE / SOURCE TEXT
  // ==========================================
  if (passage) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 150, after: 100 },
        children: [
          new TextRun({ text: 'READING PASSAGE', bold: true, size: 24, color: '0F172A' }),
        ],
      })
    );

    const passageParagraphs = passage.split('\n\n').filter(Boolean);
    for (const para of passageParagraphs) {
      children.push(
        new Paragraph({
          spacing: { after: 140, line: 280 },
          children: [
            new TextRun({ text: para.trim(), size: 22, font: 'Georgia', color: '1E293B' }),
          ],
        })
      );
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  } else if (rawText && (!questions || questions.length === 0)) {
    // If raw text provided without structured questions
    const rawParagraphs = rawText.split('\n\n').filter(Boolean);
    for (const para of rawParagraphs) {
      children.push(
        new Paragraph({
          spacing: { after: 120, line: 260 },
          children: [new TextRun({ text: para.trim(), size: 21, color: '1E293B' })],
        })
      );
    }
  }

  // ==========================================
  // 4. QUESTIONS SECTION
  // ==========================================
  if (questions && questions.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 140 },
        children: [
          new TextRun({ text: 'QUESTIONS & EXERCISES', bold: true, size: 24, color: '0F172A' }),
        ],
      })
    );

    questions.forEach((q, index) => {
      // Question Title and Prompt
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({ text: `Question ${index + 1} `, bold: true, size: 22, color: '2563EB' }),
            new TextRun({ text: `(${q.type.replace(/_/g, ' ')})`, italics: true, size: 18, color: '64748B' }),
            new TextRun({ text: `: ${q.prompt}`, bold: true, size: 22, color: '0F172A' }),
          ],
        })
      );

      // Options if multiple choice
      if (q.options && q.options.length > 0) {
        for (const opt of q.options) {
          children.push(
            new Paragraph({
              indent: { left: 400 },
              spacing: { after: 40 },
              children: [
                new TextRun({ text: `[   ]  ${opt}`, size: 20, color: '334155' }),
              ],
            })
          );
        }
      } else if (q.type === 'true_false_not_given') {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Answer Choices: [ TRUE ]   [ FALSE ]   [ NOT GIVEN ]', size: 20, color: '475569', bold: true }),
            ],
          })
        );
      } else if (q.type === 'yes_no_not_given') {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Answer Choices: [ YES ]   [ NO ]   [ NOT GIVEN ]', size: 20, color: '475569', bold: true }),
            ],
          })
        );
      } else if (q.type === 'matching' && q.matchingPairs) {
        // Render matching pairs table
        const matchingRows = [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                children: [new Paragraph({ children: [new TextRun({ text: 'Item / Feature', bold: true, size: 20 })] })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                children: [new Paragraph({ children: [new TextRun({ text: 'Matching Description', bold: true, size: 20 })] })],
              }),
            ],
          }),
          ...q.matchingPairs.map(
            (pair) =>
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: pair.left, size: 20 })] })],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: pair.right, size: 20 })] })],
                  }),
                ],
              })
          ),
        ];

        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: matchingRows }));
      } else {
        // Blank answer space for fill-in-blank or short answer
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 80 },
            children: [
              new TextRun({ text: 'Your Answer: ____________________________________________________', color: '94A3B8', size: 20 }),
            ],
          })
        );
      }
    });
  }

  // ==========================================
  // 5. TEACHER ANSWER KEY & EXPLANATIONS (SEPARATE PAGE)
  // ==========================================
  if (includeAnswerKey && questions && questions.some((q) => q.correctAnswer)) {
    children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 120 },
        children: [
          new TextRun({ text: 'TEACHER ANSWER KEY & EXPLANATIONS', bold: true, size: 26, color: '1E3A8A' }),
        ],
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: 'Confidential Teacher Reference — Not for distribution before exam submission.',
            italics: true,
            size: 18,
            color: 'DC2626', // Red notice
          }),
        ],
      })
    );

    // Answer Key Table
    const keyRows = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
            children: [new Paragraph({ children: [new TextRun({ text: 'Q#', bold: true, color: 'FFFFFF', size: 20 })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
            children: [new Paragraph({ children: [new TextRun({ text: 'Correct Answer', bold: true, color: 'FFFFFF', size: 20 })] })],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
            children: [new Paragraph({ children: [new TextRun({ text: 'Citation & Pedagogical Explanation', bold: true, color: 'FFFFFF', size: 20 })] })],
          }),
        ],
      }),
      ...questions.map(
        (q, idx) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: `Q${idx + 1}`, bold: true, size: 20 })] })],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: q.correctAnswer || 'N/A', bold: true, color: '059669', size: 20 })] })],
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: q.explanation || 'Refer to passage.', size: 19, color: '334155' })] })],
              }),
            ],
          })
      ),
    ];

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: keyRows }));
  }

  // Create docx document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Triggers a real browser file download for the generated DOCX blob
 */
export function downloadDocxBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Converts a Blob to a base64 Data URL for storing in Supabase Resources
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
