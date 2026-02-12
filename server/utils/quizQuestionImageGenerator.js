const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const OPENAI_IMAGE_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const GENERATED_QUIZ_IMAGE_ROOT = path.join(__dirname, '..', 'generated-media', 'quiz-images');
const GENERATED_MEDIA_ROOT = path.join(__dirname, '..', 'generated-media');
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_IMAGE_SIZE = '1024x1024';
const DEFAULT_IMAGE_QUALITY = 'medium';
const DEFAULT_MAX_GENERATED_IMAGES = 8;
const DEFAULT_IMAGE_SELECTION_MODEL = 'gpt-4.1-mini';
const DEFAULT_MAX_VISION_RERANK_QUESTIONS = 12;
const DEFAULT_MAX_VISION_RERANK_CANDIDATES = 4;
const VISION_RERANK_MIN_SCORE_DELTA = 8;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function countRegexMatches(value, regex) {
  const matches = cleanString(value).match(regex);
  return Array.isArray(matches) ? matches.length : 0;
}

function normalizeWhitespace(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function parsePositiveInt(rawValue, fallbackValue) {
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }
  return parsedValue;
}

function isPdfPageSnapshotUrl(value) {
  return cleanString(value).startsWith('/generated-media/pdf-pages/');
}

function parsePageNumberFromSnapshotUrl(imageUrl) {
  const match = cleanString(imageUrl).match(/page-(\d+)(?:-crop-\d+)?\.png$/);
  if (!match) {
    return null;
  }

  return parsePositiveInt(match[1], null);
}

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'all', 'also', 'among', 'and', 'any', 'are', 'been', 'before',
  'being', 'below', 'between', 'both', 'but', 'can', 'could', 'does', 'each', 'for', 'from', 'have',
  'here', 'into', 'its', 'many', 'more', 'most', 'none', 'not', 'only', 'other', 'over', 'such',
  'than', 'that', 'the', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'using', 'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
]);

function tokenizeForMatching(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function uniqueTokens(tokens) {
  return Array.from(new Set(Array.isArray(tokens) ? tokens : []));
}

function countTokenHits(tokens, tokenSet) {
  if (!Array.isArray(tokens) || !tokenSet || tokenSet.size === 0) {
    return 0;
  }

  return tokens.reduce((total, token) => total + (tokenSet.has(token) ? 1 : 0), 0);
}

function calculateTableOfContentsSignal(value) {
  const text = cleanString(value).toLowerCase();
  if (!text) {
    return 0;
  }

  let signal = 0;
  if (/\b(table\s+of\s+contents|contents|index)\b/.test(text)) {
    signal += 3;
  }

  const hierarchicalNumbers = countRegexMatches(text, /\b\d+(?:\.\d+){1,4}\b/g);
  if (hierarchicalNumbers >= 4) {
    signal += 3;
  } else if (hierarchicalNumbers >= 2) {
    signal += 2;
  }

  const dottedLeaders =
    countRegexMatches(text, /\.{3,}/g) +
    countRegexMatches(text, /(?:\.\s*){4,}/g);
  if (dottedLeaders >= 2) {
    signal += 2;
  } else if (dottedLeaders >= 1) {
    signal += 1;
  }

  const standaloneNumbers = countRegexMatches(text, /(?:^|\s)\d{1,3}(?:\s|$)/g);
  if (standaloneNumbers >= 10 && hierarchicalNumbers >= 2) {
    signal += 1;
  }

  return signal;
}

function hasVisualCueInQuestion(question) {
  const questionText = cleanString(question?.questionText).toLowerCase();
  if (!questionText) {
    return false;
  }

  return /(look at|refer to|pictured|shown|image|diagram|figure|graph|chart|trace|photo|screenshot)/.test(
    questionText
  );
}

function parseBooleanEnv(rawValue, fallbackValue = false) {
  const value = cleanString(rawValue).toLowerCase();
  if (!value) {
    return fallbackValue;
  }
  if (['1', 'true', 'yes', 'on'].includes(value)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(value)) {
    return false;
  }
  return fallbackValue;
}

function extractResponsesOutputText(responseBody) {
  const directOutputText = cleanString(responseBody?.output_text);
  if (directOutputText) {
    return directOutputText;
  }

  const outputItems = Array.isArray(responseBody?.output) ? responseBody.output : [];
  const textParts = [];
  outputItems.forEach((item) => {
    if (item?.type !== 'message' || !Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (
        (contentItem?.type === 'output_text' || contentItem?.type === 'text') &&
        typeof contentItem.text === 'string'
      ) {
        textParts.push(contentItem.text);
      }
    });
  });

  return normalizeWhitespace(textParts.join('\n'));
}

function parseJsonObjectFromText(rawText) {
  const text = cleanString(rawText);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex >= 0 && endIndex > startIndex) {
      const candidate = text.slice(startIndex, endIndex + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function generatedMediaUrlToAbsolutePath(imageUrl) {
  const normalizedImageUrl = cleanString(imageUrl);
  if (!normalizedImageUrl.startsWith('/generated-media/')) {
    return null;
  }

  const relativePath = normalizedImageUrl.slice('/generated-media/'.length);
  const absolutePath = path.resolve(path.join(GENERATED_MEDIA_ROOT, relativePath));
  if (!absolutePath.startsWith(path.resolve(GENERATED_MEDIA_ROOT))) {
    return null;
  }

  return absolutePath;
}

function buildQuestionSummary(question) {
  const questionText = cleanString(question?.questionText);
  const correctAnswer = cleanString(question?.correctAnswer);
  const options = Array.isArray(question?.options)
    ? question.options.map((option) => cleanString(option)).filter(Boolean)
    : [];

  return [
    `Question: ${questionText}`,
    options.length > 0 ? `Options: ${options.join(' | ')}` : '',
    correctAnswer ? `Expected answer: ${correctAnswer}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizePdfImageCandidates(pdfImageCandidates = []) {
  if (!Array.isArray(pdfImageCandidates)) {
    return [];
  }

  return pdfImageCandidates
    .map((candidate) => {
      const url = cleanString(candidate?.url);
      const pageNumber = parsePositiveInt(candidate?.pageNumber, null);
      const width = Number(candidate?.width) || 0;
      const height = Number(candidate?.height) || 0;
      const area = Number(candidate?.area) || width * height;
      const areaRatio = Number(candidate?.areaRatio) || 0;
      const contextText = cleanString(candidate?.contextText);
      const pageText = cleanString(candidate?.pageText);
      const sourceType = cleanString(candidate?.sourceType).toLowerCase() === 'image-object'
        ? 'image-object'
        : 'text-block';
      const contextTocSignal = calculateTableOfContentsSignal(contextText);
      const pageTocSignal = calculateTableOfContentsSignal(pageText);

      if (!url || !pageNumber || area <= 0) {
        return null;
      }

      return {
        url,
        pageNumber,
        width,
        height,
        area,
        areaRatio,
        contextText,
        pageText,
        sourceType,
        tocSignal: contextTocSignal + Math.floor(pageTocSignal / 2),
        contextTokenSet: new Set(tokenizeForMatching(contextText)),
        pageTokenSet: new Set(tokenizeForMatching(pageText)),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.area - left.area);
}

function buildQuestionMatchTokens(question) {
  const options = Array.isArray(question?.options) ? question.options.join(' ') : '';
  return uniqueTokens(
    tokenizeForMatching(
      `${cleanString(question?.questionText)} ${cleanString(question?.correctAnswer)} ${cleanString(options)}`
    )
  );
}

function resolvePreferredPageForQuestion(question, questionTokens, candidatesByPage) {
  const existingImageUrl = cleanString(question?.imageUrl);
  const explicitSourcePage = parsePositiveInt(question?.sourcePage, null) || parsePageNumberFromSnapshotUrl(existingImageUrl);
  const pageScores = new Map();

  for (const [pageNumber, candidates] of candidatesByPage.entries()) {
    const pageTokenSet = candidates[0]?.pageTokenSet || new Set();
    pageScores.set(pageNumber, countTokenHits(questionTokens, pageTokenSet));
  }

  let inferredPage = null;
  let inferredScore = -1;
  for (const [pageNumber, score] of pageScores.entries()) {
    if (score > inferredScore) {
      inferredPage = pageNumber;
      inferredScore = score;
    }
  }

  if (!explicitSourcePage) {
    return inferredPage;
  }

  if (!candidatesByPage.has(explicitSourcePage)) {
    return inferredPage;
  }

  const explicitScore = pageScores.get(explicitSourcePage) || 0;
  if (inferredPage && inferredPage !== explicitSourcePage && inferredScore >= explicitScore + 2) {
    return inferredPage;
  }

  return explicitSourcePage;
}

function scoreCandidateForQuestion(candidate, questionTokens, preferredPage, usageMap, selectionHints = {}) {
  const usageCount = usageMap.get(candidate.url) || 0;
  const contextHits = countTokenHits(questionTokens, candidate.contextTokenSet);
  const pageHits = countTokenHits(questionTokens, candidate.pageTokenSet);
  const contextTokenCount = candidate.contextTokenSet.size;
  const pageTokenCount = candidate.pageTokenSet.size;
  const prefersVisualImage = Boolean(selectionHints.prefersVisualImage);
  const tocSignal = Number(candidate.tocSignal) || 0;

  let score = 0;
  if (preferredPage) {
    score += candidate.pageNumber === preferredPage ? 8 : -2;
  }
  score += contextHits * 6;
  score += pageHits * 2;
  if (contextTokenCount === 0 && pageTokenCount === 0) {
    score -= 6;
  } else if (contextTokenCount === 0) {
    score -= 2;
  }
  if (candidate.areaRatio >= 0.03 && candidate.areaRatio <= 0.45) {
    score += 4;
  } else if (candidate.areaRatio > 0.75) {
    score -= 12;
  } else if (candidate.areaRatio > 0 && candidate.areaRatio < 0.015) {
    score -= 6;
  }
  if (candidate.contextText.length >= 48) {
    score += 3;
  } else if (candidate.contextText.length > 0 && candidate.contextText.length < 18) {
    score -= 2;
  }
  if (candidate.pageText.length < 24) {
    score -= 2;
  }
  if (candidate.sourceType === 'image-object') {
    score += 8;
    if (prefersVisualImage) {
      score += 6;
    }
  } else if (candidate.sourceType === 'text-block') {
    score -= 4;
    if (prefersVisualImage) {
      score -= 10;
    }
  }
  score -= tocSignal * 7;
  if (prefersVisualImage && tocSignal >= 2) {
    score -= 10;
  }
  score -= usageCount * 4;

  return {
    score,
    usageCount,
    contextHits,
    pageHits,
    contextTokenCount,
    pageTokenCount,
  };
}

function rankCandidatesForQuestion(candidates, questionTokens, preferredPage, usageMap, selectionHints = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  return candidates
    .map((candidate) => {
      const scoring = scoreCandidateForQuestion(
        candidate,
        questionTokens,
        preferredPage,
        usageMap,
        selectionHints
      );
      return {
        candidate,
        ...scoring,
      };
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.usageCount !== right.usageCount) {
        return left.usageCount - right.usageCount;
      }
      return (right.candidate.area || 0) - (left.candidate.area || 0);
    });
}

function filterCandidatesForQuestion(candidates, selectionHints = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const prefersVisualImage = Boolean(selectionHints.prefersVisualImage);
  if (!prefersVisualImage) {
    return candidates;
  }

  const imageObjectCandidates = candidates.filter((candidate) => candidate.sourceType === 'image-object');
  const nonTocCandidates = candidates.filter((candidate) => (candidate.tocSignal || 0) < 2);
  const nonTocImageObjectCandidates = imageObjectCandidates.filter(
    (candidate) => (candidate.tocSignal || 0) < 2
  );

  if (nonTocImageObjectCandidates.length > 0) {
    return nonTocImageObjectCandidates;
  }

  if (nonTocCandidates.length > 0) {
    return nonTocCandidates;
  }

  if (imageObjectCandidates.length > 0) {
    return imageObjectCandidates;
  }

  return candidates;
}

function shouldUseVisionRerank(rankedCandidates, preferredPage) {
  if (!Array.isArray(rankedCandidates) || rankedCandidates.length < 2) {
    return false;
  }

  const topCandidate = rankedCandidates[0];
  const secondCandidate = rankedCandidates[1];
  const scoreDelta = topCandidate.score - secondCandidate.score;
  const weakTextSignal = topCandidate.contextHits < 2 && topCandidate.pageHits < 2;
  const likelyWrongPage = preferredPage && topCandidate.candidate.pageNumber !== preferredPage;

  return (
    scoreDelta <= VISION_RERANK_MIN_SCORE_DELTA ||
    weakTextSignal ||
    (likelyWrongPage && scoreDelta <= VISION_RERANK_MIN_SCORE_DELTA * 2)
  );
}

async function selectCandidateByVision({
  question,
  candidateEntries,
  openAiApiKey,
  imageSelectionModel,
}) {
  if (!Array.isArray(candidateEntries) || candidateEntries.length < 2) {
    return null;
  }

  const content = [
    {
      type: 'input_text',
      text: [
        'Pick the one crop image that best supports answering the quiz question.',
        'Return JSON only: {"selected_index": number}',
        'selected_index must be 1-based and between 1 and the number of candidates.',
        'Prefer the crop that directly contains the relevant diagram/table/text for the asked concept.',
        buildQuestionSummary(question),
      ].join('\n\n'),
    },
  ];

  const usableCandidateEntries = [];
  for (let index = 0; index < candidateEntries.length; index += 1) {
    const candidateEntry = candidateEntries[index];
    const absolutePath = generatedMediaUrlToAbsolutePath(candidateEntry?.candidate?.url);
    if (!absolutePath) {
      continue;
    }

    let imageBuffer;
    try {
      imageBuffer = await fs.readFile(absolutePath);
    } catch {
      continue;
    }

    usableCandidateEntries.push({
      entry: candidateEntry,
      imageBuffer,
    });
  }

  if (usableCandidateEntries.length < 2) {
    return null;
  }

  for (let index = 0; index < usableCandidateEntries.length; index += 1) {
    const candidateEntry = usableCandidateEntries[index].entry;
    content.push({
      type: 'input_text',
      text: `Candidate ${index + 1}: page ${candidateEntry.candidate.pageNumber}; nearby text: ${candidateEntry.candidate.contextText || 'none'}`,
    });
    content.push({
      type: 'input_image',
      image_url: `data:image/png;base64,${usableCandidateEntries[index].imageBuffer.toString('base64')}`,
    });
  }

  if (content.length <= 1) {
    return null;
  }

  let openAiResponse;
  try {
    openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: imageSelectionModel,
        max_output_tokens: 180,
        input: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    });
  } catch {
    return null;
  }

  if (!openAiResponse.ok) {
    return null;
  }

  let responseBody = null;
  try {
    responseBody = await openAiResponse.json();
  } catch {
    responseBody = null;
  }

  const outputText = extractResponsesOutputText(responseBody);
  const parsedOutput = parseJsonObjectFromText(outputText);
  const selectedIndex = Number.parseInt(parsedOutput?.selected_index, 10);

  if (Number.isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > usableCandidateEntries.length) {
    return null;
  }

  return usableCandidateEntries[selectedIndex - 1]?.entry?.candidate || null;
}

async function assignPdfCropImagesToQuizQuestions(quiz, pdfImageCandidates = []) {
  const normalizedQuiz = quiz && typeof quiz === 'object' ? quiz : {};
  const sourceQuestions = Array.isArray(normalizedQuiz.questions) ? normalizedQuiz.questions : [];
  const candidates = normalizePdfImageCandidates(pdfImageCandidates);

  if (sourceQuestions.length === 0 || candidates.length === 0) {
    return {
      quiz: normalizedQuiz,
      assignedPdfCropCount: 0,
      attemptedPdfCropCount: 0,
    };
  }

  const candidatesByPage = new Map();
  candidates.forEach((candidate) => {
    const pageCandidates = candidatesByPage.get(candidate.pageNumber) || [];
    pageCandidates.push(candidate);
    candidatesByPage.set(candidate.pageNumber, pageCandidates);
  });

  const candidateUsage = new Map();
  const candidateUrls = new Set(candidates.map((candidate) => candidate.url));
  const questions = sourceQuestions.map((question) => ({ ...question }));
  let assignedPdfCropCount = 0;
  let attemptedPdfCropCount = 0;
  const openAiApiKey = cleanString(process.env.OPENAI_API_KEY);
  const enableVisionRerank = parseBooleanEnv(process.env.OPENAI_CROP_VISION_RERANK, true) && !!openAiApiKey;
  const imageSelectionModel = cleanString(process.env.OPENAI_IMAGE_SELECTION_MODEL) || DEFAULT_IMAGE_SELECTION_MODEL;
  const maxVisionRerankQuestions = Math.max(
    0,
    parsePositiveInt(process.env.OPENAI_MAX_CROP_RERANK_QUESTIONS, DEFAULT_MAX_VISION_RERANK_QUESTIONS)
  );
  const maxVisionRerankCandidates = Math.max(
    2,
    parsePositiveInt(process.env.OPENAI_MAX_CROP_RERANK_CANDIDATES, DEFAULT_MAX_VISION_RERANK_CANDIDATES)
  );
  let visionRerankCount = 0;

  for (const question of questions) {
    if (cleanString(question?.questionType) !== 'image-based') {
      continue;
    }

    attemptedPdfCropCount += 1;
    const questionTokens = buildQuestionMatchTokens(question);
    const selectionHints = {
      prefersVisualImage: hasVisualCueInQuestion(question),
    };
    const candidatePool = filterCandidatesForQuestion(candidates, selectionHints);
    const preferredPage = resolvePreferredPageForQuestion(question, questionTokens, candidatesByPage);
    const rankedCandidates = rankCandidatesForQuestion(
      candidatePool,
      questionTokens,
      preferredPage,
      candidateUsage,
      selectionHints
    );
    let selectedCandidate = rankedCandidates[0]?.candidate || null;

    if (
      enableVisionRerank &&
      process.env.NODE_ENV !== 'test' &&
      rankedCandidates.length >= 2 &&
      visionRerankCount < maxVisionRerankQuestions &&
      shouldUseVisionRerank(rankedCandidates, preferredPage)
    ) {
      const visionCandidateEntries = rankedCandidates.slice(0, maxVisionRerankCandidates);
      const visionSelectedCandidate = await selectCandidateByVision({
        question,
        candidateEntries: visionCandidateEntries,
        openAiApiKey,
        imageSelectionModel,
      });

      if (visionSelectedCandidate) {
        selectedCandidate = visionSelectedCandidate;
        visionRerankCount += 1;
      }
    }

    if (!selectedCandidate) {
      const existingImageUrl = cleanString(question?.imageUrl);
      if (candidateUrls.has(existingImageUrl)) {
        candidateUsage.set(existingImageUrl, (candidateUsage.get(existingImageUrl) || 0) + 1);
        assignedPdfCropCount += 1;
      }
      continue;
    }

    question.imageUrl = selectedCandidate.url;
    question.sourcePage = selectedCandidate.pageNumber;
    candidateUsage.set(selectedCandidate.url, (candidateUsage.get(selectedCandidate.url) || 0) + 1);
    assignedPdfCropCount += 1;
  }

  return {
    quiz: {
      ...normalizedQuiz,
      questions,
    },
    assignedPdfCropCount,
    attemptedPdfCropCount,
  };
}

function shouldGenerateImageForQuestion(question) {
  if (cleanString(question?.questionType) !== 'image-based') {
    return false;
  }

  const imageUrl = cleanString(question?.imageUrl);
  return !imageUrl || isPdfPageSnapshotUrl(imageUrl);
}

function buildQuestionImagePrompt({ quizTitle, quizDescription, question, questionNumber }) {
  const title = cleanString(quizTitle);
  const description = cleanString(quizDescription);
  const questionText = cleanString(question?.questionText);
  const correctAnswer = cleanString(question?.correctAnswer);
  const options = Array.isArray(question?.options)
    ? question.options.map((option) => cleanString(option)).filter(Boolean)
    : [];

  return [
    'Create a clean educational diagram or illustration for a quiz question.',
    title ? `Quiz topic: ${title}` : '',
    description ? `Quiz context: ${description}` : '',
    `Question ${questionNumber}: ${questionText}`,
    correctAnswer ? `Correct answer concept: ${correctAnswer}` : '',
    options.length > 0 ? `Options: ${options.join(' | ')}` : '',
    'Requirements:',
    '- The image must directly help answer the question.',
    '- Use a clear white or light background.',
    '- Avoid watermarks, logos, and decorative clutter.',
    '- Keep text labels minimal and only when necessary.',
    '- Produce one standalone image.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function requestOpenAiGeneratedImage({
  prompt,
  openAiApiKey,
  imageModel,
  imageSize,
  imageQuality,
}) {
  let openAiResponse;
  try {
    openAiResponse = await fetch(OPENAI_IMAGE_GENERATIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        size: imageSize,
        quality: imageQuality,
      }),
    });
  } catch {
    const error = new Error('Unable to reach OpenAI image generation API.');
    error.code = 'UPSTREAM_NETWORK_ERROR';
    throw error;
  }

  let responseBody = null;
  try {
    responseBody = await openAiResponse.json();
  } catch {
    responseBody = null;
  }

  if (!openAiResponse.ok) {
    const upstreamMessage = cleanString(responseBody?.error?.message) || 'OpenAI image generation failed.';
    const error = new Error(upstreamMessage);
    error.code = 'UPSTREAM_REQUEST_FAILED';
    error.httpStatus = openAiResponse.status;
    error.upstreamMessage = upstreamMessage;
    throw error;
  }

  const imageBase64 = cleanString(responseBody?.data?.[0]?.b64_json);
  if (!imageBase64) {
    const error = new Error('OpenAI image generation did not return image bytes.');
    error.code = 'INVALID_OUTPUT';
    throw error;
  }

  return Buffer.from(imageBase64, 'base64');
}

async function attachGeneratedImagesToQuizQuestions(quiz, options = {}) {
  const normalizedQuiz = quiz && typeof quiz === 'object' ? quiz : {};
  const cropAssignmentResult = await assignPdfCropImagesToQuizQuestions(
    normalizedQuiz,
    options?.pdfImageCandidates || []
  );
  const quizAfterPdfCrops = cropAssignmentResult.quiz;
  const sourceQuestions = Array.isArray(quizAfterPdfCrops.questions) ? quizAfterPdfCrops.questions : [];
  const imageGenerationModel = cleanString(process.env.OPENAI_IMAGE_MODEL) || DEFAULT_IMAGE_MODEL;

  if (process.env.NODE_ENV === 'test') {
    return {
      quiz: quizAfterPdfCrops,
      assignedPdfCropCount: cropAssignmentResult.assignedPdfCropCount,
      attemptedPdfCropCount: cropAssignmentResult.attemptedPdfCropCount,
      generatedImageCount: 0,
      attemptedImageCount: 0,
      imageGenerationModel,
    };
  }

  const imageGenerationEnabled = cleanString(process.env.OPENAI_GENERATE_QUESTION_IMAGES).toLowerCase() === 'true';
  const openAiApiKey = cleanString(process.env.OPENAI_API_KEY);
  if (!imageGenerationEnabled || !openAiApiKey || sourceQuestions.length === 0) {
    return {
      quiz: quizAfterPdfCrops,
      assignedPdfCropCount: cropAssignmentResult.assignedPdfCropCount,
      attemptedPdfCropCount: cropAssignmentResult.attemptedPdfCropCount,
      generatedImageCount: 0,
      attemptedImageCount: 0,
      imageGenerationModel,
    };
  }

  const maxGeneratedImages = Math.min(
    20,
    parsePositiveInt(process.env.OPENAI_MAX_GENERATED_QUESTION_IMAGES, DEFAULT_MAX_GENERATED_IMAGES)
  );
  const imageModel = imageGenerationModel;
  const imageSize = cleanString(process.env.OPENAI_IMAGE_SIZE) || DEFAULT_IMAGE_SIZE;
  const imageQuality = cleanString(process.env.OPENAI_IMAGE_QUALITY) || DEFAULT_IMAGE_QUALITY;

  const targetQuestionIndexes = sourceQuestions
    .map((question, index) => (shouldGenerateImageForQuestion(question) ? index : -1))
    .filter((index) => index >= 0)
    .slice(0, maxGeneratedImages);

  if (targetQuestionIndexes.length === 0) {
    return {
      quiz: quizAfterPdfCrops,
      assignedPdfCropCount: cropAssignmentResult.assignedPdfCropCount,
      attemptedPdfCropCount: cropAssignmentResult.attemptedPdfCropCount,
      generatedImageCount: 0,
      attemptedImageCount: 0,
      imageGenerationModel: imageModel,
    };
  }

  const questions = sourceQuestions.map((question) => ({ ...question }));
  const jobId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const outputDirectory = path.join(GENERATED_QUIZ_IMAGE_ROOT, jobId);
  try {
    await fs.mkdir(outputDirectory, { recursive: true });
  } catch (error) {
    console.warn('Unable to prepare generated image directory:', error.message);
    return {
      quiz: quizAfterPdfCrops,
      assignedPdfCropCount: cropAssignmentResult.assignedPdfCropCount,
      attemptedPdfCropCount: cropAssignmentResult.attemptedPdfCropCount,
      generatedImageCount: 0,
      attemptedImageCount: 0,
      imageGenerationModel: imageModel,
    };
  }

  let generatedImageCount = 0;

  for (const questionIndex of targetQuestionIndexes) {
    const question = questions[questionIndex];
    const prompt = buildQuestionImagePrompt({
      quizTitle: normalizedQuiz.title,
      quizDescription: normalizedQuiz.description,
      question,
      questionNumber: questionIndex + 1,
    });

    try {
      const imageBuffer = await requestOpenAiGeneratedImage({
        prompt,
        openAiApiKey,
        imageModel,
        imageSize,
        imageQuality,
      });
      const fileName = `question-${questionIndex + 1}.png`;
      await fs.writeFile(path.join(outputDirectory, fileName), imageBuffer);
      question.imageUrl = `/generated-media/quiz-images/${jobId}/${fileName}`;
      generatedImageCount += 1;
    } catch (error) {
      console.warn('Unable to generate image for quiz question:', {
        questionIndex,
        status: error.httpStatus,
        message: error.upstreamMessage || error.message,
      });
    }
  }

  return {
    quiz: {
      ...quizAfterPdfCrops,
      questions,
    },
    assignedPdfCropCount: cropAssignmentResult.assignedPdfCropCount,
    attemptedPdfCropCount: cropAssignmentResult.attemptedPdfCropCount,
    generatedImageCount,
    attemptedImageCount: targetQuestionIndexes.length,
    imageGenerationModel: imageModel,
  };
}

module.exports = {
  attachGeneratedImagesToQuizQuestions,
};
