// Allows users to study quizzes in an interactive session.
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, CheckCircle, RotateCcw, Send } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import CourseHeader from '../components/questions/CourseHeader';
import QuestionCard from '../components/questions/QuestionCard';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Select } from '../components/ui';

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
      <div>
        <PageHeader
          title="Study Mode"
          subtitle="Select a quiz and start practicing with immediate feedback."
        />
        {loading && <p className="text-[var(--muted)] animate-pulse mt-6">Loading available quizzes...</p>}
        {error && (
          <Card className="mt-6 text-[var(--danger)] bg-[rgb(180_35_24_/_0.08)] border-[rgb(180_35_24_/_0.3)]">
            {error}
          </Card>
        )}
        {!loading && !error && (
          <Card className="mt-6 max-w-xl mx-auto">
            <Select
              id="quizSelect"
              label="Choose a quiz to start studying"
              value={selectedQuizId}
              onChange={handleQuizSelection}
              hint="You can switch to a different quiz any time after completing the current run."
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
            </Select>
          </Card>
        )}
      </div>
    );
  }

  // 2. Show loading state while fetching the selected quiz
  if (loading) {
    return (
      <div className="text-center">
        <PageHeader title="Loading Quiz..." />
        <div className="text-[var(--muted)] animate-pulse mt-8">Fetching quiz details...</div>
      </div>
    );
  }

  // 3. Show error state if fetching the selected quiz failed (and not already submitted)
  if (error && !isSubmitted) {
    return (
      <div>
        <PageHeader title="Error Loading Quiz" />
        <Card className="text-center text-[var(--danger)] bg-[rgb(180_35_24_/_0.08)] border-[rgb(180_35_24_/_0.3)] mt-8">
          <p>{error}</p>
          <Button onClick={resetQuiz} variant="secondary" className="mt-4">
            Select Another Quiz
          </Button>
        </Card>
      </div>
    );
  }

  // 4. Show message if quiz data is somehow still null after loading/no error
  if (!quiz) {
    return (
      <div>
        <PageHeader title="Quiz Not Found" />
        <Card className="text-center text-[var(--muted)] mt-8">
          <p>Could not load quiz data.</p>
          <Button onClick={resetQuiz} variant="secondary" className="mt-4">
            Select Another Quiz
          </Button>
        </Card>
      </div>
    );
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div>
        <CourseHeader
          category="Study mode"
          title={quiz.title}
          subtitle={quiz.description || 'This quiz currently has no questions.'}
        />
        <Card className="max-w-xl mx-auto text-center text-[var(--muted)]">
          No questions are available in this quiz yet.
        </Card>
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
      <Button
        onClick={goToPreviousQuestion}
        disabled={currentQuestionIndex === 0 || saving}
        variant="secondary"
        className="min-w-[104px]"
      >
        <ArrowLeft className="w-4 h-4" />
        Previous
      </Button>

      {!isCurrentChecked ? (
        <Button
          onClick={handleCheckCurrentQuestion}
          disabled={saving || !hasCurrentAnswer}
          className="min-w-[98px]"
        >
          <CheckCircle className="w-4 h-4" />
          Check
        </Button>
      ) : currentQuestionIndex === quiz.questions.length - 1 ? (
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="min-w-[124px]"
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
        </Button>
      ) : (
        <Button onClick={goToNextQuestion} disabled={saving} className="min-w-[92px]">
          Next
          <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </>
  );

  return (
    <div className="min-h-full">
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
        <Card className="mt-6 max-w-xl mx-auto text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-[var(--text)] mb-2">Quiz Completed!</h2>
          {error && <p className="text-[var(--danger)] bg-[rgb(180_35_24_/_0.08)] p-3 rounded mb-4">{error}</p>}
          <p className="text-lg text-[var(--muted)] mb-6">
            Your Score: <span className="font-bold text-xl text-[var(--primary)]">{score ?? 'Calculating...'}</span> / {quiz.questions.length}
          </p>
          <Button onClick={resetQuiz} variant="secondary">
            <RotateCcw className="w-4 h-4 mr-1" />
            Select Another Quiz
          </Button>
        </Card>
      )}
    </div>
  );
}

export default Study;
