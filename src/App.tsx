import { useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import * as pdfjsLib from 'pdfjs-dist';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type Section = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
};

const PAGE_WIDTH = 600;

export default function App() {
  const [numPages, setNumPages] = useState<number>();
  const [sections, setSections] = useState<Section[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [resumeData, setResumeData] = useState<any>(null);
  const [showModal, setShowModal] = useState(true);

  const sectionColors: Record<string, string> = {
    skills: 'bg-green-300/20 border-green-500',
    education: 'bg-blue-300/20 border-blue-500',
    experience: 'bg-yellow-300/20 border-yellow-500',
    certifications: 'bg-purple-300/20 border-purple-500',
    summary: 'bg-orange-300/20 border-orange-500',
    languages: 'bg-pink-300/20 border-pink-500',
    default: 'bg-gray-300/20 border-gray-500',
  };

  const getColor = (label: string) => {
    const key = label.toLowerCase();
    return sectionColors[key] || sectionColors.default;
  };

  useEffect(() => {
    if (!pdfFile || !resumeData) return;

    const extractText = async () => {
      const reader = new FileReader();
      reader.onload = async () => {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        const newSections: Section[] = [];

        const jsonKeys = Object.entries(resumeData)
          .filter(([_, value]) => {
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'string') return value.trim().length > 0;
            if (typeof value === 'object') return value !== null;
            return false;
          })
          .map(([key]) => key.toLowerCase());

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const originalViewport = page.getViewport({ scale: 1 });
          const scale = PAGE_WIDTH / originalViewport.width;
          const viewport = page.getViewport({ scale });

          const content = await page.getTextContent();

          const rawHeadings: Section[] = [];
          for (const item of content.items) {
            if ('str' in item) {
              const lower = item.str.toLowerCase();
              const matchedKey = jsonKeys.find((key) => lower.includes(key));
              if (matchedKey) {
                const transform = item.transform as number[];
                const x = transform[4] * scale;
                const y = viewport.height - transform[5] * scale;
                const height = item.height * scale;
                const width = viewport.width;

                const label =
                  matchedKey.charAt(0).toUpperCase() + matchedKey.slice(1);

                rawHeadings.push({
                  x,
                  y,
                  width,
                  height,
                  label,
                  page: pageNumber,
                });
              }
            }
          }

          const sorted = rawHeadings.sort((a, b) => a.y - b.y);
          for (let i = 0; i < sorted.length; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];
            const sectionHeight = next ? next.y - current.y : 150;
            newSections.push({ ...current, height: sectionHeight });
          }
        }

        setSections(newSections);
        setNumPages(totalPages);
      };
      reader.readAsArrayBuffer(pdfFile);
    };

    extractText();
  }, [pdfFile, resumeData]);

  return (
    <div className="flex w-full h-screen">
      {showModal && (
        <div className="absolute z-50 top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[500px] space-y-4">
            <h2 className="text-lg font-semibold">Upload PDF and JSON</h2>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="block w-full border p-2"
            />
            <textarea
              rows={10}
              className="w-full border p-2 font-mono text-xs"
              placeholder="Paste resume JSON here"
              onChange={(e) => {
                try {
                  setResumeData(JSON.parse(e.target.value));
                } catch (err) {
                  console.error('Invalid JSON');
                }
              }}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={() => {
                if (pdfFile && resumeData) setShowModal(false);
              }}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      <div className="w-1/2 overflow-auto text-xs font-mono whitespace-pre-wrap p-2">
        {resumeData &&
          Object.entries(resumeData).map(([key, value]) => (
            <div className={`${sectionColors[key]}`} key={key}>
              <span className={`font-bold ${sectionColors[key]}`}>"{key}"</span>
              :{' '}
              <span className="text-black">
                {typeof value === 'string' ? (
                  `"${value}"`
                ) : Array.isArray(value) ? (
                  JSON.stringify(value, null, 2)
                ) : typeof value === 'object' && value !== null ? (
                  <pre className="inline">{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  String(value)
                )}
              </span>
              ,
            </div>
          ))}
      </div>

      <div className="relative w-1/2 flex flex-col items-center pt-4 overflow-auto">
        {pdfFile && (
          <Document file={pdfFile}>
            {Array.from(new Array(numPages), (_, index) => (
              <div className="relative" key={index}>
                <Page pageNumber={index + 1} width={PAGE_WIDTH} />
                {sections
                  .filter((s) => s.page === index + 1)
                  .map((section, idx) => (
                    <div
                      key={idx}
                      className={`absolute pointer-events-none border-2 ${getColor(
                        section.label
                      )}`}
                      style={{
                        left: `${section.x}px`,
                        top: `${section.y}px`,
                        width: `${section.width}px`,
                        height: `${section.height}px`,
                      }}
                      title={section.label}
                    />
                  ))}
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
