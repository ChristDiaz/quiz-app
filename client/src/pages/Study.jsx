// Allows users to study quizzes in an interactive session.
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, CheckCircle, RotateCcw, Send } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import CourseHeader from '../components/questions/CourseHeader';
import QuestionCard from '../components/questions/QuestionCard';
import { useAuth } from '../context/AuthContext';

const formatQuestionType = (questionType = '') => {
  if (!questionType) return '';
  if (questionType === 'true-false') return 'True / False';
  return questionType
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const getQuestionKey = (question, index) =>
  question?._id ? question._id.toString() : index.toString();

function Study() {
  const { user, token, isLoggedIn } = useAuth();

  // --- State Variables ---
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [checkedQuestions, setCheckedQuestions] = useState({});
  const [feedbackByQuestion, setFeedbackByQuestion] = useState({});
  const [shakeQuestionKey, setShakeQuestionKey] = useState('');
  const [score, setScore] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false); // Used for both list and detail loading
  const [error, setError] = useState(null); // Used for both list and detail errors
  const [saving, setSaving] = useState(false);
  const shakeTimeoutRef = useRef(null);

  // --- Define Consistent Button Styles ---
  const primaryButtonClasses = 'inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2980b9] text-white rounded text-sm hover:bg-[#2573a6] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6] disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClasses = 'inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed';
  const successButtonClasses = 'inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed';

  // --- Shared correctness check ---
  const isAnswerCorrect = (question, userAnswer) => {
    const normalizedAnswer = typeof userAnswer === 'string' ? userAnswer.trim() : userAnswer;
    if (!question || !normalizedAnswer) {
      return false;
    }

    const correctAnswer = question.correctAnswer;

    if (question.questionType === 'fill-in-the-blank' && correctAnswer?.includes(';')) {
      const acceptedAnswers = correctAnswer
        .split(';')
        .map((answer) => answer.trim().toLowerCase());
      return acceptedAnswers.includes(String(normalizedAnswer).toLowerCase());
    }

    return normalizedAnswer === correctAnswer;
  };

  // --- Fetch List of Available Quizzes ---
  useEffect(() => {
    const fetchAvailableQuizzes = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('/api/quizzes?fields=title,questions');
        setAvailableQuizzes(response.data || []);
      } catch (err) {
        console.error('Error fetching available quizzes:', err);
        setError('Could not load list of quizzes.');
      } finally {
        setLoading(false);
      }
    };

    if (!selectedQuizId) {
      fetchAvailableQuizzes();
    }
  }, [selectedQuizId]);

  // --- Cleanup shake timer ---
  useEffect(() => () => {
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }
  }, []);

  // --- Fetch Full Quiz Data When Selected ---
  useEffect(() => {
    if (!selectedQuizId) {
      setQuiz(null);
      return;
    }

    const fetchQuizDetails = async () => {
      setLoading(true);
      setError(null);
      setQuiz(null);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setCheckedQuestions({});
      setFeedbackByQuestion({});
      setShakeQuestionKey('');
      setIsSubmitted(false);
      setScore(null);
      try {
        const response = await axios.get(`/api/quizzes/${selectedQuizId}`);
        setQuiz(response.data);
      } catch (err) {
        console.error(`Error fetching quiz ${selectedQuizId}:`, err);
        setError('Failed to load the selected quiz. Please try again or select another.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizDetails();
  }, [selectedQuizId]);

  // --- Event Handlers ---
  const handleQuizSelection = (event) => {
    setSelectedQuizId(event.target.value);
  };

  const handleAnswerSelect = (questionId, answer) => {
    if (isSubmitted || checkedQuestions[questionId]) return;

    setUserAnswers((prevAnswers) => ({
      ...prevAnswers,
      [questionId]: answer,
    }));

    setFeedbackByQuestion((previousFeedback) => {
      if (!previousFeedback[questionId]) return previousFeedback;
      const nextFeedback = { ...previousFeedback };
      delete nextFeedback[questionId];
      return nextFeedback;
    });
  };

  const goToNextQuestion = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prevIndex) => prevIndex - 1);
    }
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    let correctCount = 0;
    quiz.questions.forEach((question, index) => {
      const questionKey = getQuestionKey(question, index);
      if (isAnswerCorrect(question, userAnswers[questionKey])) {
        correctCount++;
      }
    });
    return correctCount;
  };

  const handleSubmit = async () => {
    if (!quiz || !window.confirm('Are you sure you want to submit your answers?')) return;
    if (!isLoggedIn || !user || !token) {
      setError('You must be logged in to save your results. Please log in and try again.');
      setIsSubmitted(true);
      setScore(calculateScore());
      return;
    }
    setSaving(true);
    setError(null);
    const calculatedScore = calculateScore();
    setScore(calculatedScore);
    setIsSubmitted(true);
    const attemptData = {
      userId: user.id,
      quizId: quiz._id,
      quizTitle: quiz.title,
      answers: userAnswers,
      score: calculatedScore,
      totalQuestions: quiz.questions.length,
    };
    try {
      await axios.post('/api/quiz-attempts', attemptData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Quiz attempt saved successfully.');
    } catch (err) {
      console.error('Error saving quiz attempt:', err);
      if (err.response && err.response.status === 401) {
        setError(`Authentication failed: ${err.response.data.message || 'Please log in again.'}`);
      } else {
        setError(`Failed to save your results: ${err.response?.data?.message || err.message}. Your score is still shown.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const resetQuiz = () => {
    setSelectedQuizId('');
    setQuiz(null);
  };

  // --- Render Logic ---

  // 1. Show selection UI if no quiz ID is set
  if (!selectedQuizId) {
    return (
      <div className="p-8">
        <PageHeader title="Study Mode - Select Quiz" />
        {loading && <p className="text-gray-500 animate-pulse mt-6">Loading available quizzes...</p>}
        {error && <p className="text-red-600 bg-red-100 p-3 rounded mt-6">{error}</p>}
        {!loading && !error && (
          <div className="mt-6 max-w-md mx-auto">
            <label htmlFor="quizSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Choose a quiz to start studying:
            </label>
            <select
              id="quizSelect"
              value={selectedQuizId}
              onChange={handleQuizSelection}
              className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
            >
              <option value="">-- Select a Quiz --</option>
              {availableQuizzes.length > 0 ? (
                availableQuizzes.map((availableQuiz) => (
                  <option key={availableQuiz._id} value={availableQuiz._id}>
                    {availableQuiz.title} ({availableQuiz.questions?.length || 0} Qs)
                  </option>
                ))
              ) : (
                <option disabled>No quizzes available</option>
              )}
            </select>
          </div>
        )}
      </div>
    );
  }

  // 2. Show loading state while fetching the selected quiz
  if (loading) {
    return (
      <div className="p-8 text-center">
        <PageHeader title="Loading Quiz..." />
        <div className="text-gray-500 animate-pulse mt-8">Fetching quiz details...</div>
      </div>
    );
  }

  // 3. Show error state if fetching the selected quiz failed (and not already submitted)
  if (error && !isSubmitted) {
    return (
      <div className="p-8">
        <PageHeader title="Error Loading Quiz" />
        <div className="text-center text-red-600 bg-red-100 p-4 rounded border border-red-300 mt-8">
          <p>{error}</p>
          <button onClick={resetQuiz} className={`${secondaryButtonClasses} mt-4`}>
            Select Another Quiz
          </button>
        </div>
      </div>
    );
  }

  // 4. Show message if quiz data is somehow still null after loading/no error
  if (!quiz) {
    return (
      <div className="p-8">
        <PageHeader title="Quiz Not Found" />
        <div className="text-center text-gray-500 mt-8">
          <p>Could not load quiz data.</p>
          <button onClick={resetQuiz} className={`${secondaryButtonClasses} mt-4`}>
            Select Another Quiz
          </button>
        </div>
      </div>
    );
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="p-8">
        <CourseHeader
          category="Study mode"
          title={quiz.title}
          subtitle={quiz.description || 'This quiz currently has no questions.'}
        />
        <div className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow border border-gray-200 text-center text-gray-600">
          No questions are available in this quiz yet.
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const questionKey = getQuestionKey(currentQuestion, currentQuestionIndex);
  const currentAnswer = userAnswers[questionKey] || '';
  const isCurrentChecked = Boolean(checkedQuestions[questionKey]);
  const currentIsCorrect = isCurrentChecked
    ? isAnswerCorrect(currentQuestion, currentAnswer)
    : false;
  const currentFeedback = feedbackByQuestion[questionKey] || null;
  const isFillIn = currentQuestion.questionType === 'fill-in-the-blank';
  const hasCurrentAnswer = isFillIn ? Boolean(currentAnswer?.trim()) : Boolean(currentAnswer);

  const handleCheckCurrentQuestion = () => {
    if (isSubmitted || isCurrentChecked) {
      return;
    }

    if (!hasCurrentAnswer) {
      setFeedbackByQuestion((prev) => ({
        ...prev,
        [questionKey]: {
          status: 'neutral',
          title: 'Select an answer',
          message: isFillIn ? 'Type an answer before checking.' : 'Choose an option before checking.',
        },
      }));
      return;
    }

    const correct = isAnswerCorrect(currentQuestion, currentAnswer);

    setCheckedQuestions((prev) => ({
      ...prev,
      [questionKey]: true,
    }));

    setFeedbackByQuestion((prev) => ({
      ...prev,
      [questionKey]: correct
        ? {
          status: 'correct',
          title: 'Correct',
          message: 'Nice work. You can continue when you are ready.',
        }
        : {
          status: 'incorrect',
          title: 'Not quite',
          message: `Correct answer: ${currentQuestion.correctAnswer || 'Not available'}`,
        },
    }));

    if (!correct) {
      setShakeQuestionKey(questionKey);
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
      shakeTimeoutRef.current = setTimeout(() => {
        setShakeQuestionKey((prev) => (prev === questionKey ? '' : prev));
      }, 240);
    }
  };

  const questionTypeTags = Array.from(
    new Set(
      quiz.questions
        .map((question) => formatQuestionType(question.questionType))
        .filter(Boolean),
    ),
  );

  const helperText = isCurrentChecked
    ? currentIsCorrect
      ? 'Answer locked. Great job.'
      : 'Answer locked. Review the explanation before continuing.'
    : isFillIn
      ? 'Type your answer, then press Check.'
      : 'Select one answer, then press Check.';

  const actions = (
    <>
      <button
        type="button"
        onClick={goToPreviousQuestion}
        disabled={currentQuestionIndex === 0 || saving}
        className={secondaryButtonClasses}
      >
        <ArrowLeft className="w-4 h-4" />
        Previous
      </button>

      {!isCurrentChecked ? (
        <button
          type="button"
          onClick={handleCheckCurrentQuestion}
          disabled={saving || !hasCurrentAnswer}
          className={primaryButtonClasses}
        >
          <CheckCircle className="w-4 h-4" />
          Check
        </button>
      ) : currentQuestionIndex === quiz.questions.length - 1 ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className={successButtonClasses}
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0A12 12 0 000 12h4zm2 5.29A7.96 7.96 0 014 12H0c0 3.04 1.13 5.82 3 7.94l3-2.65z" />
              </svg>
              Submitting...
            </>
          ) : (
            <>
              Submit Quiz
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      ) : (
        <button type="button" onClick={goToNextQuestion} disabled={saving} className={primaryButtonClasses}>
          Next
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </>
  );

  return (
    <div className="p-8 bg-[#f3f7fb] min-h-full">
      <CourseHeader
        category="Study mode"
        title={quiz.title}
        subtitle={quiz.description || 'Answer each question, check your work, and move forward at your own pace.'}
        tags={questionTypeTags}
      />

      {!isSubmitted ? (
        <QuestionCard
          question={currentQuestion}
          questionIndex={currentQuestionIndex}
          totalQuestions={quiz.questions.length}
          questionId={questionKey}
          selectedAnswer={currentAnswer}
          onAnswerChange={(answer) => handleAnswerSelect(questionKey, answer)}
          isLocked={isSubmitted || isCurrentChecked || saving}
          isChecked={isCurrentChecked}
          isAnswerCorrect={currentIsCorrect}
          feedback={currentFeedback}
          actions={actions}
          helperText={helperText}
          shakeWrongSelection={shakeQuestionKey === questionKey}
        />
      ) : (
        <div className="mt-6 max-w-xl mx-auto bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Quiz Completed!</h2>
          {error && <p className="text-red-600 bg-red-100 p-3 rounded mb-4">{error}</p>}
          <p className="text-lg text-gray-600 mb-6">
            Your Score: <span className="font-bold text-xl text-[#2980b9]">{score ?? 'Calculating...'}</span> / {quiz.questions.length}
          </p>
          <button onClick={resetQuiz} className={secondaryButtonClasses}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Select Another Quiz
          </button>
        </div>
      )}
    </div>
  );
}

export default Study;
