const path = require('path');

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5.2';
const MAX_SOURCE_CHARACTERS = 18000;
const DEFAULT_QUESTION_COUNT = 8;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 50;
const PDF_MIME_TYPE = 'application/pdf';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clampQuestionCount(rawValue) {
  const parsedValue = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsedValue)) {
    return DEFAULT_QUESTION_COUNT;
  }

  return Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, parsedValue));
}

function isPdfFile({ fileName, mimeType }) {
  const extension = path.extname(cleanString(fileName)).toLowerCase();
  const normalizedMimeType = cleanString(mimeType).toLowerCase();
  return normalizedMimeType === PDF_MIME_TYPE || extension === '.pdf';
}

function buildTopicFocusRules() {
  return [
    'Only use information present in the source material.',
    'Focus on the topic knowledge itself (concepts, definitions, mechanisms, causes/effects, examples, formulas, practical understanding).',
    'Do NOT ask about document structure or metadata (section titles, chapter numbers, page numbers, tables of contents, headings, layout, formatting, authoring style).',
    'Prioritize questions that help a student learn and retain the subject.',
    'If the source references figures, diagrams, charts, graphs, screenshots, or images, include at least one image-based question.',
  ];
}

function buildJsonOutputInstruction() {
  return '{"title":"string","description":"string","questions":[{"questionType":"multiple-choice|true-false|fill-in-the-blank|image-based","questionText":"string","options":["string"],"correctAnswer":"string","imageUrl":"string","sourcePage":1}]}';
}

function buildImageUrlRules(availableImageUrls, availableImageReferences = []) {
  if (Array.isArray(availableImageReferences) && availableImageReferences.length > 0) {
    return [
      'Available image references extracted from the source document:',
      ...availableImageReferences.map((reference, index) => {
        const contextText = cleanString(reference?.contextText);
        const contextSuffix = contextText ? ` | nearby text: ${contextText.slice(0, 140)}` : '';
        return `${index + 1}. page ${reference.pageNumber}: ${reference.url}${contextSuffix}`;
      }),
      'When using questionType "image-based", set imageUrl to one of the URLs listed above.',
      'For image-based questions, set sourcePage to the page number that matches the selected imageUrl.',
      'Include at least one image-based question when references are available.',
    ];
  }

  if (!Array.isArray(availableImageUrls) || availableImageUrls.length === 0) {
    return [
      'Only use questionType "image-based" when you can provide a valid http/https imageUrl for that question. If no image URL is available, use "multiple-choice" instead.',
    ];
  }

  return [
    'Available image URLs extracted from the source document (use these exact URLs for image-based questions):',
    ...availableImageUrls.map((imageUrl, index) => `${index + 1}. ${imageUrl}`),
    'When using questionType "image-based", set imageUrl to one of the URLs listed above.',
    'If the source is a PDF and a page can be identified, set sourcePage to the page number that contains the image.',
    'Include at least one image-based question using one of the listed image URLs.',
  ];
}

function buildOpenAiPayload({
  sourceText,
  questionCount,
  fileName,
  model,
  availableImageUrls = [],
  availableImageReferences = [],
}) {
  const fileLabel = cleanString(fileName) || 'uploaded-document';
  const userPrompt = [
    `Create exactly ${questionCount} quiz questions from the source text.`,
    ...buildTopicFocusRules(),
    ...buildImageUrlRules(availableImageUrls, availableImageReferences),
    'Use varied question types when reasonable.',
    'For true-false questions, the correctAnswer must be exactly "True" or "False".',
    'For multiple-choice and image-based questions, include 2 to 6 options and ensure correctAnswer matches one option exactly.',
    `Source file name: ${fileLabel}`,
    'Source text:',
    sourceText,
  ].join('\n\n');

  return {
    model,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'generated_quiz',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'description', 'questions'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            questions: {
              type: 'array',
              minItems: 1,
              maxItems: questionCount,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['questionType', 'questionText', 'correctAnswer'],
                properties: {
                  questionType: {
                    type: 'string',
                    enum: ['multiple-choice', 'true-false', 'fill-in-the-blank', 'image-based'],
                  },
                  questionText: { type: 'string' },
                  options: {
                    type: 'array',
                    minItems: 2,
                    maxItems: 6,
                    items: { type: 'string' },
                  },
                  correctAnswer: { type: 'string' },
                  imageUrl: { type: 'string' },
                  sourcePage: {
                    type: 'integer',
                    minimum: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: 'You create high-quality study quizzes. Focus on subject mastery, never document-structure trivia, and always follow the required JSON schema.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };
}

function buildFallbackPayload({
  sourceText,
  questionCount,
  fileName,
  model,
  availableImageUrls = [],
  availableImageReferences = [],
}) {
  const fileLabel = cleanString(fileName) || 'uploaded-document';
  const userPrompt = [
    `Create exactly ${questionCount} quiz questions from the source text.`,
    ...buildTopicFocusRules(),
    ...buildImageUrlRules(availableImageUrls, availableImageReferences),
    'Return valid JSON only, with this exact shape:',
    buildJsonOutputInstruction(),
    'For true-false questions, correctAnswer must be exactly "True" or "False".',
    'For multiple-choice and image-based questions, include 2 to 6 options and ensure correctAnswer matches one option exactly.',
    `Source file name: ${fileLabel}`,
    'Source text:',
    sourceText,
  ].join('\n\n');

  return {
    model,
    messages: [
      {
        role: 'system',
        content: 'You create concise, high-quality quizzes and always return valid JSON.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };
}

function buildPdfResponsesPayload({
  fileName,
  fileBuffer,
  questionCount,
  model,
  availableImageUrls = [],
  availableImageReferences = [],
}) {
  const fileLabel = cleanString(fileName) || 'uploaded-document.pdf';
  const fileData = `data:application/pdf;base64,${fileBuffer.toString('base64')}`;
  const instructions = [
    `Read the uploaded PDF and create exactly ${questionCount} quiz questions.`,
    ...buildTopicFocusRules(),
    ...buildImageUrlRules(availableImageUrls, availableImageReferences),
    'For each image-based question, sourcePage must be the PDF page number where the referenced figure appears.',
    'Use varied question types when reasonable.',
    'For true-false questions, the correctAnswer must be exactly "True" or "False".',
    'For multiple-choice and image-based questions, include 2 to 6 options and ensure correctAnswer matches one option exactly.',
    'Return valid JSON only, with this exact shape:',
    buildJsonOutputInstruction(),
    `Source file name: ${fileLabel}`,
  ].join('\n\n');

  return {
    model,
    max_output_tokens: Math.min(24000, 1200 + questionCount * 240),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: fileLabel,
            file_data: fileData,
          },
          {
            type: 'input_text',
            text: instructions,
          },
        ],
      },
    ],
  };
}

function normalizeContentString(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function parseJsonFromContent(content) {
  const normalizedContent = normalizeContentString(content);
  if (!normalizedContent) {
    const error = new Error('OpenAI response did not include content.');
    error.code = 'INVALID_OUTPUT';
    throw error;
  }

  try {
    return JSON.parse(normalizedContent);
  } catch {
    const firstBraceIndex = normalizedContent.indexOf('{');
    const lastBraceIndex = normalizedContent.lastIndexOf('}');

    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      const candidate = normalizedContent.slice(firstBraceIndex, lastBraceIndex + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // Continue to throw structured error below.
      }
    }

    const error = new Error('OpenAI did not return valid JSON.');
    error.code = 'INVALID_OUTPUT';
    throw error;
  }
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

  return textParts.join('\n').trim();
}

function shouldRetryWithoutJsonSchema(error) {
  if (error?.code !== 'UPSTREAM_REQUEST_FAILED' || error?.httpStatus !== 400) {
    return false;
  }

  const message = cleanString(error.upstreamMessage || error.message).toLowerCase();
  return (
    message.includes('response_format') ||
    message.includes('json_schema') ||
    message.includes('unsupported') ||
    message.includes('invalid schema')
  );
}

async function requestOpenAiChatCompletion(payload, openAiApiKey) {
  let openAiResponse;
  try {
    openAiResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    const error = new Error('Unable to reach OpenAI API.');
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
    const upstreamMessage = cleanString(responseBody?.error?.message) || 'OpenAI request failed.';
    const error = new Error(upstreamMessage);
    error.code = 'UPSTREAM_REQUEST_FAILED';
    error.httpStatus = openAiResponse.status;
    error.upstreamMessage = upstreamMessage;
    throw error;
  }

  const content = responseBody?.choices?.[0]?.message?.content;
  return parseJsonFromContent(content);
}

async function requestOpenAiResponses(payload, openAiApiKey) {
  let openAiResponse;
  try {
    openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    const error = new Error('Unable to reach OpenAI API.');
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
    const upstreamMessage = cleanString(responseBody?.error?.message) || 'OpenAI request failed.';
    const error = new Error(upstreamMessage);
    error.code = 'UPSTREAM_REQUEST_FAILED';
    error.httpStatus = openAiResponse.status;
    error.upstreamMessage = upstreamMessage;
    throw error;
  }

  const content = extractResponsesOutputText(responseBody);
  return parseJsonFromContent(content);
}

function normalizeQuestionType(rawQuestionType) {
  const questionType = cleanString(rawQuestionType).toLowerCase();

  if (questionType === 'true-false' || questionType === 'true false' || questionType === 'boolean') {
    return 'true-false';
  }

  if (
    questionType === 'fill-in-the-blank' ||
    questionType === 'fill in the blank' ||
    questionType === 'fill-in'
  ) {
    return 'fill-in-the-blank';
  }

  if (questionType === 'image-based' || questionType === 'image based' || questionType === 'image') {
    return 'image-based';
  }

  return 'multiple-choice';
}

function normalizeTrueFalseAnswer(rawAnswer) {
  const answer = cleanString(rawAnswer).toLowerCase();

  if (answer === 'true' || answer === 't' || answer === 'yes') {
    return 'True';
  }

  if (answer === 'false' || answer === 'f' || answer === 'no') {
    return 'False';
  }

  return '';
}

function normalizePositiveInteger(rawValue) {
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }
  return parsedValue;
}

function isHttpUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isRelativeGeneratedMediaUrl(value) {
  return typeof value === 'string' && value.startsWith('/generated-media/');
}

function isAllowedImageUrl(value, availableImageUrls) {
  if (!Array.isArray(availableImageUrls) || availableImageUrls.length === 0) {
    return isHttpUrl(value) || isRelativeGeneratedMediaUrl(value);
  }

  return availableImageUrls.includes(value);
}

function buildImagePageLookup(availableImageReferences = []) {
  const imagePageLookup = new Map();
  if (!Array.isArray(availableImageReferences)) {
    return imagePageLookup;
  }

  availableImageReferences.forEach((reference) => {
    const imageUrl = cleanString(reference?.url);
    const pageNumber = normalizePositiveInteger(reference?.pageNumber);
    if (imageUrl && pageNumber) {
      imagePageLookup.set(imageUrl, pageNumber);
    }
  });

  return imagePageLookup;
}

function sanitizeOptions(rawOptions, rawCorrectAnswer) {
  const options = [];
  const sourceOptions = Array.isArray(rawOptions) ? rawOptions : [];

  sourceOptions.forEach((option) => {
    const cleanOption = cleanString(option);
    if (cleanOption && !options.includes(cleanOption)) {
      options.push(cleanOption);
    }
  });

  let correctAnswer = cleanString(rawCorrectAnswer);
  if (!correctAnswer && options.length > 0) {
    correctAnswer = options[0];
  }

  if (correctAnswer && !options.includes(correctAnswer)) {
    options.unshift(correctAnswer);
  }

  if (options.length < 2) {
    if (!correctAnswer) {
      correctAnswer = 'Correct Answer';
    }
    options.push('Alternative Option');
    if (!options.includes(correctAnswer)) {
      options.unshift(correctAnswer);
    }
  }

  const boundedOptions = options.slice(0, 6);
  if (!correctAnswer) {
    correctAnswer = boundedOptions[0];
  }
  if (!boundedOptions.includes(correctAnswer)) {
    boundedOptions[0] = correctAnswer;
  }

  return { options: boundedOptions, correctAnswer };
}

function sanitizeQuestion(
  question,
  availableImageUrls = [],
  fallbackImageUrl = '',
  imagePageLookup = new Map()
) {
  const questionType = normalizeQuestionType(question?.questionType);
  const questionText = cleanString(question?.questionText);
  const sourcePage = normalizePositiveInteger(question?.sourcePage);

  if (!questionText) {
    return null;
  }

  if (questionType === 'true-false') {
    const correctAnswer = normalizeTrueFalseAnswer(question?.correctAnswer);
    if (!correctAnswer) {
      return null;
    }

    return {
      questionType,
      questionText,
      correctAnswer,
    };
  }

  if (questionType === 'fill-in-the-blank') {
    const correctAnswer = cleanString(question?.correctAnswer);
    if (!correctAnswer) {
      return null;
    }

    return {
      questionType,
      questionText,
      correctAnswer,
    };
  }

  const { options, correctAnswer } = sanitizeOptions(question?.options, question?.correctAnswer);
  const sanitizedQuestion = {
    questionType,
    questionText,
    options,
    correctAnswer,
  };

  if (questionType === 'image-based') {
    const imageUrl = cleanString(question?.imageUrl);
    if (isAllowedImageUrl(imageUrl, availableImageUrls)) {
      sanitizedQuestion.imageUrl = imageUrl;
      const resolvedSourcePage = sourcePage || imagePageLookup.get(imageUrl);
      if (resolvedSourcePage) {
        sanitizedQuestion.sourcePage = resolvedSourcePage;
      }
      return sanitizedQuestion;
    }

    if (fallbackImageUrl) {
      sanitizedQuestion.imageUrl = fallbackImageUrl;
      const resolvedSourcePage = sourcePage || imagePageLookup.get(fallbackImageUrl);
      if (resolvedSourcePage) {
        sanitizedQuestion.sourcePage = resolvedSourcePage;
      }
      return sanitizedQuestion;
    }

    // Avoid "image-based" questions with no usable image source.
    sanitizedQuestion.questionType = 'multiple-choice';
  }

  return sanitizedQuestion;
}

function sanitizeGeneratedQuiz(
  rawQuiz,
  questionCount,
  availableImageUrls = [],
  availableImageReferences = []
) {
  const title = cleanString(rawQuiz?.title) || 'Generated Quiz';
  const description = cleanString(rawQuiz?.description) || 'Generated from uploaded document.';
  const sourceQuestions = Array.isArray(rawQuiz?.questions) ? rawQuiz.questions : [];
  const imagePageLookup = buildImagePageLookup(availableImageReferences);

  let imageUrlCursor = 0;
  const questions = sourceQuestions
    .map((question) => {
      const fallbackImageUrl = availableImageUrls.length > 0
        ? availableImageUrls[imageUrlCursor % availableImageUrls.length]
        : '';
      imageUrlCursor += 1;
      return sanitizeQuestion(question, availableImageUrls, fallbackImageUrl, imagePageLookup);
    })
    .filter(Boolean)
    .slice(0, questionCount);

  if (questions.length === 0) {
    const error = new Error('No valid quiz questions were returned by OpenAI.');
    error.code = 'INVALID_OUTPUT';
    throw error;
  }

  return { title, description, questions };
}

async function generateQuizFromText({
  sourceText,
  questionCount,
  fileName,
  model,
  openAiApiKey,
  availableImageUrls = [],
  availableImageReferences = [],
}) {
  const truncatedSourceText = sourceText.slice(0, MAX_SOURCE_CHARACTERS);
  const strictPayload = buildOpenAiPayload({
    sourceText: truncatedSourceText,
    questionCount,
    fileName,
    model,
    availableImageUrls,
    availableImageReferences,
  });

  let rawQuiz;
  try {
    rawQuiz = await requestOpenAiChatCompletion(strictPayload, openAiApiKey);
  } catch (error) {
    if (!shouldRetryWithoutJsonSchema(error)) {
      throw error;
    }

    const fallbackPayload = buildFallbackPayload({
      sourceText: truncatedSourceText,
      questionCount,
      fileName,
      model,
      availableImageUrls,
      availableImageReferences,
    });
    rawQuiz = await requestOpenAiChatCompletion(fallbackPayload, openAiApiKey);
  }

  return {
    rawQuiz,
    wasSourceTruncated: sourceText.length > MAX_SOURCE_CHARACTERS,
  };
}

async function generateQuizFromPdf({
  fileName,
  fileBuffer,
  questionCount,
  model,
  openAiApiKey,
  availableImageUrls = [],
  availableImageReferences = [],
}) {
  const pdfPayload = buildPdfResponsesPayload({
    fileName,
    fileBuffer,
    questionCount,
    model,
    availableImageUrls,
    availableImageReferences,
  });

  const rawQuiz = await requestOpenAiResponses(pdfPayload, openAiApiKey);
  return rawQuiz;
}

function shouldFallbackToTextMode(error) {
  if (error.code === 'INVALID_OUTPUT') {
    return true;
  }

  return error.code === 'UPSTREAM_REQUEST_FAILED' && [400, 404, 415, 422].includes(error.httpStatus);
}

async function generateQuizFromDocument({
  documentText,
  questionCount,
  fileName,
  documentBuffer,
  mimeType,
  availableImageUrls = [],
  availableImageReferences = [],
}) {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  const boundedQuestionCount = clampQuestionCount(questionCount);
  const model = cleanString(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const sourceText = cleanString(documentText);
  const usePdfInput = isPdfFile({ fileName, mimeType }) && Buffer.isBuffer(documentBuffer) && documentBuffer.length > 0;

  let rawQuiz;
  let wasSourceTruncated = false;
  let usedPdfInput = false;

  if (usePdfInput) {
    try {
      rawQuiz = await generateQuizFromPdf({
        fileName,
        fileBuffer: documentBuffer,
        questionCount: boundedQuestionCount,
        model,
        openAiApiKey,
        availableImageUrls,
        availableImageReferences,
      });
      usedPdfInput = true;
    } catch (error) {
      if (!sourceText || !shouldFallbackToTextMode(error)) {
        throw error;
      }

      const textGenerationResult = await generateQuizFromText({
        sourceText,
        questionCount: boundedQuestionCount,
        fileName,
        model,
        openAiApiKey,
        availableImageUrls,
        availableImageReferences,
      });

      rawQuiz = textGenerationResult.rawQuiz;
      wasSourceTruncated = textGenerationResult.wasSourceTruncated;
    }
  } else {
    if (!sourceText) {
      const error = new Error('Document text is empty.');
      error.code = 'INVALID_INPUT';
      throw error;
    }

    const textGenerationResult = await generateQuizFromText({
      sourceText,
      questionCount: boundedQuestionCount,
      fileName,
      model,
      openAiApiKey,
      availableImageUrls,
      availableImageReferences,
    });

    rawQuiz = textGenerationResult.rawQuiz;
    wasSourceTruncated = textGenerationResult.wasSourceTruncated;
  }

  const quiz = sanitizeGeneratedQuiz(
    rawQuiz,
    boundedQuestionCount,
    availableImageUrls,
    availableImageReferences
  );

  return {
    quiz,
    model,
    wasSourceTruncated,
    usedPdfInput,
    availableImageCount: availableImageUrls.length,
  };
}

module.exports = {
  generateQuizFromDocument,
  MAX_SOURCE_CHARACTERS,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
};
