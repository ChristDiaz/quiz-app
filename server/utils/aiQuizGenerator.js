const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const MAX_SOURCE_CHARACTERS = 18000;
const DEFAULT_QUESTION_COUNT = 8;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;

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

function buildOpenAiPayload({ sourceText, questionCount, fileName, model }) {
  const fileLabel = cleanString(fileName) || 'uploaded-document';
  const userPrompt = [
    `Create exactly ${questionCount} quiz questions from the source text.`,
    'Only use information present in the source text.',
    'Use varied question types when reasonable.',
    'For true-false questions, the correctAnswer must be exactly "True" or "False".',
    'For multiple-choice and image-based questions, include 2 to 6 options and ensure correctAnswer matches one option exactly.',
    `Source file name: ${fileLabel}`,
    'Source text:',
    sourceText,
  ].join('\n\n');

  return {
    model,
    temperature: 0.2,
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
        content: 'You create concise, high-quality quizzes and always follow the required JSON schema.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };
}

function buildFallbackPayload({ sourceText, questionCount, fileName, model }) {
  const fileLabel = cleanString(fileName) || 'uploaded-document';
  const userPrompt = [
    `Create exactly ${questionCount} quiz questions from the source text.`,
    'Only use information present in the source text.',
    'Return valid JSON only, with this exact shape:',
    '{"title":"string","description":"string","questions":[{"questionType":"multiple-choice|true-false|fill-in-the-blank|image-based","questionText":"string","options":["string"],"correctAnswer":"string","imageUrl":"string"}]}',
    'For true-false questions, correctAnswer must be exactly "True" or "False".',
    'For multiple-choice and image-based questions, include 2 to 6 options and ensure correctAnswer matches one option exactly.',
    `Source file name: ${fileLabel}`,
    'Source text:',
    sourceText,
  ].join('\n\n');

  return {
    model,
    temperature: 0.2,
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

async function requestOpenAi(payload, openAiApiKey) {
  let openAiResponse;
  try {
    openAiResponse = await fetch(OPENAI_API_URL, {
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

function sanitizeQuestion(question) {
  const questionType = normalizeQuestionType(question?.questionType);
  const questionText = cleanString(question?.questionText);

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
    if (isHttpUrl(imageUrl)) {
      sanitizedQuestion.imageUrl = imageUrl;
    }
  }

  return sanitizedQuestion;
}

function sanitizeGeneratedQuiz(rawQuiz, questionCount) {
  const title = cleanString(rawQuiz?.title) || 'Generated Quiz';
  const description = cleanString(rawQuiz?.description) || 'Generated from uploaded document.';
  const sourceQuestions = Array.isArray(rawQuiz?.questions) ? rawQuiz.questions : [];

  const questions = sourceQuestions
    .map((question) => sanitizeQuestion(question))
    .filter(Boolean)
    .slice(0, questionCount);

  if (questions.length === 0) {
    const error = new Error('No valid quiz questions were returned by OpenAI.');
    error.code = 'INVALID_OUTPUT';
    throw error;
  }

  return { title, description, questions };
}

async function generateQuizFromDocument({ documentText, questionCount, fileName }) {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  const sourceText = cleanString(documentText);
  if (!sourceText) {
    const error = new Error('Document text is empty.');
    error.code = 'INVALID_INPUT';
    throw error;
  }

  const boundedQuestionCount = clampQuestionCount(questionCount);
  const truncatedSourceText = sourceText.slice(0, MAX_SOURCE_CHARACTERS);
  const model = cleanString(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const strictPayload = buildOpenAiPayload({
    sourceText: truncatedSourceText,
    questionCount: boundedQuestionCount,
    fileName,
    model,
  });

  let rawQuiz;
  try {
    rawQuiz = await requestOpenAi(strictPayload, openAiApiKey);
  } catch (error) {
    if (!shouldRetryWithoutJsonSchema(error)) {
      throw error;
    }

    const fallbackPayload = buildFallbackPayload({
      sourceText: truncatedSourceText,
      questionCount: boundedQuestionCount,
      fileName,
      model,
    });
    rawQuiz = await requestOpenAi(fallbackPayload, openAiApiKey);
  }

  const quiz = sanitizeGeneratedQuiz(rawQuiz, boundedQuestionCount);

  return {
    quiz,
    model,
    wasSourceTruncated: sourceText.length > MAX_SOURCE_CHARACTERS,
  };
}

module.exports = {
  generateQuizFromDocument,
  MAX_SOURCE_CHARACTERS,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
};
