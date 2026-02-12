const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { createCanvas } = require('@napi-rs/canvas');

const GENERATED_MEDIA_ROOT = path.join(__dirname, '..', 'generated-media', 'pdf-pages');
const PDFIUM_EXTRACTOR_SCRIPT = path.join(__dirname, '..', 'scripts', 'pdfium_extract_assets.py');
const execFileAsync = promisify(execFile);
const DEFAULT_MAX_PAGES = 80;
const MAX_RENDER_DIMENSION = 1600;
const MIN_CROP_EDGE_PX = 120;
const MIN_CROP_AREA_RATIO = 0.008;
const MAX_IMAGE_CROP_AREA_RATIO = 0.72;
const DEFAULT_MAX_IMAGE_CROPS_PER_PAGE = 2;
const DEFAULT_MAX_TEXT_CROPS_PER_PAGE = 2;
const CROP_CONTEXT_MARGIN_PX = 100;
const MAX_CONTEXT_LENGTH = 320;
const MAX_PAGE_TEXT_LENGTH = 2600;
const TEXT_BLOCK_PADDING_PX = 28;
const MIN_TEXT_BLOCK_HEIGHT_PX = 80;
const MIN_TEXT_BLOCK_CHAR_LENGTH = 28;
const MAX_TEXT_LINES_PER_BLOCK = 6;
const MIN_TEXT_LINES_PER_BLOCK = 2;
const TEXT_LINE_Y_GAP_PX = 16;
const PDFIUM_BASE_RENDER_SCALE = 2.4;
const PDFIUM_MAX_RENDER_DIMENSION = 2400;
const PDFIUM_PYTHON_CHECK_TIMEOUT_MS = 6000;
const PDFJS_STANDARD_FONT_DATA_URL = `${path
  .join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
  .replace(/\\/g, '/')}/`;
const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

let pdfJsModulePromise;
let resolvedPdfiumPythonBinaryPromise = null;

async function getPdfJsModule() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfJsModulePromise;
}

function calculateRenderScale(viewport) {
  const largestDimension = Math.max(viewport.width, viewport.height);
  if (!largestDimension || largestDimension <= MAX_RENDER_DIMENSION) {
    return 1;
  }

  return MAX_RENDER_DIMENSION / largestDimension;
}

function multiplyTransformMatrices(left, right) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function applyTransformToPoint(matrix, x, y) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function buildBoundsFromMatrix(matrix) {
  const points = [
    applyTransformToPoint(matrix, 0, 0),
    applyTransformToPoint(matrix, 1, 0),
    applyTransformToPoint(matrix, 0, 1),
    applyTransformToPoint(matrix, 1, 1),
  ];

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function normalizeWhitespace(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStringValues(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanString(value))
        .filter(Boolean)
    )
  );
}

function parsePositiveInteger(rawValue, fallbackValue, minimum = 1) {
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedValue) || parsedValue < minimum) {
    return fallbackValue;
  }
  return parsedValue;
}

function resolveExtractionLimits(maxPages) {
  const configuredMaxPages = parsePositiveInteger(
    process.env.PDF_MAX_RENDER_PAGES,
    DEFAULT_MAX_PAGES
  );
  const resolvedMaxPages = Math.max(
    1,
    Number.isFinite(maxPages) ? Math.min(parsePositiveInteger(maxPages, configuredMaxPages), configuredMaxPages) : configuredMaxPages
  );

  const maxImageCropsPerPage = parsePositiveInteger(
    process.env.PDF_MAX_IMAGE_CROPS_PER_PAGE,
    DEFAULT_MAX_IMAGE_CROPS_PER_PAGE
  );
  const maxTextCropsPerPage = parsePositiveInteger(
    process.env.PDF_MAX_TEXT_CROPS_PER_PAGE,
    DEFAULT_MAX_TEXT_CROPS_PER_PAGE
  );
  const defaultMaxTotalCrops = Math.max(
    resolvedMaxPages,
    resolvedMaxPages * (maxImageCropsPerPage + maxTextCropsPerPage)
  );
  const maxTotalCrops = parsePositiveInteger(
    process.env.PDF_MAX_TOTAL_CROPS,
    defaultMaxTotalCrops
  );

  return {
    maxPages: resolvedMaxPages,
    maxImageCropsPerPage,
    maxTextCropsPerPage,
    maxTotalCrops,
  };
}

function buildPdfiumPythonCandidateList() {
  return uniqueStringValues([
    process.env.PDFIUM_PYTHON_BIN,
    'python3',
    '/Library/Frameworks/Python.framework/Versions/Current/bin/python3',
    '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3',
  ]);
}

async function canImportPdfiumWithPythonBinary(pythonBinary) {
  try {
    await execFileAsync(
      pythonBinary,
      ['-c', 'import pypdfium2; print("ok")'],
      {
        timeout: PDFIUM_PYTHON_CHECK_TIMEOUT_MS,
      }
    );
    return true;
  } catch {
    return false;
  }
}

async function resolvePdfiumPythonBinary() {
  if (resolvedPdfiumPythonBinaryPromise) {
    return resolvedPdfiumPythonBinaryPromise;
  }

  resolvedPdfiumPythonBinaryPromise = (async () => {
    const candidateBinaries = buildPdfiumPythonCandidateList();

    for (const pythonBinary of candidateBinaries) {
      // eslint-disable-next-line no-await-in-loop
      const isUsable = await canImportPdfiumWithPythonBinary(pythonBinary);
      if (isUsable) {
        return pythonBinary;
      }
    }

    const error = new Error(
      'No Python interpreter with pypdfium2 was found. Install with "python3 -m pip install --user pypdfium2" or set PDFIUM_PYTHON_BIN to a Python path that has pypdfium2.'
    );
    error.code = 'PDFIUM_PYTHON_NOT_FOUND';
    throw error;
  })();

  try {
    return await resolvedPdfiumPythonBinaryPromise;
  } catch (error) {
    resolvedPdfiumPythonBinaryPromise = null;
    throw error;
  }
}

function tokenizeForScore(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function clampCropBounds(bounds, pageWidth, pageHeight) {
  const x = Math.max(0, Math.floor(bounds.x));
  const y = Math.max(0, Math.floor(bounds.y));
  const maxX = Math.min(pageWidth, Math.ceil(bounds.x + bounds.width));
  const maxY = Math.min(pageHeight, Math.ceil(bounds.y + bounds.height));

  return {
    x,
    y,
    width: Math.max(0, maxX - x),
    height: Math.max(0, maxY - y),
  };
}

function calculateIntersectionOverUnion(boxA, boxB) {
  const intersectionX = Math.max(boxA.x, boxB.x);
  const intersectionY = Math.max(boxA.y, boxB.y);
  const intersectionMaxX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const intersectionMaxY = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);
  const intersectionWidth = Math.max(0, intersectionMaxX - intersectionX);
  const intersectionHeight = Math.max(0, intersectionMaxY - intersectionY);
  const intersectionArea = intersectionWidth * intersectionHeight;

  if (intersectionArea === 0) {
    return 0;
  }

  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const unionArea = areaA + areaB - intersectionArea;
  if (unionArea <= 0) {
    return 0;
  }

  return intersectionArea / unionArea;
}

function selectCropBoxesForPage(rawBounds, pageWidth, pageHeight, maxCropsPerPage) {
  const pageArea = Math.max(1, pageWidth * pageHeight);
  const filteredBounds = rawBounds
    .map((bounds) => clampCropBounds(bounds, pageWidth, pageHeight))
    .filter((bounds) => {
      if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
        return false;
      }
      if (bounds.width < MIN_CROP_EDGE_PX || bounds.height < MIN_CROP_EDGE_PX) {
        return false;
      }
      const area = bounds.width * bounds.height;
      if (area < pageArea * MIN_CROP_AREA_RATIO) {
        return false;
      }
      if (area > pageArea * MAX_IMAGE_CROP_AREA_RATIO) {
        return false;
      }
      const aspectRatio = bounds.width / bounds.height;
      return aspectRatio > 0.15 && aspectRatio < 6.5;
    })
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));

  const deduplicated = [];
  for (const bounds of filteredBounds) {
    const overlapsExisting = deduplicated.some(
      (selectedBounds) => calculateIntersectionOverUnion(selectedBounds, bounds) > 0.85
    );
    if (!overlapsExisting) {
      deduplicated.push(bounds);
    }
    if (deduplicated.length >= maxCropsPerPage) {
      break;
    }
  }

  return deduplicated;
}

function buildTextItemBounds(item, viewport) {
  const text = normalizeWhitespace(item?.str);
  if (!text) {
    return null;
  }

  const transform = Array.isArray(item?.transform) ? item.transform : IDENTITY_MATRIX;
  const combinedTransform = multiplyTransformMatrices(viewport.transform, transform);
  const x = combinedTransform[4];
  const y = combinedTransform[5];
  const fontHeight = Math.max(10, Math.abs(combinedTransform[3]) || Math.hypot(combinedTransform[2], combinedTransform[3]));
  const derivedWidth = Math.max(fontHeight * Math.max(1, text.length * 0.45), Number(item?.width || 0) * (viewport.scale || 1));

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(derivedWidth) || !Number.isFinite(fontHeight)) {
    return null;
  }

  return {
    text,
    x,
    y: y - fontHeight,
    width: Math.max(1, derivedWidth),
    height: Math.max(1, fontHeight * 1.25),
  };
}

function buildTextLines(textItems = []) {
  const sortedItems = [...textItems]
    .filter((item) => item && Number.isFinite(item.x) && Number.isFinite(item.y))
    .sort((left, right) => {
      if (Math.abs(left.y - right.y) <= 3) {
        return left.x - right.x;
      }
      return left.y - right.y;
    });

  const lines = [];

  sortedItems.forEach((item) => {
    const existingLine = lines.find((line) => Math.abs(line.centerY - (item.y + item.height / 2)) <= TEXT_LINE_Y_GAP_PX);

    if (!existingLine) {
      lines.push({
        items: [item],
        centerY: item.y + item.height / 2,
      });
      return;
    }

    existingLine.items.push(item);
    existingLine.centerY = existingLine.items.reduce((sum, currentItem) => sum + currentItem.y + currentItem.height / 2, 0) / existingLine.items.length;
  });

  return lines
    .map((line) => {
      const orderedItems = line.items.sort((left, right) => left.x - right.x);
      const text = normalizeWhitespace(orderedItems.map((item) => item.text).join(' '));
      const minX = Math.min(...orderedItems.map((item) => item.x));
      const minY = Math.min(...orderedItems.map((item) => item.y));
      const maxX = Math.max(...orderedItems.map((item) => item.x + item.width));
      const maxY = Math.max(...orderedItems.map((item) => item.y + item.height));

      return {
        text,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    })
    .filter((line) => line.text);
}

function expandBounds(bounds, padding, pageWidth, pageHeight) {
  return clampCropBounds(
    {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
    },
    pageWidth,
    pageHeight
  );
}

function selectTextCropCandidatesForPage(textItems, pageWidth, pageHeight, maxTextCropsPerPage) {
  const lines = buildTextLines(textItems);
  const pageArea = Math.max(1, pageWidth * pageHeight);
  const rawCandidates = [];

  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    let combinedText = '';
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const tokenSet = new Set();

    for (
      let endIndex = startIndex;
      endIndex < Math.min(lines.length, startIndex + MAX_TEXT_LINES_PER_BLOCK);
      endIndex += 1
    ) {
      const line = lines[endIndex];
      combinedText = normalizeWhitespace(`${combinedText} ${line.text}`);
      tokenizeForScore(line.text).forEach((token) => tokenSet.add(token));

      minX = Math.min(minX, line.x);
      minY = Math.min(minY, line.y);
      maxX = Math.max(maxX, line.x + line.width);
      maxY = Math.max(maxY, line.y + line.height);

      const lineCount = endIndex - startIndex + 1;
      if (lineCount < MIN_TEXT_LINES_PER_BLOCK || combinedText.length < MIN_TEXT_BLOCK_CHAR_LENGTH) {
        continue;
      }

      const expandedBounds = expandBounds(
        {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        },
        TEXT_BLOCK_PADDING_PX,
        pageWidth,
        pageHeight
      );

      const area = expandedBounds.width * expandedBounds.height;
      if (
        expandedBounds.width < MIN_CROP_EDGE_PX ||
        expandedBounds.height < MIN_TEXT_BLOCK_HEIGHT_PX ||
        area < pageArea * 0.004 ||
        area > pageArea * 0.68
      ) {
        continue;
      }

      const score = tokenSet.size * 2 + Math.min(200, combinedText.length) * 0.07;
      rawCandidates.push({
        bounds: expandedBounds,
        contextText: combinedText.slice(0, MAX_CONTEXT_LENGTH),
        score,
      });
    }
  }

  rawCandidates.sort((left, right) => right.score - left.score);

  const selectedCandidates = [];
  for (const candidate of rawCandidates) {
    const overlapsExisting = selectedCandidates.some(
      (selectedCandidate) => calculateIntersectionOverUnion(selectedCandidate.bounds, candidate.bounds) > 0.72
    );
    if (!overlapsExisting) {
      selectedCandidates.push(candidate);
    }
    if (selectedCandidates.length >= maxTextCropsPerPage) {
      break;
    }
  }

  return selectedCandidates;
}

function intersectsExpandedBounds(textBounds, cropBounds, margin = CROP_CONTEXT_MARGIN_PX) {
  const cropLeft = cropBounds.x - margin;
  const cropTop = cropBounds.y - margin;
  const cropRight = cropBounds.x + cropBounds.width + margin;
  const cropBottom = cropBounds.y + cropBounds.height + margin;

  const textLeft = textBounds.x;
  const textTop = textBounds.y;
  const textRight = textBounds.x + textBounds.width;
  const textBottom = textBounds.y + textBounds.height;

  return !(textRight < cropLeft || textLeft > cropRight || textBottom < cropTop || textTop > cropBottom);
}

function buildCropContextText(textItems, cropBounds) {
  if (!Array.isArray(textItems) || textItems.length === 0) {
    return '';
  }

  const matchedText = textItems
    .filter((item) => intersectsExpandedBounds(item, cropBounds))
    .map((item) => item.text)
    .join(' ');

  return normalizeWhitespace(matchedText).slice(0, MAX_CONTEXT_LENGTH);
}

async function extractTextItemsFromPage(page, viewport) {
  const textContent = await page.getTextContent();
  const textItems = [];

  for (const item of textContent.items || []) {
    const bounds = buildTextItemBounds(item, viewport);
    if (bounds) {
      textItems.push(bounds);
    }
  }

  return textItems;
}

async function renderPdfPageToCanvas(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = calculateRenderScale(baseViewport);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({ canvasContext: context, viewport }).promise;

  return { canvas, viewport };
}

async function extractImageBoundsFromPage(page, viewport, OPS) {
  const operatorList = await page.getOperatorList();
  const bounds = [];
  const stateStack = [];
  let currentTransform = IDENTITY_MATRIX.slice();
  const paintOperators = new Set([
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintJpegXObject,
    OPS.paintImageMaskXObject,
  ]);

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];

    if (operation === OPS.save) {
      stateStack.push(currentTransform.slice());
      continue;
    }

    if (operation === OPS.restore) {
      currentTransform = stateStack.pop() || IDENTITY_MATRIX.slice();
      continue;
    }

    if (operation === OPS.transform && Array.isArray(args)) {
      currentTransform = multiplyTransformMatrices(currentTransform, args);
      continue;
    }

    if (!paintOperators.has(operation)) {
      continue;
    }

    const viewportTransform = viewport.transform;
    const imageToCanvasTransform = multiplyTransformMatrices(viewportTransform, currentTransform);
    const imageBounds = buildBoundsFromMatrix(imageToCanvasTransform);

    if (
      Number.isFinite(imageBounds.x) &&
      Number.isFinite(imageBounds.y) &&
      Number.isFinite(imageBounds.width) &&
      Number.isFinite(imageBounds.height) &&
      imageBounds.width > 0 &&
      imageBounds.height > 0
    ) {
      bounds.push(imageBounds);
    }
  }

  return bounds;
}

function isPdfiumEnabledByEnv() {
  const requestedEngine = cleanString(process.env.PDF_RENDER_ENGINE).toLowerCase();
  if (requestedEngine === 'pdfjs') {
    return false;
  }
  return true;
}

function shouldFallbackToPdfJsOnPdfiumError(error) {
  const code = cleanString(error?.code);
  if (code === 'PDFIUM_PYTHON_NOT_FOUND') {
    return true;
  }

  const message = cleanString(error?.message).toLowerCase();
  return (
    message.includes('enoent') ||
    message.includes('no such file') ||
    message.includes('python') ||
    message.includes('module') ||
    message.includes('pypdfium2') ||
    message.includes('traceback') ||
    message.includes('unexpected token') ||
    message.includes('json') ||
    message.includes('command failed') ||
    message.includes('non-zero exit')
  );
}

async function runPdfiumExtractor({
  pdfBuffer,
  pagesToRender,
  outputDirectory,
  maxTotalCrops,
  maxImageCropsPerPage,
  maxTextCropsPerPage,
}) {
  const pythonBinary = await resolvePdfiumPythonBinary();
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'quiz-app-pdfium-'));
  const tempPdfPath = path.join(tempDirectory, 'source.pdf');

  try {
    await fs.writeFile(tempPdfPath, pdfBuffer);
    const { stdout, stderr } = await execFileAsync(
      pythonBinary,
      [
        PDFIUM_EXTRACTOR_SCRIPT,
        '--input',
        tempPdfPath,
        '--output-dir',
        outputDirectory,
        '--max-pages',
        String(pagesToRender),
        '--max-total-crops',
        String(maxTotalCrops),
        '--max-image-crops-per-page',
        String(maxImageCropsPerPage),
        '--max-text-crops-per-page',
        String(maxTextCropsPerPage),
        '--max-render-dimension',
        String(PDFIUM_MAX_RENDER_DIMENSION),
        '--base-render-scale',
        String(PDFIUM_BASE_RENDER_SCALE),
        '--min-crop-edge-px',
        String(MIN_CROP_EDGE_PX),
        '--min-crop-area-ratio',
        String(MIN_CROP_AREA_RATIO),
        '--max-crop-area-ratio',
        String(MAX_IMAGE_CROP_AREA_RATIO),
        '--crop-context-margin-px',
        String(CROP_CONTEXT_MARGIN_PX),
        '--max-context-length',
        String(MAX_CONTEXT_LENGTH),
        '--max-page-text-length',
        String(MAX_PAGE_TEXT_LENGTH),
        '--text-block-padding-px',
        String(TEXT_BLOCK_PADDING_PX),
        '--min-text-block-height-px',
        String(MIN_TEXT_BLOCK_HEIGHT_PX),
        '--min-text-block-char-length',
        String(MIN_TEXT_BLOCK_CHAR_LENGTH),
        '--min-text-lines-per-block',
        String(MIN_TEXT_LINES_PER_BLOCK),
        '--max-text-lines-per-block',
        String(MAX_TEXT_LINES_PER_BLOCK),
      ],
      {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 120 * 1000,
      }
    );

    const parsedOutput = JSON.parse(cleanString(stdout));
    if (cleanString(stderr)) {
      console.warn('PDFium extractor stderr:', cleanString(stderr));
    }
    return parsedOutput;
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function normalizePdfiumPageImageUrls(jobId, pageImageFiles = []) {
  if (!Array.isArray(pageImageFiles)) {
    return [];
  }

  return pageImageFiles
    .map((entry) => {
      const fileName = cleanString(entry?.fileName);
      const pageNumber = Number.parseInt(entry?.pageNumber, 10);
      if (!fileName || Number.isNaN(pageNumber) || pageNumber <= 0) {
        return null;
      }
      return {
        pageNumber,
        url: `/generated-media/pdf-pages/${jobId}/${fileName}`,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((entry) => entry.url);
}

function normalizePdfiumCandidates(jobId, candidates = []) {
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((entry) => {
      const fileName = cleanString(entry?.fileName);
      const pageNumber = Number.parseInt(entry?.pageNumber, 10);
      const width = Number(entry?.width) || 0;
      const height = Number(entry?.height) || 0;
      const area = Number(entry?.area) || width * height;
      const areaRatio = Number(entry?.areaRatio) || 0;
      const contextText = cleanString(entry?.contextText);
      const pageText = cleanString(entry?.pageText);
      const sourceType = cleanString(entry?.sourceType).toLowerCase() === 'image-object'
        ? 'image-object'
        : 'text-block';

      if (!fileName || Number.isNaN(pageNumber) || pageNumber <= 0 || area <= 0) {
        return null;
      }

      return {
        url: `/generated-media/pdf-pages/${jobId}/${fileName}`,
        pageNumber,
        width,
        height,
        area,
        areaRatio,
        contextText,
        pageText,
        sourceType,
      };
    })
    .filter(Boolean);
}

async function extractPdfVisualAssetsWithPdfium(pdfBuffer, maxPages = DEFAULT_MAX_PAGES) {
  const extractionLimits = resolveExtractionLimits(maxPages);
  const jobId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const outputDirectory = path.join(GENERATED_MEDIA_ROOT, jobId);
  await fs.mkdir(outputDirectory, { recursive: true });

  const extractorOutput = await runPdfiumExtractor({
    pdfBuffer,
    pagesToRender: extractionLimits.maxPages,
    outputDirectory,
    maxTotalCrops: extractionLimits.maxTotalCrops,
    maxImageCropsPerPage: extractionLimits.maxImageCropsPerPage,
    maxTextCropsPerPage: extractionLimits.maxTextCropsPerPage,
  });

  return {
    pageImageUrls: normalizePdfiumPageImageUrls(jobId, extractorOutput?.pageImageFiles),
    imageCandidates: normalizePdfiumCandidates(jobId, extractorOutput?.imageCandidates),
  };
}

async function extractPdfVisualAssetsWithPdfJs(pdfBuffer, maxPages = DEFAULT_MAX_PAGES) {
  const extractionLimits = resolveExtractionLimits(maxPages);
  const pdfJs = await getPdfJsModule();
  const loadingTask = pdfJs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
    verbosity: 0,
  });

  const pdfDocument = await loadingTask.promise;
  const pagesToRender = Math.min(pdfDocument.numPages, extractionLimits.maxPages);
  const jobId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const outputDirectory = path.join(GENERATED_MEDIA_ROOT, jobId);

  await fs.mkdir(outputDirectory, { recursive: true });

  const pageImageUrls = [];
  const imageCandidates = [];
  let totalCropCount = 0;

  for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const { canvas, viewport } = await renderPdfPageToCanvas(page);
    const textItems = await extractTextItemsFromPage(page, viewport);
    const pageText = normalizeWhitespace(textItems.map((item) => item.text).join(' ')).slice(0, MAX_PAGE_TEXT_LENGTH);
    const pageFileName = `page-${pageNumber}.png`;
    const pageOutputPath = path.join(outputDirectory, pageFileName);
    const pageUrl = `/generated-media/pdf-pages/${jobId}/${pageFileName}`;

    await fs.writeFile(pageOutputPath, canvas.toBuffer('image/png'));
    pageImageUrls.push(pageUrl);

    if (totalCropCount >= extractionLimits.maxTotalCrops) {
      continue;
    }

    const rawImageBounds = await extractImageBoundsFromPage(page, viewport, pdfJs.OPS);
    const cropBounds = selectCropBoxesForPage(
      rawImageBounds,
      canvas.width,
      canvas.height,
      extractionLimits.maxImageCropsPerPage
    );
    const textCropCandidates = selectTextCropCandidatesForPage(
      textItems,
      canvas.width,
      canvas.height,
      extractionLimits.maxTextCropsPerPage
    );
    let cropSequence = 1;

    for (let cropIndex = 0; cropIndex < cropBounds.length; cropIndex += 1) {
      if (totalCropCount >= extractionLimits.maxTotalCrops) {
        break;
      }

      const bounds = cropBounds[cropIndex];
      const cropCanvas = createCanvas(bounds.width, bounds.height);
      const cropContext = cropCanvas.getContext('2d');
      cropContext.drawImage(
        canvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );

      const cropFileName = `page-${pageNumber}-crop-${cropSequence}.png`;
      const cropOutputPath = path.join(outputDirectory, cropFileName);
      const cropUrl = `/generated-media/pdf-pages/${jobId}/${cropFileName}`;
      await fs.writeFile(cropOutputPath, cropCanvas.toBuffer('image/png'));

      imageCandidates.push({
        url: cropUrl,
        pageNumber,
        sourceType: 'image-object',
        width: bounds.width,
        height: bounds.height,
        area: bounds.width * bounds.height,
        areaRatio: (bounds.width * bounds.height) / Math.max(1, canvas.width * canvas.height),
        contextText: buildCropContextText(textItems, bounds),
        pageText,
      });
      cropSequence += 1;
      totalCropCount += 1;
    }

    for (let textCropIndex = 0; textCropIndex < textCropCandidates.length; textCropIndex += 1) {
      if (totalCropCount >= extractionLimits.maxTotalCrops) {
        break;
      }

      const candidate = textCropCandidates[textCropIndex];
      const bounds = candidate.bounds;
      const cropCanvas = createCanvas(bounds.width, bounds.height);
      const cropContext = cropCanvas.getContext('2d');
      cropContext.drawImage(
        canvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );

      const cropFileName = `page-${pageNumber}-crop-${cropSequence}.png`;
      const cropOutputPath = path.join(outputDirectory, cropFileName);
      const cropUrl = `/generated-media/pdf-pages/${jobId}/${cropFileName}`;
      await fs.writeFile(cropOutputPath, cropCanvas.toBuffer('image/png'));

      imageCandidates.push({
        url: cropUrl,
        pageNumber,
        sourceType: 'text-block',
        width: bounds.width,
        height: bounds.height,
        area: bounds.width * bounds.height,
        areaRatio: (bounds.width * bounds.height) / Math.max(1, canvas.width * canvas.height),
        contextText: candidate.contextText,
        pageText,
      });
      cropSequence += 1;
      totalCropCount += 1;
    }
  }

  return {
    pageImageUrls,
    imageCandidates,
  };
}

async function extractPdfVisualAssets(pdfBuffer, maxPages = DEFAULT_MAX_PAGES) {
  if (isPdfiumEnabledByEnv()) {
    try {
      const pdfiumAssets = await extractPdfVisualAssetsWithPdfium(pdfBuffer, maxPages);
      if (pdfiumAssets.pageImageUrls.length > 0) {
        return pdfiumAssets;
      }
    } catch (error) {
      if (!shouldFallbackToPdfJsOnPdfiumError(error)) {
        throw error;
      }
      console.warn('PDFium extraction unavailable, falling back to PDF.js renderer:', error.message);
    }
  }

  return extractPdfVisualAssetsWithPdfJs(pdfBuffer, maxPages);
}

async function extractPdfPageImages(pdfBuffer, maxPages = DEFAULT_MAX_PAGES) {
  const assets = await extractPdfVisualAssets(pdfBuffer, maxPages);
  return assets.pageImageUrls;
}

module.exports = {
  extractPdfPageImages,
  extractPdfVisualAssets,
};
