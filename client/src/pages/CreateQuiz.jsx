import { useState } from 'react';
import axios from 'axios';
import PageHeader from '../components/PageHeader'; // Import the PageHeader component

function CreateQuiz() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([
    { questionType: 'multiple-choice', questionText: '', options: ['', '', '', ''], correctAnswer: '', imageUrl: '' }
  ]);
  const [success, setSuccess] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // --- Define Consistent Button Styles ---

  // Primary (Blue - for Save Quiz)
  const primaryButtonClasses = "bg-[#2980b9] text-white px-6 py-2 rounded hover:bg-[#2573a6] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6]";

  // Secondary (Gray - for Add Another Question)
  const secondaryButtonClasses = "bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors duration-150";

  // Tertiary Link (Red - for Delete Question)
  const tertiaryLinkRedClasses = "text-red-600 hover:text-red-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 rounded";

  // --- End Button Styles ---

  // --- Event Handlers ---
  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index][field] = value;
    setQuestions(updatedQuestions);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const updatedQuestions = [...questions];
    // Ensure options array exists
    if (!updatedQuestions[qIndex].options) {
        updatedQuestions[qIndex].options = [];
    }
    // Pad options array if needed (though initial state should handle this)
    while (updatedQuestions[qIndex].options.length <= oIndex) {
        updatedQuestions[qIndex].options.push('');
    }
    updatedQuestions[qIndex].options[oIndex] = value;
    setQuestions(updatedQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, { questionType: 'multiple-choice', questionText: '', options: ['', '', '', ''], correctAnswer: '', imageUrl: '' }]);
  };

  const deleteQuestion = (index) => {
    // Prevent deleting the last question if desired
    // if (questions.length <= 1) {
    //   alert("You must have at least one question.");
    //   return;
    // }
    const updatedQuestions = [...questions];
    updatedQuestions.splice(index, 1);
    setQuestions(updatedQuestions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation example (can be more robust)
    if (!title.trim()) {
        alert("Please enter a quiz title.");
        return;
    }
    // Add more validation as needed for questions/options

    try {
      const quizData = { title, description, questions };
      console.log('Quiz Data to Send:', quizData);
      await axios.post('/api/quizzes', quizData);

      setSuccess('✅ Quiz created successfully!');
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);

      // Reset form fields
      setTitle('');
      setDescription('');
      setQuestions([{ questionType: 'multiple-choice', questionText: '', options: ['', '', '', ''], correctAnswer: '', imageUrl: '' }]);
    } catch (error) {
      console.error('Error creating quiz:', error);
      // TODO: Show user-friendly error message
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

  // --- End Event Handlers ---

  // Define Tailwind animation for fade in/out using arbitrary variants
  const successAnimation = `
    animate-[fadeInOut_3s_ease-in-out_forwards]
    keyframes-[fadeInOut]: {
      '0%': { opacity: 0, transform: 'translateY(-10px)' },
      '10%, 90%': { opacity: 1, transform: 'translateY(0)' },
      '100%': { opacity: 0, transform: 'translateY(-10px)' }
    }
  `;


  return (
    <div className="p-8">
      {/* Use the PageHeader component */}
      <PageHeader title="Create a New Quiz" />

      {/* Success Message */}
      {showSuccess && (
        <div
          className={`fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded shadow-lg ${successAnimation}`}
          key={success} // Re-trigger animation if message changes
        >
          {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Title Input */}
        <div>
          <label htmlFor="quizTitle" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            id="quizTitle"
            type="text"
            className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Description Input */}
        <div>
          <label htmlFor="quizDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            id="quizDescription"
            className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
          />
        </div>

        {/* Questions Loop */}
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="border border-gray-300 rounded p-4 space-y-4 bg-white shadow-sm"> {/* Added bg and shadow */}

            <div className="flex justify-between items-center">
                <p className="font-semibold text-lg text-gray-700">Question {qIndex + 1}</p>
                {/* Delete Button - Placed at top right of question block */}
                {questions.length > 1 && ( // Only show delete if more than one question exists
                    <button
                        type="button"
                        onClick={() => deleteQuestion(qIndex)}
                        className={tertiaryLinkRedClasses}
                    >
                        Delete Question
                    </button>
                )}
            </div>


            {/* Question Type Selector */}
            <div>
              <label htmlFor={`qType-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
              <select
                id={`qType-${qIndex}`}
                className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                value={q.questionType}
                onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                required
              >
                <option value="multiple-choice">Multiple Choice</option>
                <option value="true-false">True/False</option>
                <option value="fill-in-the-blank">Fill in the Blank</option>
                <option value="image-based">Image-Based</option>
              </select>
            </div>

            {/* Question Text Input */}
            <div>
              <label htmlFor={`qText-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
              <input
                id={`qText-${qIndex}`}
                type="text"
                className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                value={q.questionText}
                onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                required
              />
            </div>

            {/* --- Conditional Fields --- */}

            {/* Image URL (for image-based) */}
            {q.questionType === 'image-based' && (
              <div>
                <label htmlFor={`qImgUrl-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Image URL <span className="text-xs text-gray-500">(Optional)</span></label>
                <input
                  id={`qImgUrl-${qIndex}`}
                  type="url"
                  className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                  value={q.imageUrl || ''}
                  placeholder="https://example.com/image.jpg"
                  onChange={(e) => handleQuestionChange(qIndex, 'imageUrl', e.target.value)}
                />
                {/* Optional: Image Preview */}
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="Preview" className="mt-2 max-h-40 rounded border border-gray-200" onError={(e) => e.target.style.display='none'} onLoad={(e) => e.target.style.display='block'} />
                )}
              </div>
            )}

            {/* Options (for multiple-choice and image-based) */}
            {(q.questionType === 'multiple-choice' || q.questionType === 'image-based') && (
              <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3" data-options-for={`question-${qIndex}`}>
                  {(q.options || []).map((opt, oIndex) => ( // Ensure options exists
                    <div key={oIndex}>
                      <label htmlFor={`q-${qIndex}-opt-${oIndex}`} className="block text-xs text-gray-600 mb-0.5">Option {oIndex + 1}</label>
                      <input
                        id={`q-${qIndex}-opt-${oIndex}`}
                        type="text"
                        className="border border-gray-300 rounded w-full p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                        value={opt}
                        onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                        required // Options are usually required for MC
                      />
                      <button type="button" onClick={() => removeOption(qIndex, oIndex)} className={tertiaryLinkRedClasses + " mt-1"}>Remove Option</button>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => addOption(qIndex)} className={secondaryButtonClasses}>+ Add Option</button>
                  </div>
                </div>
                 {/* Correct Answer Select for MC/Image */}
                 <div>
                    <label htmlFor={`qCorrect-${qIndex}`} className="block text-xs text-gray-600 mb-0.5">Correct Answer</label>
                    <select
                      id={`qCorrect-${qIndex}`}
                      className="border border-gray-300 rounded w-full p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                      value={q.correctAnswer}
                      onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)}
                      required
                    >
                      <option value="">Select Correct Answer</option>
                      {(q.options || []).map((opt, oIndex) => (
                        opt && <option key={oIndex} value={opt}>{opt}</option> // Only show non-empty options
                      ))}
                    </select>
                  </div>
              </div>
            )}

            {/* Correct Answer (for true-false) */}
            {q.questionType === 'true-false' && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <label htmlFor={`qCorrect-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                <select
                  id={`qCorrect-${qIndex}`}
                  className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                  value={q.correctAnswer}
                  onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)}
                  required
                >
                  <option value="">Select</option>
                  <option value="True">True</option>
                  <option value="False">False</option>
                </select>
              </div>
            )}

            {/* Correct Answer (for fill-in-the-blank) */}
            {q.questionType === 'fill-in-the-blank' && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <label htmlFor={`qCorrect-${qIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Correct Answer(s) <span className="text-xs text-gray-500">(separate multiple with ';')</span></label>
                <input
                  id={`qCorrect-${qIndex}`}
                  type="text"
                  className="border border-gray-300 rounded w-full p-2 focus:outline-none focus:ring-2 focus:ring-[#2980b9] focus:border-transparent"
                  value={q.correctAnswer}
                  onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)}
                  required
                />
              </div>
            )}
            {/* --- End Conditional Fields --- */}

          </div> /* End Question Block */
        ))}

        {/* Form Action Buttons */}
        <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
            {/* Add Question Button */}
            <button
              type="button"
              onClick={addQuestion}
              className={secondaryButtonClasses} // Apply secondary style
            >
              + Add Question
            </button>

            {/* Save Quiz Button */}
            <button
              type="submit"
              className={primaryButtonClasses} // Apply primary style
            >
              Save Quiz
            </button>
        </div>

      </form>
    </div>
  );
}

export default CreateQuiz;