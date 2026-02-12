import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Added Link
import axios from 'axios';
import PageHeader from '../components/PageHeader'; // Import the PageHeader component

function EditQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state
  const [success, setSuccess] = useState(false); // Keep success message state
  const [savingQuestionIndex, setSavingQuestionIndex] = useState(null);
  const [dirtyQuestions, setDirtyQuestions] = useState([]);

  // --- Define Consistent Button Styles ---

  // Primary (Blue - for main Save Changes & Save Question)
  const primaryButtonBase = "text-white rounded transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const primaryButtonColors = "bg-[#2980b9] hover:bg-[#2573a6] focus:ring-[#2573a6]";

  const saveAllButtonClasses = `${primaryButtonBase} ${primaryButtonColors} px-4 py-2`;
  const saveQuestionButtonClasses = `${primaryButtonBase} ${primaryButtonColors} px-3 py-2 mt-2`;

  // Secondary (Gray - for Cancel)
  const secondaryButtonClasses = "bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  // Tertiary Link (Blue - for Add Option)
  const tertiaryLinkBlueClasses = "text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50 disabled:cursor-not-allowed mt-2";

  // Tertiary Link (Red - for Remove Option)
  const tertiaryLinkRedClasses = "text-sm text-red-500 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded disabled:opacity-50 disabled:cursor-not-allowed ml-2";

  // --- End Button Styles ---

  // --- Input/Select Styles ---
  const inputBaseClasses = "border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent disabled:bg-gray-100";
  const inputSmallClasses = `${inputBaseClasses} text-sm`; // For option inputs
  // --- End Input/Select Styles ---


  // --- Data Fetching ---
  useEffect(() => {
    const fetchQuizData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/quizzes/${id}`);
        setQuiz(response.data);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError(`Failed to load quiz data: ${err.response?.data?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchQuizData();
  }, [id]);

  // Function to refetch quiz data (used if needed after save errors etc.)
  const fetchQuiz = async () => {
    try {
      const response = await axios.get(`/api/quizzes/${id}`);
      setQuiz(response.data);
    } catch (error) {
      console.error('Error fetching quiz:', error);
      // Potentially set error state here too
    }
  };
  // --- End Data Fetching ---


  // --- Unsaved Changes Warning ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirtyQuestions.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirtyQuestions]);
  // --- End Unsaved Changes Warning ---


  // --- Event Handlers ---
  const handleChange = (field, value) => {
    setQuiz({ ...quiz, [field]: value });
    setDirtyQuestions((prev) => (prev.includes('meta') ? prev : [...prev, 'meta']));
  };

  const handleQuestionDetailChange = (qIndex, field, value, oIndex = null) => {
    const updatedQuestions = [...quiz.questions];
    const questionToUpdate = { ...updatedQuestions[qIndex] };

    if (field === 'options' && oIndex !== null) {
      const newOptions = [...(questionToUpdate.options || [])];
      newOptions[oIndex] = value;
      questionToUpdate.options = newOptions;
    } else {
      questionToUpdate[field] = value;
    }

    updatedQuestions[qIndex] = questionToUpdate;
    setQuiz({ ...quiz, questions: updatedQuestions });
    setDirtyQuestions((prev) => (prev.includes(qIndex) ? prev : [...prev, qIndex]));
  };

   const removeOption = (qIndex, oIndex) => {
    const updatedQuestions = [...quiz.questions];
    const questionToUpdate = { ...updatedQuestions[qIndex] };
    const newOptions = [...(questionToUpdate.options || [])];
    newOptions.splice(oIndex, 1);
    questionToUpdate.options = newOptions;
    updatedQuestions[qIndex] = questionToUpdate;
    setQuiz({ ...quiz, questions: updatedQuestions });
    setDirtyQuestions((prev) => (prev.includes(qIndex) ? prev : [...prev, qIndex]));
  };

  const addOption = (qIndex) => {
    const updatedQuestions = [...quiz.questions];
    const questionToUpdate = { ...updatedQuestions[qIndex] };
    const currentOptions = questionToUpdate.options || [];
    if (currentOptions.length >= 6) {
      alert('Maximum of 6 options allowed.');
      return;
    }
    questionToUpdate.options = [...currentOptions, ''];
    updatedQuestions[qIndex] = questionToUpdate;
    setQuiz({ ...quiz, questions: updatedQuestions });
    setDirtyQuestions((prev) => (prev.includes(qIndex) ? prev : [...prev, qIndex]));

    setTimeout(() => {
      const optionInputs = document.querySelectorAll(`[data-options-for="question-${qIndex}"] input[type="text"]`);
      const newInput = optionInputs[optionInputs.length - 1];
      if (newInput) {
        newInput.focus();
      }
    }, 50);
  };

  // Save individual question
  const handleSaveQuestion = async (qIndex) => {
    setSavingQuestionIndex(qIndex);
    try {
      const updatedQuestion = quiz.questions[qIndex];
      if (!updatedQuestion._id) {
          console.error("Cannot save question without an ID.");
          alert("Error: Question ID is missing. Cannot save."); // User feedback
          setSavingQuestionIndex(null);
          return;
      }
      const questionIdToSave = updatedQuestion._id;

      const response = await axios.put(`/api/quizzes/${id}/questions/${questionIdToSave}`, {
        questionText: updatedQuestion.questionText,
        questionType: updatedQuestion.questionType,
        options: updatedQuestion.options,
        correctAnswer: updatedQuestion.correctAnswer,
        imageUrl: updatedQuestion.imageUrl
      });

      const updatedQuestions = [...quiz.questions];
      const savedIndex = updatedQuestions.findIndex(q => q._id === questionIdToSave);
      if (savedIndex !== -1) {
          updatedQuestions[savedIndex] = response.data.updatedQuestion;
          setQuiz({ ...quiz, questions: updatedQuestions });
          setDirtyQuestions((prev) => prev.filter((index) => index !== savedIndex));
      } else {
          console.error("Saved question not found in local state after save.");
          // Consider refetching all data if state becomes inconsistent
          await fetchQuiz();
      }

    } catch (err) {
      console.error('Error saving question:', err);
      alert(`Error saving question: ${err.response?.data?.message || err.message}`);
    } finally {
      setSavingQuestionIndex(null);
    }
  };

  // Save all changes (Quiz meta + all questions)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSavingQuestionIndex('all');
    try {
      // Prepare payload - ensure questions have necessary fields
      const payload = {
          title: quiz.title,
          description: quiz.description,
          // Optionally filter/map questions if needed before sending
          questions: quiz.questions
      };
      await axios.put(`/api/quizzes/${id}`, payload);
      setSuccess(true);
      setDirtyQuestions([]);
      setTimeout(() => {
        setSuccess(false);
        navigate('/view-quizzes');
      }, 1500);
    } catch (err) {
      console.error('Error updating quiz:', err);
      alert(`Error saving quiz: ${err.response?.data?.message || err.message}`);
    } finally {
      setSavingQuestionIndex(null);
    }
  };
  // --- End Event Handlers ---


  // --- Render Logic ---

  // Loading State
  if (loading) {
    return (
      <div className="p-8 text-center">
        <PageHeader title="Loading Editor..." />
        <div className="text-gray-500 animate-pulse mt-8">Fetching quiz data...</div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="p-8">
         <PageHeader title="Error Loading Quiz" />
         <div className="text-center text-red-600 bg-red-100 p-4 rounded border border-red-300 mt-8">
           <p>{error}</p>
           <Link to="/view-quizzes" className="mt-4 inline-block text-blue-600 hover:underline">
             Go back to Quizzes list
           </Link>
         </div>
      </div>
    );
  }

  // Quiz Not Found (after loading finished)
  if (!quiz) {
     return (
      <div className="p-8">
         <PageHeader title="Quiz Not Found" />
         <div className="text-center text-gray-500 mt-8">
           <p>The quiz you are trying to edit could not be found.</p>
           <Link to="/view-quizzes" className="mt-4 inline-block text-blue-600 hover:underline">
             Go back to Quizzes list
           </Link>
         </div>
      </div>
    );
  }

  // Main Edit Form
  return (
    <div className="p-8">
      {/* Use the PageHeader component */}
      <PageHeader title="Edit Quiz" />

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-700 font-semibold border border-green-300">
          Quiz updated successfully! Redirecting...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quiz Title and Description */}
        <div className="p-4 border border-gray-300 rounded-lg bg-white shadow-sm space-y-3">
          <div>
            <label htmlFor="quizTitle" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              id="quizTitle"
              type="text"
              value={quiz.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={inputBaseClasses}
              disabled={savingQuestionIndex !== null}
              required
            />
          </div>
          <div>
            <label htmlFor="quizDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="quizDescription"
              value={quiz.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className={inputBaseClasses}
              rows="3"
              disabled={savingQuestionIndex !== null}
            />
          </div>
           {dirtyQuestions.includes('meta') && <span className="text-xs text-orange-600 font-semibold">Unsaved title/description changes</span>}
        </div>


        {/* Questions Section */}
        <h2 className="text-xl font-semibold text-gray-700 pt-4 mt-6">Questions</h2>
        <div className="space-y-6">
          {quiz.questions?.map((q, qIndex) => (
            <div key={q._id || qIndex} className={`border rounded-lg p-4 space-y-4 relative bg-white shadow-sm ${dirtyQuestions.includes(qIndex) ? 'border-orange-400' : 'border-gray-300'}`}>
               {dirtyQuestions.includes(qIndex) && <span className="absolute top-2 right-2 text-xs text-orange-600 font-semibold bg-white px-1 rounded">Unsaved</span>}

              {/* Question Header */}
              <p className="font-semibold text-lg text-gray-700">Question {qIndex + 1}</p>

              {/* Question Text */}
              <div>
                <label htmlFor={`qText-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                <input
                  id={`qText-${qIndex}`}
                  type="text"
                  className={inputBaseClasses}
                  value={q.questionText}
                  onChange={(e) => handleQuestionDetailChange(qIndex, 'questionText', e.target.value)}
                  disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all'}
                  required
                />
              </div>

              {/* Question Type */}
              <div>
                <label htmlFor={`qType-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                <select
                  id={`qType-${qIndex}`}
                  value={q.questionType || 'multiple-choice'}
                  onChange={(e) => handleQuestionDetailChange(qIndex, 'questionType', e.target.value)}
                  className={inputBaseClasses}
                  disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all'}
                >
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="true-false">True/False</option>
                  <option value="fill-in-the-blank">Fill in the Blank</option>
                  <option value="image-based">Image-Based</option>
                </select>
              </div>

              {/* Image URL */}
              {q.questionType === 'image-based' && (
                 <div>
                    <label htmlFor={`qImgUrl-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Image URL <span className="text-xs text-gray-500">(Optional)</span></label>
                    <input
                      id={`qImgUrl-${qIndex}`}
                      type="text"
                      className={inputBaseClasses}
                      value={q.imageUrl || ''}
                      placeholder="https://example.com/image.jpg or /generated-media/..."
                      onChange={(e) => handleQuestionDetailChange(qIndex, 'imageUrl', e.target.value)}
                      disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all'}
                    />
                     {/* Optional: Image Preview */}
                    {q.imageUrl && (
                        <img src={q.imageUrl} alt="Preview" className="mt-2 max-h-40 rounded border border-gray-200" onError={(e) => e.target.style.display='none'} onLoad={(e) => e.target.style.display='block'} />
                    )}
                 </div>
              )}

              {/* Options */}
              {(q.questionType === 'multiple-choice' || q.questionType === 'image-based') && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                  <div
                    className="space-y-2" // Changed to vertical stack
                    data-options-for={`question-${qIndex}`}
                  >
                    {(q.options || []).map((opt, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <span className="font-medium text-gray-500 w-6 text-right flex-shrink-0">{String.fromCharCode(65 + oIndex)}.</span>
                        <input
                          type="text"
                          className={inputSmallClasses} // Use smaller input style
                          value={opt}
                          onChange={(e) => handleQuestionDetailChange(qIndex, 'options', e.target.value, oIndex)}
                          disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all'}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(qIndex, oIndex)}
                          className={tertiaryLinkRedClasses}
                          disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all' || (q.options || []).length <= 1}
                          title="Remove this option" // Added title for accessibility
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addOption(qIndex)}
                    className={tertiaryLinkBlueClasses}
                    disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all' || (q.options || []).length >= 6}
                  >
                    + Add Option
                  </button>
                </div>
              )}

              {/* Correct Answer */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <label htmlFor={`qCorrect-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                {(q.questionType === 'multiple-choice' || q.questionType === 'true-false' || q.questionType === 'image-based') ? (
                  <select
                    id={`qCorrect-${qIndex}`}
                    className={inputBaseClasses}
                    value={q.correctAnswer || ''}
                    onChange={(e) => handleQuestionDetailChange(qIndex, 'correctAnswer', e.target.value)}
                    disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all'}
                    required
                  >
                    <option value="">Select Correct Answer</option>
                    {q.questionType === 'true-false' ? (
                      <>
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </>
                    ) : (
                      (q.options || []).map((opt, oIndex) => (
                        opt && <option key={oIndex} value={opt}>{opt}</option>
                      ))
                    )}
                  </select>
                ) : ( // Fill-in-the-blank
                  <input
                    id={`qCorrect-${qIndex}`}
                    type="text"
                    className={inputBaseClasses}
                    value={q.correctAnswer || ''}
                    onChange={(e) => handleQuestionDetailChange(qIndex, 'correctAnswer', e.target.value)}
                    disabled={savingQuestionIndex === qIndex || savingQuestionIndex === 'all'}
                    required
                  />
                )}
              </div>

              {/* Save Question Button */}
              <div className="flex justify-end border-t border-gray-200 pt-4 mt-4">
                 <button
                    type="button"
                    onClick={() => handleSaveQuestion(qIndex)}
                    className={saveQuestionButtonClasses} // Use primary blue style
                    disabled={!dirtyQuestions.includes(qIndex) || (savingQuestionIndex !== null)}
                  >
                    {savingQuestionIndex === qIndex ? (
                      <> {/* Loading Spinner */}
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Saving...
                      </>
                    ) : (
                      "Save Question"
                    )}
                  </button>
              </div>

            </div> // End Question Block
          ))}
        </div>

        {/* Save All / Cancel Buttons */}
        <div className="flex items-center gap-4 pt-6 border-t border-gray-200 mt-6">
          <button
            type="submit"
            className={saveAllButtonClasses} // Use primary blue style
            disabled={savingQuestionIndex !== null || dirtyQuestions.length === 0}
          >
            {savingQuestionIndex === 'all' ? (
              <> {/* Loading Spinner */}
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Saving All...
              </>
            ) : (
              "Save All Changes"
            )}
          </button>
           <button
              type="button"
              onClick={() => navigate('/view-quizzes')}
              className={secondaryButtonClasses} // Use secondary gray style
              disabled={savingQuestionIndex !== null}
            >
              Cancel
            </button>
        </div>
      </form>
    </div>
  );
}

export default EditQuiz;
