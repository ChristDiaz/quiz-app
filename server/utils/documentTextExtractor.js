const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.pdf',
  '.docx',
]);

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
]);

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const SUPPORTED_DOCUMENT_MESSAGE = 'Supported formats: .txt, .md, .csv, .json, .pdf, .docx.';

function buildError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getFileExtension(fileName) {
  if (typeof fileName !== 'string') {
    return '';
  }

  return path.extname(fileName).toLowerCase();
}

function isPdf(file) {
  const extension = getFileExtension(file.originalname);
  const mimeType = file.mimetype || '';
  return mimeType === PDF_MIME_TYPE || extension === '.pdf';
}

function isDocx(file) {
  const extension = getFileExtension(file.originalname);
  const mimeType = file.mimetype || '';
  return mimeType === DOCX_MIME_TYPE || extension === '.docx';
}

function isTextDocument(file) {
  const extension = getFileExtension(file.originalname);
  const mimeType = file.mimetype || '';
  return mimeType.startsWith('text/') || TEXT_MIME_TYPES.has(mimeType) || TEXT_EXTENSIONS.has(extension);
}

async function extractTextFromDocument(file) {
  if (!file || !file.buffer || !file.originalname) {
    throw buildError('A document file is required.', 'INVALID_FILE');
  }

  if (isPdf(file)) {
    const parsedPdf = await pdfParse(file.buffer);
    return parsedPdf.text || '';
  }

  if (isDocx(file)) {
    const parsedDocx = await mammoth.extractRawText({ buffer: file.buffer });
    return parsedDocx.value || '';
  }

  if (isTextDocument(file)) {
    return file.buffer.toString('utf8');
  }

  throw buildError(`Unsupported document type. ${SUPPORTED_DOCUMENT_MESSAGE}`, 'UNSUPPORTED_FILE_TYPE');
}

module.exports = {
  extractTextFromDocument,
  MAX_UPLOAD_BYTES,
  SUPPORTED_DOCUMENT_MESSAGE,
};
