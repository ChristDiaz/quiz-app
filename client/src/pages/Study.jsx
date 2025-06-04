// Allows users to study quizzes in an interactive session.
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowRight, CheckCircle, Send, RotateCcw, BookOpen } from 'lucide-react'; // Added BookOpen
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

function Study() {
  const navigate = useNavigate();
  const { user, token, isLoggedIn } = useAuth();

  // --- State Variables ---
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false); // Used for both list and detail loading
  const [error, setError] = useState(null); // Used for both list and detail errors
  const [saving, setSaving] = useState(false);

  // --- Define Consistent Button Styles ---
  const primaryButtonClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2980b9] text-white rounded text-sm hover:bg-[#2573a6] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6] disabled:opacity-50 disabled:cursor-not-allowed";
  const secondaryButtonClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed";
  const successButtonClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed";

  // --- Fetch List of Available Quizzes ---
  useEffect(() => {
    const fetchAvailableQuizzes = async () => {
      setLoading(true); // Use loading state for list fetch
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

  // --- Fetch Full Quiz Data When Selected ---
  useEffect(() => {
    if (!selectedQuizId) {
      setQuiz(null);
      return;
    };
    const fetchQuizDetails = async () => {
      setLoading(true); // Use loading state for detail fetch
      setError(null);
      setQuiz(null);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setIsSubmitted(false);
      setScore(null);
      try {
        const response = await axios.get(`/api/quizzes/${selectedQuizId}`);
        setQuiz(response.data);
      } catch (err) {
        console.error(`Error fetching quiz ${selectedQuizId}:`, err);
        setError(`Failed to load the selected quiz. Please try again or select another.`);
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
    if (isSubmitted) return;
    setUserAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: answer
    }));
  };

  const goToNextQuestion = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prevIndex => prevIndex - 1);
    }
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    let correctCount = 0;
    quiz.questions.forEach((q, index) => {
      const questionKey = q._id ? q._id.toString() : index.toString();
      const userAnswer = userAnswers[questionKey];
      const correctAnswer = q.correctAnswer;
      if (q.questionType === 'fill-in-the-blank' && correctAnswer?.includes(';')) {
          const correctAnswers = correctAnswer.split(';').map(a => a.trim().toLowerCase());
          if (userAnswer && correctAnswers.includes(userAnswer.trim().toLowerCase())) {
              correctCount++;
          }
      } else if (userAnswer === correctAnswer) {
        correctCount++;
      }
    });
    return correctCount;
  };

  const handleSubmit = async () => {
    if (!quiz || !window.confirm("Are you sure you want to submit your answers?")) return;
    if (!isLoggedIn || !user || !token) {
        setError("You must be logged in to save your results. Please log in and try again.");
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
          headers: { 'Authorization': `Bearer ${token}` }
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
    // Reset other states implicitly via useEffect dependencies
  };

  // --- Render Logic ---

  // 1. Show selection UI if no quiz ID is set
  if (!selectedQuizId) {
      return (
        <div className="p-8">
          <PageHeader title="Study Mode - Select Quiz" />
          {/* Loading state for quiz list */}
          {loading && <p className="text-gray-500 animate-pulse mt-6">Loading available quizzes...</p>}
          {/* Error state for quiz list */}
          {error && <p className="text-red-600 bg-red-100 p-3 rounded mt-6">{error}</p>}
          {/* Selection Dropdown */}
          {!loading && !error && (
            <div className="mt-6 max-w-md mx-auto">
              <label htmlFor="quizSelect" className="block text-sm font-medium text-gray-700 mb-2">Choose a quiz to start studying:</label>
              <select
                id="quizSelect"
                value={selectedQuizId}
                onChange={handleQuizSelection}
                className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
              >
                <option value="">-- Select a Quiz --</option>
                {availableQuizzes.length > 0 ? (
                  availableQuizzes.map(q => (
                    <option key={q._id} value={q._id}>{q.title} ({q.questions?.length || 0} Qs)</option>
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

  // --- Main Content (Quiz or Results) ---
  // These variables are needed for both Quiz Taking and potentially Results Review (if added later)
  const currentQuestion = quiz.questions[currentQuestionIndex];
  const questionKey = currentQuestion._id ? currentQuestion._id.toString() : currentQuestionIndex.toString();
  const currentAnswer = userAnswers[questionKey] || '';

  return (
    <div className="p-8">
      <PageHeader title={`Study: ${quiz.title}`} />

      {!isSubmitted ? (
        // --- 5. Quiz Taking UI ---
        <div className="mt-6 max-w-3xl mx-auto bg-white p-6 rounded-lg shadow border border-gray-200">
           {/* Progress Indicator */}
           <div className="text-sm text-gray-500 mb-4 text-right">Question {currentQuestionIndex + 1} of {quiz.questions.length}</div>

           {/* Question Display */}
           <div className="mb-6">
             <h2 className="font-semibold text-lg text-gray-800 mb-3">{currentQuestion.questionText}</h2>
             {currentQuestion.imageUrl && (
               <img
                 src={currentQuestion.imageUrl}
                 alt={`Question ${currentQuestionIndex + 1}`}
                 className="w-full max-w-sm mx-auto mb-4 rounded border border-gray-200"
                 onError={(e) => e.target.style.display='none'}
                 onLoad={(e) => e.target.style.display='block'}
               />
             )}
           </div>

           {/* Answer Options */}
           <div className="space-y-3 mb-8">
             {/* Multiple Choice / Image Based */}
             {(currentQuestion.questionType === 'multiple-choice' || currentQuestion.questionType === 'image-based') && (
               (currentQuestion.options || []).map((option, index) => (
                 <label key={index} className={`block border rounded p-3 cursor-pointer transition-colors ${
                   currentAnswer === option
                     ? 'bg-blue-100 border-[#2980b9] ring-2 ring-[#2980b9]'
                     : 'border-gray-300 hover:bg-gray-50'
                 }`}>
                   <input
                     type="radio"
                     name={`question-${questionKey}`}
                     value={option}
                     checked={currentAnswer === option}
                     onChange={() => handleAnswerSelect(questionKey, option)}
                     className="mr-3 accent-[#2980b9]"
                   />
                   <span className="text-gray-700">{option || <span className="italic text-gray-400">Empty Option</span>}</span>
                 </label>
               ))
             )}
             {/* True/False */}
             {currentQuestion.questionType === 'true-false' && (
               <>
                 <label className={`block border rounded p-3 cursor-pointer transition-colors ${
                   currentAnswer === 'True' ? 'bg-blue-100 border-[#2980b9] ring-2 ring-[#2980b9]' : 'border-gray-300 hover:bg-gray-50'
                 }`}>
                   <input type="radio" name={`question-${questionKey}`} value="True" checked={currentAnswer === 'True'} onChange={() => handleAnswerSelect(questionKey, 'True')} className="mr-3 accent-[#2980b9]" />
                   <span className="text-gray-700">True</span>
                 </label>
                 <label className={`block border rounded p-3 cursor-pointer transition-colors ${
                   currentAnswer === 'False' ? 'bg-blue-100 border-[#2980b9] ring-2 ring-[#2980b9]' : 'border-gray-300 hover:bg-gray-50'
                 }`}>
                   <input type="radio" name={`question-${questionKey}`} value="False" checked={currentAnswer === 'False'} onChange={() => handleAnswerSelect(questionKey, 'False')} className="mr-3 accent-[#2980b9]" />
                   <span className="text-gray-700">False</span>
                 </label>
               </>
             )}
             {/* Fill in the Blank */}
             {currentQuestion.questionType === 'fill-in-the-blank' && (
               <div>
                 <input
                   type="text"
                   placeholder="Type your answer..."
                   value={currentAnswer}
                   onChange={(e) => handleAnswerSelect(questionKey, e.target.value)}
                   className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                 />
                  <p className="text-xs text-gray-500 mt-1">Separate multiple answers with ';'. Case-insensitive comparison might be needed.</p>
               </div>
             )}
           </div>

           {/* Navigation Buttons */}
           <div className="flex justify-between items-center border-t border-gray-200 pt-4">
             <button onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0 || saving} className={secondaryButtonClasses}>
               <ArrowLeft className="w-4 h-4 mr-1" /> Previous
             </button>
             {currentQuestionIndex === quiz.questions.length - 1 ? (
               <button onClick={handleSubmit} disabled={saving} className={successButtonClasses}>
                 {saving ? (
                   <> {/* Loading Spinner */}
                     <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     Submitting...
                   </>
                 ) : (
                   <>Submit Quiz <Send className="w-4 h-4 ml-1" /></>
                 )}
               </button>
             ) : (
               <button onClick={goToNextQuestion} disabled={saving} className={primaryButtonClasses}>
                 Next <ArrowRight className="w-4 h-4 ml-1" />
               </button>
             )}
           </div>
        </div> // End Quiz Taking UI div
      ) : (
        // --- 6. Results Display UI ---
        <div className="mt-6 max-w-xl mx-auto bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Quiz Completed!</h2>
          {/* Display submission error if saving failed */}
          {error && <p className="text-red-600 bg-red-100 p-3 rounded mb-4">{error}</p>}
          <p className="text-lg text-gray-600 mb-6">
            Your Score: <span className="font-bold text-xl text-[#2980b9]">{score ?? 'Calculating...'}</span> / {quiz.questions.length}
          </p>
          <button onClick={resetQuiz} className={secondaryButtonClasses}>
            <RotateCcw className="w-4 h-4 mr-1" /> Select Another Quiz
          </button>
          {/* Optional: Link to view detailed results or dashboard */}
          {/* <Link to="/dashboard" className={`${primaryButtonClasses} ml-4`}>Go to Dashboard</Link> */}
        </div> // End Results Display UI div
      )}
    </div> // End Main Content div
  );
}

export default Study;