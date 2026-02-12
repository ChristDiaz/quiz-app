const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENAI_MODEL = 'gpt-5.2';
const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 240;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildQuizSummary(sourceQuizzes = []) {
  return sourceQuizzes.map((quiz, index) => {
    const title = cleanString(quiz?.title) || `Quiz ${index + 1}`;
    const description = cleanString(quiz?.description) || 'No description provided.';
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const sampleQuestions = questions
      .slice(0, 4)
      .map((question, questionIndex) => {
        const questionText = cleanString(question?.questionText) || `Question ${questionIndex + 1}`;
        return `- ${questionText}`;
      })
      .join('\n');

    return [
      `Quiz ${index + 1} Title: ${title}`,
      `Quiz ${index + 1} Description: ${description}`,
      `Quiz ${index + 1} Question Count: ${questions.length}`,
      `Quiz ${index + 1} Sample Questions:`,
      sampleQuestions || '- No questions available.',
    ].join('\n');
  }).join('\n\n');
}

function buildMergeMetadataPayload({ sourceQuizzes = [], model }) {
  const quizSummary = buildQuizSummary(sourceQuizzes);
  const userPrompt = [
    'Create a concise title and description for a single merged study quiz.',
    `The title must be under ${MAX_TITLE_LENGTH} characters.`,
    `The description must be 1-2 sentences and under ${MAX_DESCRIPTION_LENGTH} characters.`,
    'The merged quiz should reflect the core learning topics from all source quizzes.',
    'Avoid generic names like "Combined Quiz" unless no better option exists.',
    'Source quizzes:',
    quizSummary,
  ].join('\n\n');

  return {
    model,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'merged_quiz_metadata',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'description'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: 'You create clear, educational quiz metadata and always return valid JSON.',
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

function buildFallbackTitle(sourceQuizzes = []) {
  const sourceTitles = sourceQuizzes
    .map((quiz) => cleanString(quiz?.title))
    .filter(Boolean)
    .slice(0, 3);

  if (sourceTitles.length === 0) {
    return 'Merged Study Quiz';
  }

  return `Merged: ${sourceTitles.join(' + ')}`.slice(0, MAX_TITLE_LENGTH);
}

function buildFallbackDescription(sourceQuizzes = []) {
  const totalQuestions = sourceQuizzes.reduce((total, quiz) => {
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    return total + questions.length;
  }, 0);

  return `Study set combining ${sourceQuizzes.length} quizzes and ${totalQuestions} questions.`;
}

function sanitizeMergedQuizMetadata(rawMetadata, sourceQuizzes = []) {
  const fallbackTitle = buildFallbackTitle(sourceQuizzes);
  const fallbackDescription = buildFallbackDescription(sourceQuizzes);
  const title = cleanString(rawMetadata?.title).slice(0, MAX_TITLE_LENGTH) || fallbackTitle;
  const description = cleanString(rawMetadata?.description).slice(0, MAX_DESCRIPTION_LENGTH) || fallbackDescription;

  return {
    title,
    description,
  };
}

async function generateMergedQuizMetadata(sourceQuizzes = []) {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  const model = cleanString(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const payload = buildMergeMetadataPayload({ sourceQuizzes, model });

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

  const rawMetadata = parseJsonFromContent(responseBody?.choices?.[0]?.message?.content);
  return sanitizeMergedQuizMetadata(rawMetadata, sourceQuizzes);
}

module.exports = {
  generateMergedQuizMetadata,
};
