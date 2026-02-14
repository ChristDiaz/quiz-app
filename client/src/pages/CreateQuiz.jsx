import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import QuestionImageLightbox from '../components/QuestionImageLightbox';
import { apiClient } from '../context/AuthContext';
import { Button, Card, Input, Select, Textarea } from '../components/ui';

const buildEmptyQuestion = () => ({
  questionType: 'multiple-choice',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  imageUrl: '',
});

const SUPPORTED_DOCUMENT_FORMATS = '.txt,.md,.markdown,.csv,.json,.pdf,.docx';

function normalizeGeneratedQuestion(question) {
  const questionType = question?.questionType || 'multiple-choice';
  const questionText = typeof question?.questionText === 'string' ? question.questionText : '';
  const correctAnswer = typeof question?.correctAnswer === 'string' ? question.correctAnswer : '';
  const imageUrl = typeof question?.imageUrl === 'string' ? question.imageUrl : '';

  if (questionType === 'multiple-choice' || questionType === 'image-based') {
    const options = Array.isArray(question?.options)
      ? question.options
        .map((option) => (typeof option === 'string' ? option.trim() : ''))
        .filter((option) => option)
      : [];

    if (correctAnswer && !options.includes(correctAnswer)) {
      options.unshift(correctAnswer);
    }

    while (options.length < 2) {
      options.push('');
    }

    return {
      questionType,
      questionText,
      options: options.slice(0, 6),
      correctAnswer,
      imageUrl,
    };
  }

  return {
    questionType,
    questionText,
    options: [],
    correctAnswer,
    imageUrl,
  };
}

function CreateQuiz() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([buildEmptyQuestion()]);
  const [success, setSuccess] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [questionCount, setQuestionCount] = useState('8');
  const [generationError, setGenerationError] = useState('');
  const [generationSuccess, setGenerationSuccess] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index][field] = value;
    setQuestions(updatedQuestions);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const updatedQuestions = [...questions];
    if (!updatedQuestions[qIndex].options) {
      updatedQuestions[qIndex].options = [];
    }

    while (updatedQuestions[qIndex].options.length <= oIndex) {
      updatedQuestions[qIndex].options.push('');
    }

    updatedQuestions[qIndex].options[oIndex] = value;
    setQuestions(updatedQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, buildEmptyQuestion()]);
  };

  const deleteQuestion = (index) => {
    const updatedQuestions = [...questions];
    updatedQuestions.splice(index, 1);
    setQuestions(updatedQuestions);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!title.trim()) {
      alert('Please enter a quiz title.');
      return;
    }

    try {
      const quizData = { title, description, questions };
      await apiClient.post('/quizzes', quizData);

      setSuccess('✅ Quiz created successfully!');
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);

      setTitle('');
      setDescription('');
      setQuestions([buildEmptyQuestion()]);
    } catch (error) {
      console.error('Error creating quiz:', error);
      alert(`Error creating quiz: ${error.response?.data?.message || error.message}`);
    }
  };

  const removeOption = (qIndex, oIndex) => {
    const updatedQuestions = [...questions];
    const questionToUpdate = { ...updatedQuestions[qIndex] };
    const newOptions = [...(questionToUpdate.options || [])];
    newOptions.splice(oIndex, 1);
    questionToUpdate.options = newOptions;
    updatedQuestions[qIndex] = questionToUpdate;
    setQuestions(updatedQuestions);
  };

  const addOption = (qIndex) => {
    const updatedQuestions = [...questions];
    const questionToUpdate = { ...updatedQuestions[qIndex] };
    const currentOptions = questionToUpdate.options || [];

    if (currentOptions.length >= 6) {
      alert('Maximum of 6 options allowed.');
      return;
    }

    questionToUpdate.options = [...currentOptions, ''];
    updatedQuestions[qIndex] = questionToUpdate;
    setQuestions(updatedQuestions);

    setTimeout(() => {
      const optionInputs = document.querySelectorAll(`[data-options-for="question-${qIndex}"] input[type="text"]`);
      const newInput = optionInputs[optionInputs.length - 1];
      if (newInput) {
        newInput.focus();
      }
    }, 50);
  };

  const handleDocumentSelection = (event) => {
    setSelectedDocument(event.target.files?.[0] || null);
    setGenerationError('');
    setGenerationSuccess('');
  };

  const handleGenerateFromDocument = async () => {
    setGenerationError('');
    setGenerationSuccess('');

    if (!selectedDocument) {
      setGenerationError('Please select a document first.');
      return;
    }

    const parsedQuestionCount = Number.parseInt(questionCount, 10);
    if (Number.isNaN(parsedQuestionCount) || parsedQuestionCount < 1 || parsedQuestionCount > 50) {
      setGenerationError('Question count must be between 1 and 50.');
      return;
    }

    const formData = new FormData();
    formData.append('document', selectedDocument);
    formData.append('questionCount', String(parsedQuestionCount));

    try {
      setIsGenerating(true);

      const response = await apiClient.post('/quizzes/generate-from-document', formData);

      const generatedQuiz = response.data?.quiz;
      const generationMetadata = response.data?.metadata || {};
      const generatedQuestions = Array.isArray(generatedQuiz?.questions)
        ? generatedQuiz.questions.map((question) => normalizeGeneratedQuestion(question))
        : [];

      if (!generatedQuiz || generatedQuestions.length === 0) {
        throw new Error('No questions were generated from the uploaded document.');
      }

      setTitle(generatedQuiz.title || title);
      setDescription(generatedQuiz.description || description);
      setQuestions(generatedQuestions);

      const attemptedImageCount = Number(generationMetadata.attemptedImageCount) || 0;
      const generatedImageCount = Number(generationMetadata.generatedImageCount) || 0;
      const attemptedPdfCropCount = Number(generationMetadata.attemptedPdfCropCount) || 0;
      const assignedPdfCropCount = Number(generationMetadata.assignedPdfCropCount) || 0;
      let imageSummary = '';

      if (attemptedPdfCropCount > 0) {
        imageSummary += ` PDF image crops assigned: ${assignedPdfCropCount}/${attemptedPdfCropCount}.`;
      }

      if (attemptedImageCount > 0) {
        imageSummary += ` Generated illustrations: ${generatedImageCount}/${attemptedImageCount}.`;
      }

      setGenerationSuccess(`Generated ${generatedQuestions.length} questions from "${selectedDocument.name}".${imageSummary}`);
    } catch (error) {
      setGenerationError(error.response?.data?.message || error.message || 'Failed to generate quiz from document.');
    } finally {
      setIsGenerating(false);
    }
  };

  const successAnimation = `
    animate-[fadeInOut_3s_ease-in-out_forwards]
    keyframes-[fadeInOut]: {
      '0%': { opacity: 0, transform: 'translateY(-10px)' },
      '10%, 90%': { opacity: 1, transform: 'translateY(0)' },
      '100%': { opacity: 0, transform: 'translateY(-10px)' }
    }
  `;

  return (
    <div>
      <PageHeader
        title="Create a New Quiz"
        subtitle="Build questions manually or generate them from a source document."
      />

      {showSuccess && (
        <div
          className={`fixed top-4 right-4 bg-[var(--success)] text-white px-6 py-3 rounded shadow-lg ${successAnimation}`}
          key={success}
        >
          {success}
        </div>
      )}

      <Card as="section" className="mb-8 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Generate Quiz from Document</h2>
          <p className="text-sm text-[var(--muted)]">
            Upload a document and generate quiz questions automatically with ChatGPT.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            id="quizSourceDocument"
            label="Document"
            type="file"
            accept={SUPPORTED_DOCUMENT_FORMATS}
            onChange={handleDocumentSelection}
            hint="Supported formats: txt, md, csv, json, pdf, docx."
            wrapperClassName="md:col-span-2"
            className="text-sm"
          />

          <Input
            id="questionCount"
            label="Question Count"
            type="number"
            min="1"
            max="50"
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
            className="text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleGenerateFromDocument}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Quiz'}
          </Button>

          {generationSuccess && <p className="text-sm text-[var(--success)]">{generationSuccess}</p>}
          {generationError && <p className="text-sm text-[var(--danger)]">{generationError}</p>}
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="space-y-4">
          <Input
            id="quizTitle"
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />

          <Textarea
            id="quizDescription"
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows="3"
          />
        </Card>

        {questions.map((question, qIndex) => (
          <Card key={qIndex} className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="font-semibold text-lg text-[var(--text)]">Question {qIndex + 1}</p>
              {questions.length > 1 && (
                <Button
                  type="button"
                  onClick={() => deleteQuestion(qIndex)}
                  variant="danger"
                  size="sm"
                >
                  Delete Question
                </Button>
              )}
            </div>

            <Select
              id={`qType-${qIndex}`}
              label="Question Type"
              value={question.questionType}
              onChange={(event) => handleQuestionChange(qIndex, 'questionType', event.target.value)}
              required
            >
              <option value="multiple-choice">Multiple Choice</option>
              <option value="true-false">True/False</option>
              <option value="fill-in-the-blank">Fill in the Blank</option>
              <option value="image-based">Image-Based</option>
            </Select>

            <Input
              id={`qText-${qIndex}`}
              label="Question Text"
              value={question.questionText}
              onChange={(event) => handleQuestionChange(qIndex, 'questionText', event.target.value)}
              required
            />

            {question.questionType === 'image-based' && (
              <div>
                <Input
                  id={`qImgUrl-${qIndex}`}
                  label="Image URL"
                  value={question.imageUrl || ''}
                  placeholder="https://example.com/image.jpg or /generated-media/..."
                  onChange={(event) => handleQuestionChange(qIndex, 'imageUrl', event.target.value)}
                  hint="Optional. Use this to attach an image to the question."
                />

                {question.imageUrl && (
                  <QuestionImageLightbox
                    src={question.imageUrl}
                    alt={`Preview for question ${qIndex + 1}`}
                    wrapperClassName="mt-2 inline-block"
                    imageClassName="max-h-40 rounded border border-gray-200"
                  />
                )}
              </div>
            )}

            {(question.questionType === 'multiple-choice' || question.questionType === 'image-based') && (
              <div className="border-t border-[var(--border)] pt-4 mt-4 space-y-3">
                <p className="block text-sm font-medium text-[var(--text)]">Options</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3" data-options-for={`question-${qIndex}`}>
                  {(question.options || []).map((option, oIndex) => (
                    <div key={oIndex}>
                      <Input
                        id={`q-${qIndex}-opt-${oIndex}`}
                        label={`Option ${oIndex + 1}`}
                        className="text-sm"
                        value={option}
                        onChange={(event) => handleOptionChange(qIndex, oIndex, event.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        onClick={() => removeOption(qIndex, oIndex)}
                        variant="ghost"
                        size="sm"
                        className="mt-1 text-[var(--danger)]"
                      >
                        Remove Option
                      </Button>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <Button type="button" onClick={() => addOption(qIndex)} variant="secondary" size="sm">+ Add Option</Button>
                  </div>
                </div>

                <Select
                  id={`qCorrect-${qIndex}`}
                  label="Correct Answer"
                  className="text-sm"
                  value={question.correctAnswer}
                  onChange={(event) => handleQuestionChange(qIndex, 'correctAnswer', event.target.value)}
                  required
                >
                  <option value="">Select Correct Answer</option>
                  {(question.options || []).map((option, oIndex) => (
                    option ? <option key={oIndex} value={option}>{option}</option> : null
                  ))}
                </Select>
              </div>
            )}

            {question.questionType === 'true-false' && (
              <div className="border-t border-[var(--border)] pt-4 mt-4">
                <Select
                  id={`qCorrect-${qIndex}`}
                  label="Correct Answer"
                  value={question.correctAnswer}
                  onChange={(event) => handleQuestionChange(qIndex, 'correctAnswer', event.target.value)}
                  required
                >
                  <option value="">Select</option>
                  <option value="True">True</option>
                  <option value="False">False</option>
                </Select>
              </div>
            )}

            {question.questionType === 'fill-in-the-blank' && (
              <div className="border-t border-[var(--border)] pt-4 mt-4">
                <Input
                  id={`qCorrect-${qIndex}`}
                  label="Correct Answer(s)"
                  hint="Separate multiple acceptable answers with ';'."
                  value={question.correctAnswer}
                  onChange={(event) => handleQuestionChange(qIndex, 'correctAnswer', event.target.value)}
                  required
                />
              </div>
            )}
          </Card>
        ))}

        <Card variant="subtle" className="flex items-center gap-4 pt-4 border-t border-[var(--border)]">
          <Button
            type="button"
            onClick={addQuestion}
            variant="secondary"
          >
            + Add Question
          </Button>

          <Button type="submit">
            Save Quiz
          </Button>
        </Card>
      </form>
    </div>
  );
}

export default CreateQuiz;
