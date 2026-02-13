import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, CheckCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader'; // Import the PageHeader component
import QuestionImageLightbox from '../components/QuestionImageLightbox';

function ViewQuiz() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state

  useEffect(() => {
    const fetchQuiz = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/quizzes/${id}`);
        setQuiz(response.data);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError(`Failed to load quiz: ${err.response?.data?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id]);

  // --- Define Button Style ---
  // Primary style (Blue) matching CreateQuiz/ViewQuizzes but using this button's padding
  const backButtonClasses = "inline-flex items-center gap-2 px-6 py-3 bg-[#2980b9] text-white rounded hover:bg-[#2573a6] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6]";

  // --- Loading State ---
  if (loading) {
    return (
      <div className="p-8 text-center">
        <PageHeader title="Loading Quiz..." /> {/* Use PageHeader even for loading */}
        <div className="text-gray-500 animate-pulse mt-8">Fetching quiz details...</div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="p-8">
         <PageHeader title="Error" />
         <div className="text-center text-red-600 bg-red-100 p-4 rounded border border-red-300 mt-8">
           <p>{error}</p>
           <Link to="/view-quizzes" className="mt-4 inline-block text-blue-600 hover:underline">
             Go back to Quizzes list
           </Link>
         </div>
      </div>
    );
  }

  // --- Quiz Not Found State ---
  if (!quiz) {
     return (
      <div className="p-8">
         <PageHeader title="Quiz Not Found" />
         <div className="text-center text-gray-500 mt-8">
           <p>The quiz you are looking for could not be found.</p>
           <Link to="/view-quizzes" className="mt-4 inline-block text-blue-600 hover:underline">
             Go back to Quizzes list
           </Link>
         </div>
      </div>
    );
  }

  // --- Main Content ---
  return (
    <div className="p-8">
      {/* Use the PageHeader component - Pass dynamic title */}
      <PageHeader title={quiz.title} />

      {/* Description */}
      {quiz.description && (
          <p className="text-gray-600 mb-8">{quiz.description}</p>
      )}

      {/* Questions List */}
      <div className="space-y-6"> {/* Add space between question blocks */}
        {quiz.questions?.map((q, index) => (
          <div key={q._id || index} className="p-4 border border-gray-300 rounded-lg shadow-sm bg-white"> {/* Added border color, rounded-lg */}
            {/* Question Text */}
            <h2 className="font-semibold text-lg text-[#2980b9] mb-3">{index + 1}. {q.questionText}</h2>

            {/* Image (if applicable) */}
            <QuestionImageLightbox
              src={q.imageUrl}
              alt={`Question ${index + 1}`}
              wrapperClassName="mb-4"
              buttonClassName="w-full"
              imageClassName="w-full max-w-md rounded border border-gray-200" // Added border
            />

            {/* Options (for MC and Image-based) */}
            {(q.questionType === 'multiple-choice' || q.questionType === 'image-based') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2"> {/* Reduced gap */}
                {q.options && q.options.length > 0 && q.options.some(opt => opt?.trim() !== '') ? (
                  q.options.map((opt, i) => {
                    const isCorrect = opt === q.correctAnswer;
                    return (
                      <div
                        key={i}
                        className={`border rounded p-3 flex items-start gap-2 text-sm ${ // Adjusted text size
                          isCorrect
                            ? 'bg-green-100 border-green-400 text-green-800 font-medium' // Enhanced correct style
                            : 'bg-gray-50 border-gray-200 text-gray-700' // Subtle base style for options
                        }`}
                      >
                        <span className={`font-semibold w-5 text-right flex-shrink-0 ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}> {/* Adjusted width/color */}
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span>{opt || <span className="italic text-gray-400">Empty Option</span>}</span>
                        {isCorrect && <CheckCircle className="ml-auto text-green-600 flex-shrink-0" />} {/* Moved checkmark */}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-400 italic text-sm col-span-full">No options provided for this question.</div>
                )}
              </div>
            )}

            {/* Correct Answer Display (Consolidated) */}
            <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600">Correct Answer:</p>
                <p className="text-green-700 font-semibold">{q.correctAnswer || <span className="italic text-gray-400">Not specified</span>}</p>
            </div>

          </div> // End Question Block
        ))}
      </div>

      {/* Back Button */}
      <div className="mt-10 text-center"> {/* Increased top margin */}
        <Link
          to="/view-quizzes"
          className={backButtonClasses} // Apply the consistent primary button style
        >
          <BookOpen className="w-5 h-5" />
          Back to Quizzes
        </Link>
      </div>
    </div>
  );
}

export default ViewQuiz;
